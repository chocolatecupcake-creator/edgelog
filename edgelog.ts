import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, AreaChart, Area
} from 'recharts';
import { 
  LayoutDashboard, BookOpen, Settings, PlayCircle, Upload, Calendar as CalendarIcon, 
  Search, Plus, Trash2, TrendingUp, TrendingDown, Activity,
  AlertCircle, CheckCircle2, MoreHorizontal, ChevronRight, X,
  Image as ImageIcon, Camera, Maximize2, MapPin, Tag, MessageSquare, Move, Save,
  BrainCircuit, ThumbsUp, ThumbsDown, Filter, ChevronLeft, ChevronRight as ChevronRightIcon,
  Lightbulb, Zap, AlertTriangle, ListChecks, Merge, Clock, FileText, Printer
} from 'lucide-react';

// --- HELPER: CSV Line Parser (Handles Quoted Strings) ---
const parseCSVLine = (text) => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') {
            inQuotes = !inQuotes;
        } else if (text[i] === ',' && !inQuotes) {
            let field = text.substring(start, i).trim();
            // Remove wrapping quotes if present
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.substring(1, field.length - 1);
            }
            result.push(field);
            start = i + 1;
        }
    }
    // Push last field
    let field = text.substring(start).trim();
    if (field.startsWith('"') && field.endsWith('"')) {
        field = field.substring(1, field.length - 1);
    }
    result.push(field);
    return result;
};

// --- HELPER: Raw Execution Parser (Format 1) ---
const processImport = (rawExecutions) => {
  // 1. Sort by time
  rawExecutions.sort((a,b) => new Date(a.time) - new Date(b.time));
  
  const trades = [];
  let currentTrade = null;
  let position = 0;
  let idCounter = Date.now();

  rawExecutions.forEach(ex => {
    const qty = parseFloat(ex.qty);
    const price = parseFloat(ex.price);
    const isBuy = ex.side.toLowerCase().includes('buy');
    const dir = isBuy ? 1 : -1;

    // Start new trade if flat
    if (position === 0) {
      currentTrade = {
        id: `trade-${idCounter++}`,
        instrument: ex.instrument,
        direction: isBuy ? 'Long' : 'Short',
        time: ex.time, // Start time
        endTime: ex.time,
        executions: [],
        chartImage: null, 
        annotations: [], 
        pnl: 0,
        equityCurve: 0,
        setup: '',
        mistakes: [],
        successes: [],
        mindsets: [], 
        notes: { entry: '', exit: '', mgmt: '', general: '' }
      };
      trades.push(currentTrade);
    }

    // Update position
    position += (qty * dir);
    
    // Determine execution role (Open/Close/Add/Trim)
    let role = 'Open';
    if(currentTrade.executions.length > 0) {
        const prevPos = currentTrade.executions[currentTrade.executions.length-1].posAfter;
        if(Math.abs(position) === 0) role = 'Close';
        else if(Math.abs(position) > Math.abs(prevPos)) role = 'Add';
        else role = 'Trim';
    }

    currentTrade.executions.push({
      time: ex.time,
      side: isBuy ? 'Buy' : 'Sell',
      price: price,
      qty: qty,
      role: role,
      posAfter: position
    });
    
    currentTrade.endTime = ex.time;

    // If flat, calculate PnL
    if (position === 0) {
       let buys = 0, sells = 0;
       currentTrade.executions.forEach(e => {
         if(e.side === 'Buy') buys += (e.price * e.qty);
         else sells += (e.price * e.qty);
       });
       
       let mult = 1;
       const inst = currentTrade.instrument.toUpperCase();
       if(inst.includes('NQ') || inst.includes('ES')) mult = 50; 
       if(inst.includes('MNQ') || inst.includes('MES')) mult = 5; 
       if(inst.includes('CL')) mult = 1000;
       if (['AAPL','TSLA','AMD','NVDA','SPY','QQQ'].includes(inst)) mult = 1;

       currentTrade.pnl = (sells - buys) * mult;
    }
  });

  // Calculate Equity Curve
  let runningEquity = 0;
  return trades.map(t => {
      runningEquity += t.pnl;
      return { ...t, equityCurve: runningEquity };
  }).reverse(); // Newest first
};

