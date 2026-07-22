import { useEffect, useState, useRef } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Requisition {
  id: number;
  position_title: string;
  department: string;
  required_skills: string;
  experience_required: number;
  employment_type: string;
  status: string;
  created_at: string;
}

interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
  resume_text: string;
  applied_position: string;
  status: string;
  created_at: string;
}

interface MatchResult {
  candidate_id: number;
  candidate_name: string;
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  rationale: string;
}

// ─── Score colour helper ──────────────────────────────────────────────────────
const scoreColor = (score: number) => {
  if (score >= 75) return { bg: '#dcfce7', color: '#16a34a', label: 'Strong Match' };
  if (score >= 50) return { bg: '#fef9c3', color: '#ca8a04', label: 'Partial Match' };
  if (score >= 30) return { bg: '#ffedd5', color: '#ea580c', label: 'Weak Match' };
  return { bg: '#fee2e2', color: '#dc2626', label: 'Poor Match' };
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    open:       { bg: '#dcfce7', color: '#16a34a' },
    pending:    { bg: '#fef9c3', color: '#ca8a04' },
    approved:   { bg: '#dbeafe', color: '#1d4ed8' },
    rejected:   { bg: '#fee2e2', color: '#dc2626' },
    closed:     { bg: '#f1f5f9', color: '#64748b' },
    shortlisted:{ bg: '#ede9fe', color: '#7c3aed' },
    hired:      { bg: '#dcfce7', color: '#16a34a' },
  };
  return map[status?.toLowerCase()] || { bg: '#f1f5f9', color: '#64748b' };
};

