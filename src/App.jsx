import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Mic, MicOff, Plus, Trash2, Edit2, Scale, Calculator, RefreshCcw, HelpCircle } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useVoiceCommand } from './hooks/useVoiceCommand';
import { parseHebrewVoiceCommand, speakText, playChimeSuccess, playChimeError } from './utils/nlp';

function App() {
  const [containers, setContainers] = useLocalStorage('kitchen-containers', [
    { id: 1, name: 'קערה מנירוסטה', weight: 450, usageCount: 0 },
    { id: 2, name: 'תבנית פיירקס', weight: 800, usageCount: 0 },
    { id: 3, name: 'קערה כחולה', weight: 320, usageCount: 0 }
  ]);
  
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [grossWeight, setGrossWeight] = useState('');
  const [netWeight, setNetWeight] = useState(null);

  // State for Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [formName, setFormName] = useState('');
  const [formWeight, setFormWeight] = useState('');

  // Auto-calculate net weight
  useEffect(() => {
    if (selectedContainer && grossWeight !== '') {
      const net = parseFloat(grossWeight) - selectedContainer.weight;
      setNetWeight(net);
    } else {
      setNetWeight(null);
    }
  }, [grossWeight, selectedContainer]);

  const handleVoiceCommand = useCallback((transcript) => {
    const { weight, container } = parseHebrewVoiceCommand(transcript, containers);
    
    let updatedContainer = selectedContainer;
    let didMatchSomething = false;
    
    if (container) {
      setSelectedContainer(container);
      updatedContainer = container;
      didMatchSomething = true;
      setContainers(prev => prev.map(c => 
        c.id === container.id ? { ...c, usageCount: (c.usageCount || 0) + 1 } : c
      ));
    }
    
    if (weight !== null) {
      setGrossWeight(weight);
      didMatchSomething = true;
      
      if (updatedContainer) {
        const net = weight - updatedContainer.weight;
        setNetWeight(net);
        // Play premium success feedback chime
        playChimeSuccess();
        // Short TTS feedback
        speakText(`${net} גרם נטו ב${updatedContainer.name}`);
      } else {
        // Matched weight but need container
        playChimeSuccess();
        speakText(`הזנתי ${weight} גרם. בחר כלי לחישוב נטו.`);
      }
    }

    if (!didMatchSomething) {
      // Gentle warning chime
      playChimeError();
    }
  }, [containers, selectedContainer, setContainers]);

  const { isListening, isActiveProcessing, toggleListening, isSupported, error } = useVoiceCommand({
    onCommand: handleVoiceCommand,
    wakeWords: ['משקל', 'היי משקל', 'תשקול לי']
  });

  const sortedContainers = useMemo(() => {
    return [...containers].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }, [containers]);

  const saveContainer = () => {
    if (!formName || !formWeight) return;
    
    if (editingContainer) {
      setContainers(prev => prev.map(c => 
        c.id === editingContainer.id ? { ...c, name: formName, weight: parseFloat(formWeight) } : c
      ));
    } else {
      setContainers(prev => [...prev, { 
        id: Date.now(), 
        name: formName, 
        weight: parseFloat(formWeight), 
        usageCount: 0 
      }]);
    }
    closeModal();
  };

  const deleteContainer = (id, e) => {
    e.stopPropagation();
    if (window.confirm('האם אתה בטוח שברצונך למחוק כלי זה?')) {
      setContainers(prev => prev.filter(c => c.id !== id));
      if (selectedContainer?.id === id) {
        setSelectedContainer(null);
      }
    }
  };

  const openEdit = (container, e) => {
    e.stopPropagation();
    setEditingContainer(container);
    setFormName(container.name);
    setFormWeight(container.weight);
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setEditingContainer(null);
    setFormName('');
    setFormWeight('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleContainerSelect = (container) => {
    setSelectedContainer(container);
    setContainers(prev => prev.map(c => 
      c.id === container.id ? { ...c, usageCount: (c.usageCount || 0) + 1 } : c
    ));
    // Play subtle audio key feedback
    playChimeSuccess();
  };

  return (
    <div className="app-container" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background Orbs for premium look */}
      <div className="glow-orb glow-orb-1"></div>
      <div className="glow-orb glow-orb-2"></div>

      {/* Header */}
      <header className="flex-between" style={{ zIndex: 2 }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '1.8rem', fontWeight: 800 }}>אפליקציית שקילה</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>חישוב משקל נטו חכם • ללא מגע</p>
        </div>
        
        {isSupported && (
          <button 
            onClick={toggleListening}
            className={`btn-icon ${isActiveProcessing ? 'voice-active-ring' : isListening ? 'text-primary' : 'text-muted'}`}
            style={{ width: '58px', height: '58px', zIndex: 10, boxShadow: isListening ? '0 0 15px var(--primary-glow)' : 'none' }}
          >
            {isListening ? <Mic size={28} /> : <MicOff size={28} />}
          </button>
        )}
      </header>

      {error && (
        <div className="glass p-3 mb-2 text-center" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', zIndex: 2, borderRadius: '1rem' }}>
          <span style={{ color: '#ff6b6b', fontSize: '0.85rem', fontWeight: 600, direction: 'rtl', display: 'block' }}>
            {error === 'not-allowed' 
              ? '⚠️ גישת מיקרופון נחסמה. נא לאשר גישה בהגדרות הדפדפן (או לוודא שימוש בחיבור HTTPS מאובטח).' 
              : `⚠️ שגיאת מיקרופון: ${error}`}
          </span>
        </div>
      )}
      
      {isListening && !error && (
         <div className="flex-center" style={{ minHeight: '32px', margin: '0.2rem 0', zIndex: 2 }}>
           {isActiveProcessing ? (
             <div className="flex-center gap-3">
               <span className="text-primary animate-pulse" style={{ fontSize: '0.9rem', color: 'var(--danger)', fontWeight: 600 }}>האפליקציה מאזינה...</span>
               <div className="soundwave">
                 <div className="soundwave-bar"></div>
                 <div className="soundwave-bar"></div>
                 <div className="soundwave-bar"></div>
                 <div className="soundwave-bar"></div>
                 <div className="soundwave-bar"></div>
               </div>
             </div>
           ) : (
             <div className="text-center text-sm text-secondary" style={{ opacity: 0.8 }}>
               האזנה רציפה פעילה • אמור <span className="text-primary" style={{ fontWeight: 600 }}>"היי משקל"</span>
             </div>
           )}
         </div>
      )}

      {/* Main Digital Scale Display Area */}
      <section className="scale-display p-6 text-center" style={{ zIndex: 2 }}>
        <div className="scale-status-badge">
          {selectedContainer ? 'NET' : 'GROSS'}
        </div>
        <h2 className="text-muted mb-1" style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>משקל נטו במטבח</h2>
        <div style={{ fontSize: '4.5rem', fontWeight: '800', fontFamily: "'Outfit', monospace", lineHeight: 1.1 }} className="text-gradient mb-2 glow-text">
          {netWeight !== null ? `${netWeight}` : '0'}<span style={{ fontSize: '1.5rem', marginLeft: '4px', fontWeight: '400', verticalAlign: 'bottom' }}>g</span>
        </div>
        
        {selectedContainer ? (
          <div className="flex-center gap-2" style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: '999px', display: 'inline-flex', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-secondary" style={{ fontSize: '0.9rem' }}>כלי פעיל: <strong>{selectedContainer.name}</strong> ({selectedContainer.weight}g)</span>
            <button onClick={() => setSelectedContainer(null)} className="text-muted" style={{ padding: '2px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} title="אפס בחירת כלי">
              <RefreshCcw size={14} className="hover-spin" />
            </button>
          </div>
        ) : (
          <div className="text-muted" style={{ fontSize: '0.85rem' }}>אנא בחר כלי מטה או אמור פקודה קולית</div>
        )}
      </section>

      {/* Manual Weight Entry */}
      <section className="glass p-5" style={{ zIndex: 2 }}>
        <div className="flex-between mb-3">
          <h3 className="flex-center gap-2" style={{ fontSize: '1.05rem' }}><Calculator size={18}/> הזנת משקל ברוטו (כולל הכלי)</h3>
        </div>
        <input 
          type="number" 
          inputMode="numeric"
          className="input-glass text-center glow-focus" 
          style={{ fontSize: '2.2rem', fontWeight: '700', letterSpacing: '0.05em' }}
          placeholder="0"
          value={grossWeight}
          onChange={(e) => setGrossWeight(e.target.value)}
        />
      </section>

      {/* Containers Grid */}
      <section style={{ zIndex: 2 }}>
        <div className="flex-between mb-4">
          <h3 className="flex-center gap-2" style={{ fontSize: '1.05rem' }}><Scale size={18}/> הכלים שלי</h3>
          <button onClick={openAdd} className="btn-icon hover-glow">
            <Plus size={20} />
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {sortedContainers.map((c, index) => (
            <div 
              key={c.id} 
              onClick={() => handleContainerSelect(c)}
              className={`glass glass-interactive container-card ${selectedContainer?.id === c.id ? 'card-selected' : ''}`}
            >
              <div className="flex-between mb-2">
                <span style={{ fontWeight: 600, fontSize: '1.05rem', color: selectedContainer?.id === c.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{c.name}</span>
                {index < 2 && c.usageCount > 0 && (
                  <span className="badge-used" title="כלי שימושי במיוחד">⭐ נפוץ</span>
                )}
              </div>
              <div className="text-primary font-medium" style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {c.weight}<span style={{ fontSize: '0.85rem', fontWeight: 400, marginLeft: '2px' }}>g</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.8rem', opacity: 0.7 }} className="card-actions">
                <button onClick={(e) => openEdit(c, e)} className="text-muted hover-primary-text" style={{ padding: '4px' }}><Edit2 size={15}/></button>
                <button onClick={(e) => deleteContainer(c.id, e)} className="text-muted hover-danger-text" style={{ color: 'var(--danger-glow)', padding: '4px' }}><Trash2 size={15}/></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Elegant Voice Cheat Sheet */}
      <section className="glass p-4" style={{ marginTop: 'auto', zIndex: 2, border: '1px dashed var(--surface-border)' }}>
        <h4 className="flex-center gap-2" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', justifyContent: 'flex-start', marginBottom: '0.5rem' }}>
          <HelpCircle size={16} className="text-primary" />
          <span>כיצד להשתמש בפקודות קוליות?</span>
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>1. לחץ על המיקרופון למעלה כדי להפעיל האזנה רציפה.</div>
          <div>2. אמור <strong>"היי משקל"</strong> כדי להפעיל את הזיהוי.</div>
          <div>3. אמור פקודה כמו: <strong>"קילו וחצי בקערה מנירוסטה"</strong> או <strong>"מאתיים וחמישים גרם"</strong>.</div>
        </div>
      </section>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="glass modal-content p-6" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', fontWeight: 700 }}>{editingContainer ? 'ערוך כלי' : 'כלי חדש'}</h2>
            
            <div className="mb-4">
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>שם הכלי (למשל: תבנית פיירקס)</label>
              <input 
                type="text" 
                className="input-glass"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="למשל: קערה גדולה"
                autoFocus
              />
            </div>
            
            <div className="mb-6">
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>משקל ריק (בגרמים)</label>
              <input 
                type="number"
                inputMode="numeric"
                className="input-glass"
                value={formWeight}
                onChange={e => setFormWeight(e.target.value)}
                placeholder="0"
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={saveContainer} className="btn-primary" style={{ flex: 1 }}>שמור</button>
              <button onClick={closeModal} className="btn-icon" style={{ flex: 1, width: 'auto', borderRadius: '1rem' }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
