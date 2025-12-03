import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Types for EdgeLog
export interface Trade {
  id: string;
  instrument: string;
  direction: 'Long' | 'Short';
  time: number;
  endTime: number;
  executions: Execution[];
  chartImage: string | null;
  annotations: Annotation[];
  pnl: number;
  equityCurve: number;
  setup: string;
  mistakes: string[];
  successes: string[];
  mindsets: string[];
  notes: {
    entry: string;
    exit: string;
    mgmt: string;
    general: string;
  };
}

export interface Execution {
  time: number;
  side: 'Buy' | 'Sell';
  price: number;
  qty: number;
  role: string;
  posAfter?: number;
  isExit?: boolean;
  pnlContribution?: number;
  instrument?: string;
}

export interface Annotation {
  id: number | string;
  x: number;
  y: number;
  text: string;
  category: 'entry' | 'exit' | 'mgmt' | 'general';
  tagType?: string;
  tagValue?: string;
}

export interface TradeConfig {
  setups: string[];
  mistakes: string[];
  successes: string[];
  mindsets: string[];
}

export const DEFAULT_CONFIG: TradeConfig = {
  setups: ['Trend Follow', 'Breakout', 'Reversal', 'Scalp'],
  mistakes: ['FOMO', 'Chasing', 'Hesitation', 'Revenge', 'No Plan'],
  successes: ['Patience', 'Good Risk Mgmt', 'Clean Entry', 'Let Runners Run'],
  mindsets: ['Flow', 'Focused', 'Anxious', 'Bored', 'Tilted', 'Tired']
};

// --- HELPER: CSV Line Parser (Handles Quoted Strings) ---
export const parseCSVLine = (text: string) => {
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
export const processImport = (rawExecutions: any[]): Trade[] => {
  // 1. Sort by time
  rawExecutions.sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const trades: Trade[] = [];
  let currentTrade: Trade | null = null;
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

    if (!currentTrade) return;

    // Update position
    position += (qty * dir);

    // Determine execution role (Open/Close/Add/Trim)
    let role = 'Open';
    if(currentTrade.executions.length > 0) {
        const prevPos = currentTrade.executions[currentTrade.executions.length-1].posAfter || 0;
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
export const processCompletedTrades = (rows: any[]): Trade[] => {

  // 1. Decompose rows into atomic executions
  const allExecutions: Execution[] = [];

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
          role: 'Open', // Placeholder
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
          role: 'Close', // Placeholder
          isExit: true,
          pnlContribution: rowPnL
      });
  });

  // 2. Sort all executions chronologically
  allExecutions.sort((a, b) => a.time - b.time);

  // 3. Group by Instrument
  const executionsByInstrument = allExecutions.reduce((acc: any, ex) => {
      if (!ex.instrument) return acc;
      if (!acc[ex.instrument]) acc[ex.instrument] = [];
      acc[ex.instrument].push(ex);
      return acc;
  }, {});

  // 4. Run "Zero-to-Zero" logic per instrument
  const trades: Trade[] = [];
  let idCounter = Date.now();

  Object.values(executionsByInstrument).forEach((instrumentExecs: any) => {
      let currentTrade: Trade | null = null;
      let position = 0;

      instrumentExecs.forEach((ex: Execution) => {
          const dir = ex.side.toLowerCase() === 'buy' ? 1 : -1;

          // Start Trade
          if (position === 0) {
              currentTrade = {
                  id: `trade-imp-${idCounter++}`,
                  instrument: ex.instrument || 'Unknown',
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

          if (!currentTrade) return;

          // Update Logic
          position += (ex.qty * dir);

          let role = 'Open';
          if (currentTrade.executions.length > 0) {
              const prevPos = currentTrade.executions[currentTrade.executions.length-1].posAfter || 0;
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
          currentTrade.pnl += ex.pnlContribution || 0;

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
export const generateDemoData = (): Trade[] => {
  const trades: Trade[] = [];
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
