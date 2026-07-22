import { useRef } from 'react';
import { Pill, Plus, Trash2, Search } from 'lucide-react';

interface PrescriptionTabProps {
  prescriptions: any[];
  setPrescriptions: (prescriptions: any[]) => void;
  medicines: any[];
  medSearch: string;
  setMedSearch: (search: string) => void;
  filteredMeds: any[];
  handleMedSearch: (search: string) => void;
  addMed: (medicine: any) => void;
}

export default function PrescriptionTab({
  prescriptions,
  setPrescriptions,
  medicines,
  medSearch,
  setMedSearch,
  filteredMeds,
  handleMedSearch,
  addMed
}: PrescriptionTabProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleAddCommonMeds = () => {
    const commonNames = [
      { name: 'Paracetamol', dosage: '500mg' },
      { name: 'Ibuprofen', dosage: '400mg' },
      { name: 'Amoxicillin', dosage: '500mg' },
      { name: 'Cetirizine', dosage: '10mg' },
      { name: 'Pantoprazole', dosage: '40mg' }
    ];
    const newPrescriptions = [...prescriptions];
    commonNames.forEach(item => {
      if (newPrescriptions.find(p => p.name.toLowerCase().includes(item.name.toLowerCase()))) return;
      const med = medicines.find(m => (m.name || '').toLowerCase().includes(item.name.toLowerCase()));
      newPrescriptions.push({
        medicine_id: med?.id || null,
        name: med?.name || item.name,
        composition: med?.composition || item.name,
        dosage: med?.dosage_adult || item.dosage || '1 Tab',
        frequency: '1-0-1',
        duration: '5',
        instructions: '-',
        note: ''
      });
    });
    setPrescriptions(newPrescriptions);
  };

  const updateField = (index: number, field: string, value: string) => {
    const next = [...prescriptions];
    next[index] = { ...next[index], [field]: value };
    setPrescriptions(next);
  };

  const removeMed = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Header + Search ─────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Pill size={20} color="#3b82f6" />
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>Prescriptions</span>
            {prescriptions.length > 0 && (
              <span style={{ background: '#eff6ff', color: '#3b82f6', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '20px' }}>
                {prescriptions.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAddCommonMeds}
              style={{ padding: '8px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
            >
              + Common Meds
            </button>
            <button
              onClick={() => searchInputRef.current?.focus()}
              style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Add Medicine
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '16px 24px', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              ref={searchInputRef}
              placeholder="Search medicine by name or composition..."
              style={{
                width: '100%', padding: '11px 40px 11px 40px',
                border: '1.5px solid #e2e8f0', borderRadius: '12px',
                fontSize: '14px', color: '#1e293b', outline: 'none',
                background: '#f8fafc', boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              value={medSearch}
              onChange={e => handleMedSearch(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
            {medSearch && (
              <button
                onClick={() => setMedSearch('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >✕</button>
            )}
          </div>

          {/* Dropdown Results */}
          {filteredMeds.length > 0 && medSearch && (
            <div style={{
              position: 'absolute', top: '68px', left: '24px', right: '24px',
              background: 'white', border: '1.5px solid #3b82f6', borderRadius: '14px',
              boxShadow: '0 16px 40px rgba(59,130,246,0.15)', zIndex: 200,
              maxHeight: '260px', overflowY: 'auto'
            }}>
              {filteredMeds.slice(0, 8).map(m => (
                <div
                  key={m.id}
                  onClick={() => { addMed({ ...m, note: '' }); setMedSearch(''); }}
                  style={{ padding: '14px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{m.composition}</div>
                  </div>
                  <div style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>+ Add</div>
                </div>
              ))}
              {filteredMeds.length > 8 && (
                <div style={{ padding: '12px 20px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                  +{filteredMeds.length - 8} more results
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Prescription Cards ────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {prescriptions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', border: '2px dashed #e2e8f0', borderRadius: '20px', background: 'white' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>💊</div>
            <div style={{ fontWeight: 700, color: '#64748b', fontSize: '14px' }}>No medications prescribed yet</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>Search above or click "Add Medicine" to start</div>
          </div>
        ) : (
          prescriptions.map((p, i) => (
            <div
              key={i}
              style={{
                background: 'white', borderRadius: '20px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              {/* Card Header */}
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '16px', color: '#0f172a' }}>{p.name}</div>
                  {p.composition && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>{p.composition}</div>
                  )}
                </div>
                <button
                  onClick={() => removeMed(i)}
                  style={{ background: '#fee2e2', border: 'none', color: '#ef4444', padding: '7px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Fields Grid — 5 columns matching screenshot */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: '12px'
                }}>
                  {/* Dosage */}
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      💊 Dosage
                    </label>
                    <input
                      style={fieldInputStyle}
                      value={p.dosage}
                      onChange={e => updateField(i, 'dosage', e.target.value)}
                      placeholder="e.g. 500mg"
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    />
                  </div>

                  {/* Frequency */}
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      🔄 Frequency
                    </label>
                    <select
                      style={fieldSelectStyle}
                      value={p.frequency}
                      onChange={e => updateField(i, 'frequency', e.target.value)}
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    >
                      <option>1-0-1</option>
                      <option>1-1-1</option>
                      <option>1-0-0</option>
                      <option>0-0-1</option>
                      <option>0-1-0</option>
                      <option>0-1-1</option>
                      <option>SOS</option>
                      <option>STAT</option>
                    </select>
                  </div>

                  {/* Duration in Days */}
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      📅 Duration in Days
                    </label>
                    <input
                      style={fieldInputStyle}
                      value={p.duration}
                      onChange={e => updateField(i, 'duration', e.target.value)}
                      placeholder="e.g. 5"
                      type="text"
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    />
                  </div>

                  {/* Timing */}
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      ⏰ Timing
                    </label>
                    <select
                      style={fieldSelectStyle}
                      value={p.instructions}
                      onChange={e => updateField(i, 'instructions', e.target.value)}
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    >
                      <option value="-">-</option>
                      <option>After Food</option>
                      <option>Before Food</option>
                      <option>With Food</option>
                      <option>Empty Stomach</option>
                      <option>At Bedtime</option>
                    </select>
                  </div>

                  {/* Note / Advise — NEW COLUMN matching the screenshot */}
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      📝 Note / Advise
                    </label>
                    <input
                      style={fieldInputStyle}
                      value={p.note || ''}
                      onChange={e => updateField(i, 'note', e.target.value)}
                      placeholder="Enter note or advise"
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clear All (only when meds exist) */}
      {prescriptions.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setPrescriptions([])}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #ef4444', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#ef4444', cursor: 'pointer' }}
          >
            Clear All Medications
          </button>
        </div>
      )}
    </div>
  );
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1e293b',
  background: '#f8fafc',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s'
};

const fieldSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '10px',
  fontSize: '13px',
                fontWeight: 600,
  color: '#1e293b',
  background: '#f8fafc',
  outline: 'none',
  boxSizing: 'border-box',
  cursor: 'pointer',
  transition: 'border-color 0.2s'
};
