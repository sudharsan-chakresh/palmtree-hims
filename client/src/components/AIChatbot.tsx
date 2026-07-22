import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { MessageSquare, X, Send, GripVertical, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const API_BASE = API_BASE_URL;
const STORAGE_KEY = 'chatbot_position';

// Position type: either "anchored" (bottom-right corner) or "free" (user dragged it)
type WidgetPos = { mode: 'anchored' } | { mode: 'free'; left: number; top: number };

const AIChatbot: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: "Hello! I'm your Palmtree Wellness AI Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- DRAG STATE ---
  const widgetRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, elLeft: 0, elTop: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Load saved position
  const loadPos = (): WidgetPos => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        // Validate it's in-bounds before using it
        if (
          typeof p.left === 'number' && typeof p.top === 'number' &&
          p.left >= 0 && p.left < window.innerWidth &&
          p.top >= 0 && p.top < window.innerHeight
        ) {
          return { mode: 'free', left: p.left, top: p.top };
        }
      }
    } catch {}
    return { mode: 'anchored' };
  };

  const [pos, setPos] = useState<WidgetPos>({ mode: 'anchored' });

  // Load saved position after mount (so window.innerWidth/Height are correct)
  useEffect(() => {
    setPos(loadPos());
  }, []);

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elLeft: rect.left,
      elTop: rect.top
    };
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPos({
        mode: 'free',
        left: clamp(dragStartRef.current.elLeft + dx, 0, window.innerWidth - 72),
        top: clamp(dragStartRef.current.elTop + dy, 0, window.innerHeight - 72)
      });
    };

    const onUp = (e: MouseEvent) => {
      isDraggingRef.current = false;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const finalPos = {
        mode: 'free' as const,
        left: clamp(dragStartRef.current.elLeft + dx, 0, window.innerWidth - 72),
        top: clamp(dragStartRef.current.elTop + dy, 0, window.innerHeight - 72)
      };
      setPos(finalPos);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: finalPos.left, top: finalPos.top }));
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    try {
      const tenantId = localStorage.getItem('tenant') || '';
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/api/hospital/ai/chat`, {
        messages: [...messages, userMessage]
      }, {
        headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId }
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error. Please check the clinical modules for data." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const isConsultationRoute = location.pathname.startsWith('/tenant/opd/consultation');
  if (
    !isConsultationRoute ||
    location.pathname === '/' ||
    location.pathname === '/login' ||
    localStorage.getItem('isAutomation') === 'true'
  ) {
    return null;
  }

  // Build the position style: anchored = bottom-right, free = top-left absolute
  const posStyle: React.CSSProperties = pos.mode === 'anchored'
    ? { position: 'fixed', bottom: '30px', left: '300px', zIndex: 999999 }
    : { position: 'fixed', left: `${pos.left}px`, top: `${pos.top}px`, zIndex: 999999 };

  return (
    <>
      <style>{`
        @keyframes chatbot-float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        .chatbot-floating { animation: chatbot-float 4s ease-in-out infinite; }
        .chatbot-floating:hover { animation-play-state: paused; }
        .chatbot-dragging { animation: none !important; }
        .chatbot-grip { cursor: grab; user-select: none; }
        .chatbot-grip:active { cursor: grabbing; }
      `}</style>

      <div
        ref={widgetRef}
        style={{ ...posStyle, fontFamily: 'sans-serif', userSelect: 'none' }}
      >
        {/* Chat Window */}
        {isOpen && (
          <div style={{
            backgroundColor: '#ffffff',
            width: '380px',
            height: '520px',
            borderRadius: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            marginBottom: '16px'
          }}>
            {/* Header — drag handle */}
            <div
              onMouseDown={onMouseDown}
              className="chatbot-grip"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
                <GripVertical size={16} style={{ opacity: 0.7 }} />
                <MessageSquare size={18} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Palmtree Wellness AI</div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>⠿ Drag to move</div>
                </div>
              </div>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{
              flex: 1, padding: '16px', overflowY: 'auto', backgroundColor: '#f8fafc',
              display: 'flex', flexDirection: 'column', gap: '14px'
            }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    backgroundColor: m.role === 'user' ? '#2563eb' : '#ffffff',
                    color: m.role === 'user' ? '#ffffff' : '#334155',
                    padding: '10px 14px', borderRadius: '14px', fontSize: '13px', maxWidth: '85%',
                    boxShadow: m.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                    border: m.role === 'user' ? 'none' : '1px solid #e2e8f0', lineHeight: 1.5
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                  <Loader2 size={14} />
                  Analyzing hospital metrics...
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Ask me anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid #e2e8f0', outline: 'none', fontSize: '13px'
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  style={{
                    padding: '10px 14px', backgroundColor: '#2563eb', color: 'white',
                    border: 'none', borderRadius: '10px', cursor: 'pointer',
                    opacity: (isLoading || !input.trim()) ? 0.5 : 1
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Toggle Button */}
        {!isOpen && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Drag grip tab above the button */}
            <div
              onMouseDown={onMouseDown}
              className="chatbot-grip"
              title="Drag to reposition"
              style={{
                position: 'absolute',
                top: '-22px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(99,102,241,0.2)',
                borderRadius: '6px 6px 0 0',
                padding: '3px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                whiteSpace: 'nowrap'
              }}
            >
              <GripVertical size={13} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '9px', color: '#6366f1', fontWeight: 700 }}>DRAG</span>
            </div>

            <button
              onClick={() => {
                if (!isDraggingRef.current) setIsOpen(true);
              }}
              className={isDragging ? 'chatbot-dragging' : 'chatbot-floating'}
              style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
                borderRadius: '50%',
                border: 'none',
                boxShadow: '0 8px 25px rgba(99,102,241,0.45)',
                color: 'white',
                cursor: isDragging ? 'grabbing' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MessageSquare size={28} />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default AIChatbot;
