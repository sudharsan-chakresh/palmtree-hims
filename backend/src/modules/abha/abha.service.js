const axios = require('axios');
const crypto = require('crypto');

// ABDM API ARCHITECTURE (as of 2024-2026):
// - Sessions (auth):  https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions (new)
//                     https://dev.abdm.gov.in/gateway/v0.5/sessions           (also works)
// - ABHA APIs:        https://abhasbx.abdm.gov.in/abha/api/v3/...
//   • Public Cert:    GET  /v3/profile/public/certificate
//   • Generate OTP:   POST /v3/enrollment/request/otp
//   • Verify OTP:     POST /v3/enrollment/enrol/byAadhaar
//   • Mobile Search:  POST /v3/enrollment/request/otp  (with loginHint: 'mobile')
// All ABHA API calls REQUIRE headers: REQUEST-ID, TIMESTAMP, X-CM-ID: sbx, Authorization

class ABHAService {
  constructor() {
    // Gateway used only for session token
    this.gatewayUrl = process.env.ABDM_GATEWAY_URL || 'https://dev.abdm.gov.in/gateway';
    // Separate base URL for ABHA V3 APIs
    this.abhaApiUrl = 'https://abhasbx.abdm.gov.in/abha/api';

    this.clientId = process.env.ABDM_CLIENT_ID;
    this.clientSecret = process.env.ABDM_CLIENT_SECRET;
    this.token = null;
    this.tokenExpiry = null;

    // Auto-detect Demo Mode if credentials are placeholders or flag is set
    this.isDemoMode = process.env.ABHA_DEMO_MODE === 'true' ||
                      !this.clientId ||
                      !this.clientSecret ||
                      this.clientId.includes('000123') ||
                      this.clientSecret.includes('xxxx');

    if (this.isDemoMode) {
      console.log('----------------------------------------------------');
      console.log('[ABHA SERVICE] RUNNING IN DEMO / SIMULATION MODE');
      console.log('[ABHA SERVICE] Mock data will be returned for testing');
      console.log('----------------------------------------------------');
    } else {
      console.log('[ABHA SERVICE] Live mode — connecting to ABDM Sandbox');
      console.log(`[ABHA SERVICE] Gateway: ${this.gatewayUrl}`);
      console.log(`[ABHA SERVICE] ABHA API: ${this.abhaApiUrl}`);
    }
  }

  // ---------------------------------------------------------------
  // Session Token (v0.5 gateway — still valid for auth)
  // ---------------------------------------------------------------
  async getSessionToken() {
    if (this.isDemoMode) return 'demo-token-123';

    if (this.token && this.tokenExpiry > Date.now()) {
      return this.token;
    }

    try {
      const response = await axios.post(`${this.gatewayUrl}/v0.5/sessions`, {
        clientId: this.clientId,
        clientSecret: this.clientSecret
      });
      this.token = response.data.accessToken;
      // Subtract 60 s to refresh before expiry
      this.tokenExpiry = Date.now() + (response.data.expiresIn * 1000) - 60000;
      return this.token;
    } catch (error) {
      console.error('[ABHA] Session Error:', error.response?.data || error.message);
      throw new Error('Could not connect to ABDM Gateway. Check credentials in .env');
    }
  }

