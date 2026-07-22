import { useState } from 'react';
import axios from 'axios';
import { Zap, Heart, FlaskConical, Pill, Upload, FileText, Loader2 } from 'lucide-react';
import { API_BASE_URL as API_BASE } from "../../../../config/api";

interface ClinicalHistoryTabProps {
  patient: any;
  pastLabs: any[];
  pastMeds: any[];
  onRefresh?: () => void;
}

export default function ClinicalHistoryTab({ patient, pastLabs, pastMeds, onRefresh }: ClinicalHistoryTabProps) {
  const [uploadType, setUploadType] = useState<'lab' | 'prescription'>('lab');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDate, setUploadDate] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openingDocumentUrl, setOpeningDocumentUrl] = useState<string | null>(null);

  const displayValue = (value: any, fallback = '-') => {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value);
  };

  const getAttachmentUrl = (record: any) => {
    return record?.attachment_url || record?.report_url || record?.file_url || record?.document_url || record?.pdf_path || record?.file_path || record?.prescription_url || record?.url || null;
  };

  const getAttachmentLabel = (record: any, fallback = 'View attachment') => {
    return record?.file_name || record?.title || record?.name || fallback;
  };

  const getAbsoluteAttachmentUrl = (url: string) => {
    if (/^https?:\/\//i.test(url)) return url;

    const path = url.startsWith('/') ? url : `/${url}`;
    const base = API_BASE.replace(/\/+$/, '');

    if (!base) return path;
    if (base.endsWith('/api')) {
      return `${base.slice(0, -4)}${path}`;
    }
    return `${base}${path}`;
  };

  const openAttachment = async (url: string) => {
    const absoluteUrl = getAbsoluteAttachmentUrl(url);
    const documentWindow = window.open('', '_blank');

    if (!documentWindow) {
      alert('Please allow pop-ups for Palmtree Wellness to view this document.');
      return;
    }

    documentWindow.document.title = 'Loading document...';
    documentWindow.document.body.textContent = 'Loading document...';
    setOpeningDocumentUrl(url);

    try {
      const response = await axios.get(absoluteUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'x-tenant-id': localStorage.getItem('tenant') || ''
        },
        responseType: 'blob'
      });
      const objectUrl = URL.createObjectURL(response.data);
      documentWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: any) {
      documentWindow.close();

      let message = 'Unable to open this document.';
      const errorBlob = error?.response?.data;
      if (errorBlob instanceof Blob) {
        try {
          const payload = JSON.parse(await errorBlob.text());
          message = payload?.error || message;
        } catch {
          // Keep the user-friendly fallback for non-JSON server responses.
        }
      }
      alert(message);
    } finally {
      setOpeningDocumentUrl(null);
    }
  };

  const renderAttachmentLink = (record: any) => {
    const url = getAttachmentUrl(record);
    if (!url) return null;
    const label = getAttachmentLabel(record, 'View document');
    const isOpening = openingDocumentUrl === url;

    return (
      <button
        type="button"
        disabled={isOpening}
        onClick={() => openAttachment(url)}
        style={{
          marginTop: '8px',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: 'none',
          background: 'none',
          fontSize: '12px',
          fontWeight: 800,
          color: '#3b82f6',
          textDecoration: 'underline',
          cursor: isOpening ? 'wait' : 'pointer'
        }}
      >
        {isOpening
          ? <Loader2 size={12} className="animate-spin" />
          : <FileText size={12} />}
        {isOpening ? 'Opening document...' : label}
      </button>
    );
  };

  const getMedicationItems = (encounter: any) => {
    if (Array.isArray(encounter?.prescriptions)) return encounter.prescriptions;
    if (Array.isArray(encounter?.prescription_items)) return encounter.prescription_items;
    if (Array.isArray(encounter?.items)) return encounter.items;
    return [];
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("Please select a file to upload.");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("recordType", uploadType);
    formData.append("title", uploadTitle);
    formData.append("recordDate", uploadDate);

    try {
      const getHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-tenant-id": localStorage.getItem("tenant") || ""
      });
      await axios.post(`${API_BASE}/api/hospital/patients/${patient.id}/past-records`, formData, {
        headers: {
          ...getHeaders(),
          "Content-Type": "multipart/form-data"
        }
      });
      alert("Past record uploaded successfully!");
      setUploadTitle('');
      setUploadDate('');
      setUploadFile(null);
      const fileInput = document.getElementById("past-record-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to upload past record.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
      <div className="page-card" style={{ padding: '24px', borderRadius: '24px', background: '#0f172a', color: 'white', height: 'fit-content' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 900, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
          <Zap size={14} fill="currentColor" /> Patient Profile
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Allergies</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {patient?.allergies ? (
                patient.allergies.split(',').map((allergy: string, i: number) => (
                  <span key={i} style={{ background: '#ef4444', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>
                    {allergy.trim()}
                  </span>
                ))
              ) : (
                <span style={{ color: '#475569', fontSize: '12px' }}>No known allergies</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Medical History</div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', fontSize: '12px', lineHeight: '1.6', color: '#94a3b8' }}>
              {patient?.medical_history || 'No significant history recorded'}
            </div>
          </div>

          <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '16px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Heart size={14} color="#3b82f6" />
                <span style={{ fontSize: '11px', fontWeight: 900, color: '#3b82f6' }}>AI RISK SCORE</span>
             </div>
             <div style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>Low <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>Risk</span></div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />
          
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
              <Upload size={14} /> Upload Past Record
            </div>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>RECORD TYPE</label>
                <select 
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: 'white', fontSize: '12px' }}
                  value={uploadType} 
                  onChange={e => setUploadType(e.target.value as any)}
                >
                  <option value="lab">Lab Report</option>
                  <option value="prescription">Prescription</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>TITLE / DIAGNOSIS</label>
                <input 
                  required 
                  placeholder={uploadType === 'lab' ? "e.g. Blood Test Report" : "e.g. Chronic Asthma"}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: 'white', fontSize: '12px' }}
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>RECORD DATE</label>
                <input 
                  type="date"
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: 'white', fontSize: '12px' }}
                  value={uploadDate}
                  onChange={e => setUploadDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>SELECT FILE</label>
                <input 
                  id="past-record-file-input"
                  required
                  type="file"
                  accept=".pdf,image/*"
                  style={{ width: '100%', fontSize: '11px', color: '#94a3b8' }}
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>

              <button 
                type="submit" 
                disabled={isUploading}
                style={{ 
                  width: '100%', padding: '10px', borderRadius: '8px', background: '#10b981', color: 'white', 
                  border: 'none', fontWeight: 800, fontSize: '12px', cursor: 'pointer', marginTop: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {isUploading ? 'Uploading...' : 'Upload Record'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <div className="page-card" style={{ padding: '24px', borderRadius: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FlaskConical size={18} color="#3b82f6" /> Past Laboratory Investigations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {pastLabs.length > 0 ? (
                 pastLabs.slice(0, 5).map((lab, i) => (
                   <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{lab.test_name}</div>
                        {renderAttachmentLink(lab)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <span style={{ fontSize: '11px', color: '#64748b' }}>{new Date(lab.created_at).toLocaleDateString()}</span>
                         <span style={{ fontSize: '11px', fontWeight: 800, color: lab.status === 'Completed' ? '#10b981' : '#f59e0b' }}>{lab.status}</span>
                      </div>
                   </div>
                 ))
               ) : (
                 <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No previous lab records found</div>
               )}
            </div>
         </div>

         <div className="page-card" style={{ padding: '24px', borderRadius: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Pill size={18} color="#10b981" /> Past Medication Regimen
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {pastMeds.length > 0 ? (
                 pastMeds.slice(0, 3).map((med, i) => {
                  const medicationItems = getMedicationItems(med);
                  return (
                   <div key={i} style={{ padding: '16px', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#166534', marginBottom: '4px' }}>Diagnosis: {displayValue(med.diagnosis, 'Not recorded')}</div>
                      <div style={{ fontSize: '12px', color: '#15803d', marginBottom: medicationItems.length ? '12px' : 0 }}>Visited: {new Date(med.created_at).toLocaleDateString()}</div>
                      {medicationItems.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {medicationItems.map((item: any, itemIndex: number) => (
                            <div key={`${i}-${itemIndex}`} style={{ padding: '10px 12px', background: 'white', border: '1px solid #bbf7d0', borderRadius: '12px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#14532d' }}>
                                {displayValue(item.name || item.drug_name || item.medicine_name, 'Medicine')}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '11px', color: '#15803d', fontWeight: 700 }}>
                                <span>{displayValue(item.dosage)}</span>
                                <span>{displayValue(item.frequency)}</span>
                                <span>{displayValue(item.duration)} days</span>
                                {item.instructions && <span>{item.instructions}</span>}
                              </div>
                              {renderAttachmentLink(item)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#65a30d', fontWeight: 600 }}>No medicines recorded for this visit</div>
                      )}
                      {renderAttachmentLink(med)}
                   </div>
                  );
                 })
               ) : (
                 <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No previous medication records found</div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
