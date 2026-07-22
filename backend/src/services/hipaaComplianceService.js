/**
 * HIPAA Compliance Service
 * Implements role-based access control with PII masking according to HIPAA standards
 */

class HIPAAComplianceService {
  
  /**
   * HIPAA Privacy Levels - defines what PII can be accessed based on role
   */
  static PRIVACY_LEVELS = {
    FULL_ACCESS: {
      level: 'FULL',
      description: 'Complete access to all patient information',
      piiMasking: 'NONE',
      roles: ['ADMIN'],
      color: '#10b981'
    },
    
    CLINICAL_ACCESS: {
      level: 'CLINICAL',
      description: 'Access to clinical patient data for treatment',
      piiMasking: 'MASKED',
      roles: ['DOCTOR', 'NURSE'],
      color: '#3b82f6'
    },
    
    LIMITED_ACCESS: {
      level: 'LIMITED',
      description: 'Access to limited patient information with PII masking',
      piiMasking: 'HEAVY',
      roles: ['LAB_ASSISTANT', 'PHARMACIST', 'RECEPTIONIST'],
      color: '#f59e0b'
    },
    
    ADMIN_VIEW: {
      level: 'ADMIN_VIEW',
      description: 'Administrative access with masked PII for audit purposes',
      piiMasking: 'PARTIAL',
      roles: ['ADMIN'],
      color: '#8b5cf6'
    }
  };

  /**
   * PII Fields that require masking based on privacy level
   */
  static PII_FIELDS = {
    FULL_NAME: { field: 'name', mask: '***', requiredLevel: 'CLINICAL' },
    EMAIL: { field: 'email', mask: '***@***.com', requiredLevel: 'CLINICAL' },
    PHONE: { field: 'phone', mask: '***-***-****', requiredLevel: 'CLINICAL' },
    MRN: { field: 'mrn', mask: '***-***-***', requiredLevel: 'LIMITED' },
    ADDRESS: { field: 'address', mask: '*** ******', requiredLevel: 'LIMITED' },
    DOB: { field: 'dob', mask: '**/**/**', requiredLevel: 'LIMITED' },
    EMERGENCY_CONTACT: { field: 'guardian_phone', mask: '***-***-****', requiredLevel: 'LIMITED' },
    INSURANCE: { field: 'insurance_info', mask: '*** ******', requiredLevel: 'ADMIN_VIEW' },
    SSN: { field: 'ssn', mask: '***-**-****', requiredLevel: 'ADMIN_VIEW' },
    MEDICAL_HISTORY: { field: 'medical_history', mask: '***[RESTRICTED]***', requiredLevel: 'ADMIN_VIEW' }
  };

  /**
   * Get privacy level for a role
   */
  static getPrivacyLevel(role) {
    const levelConfig = Object.values(this.PRIVACY_LEVELS).find(config => 
      config.roles.includes(role.toUpperCase())
    );
    
    return levelConfig || this.PRIVACY_LEVELS.LIMITED_ACCESS;
  }

  /**
   * Apply PII masking to patient data based on user role
   */
  static maskPII(patientData, userRole, requestedFields = []) {
    const privacyLevel = this.getPrivacyLevel(userRole);
    const maskedData = { ...patientData };

    // Apply masking based on privacy level
    if (privacyLevel.level !== 'FULL') {
      Object.keys(this.PII_FIELDS).forEach(field => {
        if (maskedData[field] && this.PII_FIELDS[field].requiredLevel === privacyLevel.level) {
          const piiField = this.PII_FIELDS[field];
          maskedData[field] = piiField.mask;
        }
      });
    }

    // Only return requested fields if user has appropriate access
    const result = {};
    requestedFields.forEach(field => {
      if (this.canAccessField(field, userRole)) {
        result[field] = maskedData[field];
      } else {
        result[field] = '[ACCESS DENIED]';
      }
    });

    return result;
  }

  /**
   * Check if user can access specific field
   */
  static canAccessField(field, userRole) {
    const fieldConfig = this.PII_FIELDS[field];
    const userPrivacyLevel = this.getPrivacyLevel(userRole);
    
    if (!fieldConfig) return false;
    
    // Admin can access all fields
    if (userPrivacyLevel.level === 'FULL') return true;
    
    // Check if user's privacy level meets field requirements
    const requiredLevels = {
      'CLINICAL': ['CLINICAL', 'FULL'],
      'LIMITED': ['LIMITED', 'CLINICAL', 'FULL'],
      'ADMIN_VIEW': ['ADMIN_VIEW', 'CLINICAL', 'FULL']
    };

    return requiredLevels[userPrivacyLevel.level]?.includes(fieldConfig.requiredLevel) || false;
  }

