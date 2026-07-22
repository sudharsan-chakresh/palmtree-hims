import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function BedManagementPage() {
  const navigate = useNavigate();
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWard, setActiveWard] = useState<any>(null);
  const [wardBeds, setWardBeds] = useState<any[]>([]);
  const [bedsLoading, setBedsLoading] = useState(false);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/hospital/ipd/bedmap`, { headers });
        setWards(res.data);
        if (res.data.length > 0) loadWardBeds(res.data[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMasters();
  }, []);

  const loadWardBeds = async (ward: any) => {
    setActiveWard(ward);
    setBedsLoading(true);
    try {
      let res = await axios.get(`${API_BASE}/api/hospital/ipd/wards/${ward.id}/beds`, { headers });
      // Auto-provision beds if none exist yet
      if (res.data.length === 0) {
        await axios.post(`${API_BASE}/api/hospital/ipd/wards/${ward.id}/provision-beds`, {}, { headers });
        res = await axios.get(`${API_BASE}/api/hospital/ipd/wards/${ward.id}/beds`, { headers });
      }
      setWardBeds(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBedsLoading(false);
    }
  };

  const totalOccupied = wards.reduce((acc, w) => acc + Number(w.occupied || 0), 0);
  const totalBeds = wards.reduce((acc, w) => acc + Number(w.capacity || 0), 0);
  const occupancyRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content" style={{ padding: '32px' }}>
        <Header title="IPD Bed Management & Occupancy" />

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total Beds', value: loading ? '—' : totalBeds, color: '#3b82f6', icon: '🛏️' },
            { label: 'Occupied', value: loading ? '—' : totalOccupied, color: '#ef4444', icon: '🔴' },
            { label: 'Vacant', value: loading ? '—' : (totalBeds - totalOccupied), color: '#10b981', icon: '🟢' },
            { label: 'Occupancy Rate', value: loading ? '—' : `${occupancyRate}%`, color: occupancyRate > 80 ? '#ef4444' : '#f59e0b', icon: '📊' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{s.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 900, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '28px' }}>
          {/* Ward list */}
          <aside>
            <div style={{ background: 'white', padding: '28px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: '#0f172a' }}>Hospital Floors / Wards</h3>
              {loading ? (
                <p style={{ textAlign: 'center', color: '#94a3b8' }}>Loading wards...</p>
              ) : wards.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ marginBottom: '12px', fontSize: '13px' }}>No wards configured yet.</p>
                  <button
                    onClick={() => navigate('/tenant/masters')}
                    style={{ padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                  >
                    + Add Wards in Masters
                  </button>
                </div>
              ) : (
                wards.map((ward, i) => {
                  const pct = ward.capacity > 0 ? Math.round((Number(ward.occupied) / Number(ward.capacity)) * 100) : 0;
                  return (
                    <div
                      key={i}
                      onClick={() => loadWardBeds(ward)}
                      style={{
                        padding: '16px', borderRadius: '16px', marginBottom: '10px', cursor: 'pointer',
                        background: activeWard?.id === ward.id ? '#eff6ff' : 'white',
                        border: `1px solid ${activeWard?.id === ward.id ? '#3b82f6' : '#f1f5f9'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{ward.name}</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{ward.occupied}/{ward.capacity}</div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>{ward.type}</div>
                      <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#ef4444' : '#3b82f6', borderRadius: '2px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => navigate('/tenant/ipd/admissions')}
              style={{ width: '100%', marginTop: '14px', padding: '14px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}
            >
              📋 View All Active Admissions
            </button>
            <button
              onClick={() => navigate('/tenant/ipd/beds')}
              style={{ width: '100%', marginTop: '10px', padding: '14px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}
            >
              🛏️ Full Bed Map & Admissions
            </button>
          </aside>

          {/* Bed grid */}
          <section>
            <div style={{ background: 'white', padding: '28px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0 }}>
                  {activeWard?.name || 'Select a Ward'}
                  {activeWard && <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginLeft: '12px' }}>{activeWard.type}</span>}
                </h2>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {[
                    { bg: '#f0fdf4', border: '#86efac', label: 'Vacant' },
                    { bg: '#fee2e2', border: '#fca5a5', label: 'Occupied' },
                    { bg: '#fffbeb', border: '#fcd34d', label: 'Maintenance' },
                  ].map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', background: l.bg, border: `1px solid ${l.border}`, borderRadius: '4px' }} />
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {bedsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading beds...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '16px' }}>
                  {wardBeds.map((bed, i) => {
                    const isOccupied = bed.status === 'Occupied';
                    const isMaint = bed.status === 'Maintenance';
                    const bg = isOccupied ? '#fee2e2' : isMaint ? '#fffbeb' : '#f0fdf4';
                    const border = isOccupied ? '#fca5a5' : isMaint ? '#fcd34d' : '#86efac';
                    const textColor = isOccupied ? '#ef4444' : isMaint ? '#f59e0b' : '#10b981';

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (isOccupied && bed.admission_id) {
                            navigate(`/tenant/ipd/admissions/${bed.admission_id}`);
                          } else if (!isOccupied && !isMaint) {
                            navigate('/tenant/ipd/beds');
                          }
                        }}
                        style={{
                          padding: '20px 16px', borderRadius: '18px', background: bg, border: `2px solid ${border}`,
                          cursor: (isOccupied || !isMaint) ? 'pointer' : 'default',
                          textAlign: 'center', transition: 'all 0.2s',
                          boxShadow: isOccupied ? '0 4px 12px rgba(239, 68, 68, 0.1)' : '0 2px 4px rgba(0,0,0,0.04)'
                        }}
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                          <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
                        </svg>
                        <div style={{ fontWeight: 900, fontSize: '13px', color: '#0f172a' }}>{bed.bed_number}</div>
                        {isOccupied ? (
                          <>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: textColor, marginTop: '4px' }}>{bed.patient_name?.split(' ')[0] || 'Patient'}</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{bed.mrn}</div>
                            <div style={{ marginTop: '8px', padding: '3px 8px', background: '#ef4444', color: 'white', borderRadius: '6px', fontSize: '9px', fontWeight: 900 }}>
                              VIEW RECORD
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '11px', color: textColor, fontWeight: 700, marginTop: '6px' }}>
                            {isMaint ? 'Maintenance' : '+ Admit'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {wardBeds.length === 0 && !bedsLoading && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                      No beds provisioned for this ward. Click another ward or add capacity in Masters.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
