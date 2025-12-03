import React, { useRef, useState, useMemo } from 'react';
import {
  Filter, Search, ListChecks, CheckCircle2, Merge, Activity, Save,
  Clock, Trash2, Camera, BookOpen, MoreHorizontal, BrainCircuit,
  ThumbsUp, ThumbsDown, TrendingUp, ImageIcon, Bot
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trade, TradeConfig, Annotation, cn } from "@/lib/trade-utils";
import { analyzeTrade } from "@/app/actions/ai-analysis";

interface JournalProps {
  trades: Trade[];
  filteredTrades: Trade[];
  selectedTrade: Trade | undefined;
  selectedTradeId: string | null;
  setSelectedTradeId: (id: string | null) => void;
  config: TradeConfig;
  filters: any;
  setFilters: (filters: any) => void;
  selectionMode: boolean;
  setSelectionMode: (mode: boolean) => void;
  selectedIds: string[];
  toggleSelectId: (id: string, e: any) => void;
  mergeSelectedTrades: () => void;
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  isTradeSaved: boolean;
  handleTradeSave: () => void;
}

export const Journal = ({
  trades, filteredTrades, selectedTrade, selectedTradeId, setSelectedTradeId,
  config, filters, setFilters, selectionMode, setSelectionMode, selectedIds,
  toggleSelectId, mergeSelectedTrades, setTrades, isTradeSaved, handleTradeSave
}: JournalProps) => {

  const [showOverlay, setShowOverlay] = useState(true);
  const [draggingId, setDraggingId] = useState<number | string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [annoModal, setAnnoModal] = useState<{ isOpen: boolean, id: number | string | null, x: number, y: number, text: string, category: 'entry' | 'exit' | 'mgmt' | 'general', tagType: string, tagValue: string }>({ isOpen: false, id: null, x: 0, y: 0, text: '', category: 'general', tagType: '', tagValue: '' });
  const [barCalc, setBarCalc] = useState({ start: "09:30", tf: 5 });
  const [aiAnalysis, setAiAnalysis] = useState<{ loading: boolean, result: string | null }>({ loading: false, result: null });
  const [includeChart, setIncludeChart] = useState(false);
  const imageUploadRef = useRef<HTMLInputElement>(null);

  const handleAiAnalyze = async () => {
    if (!selectedTrade) return;
    setAiAnalysis({ loading: true, result: null });

    const tradePayload = { ...selectedTrade };

    // If not including chart or no chart exists, remove it to save bandwidth/tokens
    if (!includeChart || !tradePayload.chartImage) {
        delete (tradePayload as any).chartImage;
    }

    const response = await analyzeTrade(tradePayload, includeChart);
    if (response.success) {
        setAiAnalysis({ loading: false, result: response.text || "" });
    } else {
        setAiAnalysis({ loading: false, result: "Analysis failed. Ensure API Key is set." });
    }
  };

  const renderFilters = (context = 'sidebar') => {
      const isFull = context === 'full';
      const containerClass = isFull
        ? "flex flex-wrap items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl mb-6 shadow-sm no-print"
        : "flex flex-wrap items-center gap-2 p-2 bg-slate-900 border-b border-slate-800 no-print";
      const inputClass = isFull
        ? "w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition shadow-inner"
        : "w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none";
      const selectClass = isFull
        ? "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 shadow-inner"
        : "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500";

      return (
          <div className={containerClass}>
             {isFull && <div className="text-sm font-bold text-white mr-2 flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-500" /> Filter Data:</div>}
             <div className="relative flex-grow max-w-xs">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 ${isFull ? 'w-4 h-4' : 'w-3 h-3'}`} />
                <input type="text" placeholder="Search symbol, setup..." className={inputClass} value={filters.text} onChange={(e) => setFilters({...filters, text: e.target.value})} />
             </div>
             <select className={selectClass} value={filters.setup} onChange={(e) => setFilters({...filters, setup: e.target.value})}>
                 <option value="All">All Setups</option>
                 {config.setups.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
             <select className={selectClass} value={filters.side} onChange={(e) => setFilters({...filters, side: e.target.value})}>
                 <option value="All">All Sides</option>
                 <option value="Long">Long</option>
                 <option value="Short">Short</option>
             </select>
             <select className={selectClass} value={filters.outcome} onChange={(e) => setFilters({...filters, outcome: e.target.value})}>
                 <option value="All">All Outcomes</option>
                 <option value="Win">Winners</option>
                 <option value="Loss">Losers</option>
             </select>
             {context === 'sidebar' && (
                 <button
                    onClick={() => {
                        setSelectionMode(!selectionMode);
                        // Reset selectedIds logic handled in parent or here? Parent resets it.
                        // Actually toggleSelectionMode in parent resets IDs.
                    }}
                    className={cn("p-1.5 rounded transition ml-1", selectionMode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800')}
                    title="Select Multiple Trades"
                 >
                     <ListChecks className="w-4 h-4" />
                 </button>
             )}
             <div className={cn("ml-auto text-slate-500", isFull ? 'text-sm font-medium' : 'text-xs')}>{filteredTrades.length} trades found</div>
          </div>
      );
  };

  const updateTradeImage = (base64: string) => {
      if (!selectedTrade) return;
      setTrades(prev => prev.map(t => t.id === selectedTradeId ? { ...t, chartImage: base64 } : t));
  };

  const handleImagePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if(blob) {
                const reader = new FileReader();
                reader.onload = (event) => updateTradeImage(event.target?.result as string);
                reader.readAsDataURL(blob);
            }
        }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => updateTradeImage(event.target?.result as string);
          reader.readAsDataURL(file);
      }
  };

  const deleteImage = () => {
    if (!selectedTrade) return;
    setTrades(prev => prev.map(t => t.id === selectedTradeId ? { ...t, chartImage: null, annotations: [] } : t));
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingId && selectedTrade) {
          const rect = e.currentTarget.getBoundingClientRect();
          const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
          setTrades(prev => prev.map(t => {
              if (t.id === selectedTradeId) {
                  return { ...t, annotations: t.annotations.map(a => a.id === draggingId ? { ...a, x: xPct, y: yPct } : a) };
              }
              return t;
          }));
      }
  };

  const handleContainerMouseUp = () => { if (draggingId) setDraggingId(null); };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if(draggingId || (e.target as HTMLElement).closest('.annotation-marker')) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      setAnnoModal({ isOpen: true, id: null, x: xPct, y: yPct, text: '', category: 'general', tagType: '', tagValue: '' });
  };

  const handleMarkerMouseDown = (e: React.MouseEvent, annoId: string | number) => {
      e.stopPropagation(); e.preventDefault();
      setDraggingId(annoId);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMarkerClick = (e: React.MouseEvent, anno: Annotation) => {
      e.stopPropagation();
      const dist = Math.sqrt(Math.pow(e.clientX - dragStartRef.current.x, 2) + Math.pow(e.clientY - dragStartRef.current.y, 2));
      if (dist < 5) {
          setAnnoModal({ isOpen: true, id: anno.id, x: anno.x, y: anno.y, text: anno.text, category: anno.category, tagType: anno.tagType || '', tagValue: anno.tagValue || '' });
      }
  };

  const saveAnnotation = () => {
      if(!selectedTrade) return;
      const newAnno: Annotation = {
          id: annoModal.id || Date.now(),
          x: annoModal.x, y: annoModal.y,
          text: annoModal.text, category: annoModal.category,
          tagType: annoModal.tagType, tagValue: annoModal.tagValue
      };
      setTrades(prev => prev.map(t => {
          if(t.id === selectedTrade.id) {
              let newAnnotations = [...(t.annotations || [])];
              if (annoModal.id) newAnnotations = newAnnotations.map(a => a.id === annoModal.id ? newAnno : a);
              else newAnnotations.push(newAnno);

              let updatedNotes = { ...t.notes };
              const noteKey = annoModal.category;
              const noteText = `[Chart] ${annoModal.text}`;

              if (annoModal.id) {
                   const oldAnno = t.annotations.find(a => a.id === annoModal.id);
                   if (oldAnno && oldAnno.text !== annoModal.text) {
                        const oldString = `[Chart] ${oldAnno.text}`;
                        if (updatedNotes[noteKey].includes(oldString)) {
                             updatedNotes[noteKey] = updatedNotes[noteKey].replace(oldString, noteText);
                        } else {
                             updatedNotes[noteKey] = (updatedNotes[noteKey] || "") + "\n" + noteText;
                        }
                   }
              } else {
                   updatedNotes[noteKey] = (updatedNotes[noteKey] || "") + (updatedNotes[noteKey] ? "\n" : "") + noteText;
              }

              let updatedMeta = { mistakes: [...t.mistakes], successes: [...t.successes], mindsets: [...t.mindsets], setup: t.setup };
              if (annoModal.tagType && annoModal.tagValue) {
                  if (annoModal.tagType === 'setup') {
                      updatedMeta.setup = annoModal.tagValue;
                  } else if (annoModal.tagType === 'mistake') {
                      if (!updatedMeta.mistakes.includes(annoModal.tagValue)) updatedMeta.mistakes.push(annoModal.tagValue);
                  } else if (annoModal.tagType === 'success') {
                      if (!updatedMeta.successes.includes(annoModal.tagValue)) updatedMeta.successes.push(annoModal.tagValue);
                  } else if (annoModal.tagType === 'mindset') {
                      if (!updatedMeta.mindsets.includes(annoModal.tagValue)) updatedMeta.mindsets.push(annoModal.tagValue);
                  }
              }
              return { ...t, annotations: newAnnotations, notes: updatedNotes, ...updatedMeta };
          }
          return t;
      }));
      setAnnoModal({ ...annoModal, isOpen: false });
  };

  const deleteAnnotation = () => {
      if(!selectedTrade || !annoModal.id) return;
      setTrades(prev => prev.map(t => {
          if(t.id === selectedTrade.id) {
              return { ...t, annotations: t.annotations.filter(a => a.id !== annoModal.id) };
          }
          return t;
      }));
      setAnnoModal({ ...annoModal, isOpen: false });
  };

  const handleUpdateTrade = (field: string, value: string) => {
    if (!selectedTrade) return;
    setTrades(prev => prev.map(t => {
      if (t.id === selectedTrade.id) {
        if (['entry', 'exit', 'mgmt', 'general'].includes(field)) {
          return { ...t, notes: { ...t.notes, [field]: value } };
        }
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  const toggleTag = (type: 'mistakes' | 'successes' | 'mindsets', tag: string) => {
    if (!selectedTrade) return;
    const currentTags = selectedTrade[type] || [];
    const newTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
    setTrades(prev => prev.map(t => t.id === selectedTradeId ? { ...t, [type]: newTags } : t));
  };

  const getBarIndex = (timestamp: number, sessionStartStr: string, tfMinutes: number) => {
      if (!timestamp) return "-";
      const d = new Date(timestamp);
      const [h, m] = sessionStartStr.split(':').map(Number);
      const sessionStart = new Date(d);
      sessionStart.setHours(h, m, 0, 0);

      const diff = d.getTime() - sessionStart.getTime();
      if (diff < 0) return "Pre";

      const msPerBar = tfMinutes * 60 * 1000;
      return Math.floor(diff / msPerBar) + 1;
  };

  return (
    <div className="flex h-full overflow-hidden" onPaste={handleImagePaste}>
      {/* Modal for Annotations */}
      {annoModal.isOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setAnnoModal({...annoModal, isOpen: false})}>
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h3 className="text-white font-bold mb-4">Add Annotation</h3>
                  <textarea
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white mb-4 text-sm"
                      rows={3}
                      value={annoModal.text}
                      onChange={e => setAnnoModal({...annoModal, text: e.target.value})}
                      placeholder="Note..."
                      autoFocus
                  />
                  <div className="mb-4">
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Category</label>
                      <select
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white text-sm"
                          value={annoModal.category}
                          onChange={e => setAnnoModal({...annoModal, category: e.target.value as any})}
                      >
                          <option value="general">General</option>
                          <option value="entry">Entry</option>
                          <option value="exit">Exit</option>
                          <option value="mgmt">Management</option>
                      </select>
                  </div>
                   <div className="mb-4">
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Quick Tag (Optional)</label>
                      <select
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white text-sm mb-2"
                          value={annoModal.tagType}
                          onChange={e => setAnnoModal({...annoModal, tagType: e.target.value, tagValue: ''})}
                      >
                          <option value="">None</option>
                          <option value="setup">Setup</option>
                          <option value="mistake">Mistake</option>
                          <option value="success">Habit</option>
                          <option value="mindset">Mindset</option>
                      </select>
                      {annoModal.tagType && (
                          <select
                             className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white text-sm"
                             value={annoModal.tagValue}
                             onChange={e => setAnnoModal({...annoModal, tagValue: e.target.value})}
                          >
                              <option value="">Select Value...</option>
                              {annoModal.tagType === 'setup' && config.setups.map(s => <option key={s} value={s}>{s}</option>)}
                              {annoModal.tagType === 'mistake' && config.mistakes.map(s => <option key={s} value={s}>{s}</option>)}
                              {annoModal.tagType === 'success' && config.successes.map(s => <option key={s} value={s}>{s}</option>)}
                              {annoModal.tagType === 'mindset' && config.mindsets.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      )}
                  </div>
                  <div className="flex justify-end gap-2">
                      {annoModal.id && <button onClick={deleteAnnotation} className="px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded text-xs font-bold hover:bg-rose-500/30">Delete</button>}
                      <button onClick={() => setAnnoModal({...annoModal, isOpen: false})} className="px-3 py-1.5 text-slate-400 text-xs font-bold hover:text-white">Cancel</button>
                      <button onClick={saveAnnotation} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-500">Save</button>
                  </div>
              </div>
          </div>
      )}

      <div className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-900/30 flex flex-col relative no-print">
        {renderFilters('sidebar')}

        {/* Selection Merge Banner */}
        {selectionMode && selectedIds.length > 1 && (
            <div className="absolute bottom-4 left-4 right-4 z-20 bg-indigo-600 rounded-lg p-3 shadow-lg flex justify-between items-center animate-in slide-in-from-bottom-2">
                <span className="text-white font-bold text-xs">{selectedIds.length} Selected</span>
                <button onClick={mergeSelectedTrades} className="flex items-center gap-2 bg-white text-indigo-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-100 transition">
                    <Merge className="w-3 h-3" /> Merge
                </button>
            </div>
        )}

        <div className="flex-grow overflow-y-auto pb-20">
          {filteredTrades.map(trade => {
            const isSelected = selectedIds.includes(trade.id);
            const startDate = new Date(trade.time).toLocaleDateString();
            const endDate = new Date(trade.endTime).toLocaleDateString();
            const dateDisplay = startDate !== endDate ? `${startDate} - ${endDate}` : startDate;

            return (
            <div
              key={trade.id}
              onClick={(e) => {
                  if(selectionMode) toggleSelectId(trade.id, e);
                  else setSelectedTradeId(trade.id);
              }}
              className={cn("p-4 border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-800/50 relative",
                  isSelected ? 'bg-indigo-900/20 border-l-2 border-l-indigo-500' :
                  selectedTradeId === trade.id ? 'bg-slate-800 border-l-2 border-l-indigo-500' :
                  'border-l-2 border-l-transparent'
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {selectionMode && (
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition", isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-900')}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                  )}
                  <span className="font-bold text-slate-200">{trade.instrument}</span>
                  <Badge variant={trade.direction === 'Long' ? 'green' : 'red'}>{trade.direction}</Badge>
                </div>
                <span className={cn("font-mono font-bold", trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end mt-2">
                <span className="text-[10px] text-slate-500">{dateDisplay}</span>
                <div className="flex gap-1 items-center">
                  {trade.chartImage && <ImageIcon className="w-3 h-3 text-slate-500" />}
                  {trade.setup && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                </div>
              </div>
            </div>
          )})}
          {filteredTrades.length === 0 && <div className="p-8 text-center text-slate-500 text-xs">No trades match filters.</div>}
        </div>
      </div>

      <div className="flex-grow flex flex-col bg-[#020617] relative overflow-hidden print:w-full print:bg-white print:overflow-visible">
        {!selectedTrade ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 no-print">
            <Activity className="w-8 h-8 opacity-50 mb-4" />
            <p className="font-medium text-slate-500">Select a trade to analyze</p>
          </div>
        ) : (
          <div className="flex-col flex h-full overflow-y-auto print:overflow-visible print:h-auto">
            <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-10 print:static print:bg-white print:border-slate-200">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white print:text-black">{selectedTrade.instrument}</h2>
                <Badge variant={selectedTrade.direction === 'Long' ? 'green' : 'red'}>{selectedTrade.direction}</Badge>
                <span className="text-xs text-slate-500 font-mono">{new Date(selectedTrade.time).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Net P&L</div>
                    <div className={cn("text-xl font-mono font-bold print:text-black", selectedTrade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}</div>
                  </div>
                  <div className="h-8 w-px bg-slate-800 mx-2 no-print"></div>
                  <button onClick={handleTradeSave} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border transition no-print", isTradeSaved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white')}>
                      <Save className="w-4 h-4" />
                      <span className="text-xs font-medium">{isTradeSaved ? 'Saved' : 'Save'}</span>
                  </button>
              </div>
            </div>

            <div className="p-6 space-y-6 print:space-y-4">

              {/* Bar Index Calculator Tool */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center gap-6 shadow-md no-print">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold shrink-0">
                      <Clock className="w-5 h-5" />
                      <span className="text-sm">Bar Locator</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 text-xs uppercase font-bold">Session:</span>
                      <input
                          type="time"
                          value={barCalc.start}
                          onChange={(e) => setBarCalc({...barCalc, start: e.target.value})}
                          className="bg-transparent text-white text-sm outline-none w-24 font-mono font-bold"
                      />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 text-xs uppercase font-bold">TF:</span>
                      <select
                          value={barCalc.tf}
                          onChange={(e) => setBarCalc({...barCalc, tf: Number(e.target.value)})}
                          className="bg-transparent text-white text-sm outline-none font-bold"
                      >
                          <option value={1}>1 min</option>
                          <option value={2}>2 min</option>
                          <option value={5}>5 min</option>
                          <option value={15}>15 min</option>
                          <option value={30}>30 min</option>
                          <option value={60}>1 hour</option>
                      </select>
                  </div>
                  <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                  <div className="flex gap-6 text-sm">
                      <div>
                          <span className="text-slate-500 mr-2 uppercase font-bold text-xs">Entry Bar:</span>
                          <span className="text-emerald-400 font-mono font-bold text-lg">#{getBarIndex(selectedTrade.time, barCalc.start, barCalc.tf)}</span>
                      </div>
                      {selectedTrade.endTime !== selectedTrade.time && (
                          <div>
                              <span className="text-slate-500 mr-2 uppercase font-bold text-xs">Exit Bar:</span>
                              <span className="text-rose-400 font-mono font-bold text-lg">#{getBarIndex(selectedTrade.endTime, barCalc.start, barCalc.tf)}</span>
                          </div>
                      )}
                  </div>
              </div>

              <Card className="min-h-[380px] w-full relative group bg-slate-950 flex flex-col border-slate-800 border-2 border-dashed hover:border-indigo-500/50 transition-colors overflow-hidden print:border-slate-200 print:bg-white print:min-h-[300px] print:border-solid">
                 {selectedTrade.chartImage ? (
                    <>
                    <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50 no-print">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-0" />
                            <span className="text-xs text-slate-400 font-medium">Show Overlay Text</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">Drag dots to move • Click to edit</span>
                            <button onClick={(e) => { e.stopPropagation(); deleteImage(); }} className="text-slate-500 hover:text-rose-500 transition"><Trash2 className="w-3 h-3" /></button>
                        </div>
                    </div>
                    <div className="relative w-full flex-grow bg-black group-image cursor-crosshair overflow-hidden print:bg-white" onMouseMove={handleContainerMouseMove} onMouseUp={handleContainerMouseUp} onMouseLeave={handleContainerMouseUp} onClick={handleImageClick}>
                        <img src={selectedTrade.chartImage} className="w-full h-full object-contain pointer-events-none select-none max-h-[600px] print:max-h-full" alt="Trade Chart" />
                        {selectedTrade.annotations && selectedTrade.annotations.map(anno => {
                            let color = 'bg-indigo-500';
                            if (anno.category === 'entry') color = 'bg-emerald-500';
                            if (anno.category === 'exit') color = 'bg-rose-500';
                            if (anno.category === 'mgmt') color = 'bg-amber-500';
                            return (
                                <div key={anno.id} className={`annotation-marker absolute flex items-center group/marker`} style={{ left: `${anno.x}%`, top: `${anno.y}%` }}>
                                    <div className={`w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg ${color} flex items-center justify-center cursor-move transform hover:scale-125 transition-transform z-20 print:border-slate-800`} onMouseDown={(e) => handleMarkerMouseDown(e, anno.id)} onClick={(e) => handleMarkerClick(e, anno)}>
                                        <span className="text-[10px] font-bold text-white select-none">{anno.category[0].toUpperCase()}</span>
                                    </div>
                                    {(showOverlay || draggingId === anno.id) ? (
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 border border-slate-700/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg z-10 pointer-events-none print:bg-white print:text-black print:border-slate-300 print:shadow-none">{anno.text}</div>
                                    ) : (
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none z-30 print:opacity-100 print:bg-white print:text-black print:border print:border-slate-300">{anno.text}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    </>
                 ) : (
                    <div className="text-center p-10 cursor-pointer flex-grow flex flex-col items-center justify-center no-print" onClick={() => imageUploadRef.current?.click()}>
                        <div className="w-16 h-16 rounded-full bg-slate-900 mx-auto flex items-center justify-center mb-4 text-indigo-500"><Camera className="w-8 h-8" /></div>
                        <h3 className="text-lg font-bold text-slate-300">Upload Chart Screenshot</h3>
                        <p className="text-slate-500 text-xs mt-2 max-w-sm mx-auto">Paste image (Ctrl+V) directly here, or click to browse.</p>
                        <input type="file" accept="image/*" className="hidden" ref={imageUploadRef} onChange={handleImageSelect} />
                    </div>
                 )}
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 print:block">
                <div className="space-y-4 print:mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 print:text-slate-600"><BookOpen className="w-4 h-4" /> Logic Breakdown</h3>
                  {[{ id: 'entry', label: 'Entry Logic', color: 'text-emerald-500' }, { id: 'exit', label: 'Exit Logic', color: 'text-rose-500' }, { id: 'mgmt', label: 'Management', color: 'text-amber-500' }].map(field => (
                    <div key={field.id} className="print:mb-2">
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${field.color}`}>{field.label}</label>
                      <textarea className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none h-24 resize-none placeholder:text-slate-700 print:bg-white print:text-black print:border-slate-200 print:h-auto print:min-h-[60px]" placeholder={`Describe your ${field.label.toLowerCase()}...`} value={selectedTrade.notes[field.id as keyof typeof selectedTrade.notes]} onChange={(e) => handleUpdateTrade(field.id, e.target.value)} />
                    </div>
                  ))}
                </div>

                <div className="space-y-4 print:mb-6">
                   {/* AI Analysis Card */}
                   <Card className="p-4 border-indigo-500/30 bg-indigo-900/10 print:border-slate-300 print:bg-white print:shadow-none">
                       <div className="flex justify-between items-start mb-2">
                           <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2 print:text-black">
                               <Bot className="w-4 h-4" /> AI Coach
                           </h3>
                           <div className="flex items-center gap-2">
                               {selectedTrade.chartImage && (
                                   <label className="flex items-center gap-1 cursor-pointer select-none">
                                       <input
                                           type="checkbox"
                                           checked={includeChart}
                                           onChange={(e) => setIncludeChart(e.target.checked)}
                                           className="w-3 h-3 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-0"
                                       />
                                       <span className="text-[10px] text-slate-400">Include Chart</span>
                                   </label>
                               )}
                               <button
                                 onClick={handleAiAnalyze}
                                 disabled={aiAnalysis.loading}
                                 className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition disabled:opacity-50 print:hidden"
                               >
                                   {aiAnalysis.loading ? 'Thinking...' : 'Analyze Trade'}
                               </button>
                           </div>
                       </div>
                       {aiAnalysis.result ? (
                           <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap print:text-black">
                               {aiAnalysis.result}
                           </div>
                       ) : (
                           <p className="text-[10px] text-slate-500 italic print:hidden">Click analyze to get feedback on this trade.</p>
                       )}
                   </Card>

                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 print:text-slate-600"><MoreHorizontal className="w-4 h-4" /> Review</h3>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Setup Type</label>
                    <div className="flex flex-wrap gap-2">
                      {config.setups.map(s => (
                        <button key={s} onClick={() => handleUpdateTrade('setup', s)} className={cn("px-2 py-1 rounded text-[10px] border transition", selectedTrade.setup === s ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden')}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><BrainCircuit className="w-3 h-3 text-indigo-400" /> Mental State</label>
                    <div className="flex flex-wrap gap-2">
                      {config.mindsets.map(m => (
                        <button key={m} onClick={() => toggleTag('mindsets', m)} className={cn("px-2 py-1 rounded text-[10px] border transition", selectedTrade.mindsets?.includes(m) ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden')}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <Card className="p-4 space-y-4 print:border-none print:shadow-none print:p-0">
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-500 uppercase mb-2 flex items-center gap-2"><ThumbsUp className="w-3 h-3" /> Good Habits</label>
                        <div className="flex flex-wrap gap-2">
                          {config.successes.map(s => (
                            <button key={s} onClick={() => toggleTag('successes', s)} className={cn("px-2 py-1 rounded text-[10px] border transition", selectedTrade.successes.includes(s) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden')}>{s}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-rose-500 uppercase mb-2 flex items-center gap-2"><ThumbsDown className="w-3 h-3" /> Mistakes</label>
                        <div className="flex flex-wrap gap-2">
                          {config.mistakes.map(s => (
                            <button key={s} onClick={() => toggleTag('mistakes', s)} className={cn("px-2 py-1 rounded text-[10px] border transition", selectedTrade.mistakes.includes(s) ? 'bg-rose-500/20 border-rose-500 text-rose-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden')}>{s}</button>
                          ))}
                        </div>
                      </div>
                  </Card>
                </div>

                <div className="space-y-4 print:break-inside-avoid">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 print:text-slate-600"><TrendingUp className="w-4 h-4" /> Execution Log</h3>
                  <Card className="h-64 flex flex-col print:h-auto print:border-slate-200 print:bg-white">
                    <div className="p-2 bg-slate-900/80 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase flex justify-between px-4 print:bg-slate-100 print:border-slate-200">
                      <span>Date/Time</span>
                      <span>Price</span>
                    </div>
                    <div className="overflow-y-auto p-0 print:overflow-visible">
                      <table className="w-full text-[10px] text-left">
                        <tbody className="divide-y divide-slate-800/50 print:divide-slate-200">
                          {selectedTrade.executions.map((ex, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="p-3 font-mono text-slate-400 print:text-black">
                                <div className="opacity-50 text-[9px]">{new Date(ex.time).toLocaleDateString()}</div>
                                <div>{new Date(ex.time).toLocaleTimeString([], {hour12:false})}</div>
                              </td>
                              <td className={cn("p-3 font-bold print:text-black", ex.side === 'Buy' ? 'text-emerald-400' : 'text-rose-400')}>{ex.side}</td>
                              <td className="p-3 text-right text-slate-300 print:text-black">{ex.qty}</td>
                              <td className="p-3 text-right font-mono text-slate-300 print:text-black">{ex.price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
