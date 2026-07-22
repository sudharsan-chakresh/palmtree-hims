import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

const SPECIALIZATIONS = [
  'General Medicine',
  'Internal Medicine',
  'Cardiology',
  'Dermatology',
  'ENT',
  'Gastroenterology',
  'Gynecology',
  'Nephrology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Radiology',
  'General Surgery',
  'Urology',
  'Emergency Medicine'
];

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVendorId, setEditVendorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'vendors' | 'rbac'>('list');
  const [searchTerm, setSearchTerm] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'doctor',
    license_number: '',
    age: '',
    qualifications: '',
    experience_years: '',
    specialization: '',
    department: '',
    gender: 'Male',
    dob: '',
    doj: '',
    employment_type: 'Permanent',
    vendor_id: '',
    is_manager: false
  });

  const [vendorFormData, setVendorFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  });


  const ROLES = [
    { value: 'admin',         label: 'Admin',           desc: 'Full system access' },
    { value: 'doctor',        label: 'Doctor',          desc: 'OPD, prescriptions, lab orders' },
    { value: 'lab_assistant', label: 'Lab Assistant',   desc: 'Lab queue, result entry only' },
    { value: 'pharmacist',    label: 'Pharmacist',      desc: 'Inventory, dispensing, prescription queue' },
    { value: 'receptionist',  label: 'Receptionist',    desc: 'Patient registration, appointments' },
    { value: 'nurse',         label: 'Nurse',           desc: 'Vitals, in-patient care' },
    { value: 'staff',         label: 'General Staff',   desc: 'Read-only access' },
  ];

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  // ─── Staff CRUD ──────────────────────────────────────────────────────────
  const fetchStaff = async (search: string = "") => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/staff?search=${encodeURIComponent(search)}`, { headers: getHeaders() });
      const rows = Array.isArray(res.data) ? res.data : [];
      const term = search.trim().toLowerCase();
      setStaff(term
        ? rows.filter((member: any) =>
            [member.name, member.email, member.role, member.department, member.specialization]
              .some(value => String(value || '').toLowerCase().includes(term))
          )
        : rows
      );
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // ─── Vendor CRUD ─────────────────────────────────────────────────────────
  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/staff/vendors`, { headers: getHeaders() });
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setVendors([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/masters/departments`, { headers: getHeaders() });
      const names = (res.data || []).map((d: any) => d.name).filter(Boolean);
      if (names.length > 0) setDepartments(names);
    } catch (err) {
      console.error("Failed to fetch departments:", err);
    }
  };

  const fetchSpecializations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/masters/specialities`, { headers: getHeaders() });
      const names = (res.data || []).map((s: any) => s.name).filter(Boolean);
      if (names.length > 0) {
        setSpecializations(names);
      } else {
        setSpecializations(SPECIALIZATIONS);
      }
    } catch (err) {
      console.error("Failed to fetch specializations:", err);
      setSpecializations(SPECIALIZATIONS);
    }
  };

  useEffect(() => {
    fetchStaff(searchTerm);
    fetchVendors();
    fetchDepartments();
    fetchSpecializations();
  }, [searchTerm]);

  const resetForm = () => setFormData({
    name: '', email: '', password: '', role: 'doctor', license_number: '', age: '',
    qualifications: '', experience_years: '', specialization: '', department: '',
    gender: 'Male', dob: '', doj: '', employment_type: 'Permanent', vendor_id: '', is_manager: false
  });

  const handleOpenAddModal = () => {
    resetForm();
    setIsEditing(false);
    setEditId(null);
    setShowModal(true);
    fetchSpecializations();
  };

  const handleOpenEditModal = (member: any) => {
    setFormData({
      name: member.name || '',
      email: member.email || '',
      password: '',
      role: member.role || 'doctor',
      license_number: member.license_number || '',
      age: member.age ? String(member.age) : '',
      qualifications: member.qualifications || '',
      experience_years: member.experience_years ? String(member.experience_years) : '',
      specialization: member.specialization || '',
      department: member.department || '',
      gender: member.gender || 'Male',
      dob: member.dob ? member.dob.substring(0, 10) : '',
      doj: member.doj ? member.doj.substring(0, 10) : '',
      employment_type: member.employment_type || 'Permanent',
      vendor_id: member.vendor_id ? String(member.vendor_id) : '',
      is_manager: member.is_manager || false
    });
    setIsEditing(true);
    setEditId(member.id);
    setShowModal(true);
    fetchSpecializations();
  };

  const handleDobChange = (val: string) => {
    setFormData(prev => {
      const newData = { ...prev, dob: val };
      if (val) {
        const birthDate = new Date(val);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        newData.age = String(age);
      }
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && editId) {
        await axios.put(`${API_BASE}/api/hospital/staff/${editId}`, formData, { headers: getHeaders() });
        alert("Staff member updated successfully!");
      } else {
        await axios.post(`${API_BASE}/api/hospital/staff`, formData, { headers: getHeaders() });
        alert("Staff member added successfully!");
      }
      setShowModal(false);
      fetchStaff(searchTerm);
    } catch (err: any) {
      alert(err.response?.data?.error || "Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;
    try {
      await axios.delete(`${API_BASE}/api/hospital/staff/${id}`, { headers: getHeaders() });
      fetchStaff(searchTerm);
    } catch {
      alert("Failed to delete staff member");
    }
  };

  // ─── Vendor Handlers ──────────────────────────────────────────────────────
  const handleOpenAddVendorModal = () => {
    setVendorFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });
    setIsEditingVendor(false);
    setEditVendorId(null);
    setShowVendorModal(true);
  };

  const handleOpenEditVendorModal = (vendor: any) => {
    setVendorFormData({
      name: vendor.name || '',
      contact_person: vendor.contact_person || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || ''
    });
    setIsEditingVendor(true);
    setEditVendorId(vendor.id);
    setShowVendorModal(true);
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingVendor && editVendorId) {
        await axios.put(`${API_BASE}/api/hospital/staff/vendors/${editVendorId}`, vendorFormData, { headers: getHeaders() });
        alert("Vendor updated successfully!");
      } else {
        await axios.post(`${API_BASE}/api/hospital/staff/vendors`, vendorFormData, { headers: getHeaders() });
        alert("Vendor added successfully!");
      }
      setShowVendorModal(false);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.error || "Vendor operation failed");
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (!window.confirm("Delete this vendor? Contractor employees linked to them will lose the vendor reference.")) return;
    try {
      await axios.delete(`${API_BASE}/api/hospital/staff/vendors/${id}`, { headers: getHeaders() });
      fetchVendors();
    } catch {
      alert("Failed to delete vendor");
    }
  };

  // ─── Employment type badge color ─────────────────────────────────────────
  const empTypeBadge = (type: string) => {
    if (type === 'Contract') return { bg: '#fef3c7', color: '#d97706' };
    if (type === 'Probation') return { bg: '#ede9fe', color: '#7c3aed' };
    return { bg: '#dcfce7', color: '#16a34a' };
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Staff & RBAC" />

        {/* Search + Add */}
        <div className="flex-responsive" style={{ marginBottom: '24px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
            <input
              type="text"
              placeholder="Search staff members..."
              style={{
                width: '100%', padding: '12px 16px 12px 40px', borderRadius: '12px',
                border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, background: 'white'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleOpenAddModal} className="button-primary" style={{ whiteSpace: 'nowrap' }}>
              + Add Staff Member
            </button>
            {activeTab === 'vendors' && (
              <button onClick={handleOpenAddVendorModal} className="button-primary" style={{ whiteSpace: 'nowrap', background: '#7c3aed' }}>
                + Add Vendor
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '32px' }}>
          <div className="stat-card">
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Total Staff</p>
            <h3 style={{ fontSize: '24px', fontWeight: 900, margin: 0 }}>{staff.length}</h3>
          </div>
          <div className="stat-card">
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Permanent</p>
            <h3 style={{ fontSize: '24px', fontWeight: 900, margin: 0, color: '#16a34a' }}>{staff.filter(s => (s.employment_type || 'Permanent') === 'Permanent').length}</h3>
          </div>
          <div className="stat-card">
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Contractors</p>
            <h3 style={{ fontSize: '24px', fontWeight: 900, margin: 0, color: '#d97706' }}>{staff.filter(s => s.employment_type === 'Contract').length}</h3>
          </div>
          <div className="stat-card hide-mobile">
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Vendors Registered</p>
            <h3 style={{ fontSize: '24px', fontWeight: 900, margin: 0, color: '#7c3aed' }}>{vendors.length}</h3>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
          {(['list', 'vendors', 'rbac'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              background: activeTab === tab ? 'white' : 'transparent',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}>
              {tab === 'list' ? 'Staff Directory' : tab === 'vendors' ? '🏢 Vendor Directory' : 'Access Permissions (RBAC)'}
            </button>
          ))}
        </div>

        {/* ── Staff Directory Tab ── */}
        {activeTab === 'list' && (
          <>
            <div className="manage-card hide-mobile" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {loading && staff.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>Loading staff records...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>STAFF NAME</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>EMAIL / ROLE</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>EMPLOYMENT</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>DETAILS</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>JOINED (DOJ)</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member: any, i: number) => {
                      const badge = empTypeBadge(member.employment_type || 'Permanent');
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: 600 }}>{member.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>ID: {member.id?.substring(0, 8)}</div>
                            {member.is_manager && (
                              <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>MANAGER</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ color: '#64748b', fontSize: '13px' }}>{member.email}</div>
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                              background: member.role === 'admin' ? '#fee2e2' : '#f0f9ff',
                              color: member.role === 'admin' ? '#ef4444' : '#3b82f6', display: 'inline-block', marginTop: '4px'
                            }}>{member.role}</span>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color }}>
                              {member.employment_type || 'Permanent'}
                            </span>
                            {member.employment_type === 'Contract' && member.vendor_name && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>🏢 {member.vendor_name}</div>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b' }}>
                            {member.role === 'doctor' ? (
                              <>
                                <div>Lic: {member.license_number || 'N/A'}</div>
                                <div>Spec: {member.specialization || 'N/A'}</div>
                              </>
                            ) : (
                              <>
                                <div>Dept: {member.department || 'N/A'}</div>
                                <div>Exp: {member.experience_years || '0'} yrs</div>
                              </>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                              {member.doj ? new Date(member.doj).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>DOB: {member.dob ? new Date(member.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleOpenEditModal(member)} style={{ padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Edit
                              </button>
                              <button onClick={() => handleDelete(member.id)} style={{ padding: '6px 12px', borderRadius: '8px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {staff.length === 0 && !loading && (
                      <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No staff found matching "{searchTerm}"</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mobile Card List */}
            <div className="mobile-card-list show-mobile" style={{ display: 'none' }}>
              {staff.map((member, i) => {
                const badge = empTypeBadge(member.employment_type || 'Permanent');
                return (
                  <div key={i} className="mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '16px' }}>{member.name}</div>
                        <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase' }}>{member.role}</div>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', background: badge.bg, color: badge.color, fontWeight: 700 }}>
                          {member.employment_type || 'Permanent'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenEditModal(member)} style={{ padding: '8px', borderRadius: '8px', background: '#f1f5f9', border: 'none' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button onClick={() => handleDelete(member.id)} style={{ padding: '8px', borderRadius: '8px', background: '#fee2e2', border: 'none', color: '#ef4444' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Vendor Directory Tab ── */}
        {activeTab === 'vendors' && (
          <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>VENDOR NAME</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>CONTACT PERSON</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>EMAIL / PHONE</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>CONTRACTORS</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor: any, i: number) => {
                  const contractorCount = staff.filter(s => s.vendor_id === vendor.id).length;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700 }}>🏢 {vendor.name}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{vendor.address || 'No address'}</div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600 }}>{vendor.contact_person || 'N/A'}</td>
                      <td style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>
                        <div>{vendor.email || 'N/A'}</div>
                        <div>{vendor.phone || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ padding: '4px 12px', borderRadius: '10px', background: contractorCount > 0 ? '#fef3c7' : '#f1f5f9', color: contractorCount > 0 ? '#d97706' : '#94a3b8', fontWeight: 700, fontSize: '13px' }}>
                          {contractorCount} staff
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleOpenEditVendorModal(vendor)} style={{ padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => handleDeleteVendor(vendor.id)} style={{ padding: '6px 12px', borderRadius: '8px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {vendors.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No vendors registered yet. Add your first vendor to link contract staff.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── RBAC Tab ── */}
        {activeTab === 'rbac' && (
          <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--app-bg)' }}>
                  <th style={{ padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Scope</th>
                  <th style={{ padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>OPD/IPD Access</th>
                  <th style={{ padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Lab/Pharmacy</th>
                  <th style={{ padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Admin/Masters</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { role: 'admin',         scope: 'Full System',  opd_ipd: '✅ Full',      diag: '✅ Full',  admin: '✅ Full' },
                  { role: 'doctor',        scope: 'Clinical',     opd_ipd: '✅ Full',      diag: '📋 View',  admin: '❌' },
                  { role: 'nurse',         scope: 'Clinical',     opd_ipd: '📋 IPD/Vitals',diag: '❌',       admin: '❌' },
                  { role: 'lab_assistant', scope: 'Diagnostics',  opd_ipd: '❌',            diag: '✅ Lab',   admin: '❌' },
                  { role: 'pharmacist',    scope: 'Diagnostics',  opd_ipd: '❌',            diag: '✅ Phar',  admin: '❌' },
                  { role: 'receptionist',  scope: 'Front Office', opd_ipd: '📋 Reg',        diag: '❌',       admin: '❌' },
                  { role: 'staff',         scope: 'Support',      opd_ipd: '❌',            diag: '❌',       admin: '❌' },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', color: '#0f172a', textTransform: 'capitalize' }}>
                        {r.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#64748b', fontSize: '13px' }}>{r.scope}</td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600 }}>{r.opd_ipd}</td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600 }}>{r.diag}</td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600 }}>{r.admin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STAFF MODAL
        ══════════════════════════════════════════════════════════════════════ */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>
                {isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <form onSubmit={handleSubmit}>
                {/* Name + Email */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Full Name</label>
                    <input required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Email Address</label>
                    <input type="email" required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>

                {/* Password (add only) */}
                {!isEditing && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Temporary Password</label>
                    <input type="password" required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                )}

                {/* Role */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Role</label>
                  <select required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                    <option value="" disabled>Select Role...</option>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                  </select>
                </div>

                {/* Employment Type */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Employment Type</label>
                    <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.employment_type} onChange={e => setFormData({ ...formData, employment_type: e.target.value, vendor_id: e.target.value !== 'Contract' ? '' : formData.vendor_id })}>
                      <option value="Permanent">Permanent</option>
                      <option value="Probation">Probation</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  {formData.employment_type === 'Contract' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                        🏢 Vendor / Agency <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        value={formData.vendor_id} onChange={e => setFormData({ ...formData, vendor_id: e.target.value })}>
                        <option value="">Select Vendor</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                      {vendors.length === 0 && (
                        <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>No vendors found. Please add a vendor in the Vendor Directory tab first.</p>
                      )}
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#64748b', cursor: 'pointer', marginTop: formData.employment_type !== 'Contract' ? '28px' : '0' }}>
                      <input type="checkbox" checked={formData.is_manager} onChange={e => setFormData({ ...formData, is_manager: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                      Is Manager (can approve team requests)
                    </label>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '24px 0' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '16px', color: '#1e293b' }}>Professional Details</h3>

                {/* Gender + DOB + Age + DOJ + Exp */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Gender</label>
                    <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Date of Birth</label>
                    <input type="date" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.dob} onChange={e => handleDobChange(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Age (auto-calculated)</label>
                    <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'var(--app-bg)' }}
                      value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Date of Joining</label>
                    <input type="date" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.doj} onChange={e => setFormData({ ...formData, doj: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Years of Experience</label>
                    <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.experience_years} onChange={e => setFormData({ ...formData, experience_years: e.target.value })} />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Qualifications</label>
                  <input placeholder="e.g. MBBS, MD, PhD" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    value={formData.qualifications} onChange={e => setFormData({ ...formData, qualifications: e.target.value })} />
                </div>

                {formData.role === 'doctor' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>License Number</label>
                      <input style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        value={formData.license_number} onChange={e => setFormData({ ...formData, license_number: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Specialization</label>
                      <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        value={formData.specialization} onChange={e => setFormData({ ...formData, specialization: e.target.value })}>
                        <option value="">Select Specialization</option>
                        {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Department</label>
                    <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    {isEditing ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VENDOR MODAL
        ══════════════════════════════════════════════════════════════════════ */}
        {showVendorModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>
                {isEditingVendor ? 'Edit Vendor' : 'Add Vendor / Agency'}
              </h2>
              <form onSubmit={handleVendorSubmit}>
                <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                  {[
                    { label: 'Company / Vendor Name', key: 'name', required: true },
                    { label: 'Contact Person', key: 'contact_person' },
                    { label: 'Email', key: 'email' },
                    { label: 'Phone Number', key: 'phone' },
                    { label: 'Address', key: 'address' },
                  ].map(field => (
                    <div key={field.key}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                        {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>
                      <input
                        required={field.required}
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        value={(vendorFormData as any)[field.key]}
                        onChange={e => setVendorFormData({ ...vendorFormData, [field.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowVendorModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    {isEditingVendor ? 'Save Changes' : 'Add Vendor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