// --- HELPER: Completed Trades Parser (Format 2 - Decomposed & Regrouped) ---
const processCompletedTrades = (rows) => {
  
  // 1. Decompose rows into atomic executions
  const allExecutions = [];
  
  rows.forEach(row => {
      // Robust Date Parsing: Handle explicit NaN or Invalid Date
      let entryTime = new Date(row.EnteredAt).getTime();
      let exitTime = new Date(row.ExitedAt).getTime();
      
      // Fallback if parsing fails (prevent NaN breaking sort)
      if (isNaN(entryTime)) entryTime = Date.now();
      if (isNaN(exitTime)) exitTime = Date.now();

      const isLong = (row.Type || '').toLowerCase().includes('long');
      const qty = parseFloat(row.Size) || 0;
      const rowPnL = parseFloat(row.PnL) || 0;

      // Entry Action
      allExecutions.push({
          instrument: row.ContractName || 'Unknown',
          time: entryTime,
          side: isLong ? 'Buy' : 'Sell',
          price: parseFloat(row.EntryPrice) || 0,
          qty: qty,
          isExit: false,
          pnlContribution: 0 
      });

      // Exit Action
      allExecutions.push({
          instrument: row.ContractName || 'Unknown',
          time: exitTime,
          side: isLong ? 'Sell' : 'Buy',
          price: parseFloat(row.ExitPrice) || 0,
          qty: qty,
          isExit: true,
          pnlContribution: rowPnL 
      });
  });

  // 2. Sort all executions chronologically
  allExecutions.sort((a, b) => a.time - b.time);

  // 3. Group by Instrument
  const executionsByInstrument = allExecutions.reduce((acc, ex) => {
      if (!acc[ex.instrument]) acc[ex.instrument] = [];
      acc[ex.instrument].push(ex);
      return acc;
  }, {});

  // 4. Run "Zero-to-Zero" logic per instrument
  const trades = [];
  let idCounter = Date.now();

  Object.values(executionsByInstrument).forEach(instrumentExecs => {
      let currentTrade = null;
      let position = 0;

      instrumentExecs.forEach(ex => {
          const dir = ex.side.toLowerCase() === 'buy' ? 1 : -1;
          
          // Start Trade
          if (position === 0) {
              currentTrade = {
                  id: `trade-imp-${idCounter++}`,
                  instrument: ex.instrument,
                  direction: ex.side === 'Buy' ? 'Long' : 'Short', 
                  time: ex.time,
                  endTime: ex.time,
                  executions: [],
                  chartImage: null,
                  annotations: [],
                  pnl: 0,
                  equityCurve: 0,
                  setup: '',
                  mistakes: [],
                  successes: [],
                  mindsets: [],
                  notes: { entry: '', exit: '', mgmt: '', general: '' }
              };
              trades.push(currentTrade);
          }

          // Update Logic
          position += (ex.qty * dir);
          
          let role = 'Open';
          if (currentTrade.executions.length > 0) {
              const prevPos = currentTrade.executions[currentTrade.executions.length-1].posAfter;
              if (Math.abs(position) === 0) role = 'Close';
              else if (Math.abs(position) > Math.abs(prevPos)) role = 'Add';
              else role = 'Trim';
          }

          // Add execution to trade
          currentTrade.executions.push({
              time: ex.time,
              side: ex.side,
              price: ex.price,
              qty: ex.qty,
              role: role,
              posAfter: position
          });

          // Update Trade Metadata
          currentTrade.endTime = ex.time;
          currentTrade.pnl += ex.pnlContribution; 

          // Trade is logically complete when position returns to 0
          if (position === 0) {
              currentTrade = null; // Reset for next loop
          }
      });
  });

  // 5. Final Sort & Equity Curve
  trades.sort((a,b) => a.time - b.time); 

  let runningEquity = 0;
  trades.forEach(t => {
      runningEquity += t.pnl;
      t.equityCurve = runningEquity;
  });

  return trades.reverse(); 
};

// --- MOCK DATA GENERATOR ---
const generateDemoData = () => {
  const trades = [];
  let equity = 10000;
  const now = Date.now();
  const setups = ['Trend Follow', 'Breakout', 'Reversal', 'Scalp'];
  const instruments = ['NQ', 'ES', 'CL', 'GC', 'AAPL', 'TSLA'];
  const mindsets = ['Flow', 'Focused', 'Anxious', 'Bored', 'Tilted'];

  for (let i = 0; i < 45; i++) {
    const isWin = Math.random() > 0.45;
    const pnl = isWin ? Math.random() * 500 + 100 : (Math.random() * 300 + 50) * -1;
    equity += pnl;
    const startTime = now - (Math.floor(Math.random() * 60)) * 86400000;
    const entryPrice = 15000 + (Math.random() * 100);
    const exitPrice = isWin ? entryPrice + 20 : entryPrice - 10;
    
    trades.push({
      id: `trade-${i}`,
      instrument: instruments[Math.floor(Math.random() * instruments.length)],
      direction: Math.random() > 0.5 ? 'Long' : 'Short',
      time: startTime,
      endTime: startTime + 3600000,
      pnl: pnl,
      equityCurve: equity,
      setup: setups[Math.floor(Math.random() * setups.length)],
      mistakes: !isWin && Math.random() > 0.6 ? ['FOMO'] : [],
      successes: isWin ? ['Patience'] : [],
      mindsets: [mindsets[Math.floor(Math.random() * mindsets.length)]],
      chartImage: null,
      annotations: [],
      notes: { entry: '', exit: '', mgmt: '', general: '' },
      executions: [
        { time: startTime, side: 'Buy', qty: 1, price: entryPrice, role: 'Open' },
        { time: startTime + 1800000, side: 'Sell', qty: 1, price: exitPrice, role: 'Close' }
      ]
    });
  }
  return trades.sort((a,b) => b.time - a.time);
};

