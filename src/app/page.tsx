'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Journal } from '@/components/dashboard/Journal';
import { Calendar } from '@/components/dashboard/Calendar';
import { Stats } from '@/components/dashboard/Stats';
import { Settings } from '@/components/dashboard/Settings';
import { ImportWizard } from '@/components/dashboard/ImportWizard';
import { Trade, TradeConfig, DEFAULT_CONFIG, generateDemoData, processImport, processCompletedTrades, parseCSVLine } from "@/lib/trade-utils";
import { createClient } from '@/lib/supabase/client';

export default function EdgeLog() {
  const [view, setView] = useState('journal');
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  const [trades, setTrades] = useState<Trade[]>([]);

  const [config, setConfig] = useState<TradeConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    // Initial Load from LocalStorage for Guest Mode or Config
    // We do this here to avoid hydration mismatch
    try {
        const saved = localStorage.getItem('edgeLogData');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Only set trades if we are not going to fetch from user (will check user in another effect, but for guest start it's fine)
            // Actually, we should wait for user check?
            // If user is logged in, we fetch from DB. If not, we use local.
            // But we don't know user status instantly.
            // Let's set local first, and if user logs in, we might overwrite or merge.
            // Given the logic in previous effect: "if (user) fetchTrades(user.id)"
            // It's safe to load local initially, and let fetchTrades override it if logged in.
            setTrades(parsed.trades || []);
            setConfig({ ...DEFAULT_CONFIG, ...(parsed.config || {}) });
        }
    } catch (e) { console.error("Error loading local data", e); }
  }, []);

  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ text: '', setup: 'All', side: 'All', outcome: 'All' });
  const [isSaved, setIsSaved] = useState(false);
  const [isTradeSaved, setIsTradeSaved] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [importWizard, setImportWizard] = useState<{ isOpen: boolean, content: string }>({ isOpen: false, content: '' });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchTrades(user.id);
      }
    };
    getUser();
  }, []);

  const fetchTrades = async (userId: string) => {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('time', { ascending: false });

    if (error) {
      console.error('Error fetching trades:', error);
    } else if (data) {
        // Map DB structure to App structure if needed, or ensure they match
        // The DB schema uses snake_case, our app uses camelCase mostly, but let's check.
        // DB: instrument, direction, time, end_time, pnl, equity_curve, ...
        // App Trade: instrument, direction, time, endTime, pnl, equityCurve, ...

        const mappedTrades: Trade[] = data.map((t: any) => ({
            id: t.id,
            instrument: t.instrument,
            direction: t.direction as 'Long' | 'Short',
            time: Number(t.time),
            endTime: Number(t.end_time),
            pnl: Number(t.pnl),
            equityCurve: Number(t.equity_curve),
            setup: t.setup,
            notes: t.notes || { entry: '', exit: '', mgmt: '', general: '' },
            executions: t.executions || [],
            annotations: t.annotations || [],
            mistakes: t.mistakes || [],
            successes: t.successes || [],
            mindsets: t.mindsets || [],
            chartImage: t.chart_image_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/trade-images/${t.chart_image_path}` : null
        }));

        // Recalculate equity curve just in case order changed
        const sorted = mappedTrades.sort((a,b) => a.time - b.time);
        let runEq = 0;
        sorted.forEach(t => {
            runEq += t.pnl;
            t.equityCurve = runEq;
        });

        setTrades(sorted.reverse());
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTrades([]); // Clear data on logout
    window.location.reload(); // Refresh to ensure clean state
  };

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

    const getBreakdown = (field: keyof Trade, isArray = false) => {
        const counts: Record<string, number> = {};
        filteredTrades.forEach(t => {
            const items = isArray ? (t[field] as string[]) : [t[field] as string];
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
    }).filter(Boolean).sort((a,b) => (b!.expectancy - a!.expectancy));

    const combinations: Record<string, { pnl: number, count: number }> = {};
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
      const days: Record<string, { pnl: number, count: number, trades: Trade[] }> = {};
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
      localStorage.setItem('edgeLogData', JSON.stringify({ trades, config }));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTradeSave = async () => {
      if (user) {
          // Save to Supabase
          setIsTradeSaved(false); // Reset

          // We can save all, or just the selected/modified one.
          // For simplicity/robustness in this "Journal" app, let's upsert the selected trade if available,
          // or if we are just clicking "Save Workspace" (handleManualSave), we might want to sync all.
          // But handleTradeSave is usually for the specific trade in view.

          if (selectedTrade) {
             const t = selectedTrade;

             // Upload Image if it's base64 (new)
             let imagePath = null;
             if (t.chartImage && t.chartImage.startsWith('data:image')) {
                 const fileExt = 'png'; // Assume png for base64 from paste
                 const fileName = `${user.id}/${t.id}-${Date.now()}.${fileExt}`;

                 // Convert base64 to blob
                 const res = await fetch(t.chartImage);
                 const blob = await res.blob();

                 const { error: uploadError } = await supabase.storage
                    .from('trade-images')
                    .upload(fileName, blob);

                 if (!uploadError) {
                     imagePath = fileName;
                 }
             } else if (t.chartImage && t.chartImage.includes('trade-images')) {
                 // Existing remote image, extract path if needed, or just leave it.
                 // Actually our DB stores the path, so we need to preserve it if it wasn't changed.
                 // But wait, our mapped object puts the full URL in `chartImage`.
                 // We need to extract the path back out if we are updating.
                 const urlPart = '/storage/v1/object/public/trade-images/';
                 if (t.chartImage.includes(urlPart)) {
                     imagePath = t.chartImage.split(urlPart)[1];
                 }
             }

             const dbTrade = {
                 id: t.id.startsWith('trade-') ? undefined : t.id, // If it's a temp ID, let DB generate UUID? Or we generate one?
                 // Actually, if we want to sync, we should probably generate UUIDs on client or handle mapping.
                 // For now, if it's a "trade-..." ID, it's local. We should Insert.
                 // If it's a UUID, it's existing. Update.
                 // Let's rely on upsert, but we need a valid UUID for the primary key if we want to determine identity.
                 // If the ID is 'trade-123', Supabase won't like it if the column is UUID.
                 // We need to handle ID migration.
                 user_id: user.id,
                 instrument: t.instrument,
                 direction: t.direction,
                 time: t.time,
                 end_time: t.endTime,
                 pnl: t.pnl,
                 equity_curve: t.equityCurve,
                 setup: t.setup,
                 notes: t.notes,
                 executions: t.executions,
                 annotations: t.annotations,
                 mistakes: t.mistakes,
                 successes: t.successes,
                 mindsets: t.mindsets,
                 chart_image_path: imagePath
             };

             // If ID is not UUID, remove it so Supabase generates one.
             // BUT, we need to update our local state with the new UUID to avoid duplicates on next save.
             const isTempId = t.id.startsWith('trade-');
             if (!isTempId) (dbTrade as any).id = t.id;

             const { data, error } = await supabase.from('trades').upsert(dbTrade).select().single();

             if (!error && data) {
                 // Update local state with new ID and Image Path (URL)
                 const newUrl = data.chart_image_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/trade-images/${data.chart_image_path}` : null;
                 setTrades(prev => prev.map(pt => pt.id === t.id ? { ...pt, id: data.id, chartImage: newUrl } : pt));
                 if(selectedTradeId === t.id) setSelectedTradeId(data.id);
                 setIsTradeSaved(true);
             } else {
                 console.error(error);
                 alert('Error saving to cloud');
             }
          }
      } else {
          // Local Storage Fallback
          localStorage.setItem('edgeLogData', JSON.stringify({ trades, config }));
          setIsTradeSaved(true);
          setTimeout(() => setIsTradeSaved(false), 2000);
      }
  };

  const handleLoadDemo = () => {
    const data = generateDemoData();
    setTrades(data);
    setSelectedTradeId(data[0].id);
  };

  const handlePrint = () => {
      window.print();
  };

  const handleExportCSV = () => {
      const headers = ['id', 'instrument', 'direction', 'time', 'endTime', 'pnl', 'setup', 'entry_note', 'exit_note', 'mistakes', 'successes'];
      const csvContent = [
          headers.join(','),
          ...trades.map(t => {
              const row = [
                  t.id,
                  t.instrument,
                  t.direction,
                  new Date(t.time).toISOString(),
                  new Date(t.endTime).toISOString(),
                  t.pnl,
                  t.setup,
                  `"${(t.notes.entry || '').replace(/"/g, '""')}"`,
                  `"${(t.notes.exit || '').replace(/"/g, '""')}"`,
                  `"${(t.mistakes || []).join(';')}"`,
                  `"${(t.successes || []).join(';')}"`
              ];
              return row.join(',');
          })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `trades_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- SELECTION & MERGE LOGIC ---
  const toggleSelectionMode = (mode: boolean) => {
      setSelectionMode(mode);
      setSelectedIds([]);
  };

  const toggleSelectId = (id: string, e: React.MouseEvent) => {
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

      const newTrade: Trade = {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
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
             const rows: any[] = [];
             for(let i=1; i<lines.length; i++) {
                 // Use Robust Parser
                 const cols = parseCSVLine(lines[i]);
                 if (cols.length < headers.length) continue;

                 const row: any = {};
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
         // DETECT FORMAT 1: Raw Executions (Basic Heuristic)
         else if (headers.length >= 5 && (headers.includes('Time') || headers.includes('time') || headers[2].toLowerCase().includes('time'))) {
             const raw: any[] = [];
             lines.forEach(line => {
                 const cols = parseCSVLine(line);
                 // Very basic check for execution row
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
                 // Fallback to Wizard
                 setImportWizard({ isOpen: true, content });
             }
         } else {
            // Unknown format -> Wizard
            setImportWizard({ isOpen: true, content });
         }
      }
    };
    reader.readAsText(file);
  };

  const handleWizardComplete = (rows: any[]) => {
      const processed = processCompletedTrades(rows);
      setTrades(processed);
      if(processed.length) setSelectedTradeId(processed[0].id);
      setImportWizard({ isOpen: false, content: '' });
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 font-sans selection:bg-indigo-500/30">
      <Sidebar
        view={view}
        setView={setView}
        isSaved={isSaved}
        onLoadDemo={handleLoadDemo}
        onImport={handleFileUpload}
        onPrint={handlePrint}
        onManualSave={handleManualSave}
        user={user}
        onLogout={handleLogout}
        onExportCSV={handleExportCSV}
      />

      <main className="flex-grow flex relative overflow-hidden print:overflow-visible">
        {importWizard.isOpen && (
            <ImportWizard
                csvContent={importWizard.content}
                onComplete={handleWizardComplete}
                onCancel={() => setImportWizard({ isOpen: false, content: '' })}
            />
        )}
        {view === 'journal' && (
            <Journal
                trades={trades}
                filteredTrades={filteredTrades}
                selectedTrade={selectedTrade}
                selectedTradeId={selectedTradeId}
                setSelectedTradeId={setSelectedTradeId}
                config={config}
                filters={filters}
                setFilters={setFilters}
                selectionMode={selectionMode}
                setSelectionMode={toggleSelectionMode}
                selectedIds={selectedIds}
                toggleSelectId={toggleSelectId}
                mergeSelectedTrades={mergeSelectedTrades}
                setTrades={setTrades}
                isTradeSaved={isTradeSaved}
                handleTradeSave={handleTradeSave}
            />
        )}
        {view === 'calendar' && (
            <Calendar
                trades={trades}
                calendarDate={calendarDate}
                setCalendarDate={setCalendarDate}
                calendarData={calendarData}
            />
        )}
        {view === 'stats' && (
            <Stats
                trades={trades}
                filteredTrades={filteredTrades}
                stats={stats}
                config={config}
                filters={filters}
                setFilters={setFilters}
            />
        )}
        {view === 'settings' && (
            <Settings config={config} setConfig={setConfig} />
        )}
      </main>
    </div>
  );
}