  // ---------------------------------------------------------------
  // Shared ABHA API headers builder
  // ---------------------------------------------------------------
  _buildAbhaHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      'REQUEST-ID': crypto.randomUUID(),
      TIMESTAMP: new Date().toISOString(),
      'X-CM-ID': 'sbx',
      'Content-Type': 'application/json'
    };
  }

  // ---------------------------------------------------------------
  // Fetch the ABHA V3 public RSA certificate (OAEP)
  // Returns the raw base64 public key string
  // ---------------------------------------------------------------
  async fetchCert() {
    if (this.isDemoMode) return 'demo-cert';

    const token = await this.getSessionToken();
    try {
      const response = await axios.get(
        `${this.abhaApiUrl}/v3/profile/public/certificate`,
        { headers: this._buildAbhaHeaders(token) }
      );
      // response.data.publicKey is a base64-encoded DER public key
      return response.data.publicKey;
    } catch (error) {
      console.error('[ABHA] Cert fetch error:', error.response?.data || error.message);
      throw new Error('Failed to fetch ABHA public certificate from ABDM');
    }
  }

  // ---------------------------------------------------------------
  // Encrypt sensitive data using OAEP (required by ABDM V3)
  // ---------------------------------------------------------------
  async encrypt(data, publicKeyBase64) {
    if (this.isDemoMode) return data; // No encryption in demo mode

    try {
      // Convert base64 DER → PEM
      const pemKey = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;

      const buffer = Buffer.from(data, 'utf8');
      const encrypted = crypto.publicEncrypt(
        {
          key: pemKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha1'   // ABDM spec: OAEPWithSHA-1AndMGF1Padding
        },
        buffer
      );
      return encrypted.toString('base64');
    } catch (err) {
      console.error('[ABHA] Encryption Error:', err.message);
      throw new Error('Encryption failed: ' + err.message);
    }
  }

  // ---------------------------------------------------------------
  // Generate OTP via Aadhaar (ABDM V3 Enrollment API)
  // POST /v3/enrollment/request/otp
  // ---------------------------------------------------------------
  async generateAadhaarOtp(aadhaarNumber) {
    if (this.isDemoMode) {
      console.log(`[ABHA DEMO] Generating OTP for Aadhaar ending ${aadhaarNumber.slice(-4)}`);
      return { txnId: 'demo-txn-' + Date.now() };
    }

    const token = await this.getSessionToken();
    const publicKey = await this.fetchCert();
    const encryptedAadhaar = await this.encrypt(aadhaarNumber, publicKey);

    try {
      const response = await axios.post(
        `${this.abhaApiUrl}/v3/enrollment/request/otp`,
        {
          txnId: '',
          scope: ['abha-enrol'],
          loginHint: 'aadhaar',
          loginId: encryptedAadhaar,
          otpSystem: 'aadhaar'
        },
        { headers: this._buildAbhaHeaders(token) }
      );
      const data = response.data;
      // Log the full response so we can see exact field names ABDM returns
      console.log('[ABHA] Generate OTP response:', JSON.stringify(data));
      // ABDM may return txnId at root level or nested — extract safely
      const txnId = data.txnId || data.transactionId || data.t_id || '';
      if (!txnId) {
        console.warn('[ABHA] WARNING: No txnId found in response! Keys:', Object.keys(data));
      }
      return { txnId, message: data.message || 'OTP sent' };

    } catch (error) {
      console.error('[ABHA] Generate OTP Error:', error.response?.data || error.message);
      const errData = error.response?.data;
      // ABDM V3 wraps errors as { error: { code, message } }
      const errMsg = errData?.error?.message || errData?.message || errData?.loginId || 'OTP generation failed';
      throw new Error(errMsg);
    }
  }

  // ---------------------------------------------------------------
  // Verify Aadhaar OTP and enrol / fetch ABHA profile (ABDM V3)
  // POST /v3/enrollment/enrol/byAadhaar
  //
  // Per ABDM V3 spec, the full payload is:
  //   authData.otp.txnId    — txnId returned from request/otp
  //   authData.otp.otpValue — RSA-OAEP encrypted OTP string
  //   authData.otp.mobile   — optional: encrypted mobile if linking different mobile
  //   consent.code          — 'abha-enrollment'
  //   consent.version       — '1.4'
  // ---------------------------------------------------------------
  async verifyAadhaarOtp(otp, txnId, mobile) {
    if (this.isDemoMode) {
      console.log(`[ABHA DEMO] Verifying OTP ${otp} for txn ${txnId}`);
      return {
        healthIdNumber: '91-1234-5678-9012',
        healthId: 'selvakumar@abha',
        name: 'Selvakumar Balakrishnan',
        gender: 'M',
        dayOfBirth: '15',
        monthOfBirth: '06',
        yearOfBirth: '1985',
        address: '123, Apollo Greams Road, Chennai, Tamil Nadu',
        stateName: 'Tamil Nadu',
        districtName: 'Chennai'
      };
    }

    const token = await this.getSessionToken();
    const publicKey = await this.fetchCert();
    const encryptedOtp = await this.encrypt(otp, publicKey);

    const otpObj = {
      txnId: txnId,
      otpValue: encryptedOtp
    };

    if (mobile) {
      // ABDM V3 validator strictly checks for a 10-digit string format matching Indian mobile regex (e.g. ^[6-9][0-9]{9}$).
      // RSA-encrypting it creates a 344-character base64 string, causing schema validation to fail with "Invalid Mobile Number".
      // We must pass it as a plain unencrypted 10-digit string.
      otpObj.mobile = mobile;
    }

    try {
      console.log('[ABHA] Sending verify OTP request: txnId=', txnId, '| encOtp length=', encryptedOtp.length, '| mobile=', mobile);
      const response = await axios.post(
        `${this.abhaApiUrl}/v3/enrollment/enrol/byAadhaar`,
        {
          authData: {
            authMethods: ['otp'],
            otp: otpObj
          },
          consent: {
            code: 'abha-enrollment',
            version: '1.4'
          }
        },
        { headers: this._buildAbhaHeaders(token) }
      );

      const d = response.data;
      console.log('[ABHA] Verify OTP success, raw response keys:', Object.keys(d));

      // Normalise V3 response — ABDM may return ABHANumber or healthIdNumber
      return {
        healthIdNumber: d.ABHANumber || d.abhaNumber || d.healthIdNumber || '',
        healthId: d.preferredAbhaAddress || d.phrAddress || d.healthId || '',
        name: d.name || '',
        gender: d.gender || '',
        dayOfBirth: d.dayOfBirth || '',
        monthOfBirth: d.monthOfBirth || '',
        yearOfBirth: d.yearOfBirth || '',
        address: d.address || '',
        stateName: d.stateName || '',
        districtName: d.districtName || '',
        status: d.ABHAStatus || d.status || 'ACTIVE'
      };
    } catch (error) {
      const errData = error.response?.data;
      console.error('[ABHA] Verify OTP Error encountered:', JSON.stringify(errData || error.message));

      // Throw a helpful error if it is a mobile mismatch
      const isMobileMismatch = errData && (
        errData.mobile === 'Invalid Mobile Number' ||
        (typeof errData.error?.message === 'string' && errData.error.message.includes('Mobile')) ||
        (typeof errData.message === 'string' && errData.message.includes('Mobile'))
      );

      if (isMobileMismatch) {
        throw new Error('Aadhaar Mobile Mismatch: The entered mobile number does not match the one registered with this Aadhaar card. Please enter the actual 10-digit Aadhaar-registered mobile number.');
      }

      // ABDM returns structured errors in several formats
      const errMsg =
        errData?.error?.message ||      // { error: { code, message } }
        errData?.message ||             // { message: '...' }
        errData?.details?.message ||    // { details: { message } }
        errData?.otp ||                 // field-level: { otp: 'Invalid OTP' }
        errData?.txnId ||               // field-level: { txnId: 'Invalid..' }
        'OTP verification failed';
      throw new Error(errMsg);
    }
  }

  // ---------------------------------------------------------------
  // Discovery by Mobile (search existing ABHA)
  // POST /v3/enrollment/request/otp with loginHint: 'mobile'
  // ---------------------------------------------------------------
  async searchByMobile(mobile) {
    if (this.isDemoMode) {
      console.log(`[ABHA DEMO] Searching for ABHA by mobile: ${mobile}`);
      if (mobile.startsWith('9')) {
        return {
          healthIds: [
            { healthIdNumber: '91-1234-5678-9012', name: 'Selvakumar Balakrishnan', healthId: 'selvakumar@abha' }
          ]
        };
      }
      return { healthIds: [] };
    }

    const token = await this.getSessionToken();
    const publicKey = await this.fetchCert();
    const encryptedMobile = await this.encrypt(mobile, publicKey);

    try {
      const response = await axios.post(
        `${this.abhaApiUrl}/v3/enrollment/request/otp`,
        {
          txnId: '',
          scope: ['abha-login', 'mobile-verify'],
          loginHint: 'mobile',
          loginId: encryptedMobile,
          otpSystem: 'abdm'
        },
        { headers: this._buildAbhaHeaders(token) }
      );

      // V3 returns a txnId for mobile OTP flow — wrap so frontend handles it
      return {
        txnId: response.data.txnId,
        healthIds: [],   // populated after mobile OTP verify
        message: response.data.message || 'OTP sent to mobile'
      };
    } catch (error) {
      console.error('[ABHA] Mobile search error:', error.response?.data || error.message);
      // Graceful degradation: return empty result instead of crashing
      return { healthIds: [] };
    }
  }
}

module.exports = new ABHAService();
