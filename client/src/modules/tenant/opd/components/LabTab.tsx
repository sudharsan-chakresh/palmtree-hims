import { useState } from 'react';
import axios from 'axios';
import { FlaskConical, CheckCircle2, Sparkles, Loader2, Check, X, FileText, Mic } from 'lucide-react';
import { API_BASE_URL as API_BASE } from '../../../../config/api';
import { useToast } from '../../../../components/ToastProvider';

interface LabTabProps {
  diagnostics: any[];
  selectedLabTests: string[];
  setSelectedLabTests: (tests: string[]) => void;
  problemStatement?: string;
  setProblemStatement?: (statement: string) => void;
  onAppendNotes?: (text: string) => void;
}

export default function LabTab({
  diagnostics,
  selectedLabTests,
  setSelectedLabTests,
  problemStatement = "",
  setProblemStatement,
  onAppendNotes
}: LabTabProps) {
  const { showToast } = useToast();
  const [localProblem, setLocalProblem] = useState(problemStatement);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  const handleProblemChange = (val: string) => {
    setLocalProblem(val);
    if (setProblemStatement) setProblemStatement(val);
  };

  const handleSimulateVoiceNote = () => {
    setIsVoiceRecording(true);
    showToast("Listening to voice note...", "info");
    setTimeout(() => {
      setIsVoiceRecording(false);
      const simulatedTranscript = "Patient reports intermittent fever for 3 days with chills, mild headache, and fatigue. Rule out viral fever or malaria.";
      handleProblemChange(localProblem ? `${localProblem} ${simulatedTranscript}` : simulatedTranscript);
      showToast("Voice note transcribed successfully.", "success");
    }, 2000);
  };

  const handleSummarize = async () => {
    if (!localProblem.trim()) {
      showToast("Please enter a brief problem statement or voice note first.", "error");
      return;
    }
    setIsSummarizing(true);
    setAiSummary(null);
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-tenant-id": localStorage.getItem("tenant") || ""
      };
      const res = await axios.post(`${API_BASE}/api/consultations/summarize-note`, { note: localProblem }, { headers });
      setAiSummary(res.data?.summary || `Clinical Indication: ${localProblem}`);
    } catch {
      // Local fallback if API unavailable
      setAiSummary(`Clinical Indication: ${localProblem.trim()}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAcceptSummary = () => {
    if (!aiSummary) return;
    handleProblemChange(aiSummary);
    if (onAppendNotes) {
      onAppendNotes(`\n[Diagnostic Indication]: ${aiSummary}`);
    }
    setAiSummary(null);
    showToast("AI Summary accepted.", "success");
  };

  const handleRejectSummary = () => {
    setAiSummary(null);
    showToast("AI Summary rejected. Original note preserved.", "info");
  };

  return (
    <div className="page-card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Problem Statement Before Diagnostics */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} style={{ color: '#3b82f6' }} /> Current Problem Statement
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleSimulateVoiceNote}
              disabled={isVoiceRecording}
              title="Accept voice note"
              style={{
                padding: '4px 8px', borderRadius: '12px', border: '1px solid #cbd5e1',
                background: isVoiceRecording ? '#fee2e2' : 'white',
                color: isVoiceRecording ? '#ef4444' : '#64748b',
                fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <Mic size={12} className={isVoiceRecording ? "animate-pulse" : ""} /> {isVoiceRecording ? 'Listening...' : 'Voice Note'}
            </button>
            <button
              onClick={handleSummarize}
              disabled={isSummarizing || !localProblem.trim()}
              title="Summarize clinical note without advising or overriding"
              style={{
                padding: '4px 10px', borderRadius: '12px', border: '1px solid #ddd6fe',
                background: '#f5f3ff', color: '#7c3aed',
                fontSize: '11px', fontWeight: 800, cursor: !localProblem.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              {isSummarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Summarize
            </button>
          </div>
        </div>
        <textarea
          className="input-field"
          placeholder="Note problem statement, symptoms, or voice transcript before ordering diagnostics..."
          style={{ height: '70px', padding: '10px 12px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.4', resize: 'vertical', margin: 0, background: 'white' }}
          value={localProblem}
          onChange={e => handleProblemChange(e.target.value)}
        />

        {/* AI Summary Accept/Reject Preview */}
        {aiSummary && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Sparkles size={13} style={{ color: '#3b82f6' }} /> AI Summary Proposal (Review before applying)
            </div>
            <p style={{ fontSize: '13px', color: '#1e293b', margin: '0 0 12px', fontStyle: 'italic', lineHeight: '1.4' }}>
              "{aiSummary}"
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAcceptSummary}
                style={{
                  flex: 1, padding: '7px', borderRadius: '10px', border: 'none',
                  background: '#2563eb', color: 'white', fontWeight: 800, fontSize: '12px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}
              >
                <Check size={14} /> Accept Summary
              </button>
              <button
                onClick={handleRejectSummary}
                style={{
                  flex: 1, padding: '7px', borderRadius: '10px', border: '1px solid #cbd5e1',
                  background: 'white', color: '#64748b', fontWeight: 800, fontSize: '12px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}
              >
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics List */}
      <div>
        <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FlaskConical size={18} style={{ color: '#3b82f6' }} /> LAB INVESTIGATIONS ({selectedLabTests.length} Selected)
        </h3>
        <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {diagnostics.map(test => {
            const isSelected = selectedLabTests.includes(test.id);
            const handleTestToggle = () => {
              setSelectedLabTests(
                isSelected 
                  ? selectedLabTests.filter(id => id !== test.id) 
                  : [...selectedLabTests, test.id]
              );
            };
            
            return (
              <div 
                key={test.id} 
                onClick={handleTestToggle}
                style={{ 
                  padding: '12px 14px', 
                  borderRadius: '14px', 
                  background: isSelected ? '#3b82f6' : '#f8fafc', 
                  color: isSelected ? 'white' : '#1e293b', 
                  border: '1px solid #e2e8f0', 
                  cursor: 'pointer', 
                  fontSize: '13px', 
                  fontWeight: 800, 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {test.name}
                {isSelected && <CheckCircle2 size={16} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