export default function RecruitmentHubPage() {
  const [activeTab, setActiveTab] = useState<'requisitions' | 'candidates' | 'matcher'>('requisitions');

  // ── Requisitions ──────────────────────────────────────────────────────────
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [showReqModal, setShowReqModal] = useState(false);
  const [isEditingReq, setIsEditingReq] = useState(false);
  const [editReqId, setEditReqId] = useState<number | null>(null);
  const [reqForm, setReqForm] = useState({
    position_title: '', department: '', required_skills: '',
    experience_required: 0, employment_type: 'Permanent',
    jd_text: '', status: 'pending'
  });

  // ── Candidates ────────────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candLoading, setCandLoading] = useState(true);
  const [showCandModal, setShowCandModal] = useState(false);
  const [candForm, setCandForm] = useState({
    name: '', email: '', phone: '', applied_position: '', resume_text: ''
  });
  const fileRef = useRef<HTMLInputElement>(null);

  // ── JD Matcher ────────────────────────────────────────────────────────────
  const [selectedReqId, setSelectedReqId] = useState<number | ''>('');
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState('');

  // ── Departments (from master table) ──────────────────────────────────────
  const [departments, setDepartments] = useState<string[]>([]);

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRequisitions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/requisitions`, { headers: getHeaders() });
      setRequisitions(res.data || []);
    } catch (e) { console.error(e); }
    finally { setReqLoading(false); }
  };

  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/candidates`, { headers: getHeaders() });
      setCandidates(res.data || []);
    } catch (e) { console.error(e); }
    finally { setCandLoading(false); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/masters/departments`, { headers: getHeaders() });
      const names = (res.data || []).map((d: any) => d.name).filter(Boolean);
      if (names.length > 0) setDepartments(names);
    } catch {
      setDepartments(['General Medicine', 'Cardiology', 'Dermatology', 'ENT', 'Gastroenterology',
        'Gynecology', 'Nephrology', 'Neurology', 'Oncology', 'Ophthalmology',
        'Orthopedics', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery', 'Urology',
        'ICU', 'Emergency', 'Pharmacy', 'Laboratory', 'Administration']);
    }
  };

  useEffect(() => {
    fetchRequisitions();
    fetchCandidates();
    fetchDepartments();
  }, []);

  // ── Requisition Handlers ──────────────────────────────────────────────────
  const openAddReq = () => {
    setReqForm({ position_title: '', department: '', required_skills: '', experience_required: 0, employment_type: 'Permanent', jd_text: '', status: 'pending' });
    setIsEditingReq(false);
    setEditReqId(null);
    setShowReqModal(true);
  };

  const openEditReq = (r: Requisition) => {
    setReqForm({
      position_title: r.position_title, department: r.department,
      required_skills: r.required_skills, experience_required: r.experience_required,
      employment_type: r.employment_type, jd_text: (r as any).jd_text || '',
      status: r.status
    });
    setIsEditingReq(true);
    setEditReqId(r.id);
    setShowReqModal(true);
  };

  const handleReqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingReq && editReqId) {
        await axios.put(`${API_BASE}/api/hospital/requisitions/${editReqId}`, reqForm, { headers: getHeaders() });
        alert("Requisition updated!");
      } else {
        await axios.post(`${API_BASE}/api/hospital/requisitions`, reqForm, { headers: getHeaders() });
        alert("Requisition created and sent for approval!");
      }
      setShowReqModal(false);
      fetchRequisitions();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save requisition");
    }
  };

  const handleApproveReject = async (id: number, action: 'approved' | 'rejected') => {
    try {
      await axios.put(`${API_BASE}/api/hospital/requisitions/${id}`, { status: action }, { headers: getHeaders() });
      fetchRequisitions();
    } catch { alert("Action failed"); }
  };

  const handleDeleteReq = async (id: number) => {
    if (!window.confirm("Delete this requisition?")) return;
    try {
      await axios.delete(`${API_BASE}/api/hospital/requisitions/${id}`, { headers: getHeaders() });
      fetchRequisitions();
    } catch { alert("Delete failed"); }
  };

  // ── Candidate Handlers ────────────────────────────────────────────────────
  const handleCandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/hospital/candidates`, candForm, { headers: getHeaders() });
      alert("Candidate profile saved!");
      setShowCandModal(false);
      fetchCandidates();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save candidate");
    }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCandForm(prev => ({ ...prev, resume_text: (ev.target?.result as string) || '' }));
    };
    reader.readAsText(file);
  };

  const handleUpdateCandStatus = async (id: number, status: string) => {
    try {
      await axios.put(`${API_BASE}/api/hospital/candidates/${id}`, { status }, { headers: getHeaders() });
      fetchCandidates();
    } catch { alert("Status update failed"); }
  };

  // ── JD Matcher ────────────────────────────────────────────────────────────
  const handleMatch = async () => {
    if (!selectedReqId) { setMatchError("Please select a requisition to match against."); return; }
    setIsMatching(true);
    setMatchError('');
    setMatchResults([]);
    try {
      const res = await axios.post(
        `${API_BASE}/api/hospital/requisitions/${selectedReqId}/match`,
        {},
        { headers: getHeaders() }
      );
      setMatchResults(res.data || []);
      if ((res.data || []).length === 0) setMatchError("No candidates found to match. Add candidates first.");
    } catch (err: any) {
      setMatchError(err.response?.data?.error || "Matching failed. Please try again.");
    } finally {
      setIsMatching(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const openReqs = requisitions.filter(r => r.status === 'open' || r.status === 'approved').length;
  const pendingApproval = requisitions.filter(r => r.status === 'pending').length;
  const totalCandidates = candidates.length;
  const shortlisted = candidates.filter(c => c.status === 'shortlisted' || c.status === 'hired').length;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Recruitment Hub" />

        {/* ── Stats Row ── */}
        <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '32px' }}>
          {[
            { label: 'Open Positions', value: openReqs, color: '#16a34a', icon: '📋' },
            { label: 'Pending Approval', value: pendingApproval, color: '#d97706', icon: '⏳' },
            { label: 'Total Candidates', value: totalCandidates, color: '#3b82f6', icon: '👤' },
            { label: 'Shortlisted / Hired', value: shortlisted, color: '#7c3aed', icon: '⭐' },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
                <span style={{ fontSize: '20px' }}>{s.icon}</span>
              </div>
              <h3 style={{ fontSize: '28px', fontWeight: 900, margin: 0, color: s.color }}>{s.value}</h3>
            </div>
          ))}
        </div>

        {/* ── Tab Navigation ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
          {[
            { key: 'requisitions', label: '📋 Requisitions' },
            { key: 'candidates',   label: '👤 Candidates' },
            { key: 'matcher',      label: '🤖 AI JD Matcher' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              background: activeTab === tab.key ? 'white' : 'transparent',
              color: activeTab === tab.key ? '#0f172a' : '#64748b',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: REQUISITIONS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'requisitions' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={openAddReq} className="button-primary">+ New Requisition</button>
            </div>

            {/* Pending Approvals Banner */}
            {pendingApproval > 0 && (
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: '16px', padding: '16px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>⏳</span>
                <div>
                  <strong style={{ color: '#854d0e' }}>{pendingApproval} requisition{pendingApproval > 1 ? 's' : ''} awaiting approval.</strong>
                  <span style={{ color: '#92400e', fontSize: '13px', marginLeft: '8px' }}>Review and approve to open positions for hiring.</span>
                </div>
              </div>
            )}

            <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {reqLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading requisitions...</div>
              ) : requisitions.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                  <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>No requisitions yet</div>
                  <div style={{ fontSize: '14px' }}>Create a resource requisition to start the hiring workflow.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'var(--app-bg)', borderBottom: '2px solid #f1f5f9' }}>
                      {['POSITION / DEPT', 'SKILLS REQUIRED', 'EXP.', 'TYPE', 'STATUS', 'DATE', 'ACTIONS'].map(h => (
                        <th key={h} style={{ padding: '14px 20px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requisitions.map((r) => {
                      const sb = statusBadge(r.status);
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.position_title}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>🏥 {r.department || 'N/A'}</div>
                          </td>
                          <td style={{ padding: '16px 20px', maxWidth: '200px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(r.required_skills || '').split(',').slice(0, 4).map((sk, i) => (
                                <span key={i} style={{ fontSize: '10px', background: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                  {sk.trim()}
                                </span>
                              ))}
                              {(r.required_skills || '').split(',').length > 4 && (
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>+{(r.required_skills || '').split(',').length - 4} more</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 700, color: '#475569', fontSize: '13px' }}>
                            {r.experience_required}+ yrs
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '8px', fontWeight: 700 }}>
                              {r.employment_type}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ fontSize: '11px', background: sb.bg, color: sb.color, padding: '4px 12px', borderRadius: '10px', fontWeight: 700, textTransform: 'capitalize' }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', fontSize: '12px', color: '#94a3b8' }}>
                            {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {r.status === 'pending' && (
                                <>
                                  <button onClick={() => handleApproveReject(r.id, 'approved')} style={{ padding: '5px 10px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>✅ Approve</button>
                                  <button onClick={() => handleApproveReject(r.id, 'rejected')} style={{ padding: '5px 10px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>❌ Reject</button>
                                </>
                              )}
                              <button onClick={() => openEditReq(r)} style={{ padding: '5px 10px', borderRadius: '8px', background: '#f1f5f9', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                              <button onClick={() => handleDeleteReq(r.id)} style={{ padding: '5px 10px', borderRadius: '8px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: CANDIDATES
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'candidates' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={() => { setCandForm({ name: '', email: '', phone: '', applied_position: '', resume_text: '' }); setShowCandModal(true); }} className="button-primary">
                + Add Candidate
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {candLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading candidates...</div>
              ) : candidates.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
                  <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>No candidates yet</div>
                  <div style={{ fontSize: '14px' }}>Add candidate profiles to run the AI JD Matcher.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'var(--app-bg)', borderBottom: '2px solid #f1f5f9' }}>
                      {['CANDIDATE', 'CONTACT', 'APPLIED FOR', 'RESUME PREVIEW', 'STATUS', 'ACTIONS'].map(h => (
                        <th key={h} style={{ padding: '14px 20px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => {
                      const sb = statusBadge(c.status || 'pending');
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontWeight: 700 }}>{c.name}</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                            <div>{c.email}</div>
                            <div style={{ color: '#94a3b8' }}>{c.phone}</div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ fontSize: '12px', background: '#eff6ff', color: '#3b82f6', padding: '3px 10px', borderRadius: '8px', fontWeight: 600 }}>
                              {c.applied_position || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', maxWidth: '200px' }}>
                            <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                              {c.resume_text ? c.resume_text.substring(0, 80) + '...' : 'No resume text'}
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ fontSize: '11px', background: sb.bg, color: sb.color, padding: '4px 12px', borderRadius: '10px', fontWeight: 700, textTransform: 'capitalize' }}>
                              {c.status || 'pending'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <select
                              value={c.status || 'pending'}
                              onChange={e => handleUpdateCandStatus(c.id, e.target.value)}
                              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', cursor: 'pointer', background: 'white' }}
                            >
                              {['pending', 'shortlisted', 'interviewed', 'hired', 'rejected'].map(s => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: AI JD MATCHER
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'matcher' && (
          <div>
            {/* Explanation Banner */}
            <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bfdbfe', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <span style={{ fontSize: '36px' }}>🤖</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 6px', color: '#1e40af' }}>AI-Powered Job Description Matcher</h3>
                  <p style={{ fontSize: '13px', color: '#3b82f6', margin: 0 }}>
                    Select an approved requisition below. The engine extracts required skills, experience, and role keywords from the JD, then compares each candidate's resume using weighted keyword matching with TF-IDF scoring. Scores reflect genuine skill overlap — not a flat 100%.
                  </p>
                </div>
              </div>
            </div>

            {/* Selector */}
            <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>
                Select Requisition to Match Against
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={selectedReqId}
                  onChange={e => { setSelectedReqId(Number(e.target.value) || ''); setMatchResults([]); setMatchError(''); }}
                  style={{ flex: 1, minWidth: '260px', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600 }}
                >
                  <option value="">— Choose a Position —</option>
                  {requisitions.filter(r => r.status === 'approved' || r.status === 'open').map(r => (
                    <option key={r.id} value={r.id}>{r.position_title} ({r.department})</option>
                  ))}
                </select>
                <button
                  onClick={handleMatch}
                  disabled={isMatching || !selectedReqId}
                  style={{
                    padding: '12px 28px', borderRadius: '12px', border: 'none', cursor: selectedReqId && !isMatching ? 'pointer' : 'not-allowed',
                    background: selectedReqId && !isMatching ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#e2e8f0',
                    color: selectedReqId && !isMatching ? 'white' : '#94a3b8',
                    fontWeight: 700, fontSize: '14px', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  {isMatching ? (
                    <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '16px' }}>⟳</span> Analysing...</>
                  ) : '🔍 Run AI Match'}
                </button>
              </div>

              {/* Show selected req details */}
              {selectedReqId && (() => {
                const req = requisitions.find(r => r.id === Number(selectedReqId));
                if (!req) return null;
                return (
                  <div style={{ marginTop: '16px', padding: '16px', background: 'var(--app-bg)', borderRadius: '12px', fontSize: '13px', color: '#475569' }}>
                    <strong>Skills Required:</strong> {req.required_skills || 'Not specified'} &nbsp;|&nbsp;
                    <strong>Experience:</strong> {req.experience_required}+ years &nbsp;|&nbsp;
                    <strong>Type:</strong> {req.employment_type}
                  </div>
                );
              })()}
            </div>

            {/* Error */}
            {matchError && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', color: '#dc2626', fontWeight: 600 }}>
                ⚠️ {matchError}
              </div>
            )}

            {/* Results */}
            {matchResults.length > 0 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: '#0f172a' }}>
                  {matchResults.length} Candidate{matchResults.length > 1 ? 's' : ''} Analysed — Sorted by Best Match
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {matchResults
                    .sort((a, b) => b.score - a.score)
                    .map((m, idx) => {
                      const sc = scoreColor(m.score);
                      return (
                        <div key={m.candidate_id} style={{
                          background: 'white', borderRadius: '20px', border: `1px solid ${idx === 0 ? '#bfdbfe' : '#e2e8f0'}`,
                          padding: '24px',
                          boxShadow: idx === 0 ? '0 4px 20px rgba(59,130,246,0.1)' : 'none'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {idx === 0 && <span style={{ fontSize: '20px' }}>🥇</span>}
                                <span style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>{m.candidate_name}</span>
                                <span style={{ fontSize: '11px', background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: '8px', fontWeight: 700 }}>
                                  {sc.label}
                                </span>
                              </div>
                            </div>

                            {/* Score Dial */}
                            <div style={{ textAlign: 'center' }}>
                              <div style={{
                                width: '72px', height: '72px', borderRadius: '50%',
                                background: `conic-gradient(${sc.color} ${m.score * 3.6}deg, #f1f5f9 0deg)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                              }}>
                                <div style={{
                                  width: '52px', height: '52px', borderRadius: '50%', background: 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 900, fontSize: '15px', color: sc.color
                                }}>
                                  {m.score}%
                                </div>
                              </div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', marginTop: '4px' }}>MATCH SCORE</div>
                            </div>
                          </div>

                          {/* Score Bar */}
                          <div style={{ margin: '16px 0 12px', background: '#f1f5f9', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${m.score}%`, borderRadius: '6px',
                              background: `linear-gradient(90deg, ${sc.color}, ${sc.color}88)`,
                              transition: 'width 0.8s ease'
                            }} />
                          </div>

                          {/* Rationale */}
                          {m.rationale && (
                            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px', fontStyle: 'italic' }}>{m.rationale}</p>
                          )}

                          {/* Skills breakdown */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {m.matched_skills?.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '6px', textTransform: 'uppercase' }}>✅ Matched Skills</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {m.matched_skills.map((sk, i) => (
                                    <span key={i} style={{ fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{sk}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {m.missing_skills?.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', marginBottom: '6px', textTransform: 'uppercase' }}>❌ Missing Skills</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {m.missing_skills.map((sk, i) => (
                                    <span key={i} style={{ fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{sk}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Empty State (no results, no error, not loading) */}
            {!isMatching && !matchError && matchResults.length === 0 && (
              <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '8px', color: '#0f172a' }}>Select a position and run the AI Matcher</div>
                <div style={{ fontSize: '14px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
                  The engine will score each candidate's resume against the job description and rank them by relevance.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            REQUISITION MODAL
        ══════════════════════════════════════════════════════════════════════ */}
        {showReqModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>
                {isEditingReq ? 'Edit Requisition' : '📋 New Resource Requisition'}
              </h2>
              <form onSubmit={handleReqSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Position Title <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      placeholder="e.g. Senior Nurse, Lab Technician"
                      value={reqForm.position_title} onChange={e => setReqForm({ ...reqForm, position_title: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Department</label>
                    <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={reqForm.department} onChange={e => setReqForm({ ...reqForm, department: e.target.value })}>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Employment Type</label>
                    <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={reqForm.employment_type} onChange={e => setReqForm({ ...reqForm, employment_type: e.target.value })}>
                      <option>Permanent</option><option>Probation</option><option>Contract</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Min. Experience (years)</label>
                    <input type="number" min={0} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={reqForm.experience_required} onChange={e => setReqForm({ ...reqForm, experience_required: Number(e.target.value) })} />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                    Required Skills <span style={{ fontWeight: 400, color: '#94a3b8' }}>(comma-separated)</span>
                  </label>
                  <input style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    placeholder="e.g. Patient Care, IV Administration, EMR, BCLS"
                    value={reqForm.required_skills} onChange={e => setReqForm({ ...reqForm, required_skills: e.target.value })} />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                    Full Job Description <span style={{ fontWeight: 400, color: '#94a3b8' }}>(used for AI matching)</span>
                  </label>
                  <textarea rows={6} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder="Paste or type the full job description here. The AI matcher will use this text to score candidates..."
                    value={reqForm.jd_text} onChange={e => setReqForm({ ...reqForm, jd_text: e.target.value })} />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowReqModal(false)} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <button type="submit" style={{ flex: 2, padding: '13px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    {isEditingReq ? 'Save Changes' : '📤 Submit for Approval'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            CANDIDATE MODAL
        ══════════════════════════════════════════════════════════════════════ */}
        {showCandModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>👤 Add Candidate Profile</h2>
              <form onSubmit={handleCandSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={candForm.name} onChange={e => setCandForm({ ...candForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Email</label>
                    <input type="email" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={candForm.email} onChange={e => setCandForm({ ...candForm, email: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Phone</label>
                    <input style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={candForm.phone} onChange={e => setCandForm({ ...candForm, phone: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Applying For</label>
                    <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={candForm.applied_position} onChange={e => setCandForm({ ...candForm, applied_position: e.target.value })}>
                      <option value="">Select Position</option>
                      {requisitions.map(r => <option key={r.id} value={r.position_title}>{r.position_title}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                    Resume Text <span style={{ fontWeight: 400, color: '#94a3b8' }}>(paste or upload .txt)</span>
                  </label>
                  <textarea rows={8} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder="Paste the candidate's resume text here. Include skills, experience, education, and certifications for best matching accuracy..."
                    value={candForm.resume_text} onChange={e => setCandForm({ ...candForm, resume_text: e.target.value })} />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Upload Resume (.txt)</label>
                  <input type="file" accept=".txt" ref={fileRef} onChange={handleFileRead}
                    style={{ fontSize: '13px', color: '#64748b' }} />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowCandModal(false)} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <button type="submit" style={{ flex: 2, padding: '13px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Save Candidate</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </main>
    </div>
  );
}