// --- COMPONENTS ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'neutral', className = "" }) => {
  const variants = {
    neutral: 'bg-slate-800 text-slate-400 border-slate-700',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    blue: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// --- MAIN APP ---

export default function TradeScribe() {
  const [view, setView] = useState('journal'); 
  
  const [trades, setTrades] = useState(() => {
      try {
          const saved = localStorage.getItem('tradeScribeData');
          return saved ? JSON.parse(saved).trades : [];
      } catch (e) { return []; }
  });
  
  const [config, setConfig] = useState(() => {
      try {
          const saved = localStorage.getItem('tradeScribeData');
          const defaults = {
            setups: ['Trend Follow', 'Breakout', 'Reversal', 'Scalp'],
            mistakes: ['FOMO', 'Chasing', 'Hesitation', 'Revenge', 'No Plan'],
            successes: ['Patience', 'Good Risk Mgmt', 'Clean Entry', 'Let Runners Run'],
            mindsets: ['Flow', 'Focused', 'Anxious', 'Bored', 'Tilted', 'Tired']
          };
          return saved ? { ...defaults, ...JSON.parse(saved).config } : defaults;
      } catch (e) {
          return {
            setups: ['Trend Follow', 'Breakout', 'Reversal', 'Scalp'],
            mistakes: ['FOMO', 'Chasing', 'Hesitation', 'Revenge', 'No Plan'],
            successes: ['Patience', 'Good Risk Mgmt', 'Clean Entry', 'Let Runners Run'],
            mindsets: ['Flow', 'Focused', 'Anxious', 'Bored', 'Tilted', 'Tired']
          };
      }
  });

  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [filters, setFilters] = useState({ text: '', setup: 'All', side: 'All', outcome: 'All' });
  const [showOverlay, setShowOverlay] = useState(true); 
  const [isSaved, setIsSaved] = useState(false);
  const [isTradeSaved, setIsTradeSaved] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [annoModal, setAnnoModal] = useState({ isOpen: false, id: null, x: 0, y: 0, text: '', category: 'general', tagType: '', tagValue: '' });
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Bar Calculator State
  const [barCalc, setBarCalc] = useState({ start: "09:30", tf: 5 });

  const fileInputRef = useRef(null);
  const imageUploadRef = useRef(null);

  // --- DERIVED DATA ---

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      const matchesText = t.instrument.toLowerCase().includes(filters.text.toLowerCase()) || 
                          t.setup.toLowerCase().includes(filters.text.toLowerCase());
      const matchesSetup = filters.setup === 'All' || t.setup === filters.setup;
      const matchesSide = filters.side === 'All' || t.direction === filters.side;
      const matchesOutcome = filters.outcome === 'All' || 
                             (filters.outcome === 'Win' && t.pnl > 0) || 
                             (filters.outcome === 'Loss' && t.pnl <= 0);
      return matchesText && matchesSetup && matchesSide && matchesOutcome;
    });
  }, [trades, filters]);

  const selectedTrade = useMemo(() => trades.find(t => t.id === selectedTradeId), [trades, selectedTradeId]);
  
  const stats = useMemo(() => {
    if (!filteredTrades.length) return null;
    const wins = filteredTrades.filter(t => t.pnl > 0);
    const losses = filteredTrades.filter(t => t.pnl <= 0);
    const totalPnl = filteredTrades.reduce((acc, t) => acc + t.pnl, 0);
    const winRate = (wins.length / filteredTrades.length) * 100;
    const pf = Math.abs(wins.reduce((a,t)=>a+t.pnl,0) / (losses.reduce((a,t)=>a+t.pnl,0) || 1));
    const avgWin = wins.length ? wins.reduce((a,t)=>a+t.pnl,0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((a,t)=>a+t.pnl,0) / losses.length) : 0;
    const rRatio = avgLoss === 0 ? avgWin : avgWin / avgLoss;
    const expectancy = totalPnl / filteredTrades.length;

    const getBreakdown = (field, isArray = false) => {
        const counts = {};
        filteredTrades.forEach(t => {
            const items = isArray ? t[field] : [t[field]];
            items.forEach(item => {
                if(!item) return;
                if(!counts[item]) counts[item] = 0;
                counts[item] += t.pnl;
            });
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    };

    const setupMetrics = config.setups.map(setup => {
        const tradesForSetup = filteredTrades.filter(t => t.setup === setup);
        if (tradesForSetup.length === 0) return null;
        const sWins = tradesForSetup.filter(t => t.pnl > 0);
        const sLosses = tradesForSetup.filter(t => t.pnl <= 0);
        const sTotalPnl = tradesForSetup.reduce((a,b) => a + b.pnl, 0);
        const sWinRate = (sWins.length / tradesForSetup.length) * 100;
        const sGrossWin = sWins.reduce((a,b) => a + b.pnl, 0);
        const sGrossLoss = Math.abs(sLosses.reduce((a,b) => a + b.pnl, 0));
        const sPf = sGrossLoss === 0 ? sGrossWin : sGrossWin / sGrossLoss;
        const sExpectancy = sTotalPnl / tradesForSetup.length;
        return { setup, count: tradesForSetup.length, winRate: sWinRate, pf: sPf, expectancy: sExpectancy, pnl: sTotalPnl };
    }).filter(Boolean).sort((a,b) => b.expectancy - a.expectancy);

    const combinations = {};
    filteredTrades.forEach(t => {
        if (!t.setup) return;
        t.mistakes.forEach(m => {
            const key = `${t.setup} + ${m} (Mistake)`;
            if (!combinations[key]) combinations[key] = { pnl: 0, count: 0 };
            combinations[key].pnl += t.pnl;
            combinations[key].count++;
        });
        t.successes.forEach(s => {
            const key = `${t.setup} + ${s} (Habit)`;
            if (!combinations[key]) combinations[key] = { pnl: 0, count: 0 };
            combinations[key].pnl += t.pnl;
            combinations[key].count++;
        });
        t.mindsets.forEach(m => {
             const key = `${t.setup} + ${m} (Mindset)`;
            if (!combinations[key]) combinations[key] = { pnl: 0, count: 0 };
            combinations[key].pnl += t.pnl;
            combinations[key].count++;
        });
    });

    const comboArray = Object.entries(combinations)
        .map(([name, data]) => ({ name, ...data, expectancy: data.pnl / data.count }))
        .filter(c => c.count > 1) 
        .sort((a,b) => b.expectancy - a.expectancy);

    return { 
        totalPnl, winRate, profitFactor: pf, tradeCount: filteredTrades.length,
        avgWin, avgLoss, rRatio, expectancy,
        bySetup: getBreakdown('setup'), byMistake: getBreakdown('mistakes', true),
        bySuccess: getBreakdown('successes', true), byMindset: getBreakdown('mindsets', true),
        setupMetrics, bestCombo: comboArray.length > 0 ? comboArray[0] : null, worstCombo: comboArray.length > 0 ? comboArray[comboArray.length - 1] : null
    };
  }, [filteredTrades, config.setups]);

  const calendarData = useMemo(() => {
      const days = {};
      trades.forEach(t => {
          const d = new Date(t.time);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (!days[key]) days[key] = { pnl: 0, count: 0, trades: [] };
          days[key].pnl += t.pnl;
          days[key].count += 1;
          days[key].trades.push(t);
      });
      return days;
  }, [trades]);

  const handleManualSave = () => {
      localStorage.setItem('tradeScribeData', JSON.stringify({ trades, config }));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTradeSave = () => {
      localStorage.setItem('tradeScribeData', JSON.stringify({ trades, config }));
      setIsTradeSaved(true);
      setTimeout(() => setIsTradeSaved(false), 2000);
  };

  const handleLoadDemo = () => {
    const data = generateDemoData();
    setTrades(data);
    setSelectedTradeId(data[0].id);
  };

  const handlePrint = () => {
      window.print();
  };

  // --- SELECTION & MERGE LOGIC ---
  const toggleSelectionMode = () => {
      setSelectionMode(!selectionMode);
      setSelectedIds([]);
  };

  const toggleSelectId = (id, e) => {
      e.stopPropagation();
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const mergeSelectedTrades = () => {
      if (selectedIds.length < 2) return;
      
      const tradesToMerge = trades.filter(t => selectedIds.includes(t.id));
      // Sort oldest first to establish "base" trade
      tradesToMerge.sort((a,b) => a.time - b.time);
      
      const base = tradesToMerge[0];
      
      // Calculate consolidated data
      const mergedPnl = tradesToMerge.reduce((acc, t) => acc + t.pnl, 0);
      const mergedExecutions = tradesToMerge.flatMap(t => t.executions).sort((a,b) => a.time - b.time);
      const lastEndTime = Math.max(...tradesToMerge.map(t => t.endTime));
      
      // Merge unique tags
      const mergedMistakes = [...new Set(tradesToMerge.flatMap(t => t.mistakes))];
      const mergedSuccesses = [...new Set(tradesToMerge.flatMap(t => t.successes))];
      const mergedMindsets = [...new Set(tradesToMerge.flatMap(t => t.mindsets))];
      
      // Merge notes
      const mergedNotes = {
          entry: tradesToMerge.map(t => t.notes.entry).filter(Boolean).join('\n---\n'),
          exit: tradesToMerge.map(t => t.notes.exit).filter(Boolean).join('\n---\n'),
          mgmt: tradesToMerge.map(t => t.notes.mgmt).filter(Boolean).join('\n---\n'),
          general: tradesToMerge.map(t => t.notes.general).filter(Boolean).join('\n---\n')
      };

      const newTrade = {
          ...base,
          id: `trade-merged-${Date.now()}`,
          endTime: lastEndTime,
          pnl: mergedPnl,
          executions: mergedExecutions,
          mistakes: mergedMistakes,
          successes: mergedSuccesses,
          mindsets: mergedMindsets,
          notes: mergedNotes,
          // Keep base chart/annotations as anchor
          chartImage: base.chartImage,
          annotations: base.annotations
      };

      // Reconstruct trade list: Remove old selected, add new merged
      const remainingTrades = trades.filter(t => !selectedIds.includes(t.id));
      const newTradeList = [...remainingTrades, newTrade].sort((a,b) => b.time - a.time); // Newest first for UI
      
      // Re-run Equity Curve Calculation
      // Sort ascending by time for accurate running total
      const sortedForEq = [...newTradeList].sort((a,b) => a.time - b.time);
      let runningEq = 0;
      sortedForEq.forEach(t => {
          runningEq += t.pnl;
          t.equityCurve = runningEq;
      });

      setTrades(sortedForEq.reverse());
      setSelectedIds([]);
      setSelectionMode(false);
      setSelectedTradeId(newTrade.id);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      if (file.name.endsWith('.json')) {
         try {
             const data = JSON.parse(content);
             setTrades(data.trades || []);
             setConfig(data.config || config);
             if(data.trades.length) setSelectedTradeId(data.trades[0].id);
         } catch(err) { alert("Invalid JSON"); }
      } else {
         const lines = content.trim().split('\n');
         // Clean headers from quotes and whitespace
         const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
         
         // DETECT FORMAT 2: Completed Trades
         if (headers.includes('ContractName') && headers.includes('PnL')) {
             const rows = [];
             for(let i=1; i<lines.length; i++) {
                 // Use Robust Parser
                 const cols = parseCSVLine(lines[i]);
                 if (cols.length < headers.length) continue;
                 
                 const row = {};
                 headers.forEach((h, idx) => row[h] = cols[idx]);
                 rows.push(row);
             }
             
             if (rows.length > 0) {
                 const processed = processCompletedTrades(rows);
                 setTrades(processed);
                 if(processed.length) setSelectedTradeId(processed[0].id);
             } else {
                 alert("CSV parsed but no valid rows found.");
             }
         } 
         // DETECT FORMAT 1: Raw Executions
         else {
             const raw = [];
             lines.forEach(line => {
                 const cols = parseCSVLine(line);
                 if(cols.length >= 5 && !isNaN(parseFloat(cols[3])) && !isNaN(new Date(cols[2]).getTime())) {
                      raw.push({
                         instrument: cols[0],
                         side: cols[1],
                         time: new Date(cols[2]).getTime(),
                         price: cols[3],
                         qty: cols[4]
                     });
                 }
             });
             
             if(raw.length > 0) {
                 const processed = processImport(raw);
                 setTrades(processed);
                 if(processed.length) setSelectedTradeId(processed[0].id);
             } else {
                 alert("Unknown CSV format. Headers found: " + headers.join(', '));
             }
         }
      }
    };
    reader.readAsText(file);
  };

  const handleImagePaste = async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => updateTradeImage(event.target.result);
            reader.readAsDataURL(blob);
        }
    }
  };

  const handleImageSelect = (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => updateTradeImage(event.target.result);
          reader.readAsDataURL(file);
      }
  };

  const updateTradeImage = (base64) => {
      if (!selectedTrade) return;
      setTrades(prev => prev.map(t => t.id === selectedTradeId ? { ...t, chartImage: base64 } : t));
  };

  const deleteImage = () => {
    if (!selectedTrade) return;
    setTrades(prev => prev.map(t => t.id === selectedTradeId ? { ...t, chartImage: null, annotations: [] } : t));
  };

  const handleContainerMouseMove = (e) => {
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

  const handleImageClick = (e) => {
      if(draggingId || e.target.closest('.annotation-marker')) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      setAnnoModal({ isOpen: true, id: null, x: xPct, y: yPct, text: '', category: 'general', tagType: '', tagValue: '' });
  };

  const handleMarkerMouseDown = (e, annoId) => {
      e.stopPropagation(); e.preventDefault(); 
      setDraggingId(annoId);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMarkerClick = (e, anno) => {
      e.stopPropagation();
      const dist = Math.sqrt(Math.pow(e.clientX - dragStartRef.current.x, 2) + Math.pow(e.clientY - dragStartRef.current.y, 2));
      if (dist < 5) {
          setAnnoModal({ isOpen: true, id: anno.id, x: anno.x, y: anno.y, text: anno.text, category: anno.category, tagType: anno.tagType || '', tagValue: anno.tagValue || '' });
      }
  };

  const saveAnnotation = () => {
      if(!selectedTrade) return;
      const newAnno = {
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

  const handleUpdateTrade = (field, value) => {
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

  const toggleTag = (type, tag) => {
    if (!selectedTrade) return;
    const currentTags = selectedTrade[type] || [];
    const newTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
    setTrades(prev => prev.map(t => t.id === selectedTradeId ? { ...t, [type]: newTags } : t));
  };

  // --- BAR CALCULATOR HELPER ---
  const getBarIndex = (timestamp, sessionStartStr, tfMinutes) => {
      if (!timestamp) return "-";
      const d = new Date(timestamp);
      const [h, m] = sessionStartStr.split(':').map(Number);
      const sessionStart = new Date(d);
      sessionStart.setHours(h, m, 0, 0);
      
      const diff = d - sessionStart;
      if (diff < 0) return "Pre"; 
      
      const msPerBar = tfMinutes * 60 * 1000;
      return Math.floor(diff / msPerBar) + 1;
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
                    onClick={toggleSelectionMode} 
                    className={`p-1.5 rounded transition ml-1 ${selectionMode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                    title="Select Multiple Trades"
                 >
                     <ListChecks className="w-4 h-4" />
                 </button>
             )}
             <div className={`ml-auto text-slate-500 ${isFull ? 'text-sm font-medium' : 'text-xs'}`}>{filteredTrades.length} trades found</div>
          </div>
      );
  };

  const renderJournal = () => (
    <div className="flex h-full overflow-hidden" onPaste={handleImagePaste}>
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
              className={`p-4 border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-800/50 relative ${
                  isSelected ? 'bg-indigo-900/20 border-l-2 border-l-indigo-500' : 
                  selectedTradeId === trade.id ? 'bg-slate-800 border-l-2 border-l-indigo-500' : 
                  'border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {selectionMode && (
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-900'}`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                  )}
                  <span className="font-bold text-slate-200">{trade.instrument}</span>
                  <Badge variant={trade.direction === 'Long' ? 'green' : 'red'}>{trade.direction}</Badge>
                </div>
                <span className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}</span>
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
                    <div className={`text-xl font-mono font-bold ${selectedTrade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} print:text-black`}>{selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}</div>
                  </div>
                  <div className="h-8 w-px bg-slate-800 mx-2 no-print"></div>
                  <button onClick={handleTradeSave} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition no-print ${isTradeSaved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
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
                      <textarea className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none h-24 resize-none placeholder:text-slate-700 print:bg-white print:text-black print:border-slate-200 print:h-auto print:min-h-[60px]" placeholder={`Describe your ${field.label.toLowerCase()}...`} value={selectedTrade.notes[field.id]} onChange={(e) => handleUpdateTrade(field.id, e.target.value)} />
                    </div>
                  ))}
                </div>

                <div className="space-y-4 print:mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 print:text-slate-600"><MoreHorizontal className="w-4 h-4" /> Review</h3>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Setup Type</label>
                    <div className="flex flex-wrap gap-2">
                      {config.setups.map(s => (
                        <button key={s} onClick={() => handleUpdateTrade('setup', s)} className={`px-2 py-1 rounded text-[10px] border transition ${selectedTrade.setup === s ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><BrainCircuit className="w-3 h-3 text-indigo-400" /> Mental State</label>
                    <div className="flex flex-wrap gap-2">
                      {config.mindsets.map(m => (
                        <button key={m} onClick={() => toggleTag('mindsets', m)} className={`px-2 py-1 rounded text-[10px] border transition ${selectedTrade.mindsets?.includes(m) ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <Card className="p-4 space-y-4 print:border-none print:shadow-none print:p-0">
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-500 uppercase mb-2 flex items-center gap-2"><ThumbsUp className="w-3 h-3" /> Good Habits</label>
                        <div className="flex flex-wrap gap-2">
                          {config.successes.map(s => (
                            <button key={s} onClick={() => toggleTag('successes', s)} className={`px-2 py-1 rounded text-[10px] border transition ${selectedTrade.successes.includes(s) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden'}`}>{s}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-rose-500 uppercase mb-2 flex items-center gap-2"><ThumbsDown className="w-3 h-3" /> Mistakes</label>
                        <div className="flex flex-wrap gap-2">
                          {config.mistakes.map(s => (
                            <button key={s} onClick={() => toggleTag('mistakes', s)} className={`px-2 py-1 rounded text-[10px] border transition ${selectedTrade.mistakes.includes(s) ? 'bg-rose-500/20 border-rose-500 text-rose-300 print:bg-slate-100 print:text-black print:border-slate-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 print:hidden'}`}>{s}</button>
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
                              <td className={`p-3 font-bold ${ex.side === 'Buy' ? 'text-emerald-400' : 'text-rose-400'} print:text-black`}>{ex.side}</td>
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

  const renderCalendar = () => {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const days = [];
      for(let i=0; i<firstDay; i++) days.push(null);
      for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));

      const changeMonth = (delta) => setCalendarDate(new Date(year, month + delta, 1));

      return (
          <div className="p-8 h-full overflow-y-auto">
              <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                          <CalendarIcon className="w-6 h-6 text-indigo-500" /> 
                          Consistency Calendar
                      </h2>
                      <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-1">
                          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                          <span className="text-sm font-bold w-32 text-center text-white">{calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><ChevronRightIcon className="w-5 h-5" /></button>
                      </div>
                  </div>

                  <div className="grid grid-cols-7 gap-4 mb-4">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                          <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{d}</div>
                      ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-4">
                      {days.map((date, i) => {
                          if (!date) return <div key={i} className="aspect-square"></div>;
                          
                          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                          const dayData = calendarData[key];
                          const pnl = dayData ? dayData.pnl : 0;
                          const hasTrades = !!dayData;
                          
                          let bg = 'bg-slate-900/50 border-slate-800';
                          if (hasTrades) {
                              if (pnl > 0) bg = 'bg-emerald-500/10 border-emerald-500/50 hover:bg-emerald-500/20';
                              else if (pnl < 0) bg = 'bg-rose-500/10 border-rose-500/50 hover:bg-rose-500/20';
                              else bg = 'bg-slate-800 border-slate-700';
                          }

                          return (
                              <Card key={i} className={`aspect-square p-2 border flex flex-col transition cursor-pointer group ${bg} relative`}>
                                  <div className="flex justify-between items-start">
                                      <span className={`text-sm font-bold ${hasTrades ? 'text-white' : 'text-slate-600'}`}>{date.getDate()}</span>
                                      {hasTrades && (
                                          <div className={`text-xs font-mono font-bold ${pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                              {pnl > 0 ? '+' : ''}{Math.round(pnl)}
                                          </div>
                                      )}
                                  </div>
                                  {hasTrades && (
                                      <div className="mt-auto">
                                          <div className="text-[10px] text-slate-500">{dayData.count} trades</div>
                                          <div className="flex gap-1 mt-1 flex-wrap">
                                               {dayData.trades.slice(0,3).map((t, idx) => (
                                                   <div key={idx} className={`w-1.5 h-1.5 rounded-full ${t.pnl > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                               ))}
                                          </div>
                                      </div>
                                  )}
                                  {!hasTrades && <div className="mt-auto text-[10px] text-slate-700 text-center">-</div>}
                              </Card>
                          );
                      })}
                  </div>
              </div>
          </div>
      );
  };

  const renderStats = () => {
    if (!trades.length && !filteredTrades.length) return <div className="p-10 text-center text-slate-500">No data available. Load demo data.</div>;
    const hasData = filteredTrades.length > 0;
    const equityData = hasData ? filteredTrades.slice().reverse().map(t => ({ name: new Date(t.time).toLocaleDateString(), value: t.equityCurve })) : [];
    
    return (
      <div className="p-8 overflow-y-auto h-full space-y-8 print:p-0 print:overflow-visible">
         <div className="max-w-7xl mx-auto space-y-8 print:space-y-6">
            {renderFilters('full')}
            <div className="flex justify-between items-end print:mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white print:text-black">Performance Analytics</h2>
                    <p className="text-slate-400 text-sm print:text-slate-600">Metrics from <span className="text-indigo-400 font-bold print:text-black">{stats?.tradeCount || 0}</span> trades matching filters.</p>
                </div>
                {hasData && (
                <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Net Profit</div>
                    <div className={`text-4xl font-bold mono-font ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} print:text-black`}>{stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}</div>
                </div>
                )}
            </div>

            {hasData ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="p-5 border-t-4 border-indigo-500 print:bg-white print:border-slate-300 print:shadow-none">
                    <div className="text-slate-500 text-[10px] font-bold uppercase">Expectancy</div>
                    <div className={`text-2xl font-mono font-bold mt-1 ${stats.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'} print:text-black`}>{stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}</div>
                </Card>
                <Card className="p-5 border-t-4 border-indigo-500 print:bg-white print:border-slate-300 print:shadow-none">
                    <div className="text-slate-500 text-[10px] font-bold uppercase">Profit Factor</div>
                    <div className="text-2xl font-mono font-bold text-white mt-1 print:text-black">{stats.profitFactor.toFixed(2)}</div>
                </Card>
                <Card className="p-5 border-t-4 border-emerald-500 print:bg-white print:border-slate-300 print:shadow-none">
                    <div className="text-slate-500 text-[10px] font-bold uppercase">Win Rate</div>
                    <div className="text-2xl font-mono font-bold text-white mt-1 print:text-black">{stats.winRate.toFixed(1)}%</div>
                </Card>
                <Card className="p-5 border-t-4 border-amber-500 print:bg-white print:border-slate-300 print:shadow-none">
                    <div className="text-slate-500 text-[10px] font-bold uppercase">Avg Win / Loss</div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-emerald-400 font-mono font-bold text-lg print:text-black">${Math.round(stats.avgWin)}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-rose-400 font-mono font-bold text-lg print:text-black">${Math.round(stats.avgLoss)}</span>
                    </div>
                </Card>
                <Card className="p-5 border-t-4 border-rose-500 print:bg-white print:border-slate-300 print:shadow-none">
                    <div className="text-slate-500 text-[10px] font-bold uppercase">Reward : Risk</div>
                    <div className="text-2xl font-mono font-bold text-slate-200 mt-1 print:text-black">1 : {stats.rRatio.toFixed(2)}</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:break-inside-avoid">
                <Card className="p-6 bg-gradient-to-br from-slate-900 to-indigo-950/30 border border-indigo-500/30 print:bg-white print:border-slate-300 print:shadow-none">
                     <div className="flex items-start justify-between">
                         <div>
                             <h3 className="text-indigo-400 font-bold text-sm flex items-center gap-2 print:text-black"><Lightbulb className="w-4 h-4" /> Best Performance Combo</h3>
                             <p className="text-slate-500 text-xs mt-1">Highest Expectancy</p>
                         </div>
                         <div className="p-2 bg-indigo-500/10 rounded-lg no-print"><Zap className="w-5 h-5 text-indigo-400" /></div>
                     </div>
                     <div className="mt-4">
                         {stats.bestCombo ? (
                             <>
                                 <div className="text-lg font-bold text-white print:text-black">{stats.bestCombo.name}</div>
                                 <div className="flex gap-4 mt-2">
                                     <div>
                                         <div className="text-[10px] text-slate-500 uppercase">Expectancy</div>
                                         <div className="text-emerald-400 font-mono font-bold print:text-black">+${stats.bestCombo.expectancy.toFixed(0)}</div>
                                     </div>
                                     <div>
                                         <div className="text-[10px] text-slate-500 uppercase">Total PnL</div>
                                         <div className="text-slate-200 font-mono print:text-black">${stats.bestCombo.pnl.toFixed(0)}</div>
                                     </div>
                                      <div>
                                         <div className="text-[10px] text-slate-500 uppercase">Trades</div>
                                         <div className="text-slate-200 print:text-black">{stats.bestCombo.count}</div>
                                     </div>
                                 </div>
                             </>
                         ) : (
                             <div className="text-slate-500 text-sm">Not enough data to determine best combo.</div>
                         )}
                     </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-slate-900 to-rose-950/30 border border-rose-500/30 print:bg-white print:border-slate-300 print:shadow-none">
                     <div className="flex items-start justify-between">
                         <div>
                             <h3 className="text-rose-400 font-bold text-sm flex items-center gap-2 print:text-black"><AlertTriangle className="w-4 h-4" /> Biggest Leak</h3>
                             <p className="text-slate-500 text-xs mt-1">Lowest Expectancy</p>
                         </div>
                         <div className="p-2 bg-rose-500/10 rounded-lg no-print"><TrendingDown className="w-5 h-5 text-rose-400" /></div>
                     </div>
                     <div className="mt-4">
                         {stats.worstCombo ? (
                             <>
                                 <div className="text-lg font-bold text-white print:text-black">{stats.worstCombo.name}</div>
                                 <div className="flex gap-4 mt-2">
                                     <div>
                                         <div className="text-[10px] text-slate-500 uppercase">Expectancy</div>
                                         <div className="text-rose-400 font-mono font-bold print:text-black">${stats.worstCombo.expectancy.toFixed(0)}</div>
                                     </div>
                                     <div>
                                         <div className="text-[10px] text-slate-500 uppercase">Total PnL</div>
                                         <div className="text-slate-200 font-mono print:text-black">${stats.worstCombo.pnl.toFixed(0)}</div>
                                     </div>
                                      <div>
                                         <div className="text-[10px] text-slate-500 uppercase">Trades</div>
                                         <div className="text-slate-200 print:text-black">{stats.worstCombo.count}</div>
                                     </div>
                                 </div>
                             </>
                         ) : (
                             <div className="text-slate-500 text-sm">Not enough data to determine leaks.</div>
                         )}
                     </div>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden print:border-slate-300 print:shadow-none">
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 print:bg-slate-100 print:border-slate-200">
                    <h3 className="text-slate-300 font-bold text-sm flex items-center gap-2 print:text-black"><Activity className="w-4 h-4 text-indigo-500" /> Strategy Deep Dive</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-500 print:bg-white print:text-slate-600">
                            <tr>
                                <th className="px-6 py-3">Setup</th>
                                <th className="px-6 py-3 text-right">Trades</th>
                                <th className="px-6 py-3 text-right">Win Rate</th>
                                <th className="px-6 py-3 text-right">Profit Factor</th>
                                <th className="px-6 py-3 text-right">Expectancy</th>
                                <th className="px-6 py-3 text-right">Net PnL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                            {stats.setupMetrics.map(s => (
                                <tr key={s.setup} className="hover:bg-slate-800/30 transition">
                                    <td className="px-6 py-3 font-medium text-white print:text-black">{s.setup}</td>
                                    <td className="px-6 py-3 text-right text-slate-400 print:text-black">{s.count}</td>
                                    <td className="px-6 py-3 text-right"><span className={s.winRate > 50 ? 'text-emerald-400 print:text-black' : 'text-slate-400 print:text-black'}>{s.winRate.toFixed(1)}%</span></td>
                                    <td className="px-6 py-3 text-right font-mono text-slate-300 print:text-black">{s.pf.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold"><span className={s.expectancy > 0 ? 'text-emerald-400 print:text-black' : 'text-rose-400 print:text-black'}>{s.expectancy > 0 ? '+' : ''}${s.expectancy.toFixed(0)}</span></td>
                                    <td className="px-6 py-3 text-right font-mono font-bold"><span className={s.pnl > 0 ? 'text-emerald-400 print:text-black' : 'text-rose-400 print:text-black'}>{s.pnl > 0 ? '+' : ''}${s.pnl.toFixed(0)}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card className="p-6 print:border-slate-300 print:bg-white print:shadow-none print:break-inside-avoid">
                <h3 className="text-slate-300 font-bold text-sm mb-4 flex items-center gap-2 print:text-black"><TrendingUp className="w-4 h-4 text-indigo-500" /> Equity Curve</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityData}>
                            <defs>
                                <linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                            <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorEq)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:break-inside-avoid">
                <Card className="p-6 border border-slate-700/50 print:border-slate-300 print:bg-white print:shadow-none">
                    <h3 className="text-slate-300 font-bold text-sm mb-4 flex items-center gap-2 print:text-black"><ThumbsDown className="w-4 h-4 text-rose-500" /> Cost of Mistakes</h3>
                    <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={stats.byMistake} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fill: '#94a3b8', fontSize: 10}} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                                <ReferenceLine x={0} stroke="#475569" />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {stats.byMistake.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card className="p-6 border border-slate-700/50 print:border-slate-300 print:bg-white print:shadow-none">
                    <h3 className="text-slate-300 font-bold text-sm mb-4 flex items-center gap-2 print:text-black"><ThumbsUp className="w-4 h-4 text-emerald-500" /> Value of Habits</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={stats.bySuccess} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fill: '#94a3b8', fontSize: 10}} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                                <ReferenceLine x={0} stroke="#475569" />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {stats.bySuccess.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
            </>
            ) : (
                <div className="flex flex-col items-center justify-center p-10 bg-slate-900/30 border border-slate-800 border-dashed rounded-xl mt-4">
                    <Filter className="w-10 h-10 text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-400">No trades match your filter</h3>
                    <p className="text-slate-500 text-sm">Try adjusting the search or filter criteria above.</p>
                </div>
            )}
         </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="p-10 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <div><h2 className="text-2xl font-bold text-white">Journal Configuration</h2><p className="text-slate-400 text-sm">Customize tags and dropdowns.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(config).map(([key, items]) => (
            <Card key={key} className="p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">{key}</h3>
              <div className="flex gap-2 mb-3">
                 <input type="text" placeholder="Add new..." className="flex-grow bg-slate-950 border border-slate-800 rounded px-2 text-sm text-white focus:border-indigo-500 outline-none h-8" />
                 <button className="bg-indigo-600 hover:bg-indigo-500 text-white w-8 h-8 rounded flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                 {items.map(item => (
                   <div key={item} className="flex justify-between items-center bg-slate-800/30 px-2 py-2 rounded border border-slate-700/30 group">
                      <span className="text-xs text-slate-300">{item}</span>
                      <button className="text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3 h-3" /></button>
                   </div>
                 ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 font-sans selection:bg-indigo-500/30">
      <style>
        {`
          @media print {
            @page { margin: 0.5cm; }
            body { background-color: white !important; color: black !important; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            .print-break-inside-avoid { break-inside: avoid; }
            div, span, p, td, th { color: black !important; border-color: #e2e8f0 !important; }
            .bg-slate-900, .bg-slate-950, .bg-slate-800 { background-color: white !important; }
            .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: #e2e8f0 !important; }
            .recharts-text { fill: #64748b !important; }
          }
        `}
      </style>
      <aside className="w-16 lg:w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 z-30 no-print">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
          <BookOpen className="text-indigo-500 w-6 h-6" />
          <h1 className="hidden lg:block text-lg font-bold text-white tracking-tight ml-2">Trade<span className="text-indigo-500">Scribe</span> Pro</h1>
        </div>
        
        <nav className="p-2 lg:p-4 space-y-2 flex-grow">
          {[
            { id: 'journal', label: 'Journal', icon: LayoutDashboard },
            { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
            { id: 'stats', label: 'Analytics', icon: TrendingUp },
            { id: 'settings', label: 'Config', icon: Settings },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} className={`w-full flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-4 py-3 rounded-xl transition-all group ${view === item.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white border border-transparent'}`}>
              <item.icon className="w-5 h-5" />
              <span className="hidden lg:inline font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-2">
           <button onClick={handleLoadDemo} className="w-full flex items-center justify-center lg:justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg border border-slate-700 transition">
             <PlayCircle className="w-4 h-4" />
             <span className="hidden lg:inline text-xs font-medium">Load Demo</span>
           </button>
           <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center lg:justify-start gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-3 rounded-lg border border-indigo-500 transition shadow-lg shadow-indigo-500/20">
             <Upload className="w-4 h-4" />
             <span className="hidden lg:inline text-xs font-medium">Import Data</span>
           </button>
           <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.json" />
           
           <button onClick={handlePrint} className="w-full flex items-center justify-center lg:justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg border border-slate-700 transition">
             <FileText className="w-4 h-4" />
             <span className="hidden lg:inline text-xs font-medium">Export PDF</span>
           </button>

           <button onClick={handleManualSave} className={`w-full flex items-center justify-center lg:justify-start gap-2 bg-slate-800 hover:bg-slate-700 transition py-2 px-3 rounded-lg border border-slate-700 ${isSaved ? 'text-emerald-400 border-emerald-500/50' : 'text-amber-400'}`}>
             {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
             <span className="hidden lg:inline text-xs font-medium">{isSaved ? 'Saved!' : 'Save Workspace'}</span>
           </button>
        </div>
      </aside>

      <main className="flex-grow flex relative overflow-hidden print:overflow-visible">
        {view === 'journal' && renderJournal()}
        {view === 'calendar' && renderCalendar()}
        {view === 'stats' && renderStats()}
        {view === 'settings' && renderSettings()}
      </main>
    </div>
  );
}