  /**
   * Get role-based menu access
   */
  static getMenuAccess(userRole, menuPath) {
    const privacyLevel = this.getPrivacyLevel(userRole);
    
    const menuAccessMap = {
      // Clinical menus - Doctors and Nurses only
      '/tenant/opd/consultation': ['CLINICAL', 'FULL'],
      '/tenant/opd/queue': ['CLINICAL', 'FULL'],
      '/tenant/ipd/admission-desk': ['CLINICAL', 'FULL'],
      '/tenant/ipd/beds': ['CLINICAL', 'FULL'],
      '/tenant/ipd/admissions': ['CLINICAL', 'FULL'],
      '/tenant/ipd/discharge': ['CLINICAL', 'FULL'],
      
      // Lab menus - Lab Assistants only
      '/tenant/lab': ['LIMITED', 'CLINICAL', 'FULL'],
      '/tenant/lab/billing': ['LIMITED', 'CLINICAL', 'FULL'],
      
      // Pharmacy menus - Pharmacists only
      '/tenant/pharmacy/dashboard': ['LIMITED', 'CLINICAL', 'FULL'],
      '/tenant/pharmacy/inventory': ['LIMITED', 'CLINICAL', 'FULL'],
      '/tenant/pharmacy/queue': ['LIMITED', 'CLINICAL', 'FULL'],
      
      // Front office menus - Receptionists only
      '/tenant/opd/registration': ['LIMITED', 'CLINICAL', 'FULL'],
      '/tenant/appointments': ['LIMITED', 'CLINICAL', 'FULL'],
      
      // Management menus - Admin only (with PII masking)
      '/tenant/staff': ['ADMIN_VIEW', 'FULL'],
      '/tenant/staff/user-management': ['ADMIN_VIEW', 'FULL'],
      '/tenant/masters': ['ADMIN_VIEW', 'FULL'],
      '/tenant/settings': ['ADMIN_VIEW', 'FULL'],
      '/tenant/billing': ['ADMIN_VIEW', 'FULL'],
      '/tenant/billing/insurance': ['ADMIN_VIEW', 'FULL']
    };

    const allowedRoles = menuAccessMap[menuPath] || [];
    return allowedRoles.includes(privacyLevel.level);
  }

  /**
   * Generate audit log entry for access attempt
   */
  static createAuditEntry(userId, action, resource, details, ipAddress, userAgent) {
    return {
      id: require('crypto').randomUUID(),
      user_id: userId,
      action, // 'VIEW_PATIENT', 'ACCESS_DENIED', 'ROLE_CHANGE', etc.
      resource, // '/patient/123', 'user-management', etc.
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
      risk_level: this.calculateRiskLevel(action, resource)
    };
  }

  /**
   * Calculate risk level for audit purposes
   */
  static calculateRiskLevel(action, resource) {
    const highRiskActions = ['DELETE_PATIENT', 'MODIFY_ROLES', 'EXPORT_PATIENT_DATA'];
    const sensitiveResources = ['patient', 'user-management', 'rbac'];
    
    if (highRiskActions.includes(action) && sensitiveResources.some(r => resource.includes(r))) {
      return 'HIGH';
    }
    
    if (action.includes('ACCESS_DENIED')) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  /**
   * HIPAA compliance validation
   */
  static validateCompliance(userRole, action, resource) {
    const violations = [];
    
    // Check minimum necessary rule
    if (!this.getMenuAccess(userRole, resource)) {
      violations.push(`User ${userRole} lacks access to ${resource}`);
    }
    
    // Check PII exposure
    const privacyLevel = this.getPrivacyLevel(userRole);
    if (privacyLevel.piiMasking !== 'NONE' && action.includes('VIEW_PATIENT')) {
      violations.push(`PII exposure detected for role ${userRole}`);
    }
    
    return {
      isCompliant: violations.length === 0,
      violations,
      privacyLevel: privacyLevel.level
    };
  }
}

module.exports = HIPAAComplianceService;
