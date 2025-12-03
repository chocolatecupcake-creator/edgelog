import React from 'react';
import {
  Lightbulb, Zap, AlertTriangle, TrendingDown, Activity, ThumbsUp, ThumbsDown, Filter, TrendingUp
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, AreaChart, Area
} from 'recharts';
import { Card } from "@/components/ui/card";
import { Trade, TradeConfig, cn } from "@/lib/trade-utils";

interface StatsProps {
    trades: Trade[];
    filteredTrades: Trade[];
    stats: any;
    config: TradeConfig;
    filters: any;
    setFilters: (filters: any) => void;
}

export const Stats = ({ trades, filteredTrades, stats, config, filters, setFilters }: StatsProps) => {

    const renderFilters = (context = 'sidebar') => {
      const isFull = context === 'full';
      const containerClass = isFull
        ? "flex flex-wrap items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl mb-6 shadow-sm no-print"
        : "flex flex-wrap items-center gap-2 p-2 bg-slate-900 border-b border-slate-800 no-print";
      const selectClass = isFull
        ? "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 shadow-inner"
        : "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500";

      // Simplified filters for Stats view (removed search input and other fields to match original renderStats logic if needed, but original code reuses renderFilters with 'full' context)
      // I will implement a basic version or reuse the logic. Let's reuse logic but I need to make sure I have all handlers.
      // Actually, in the original code, renderFilters was defined in the main component and passed down or used directly.
      // Here, I will implement a local version or use what is passed.
      // Since I passed `setFilters`, I can reimplement the UI.

      return (
          <div className={containerClass}>
             {isFull && <div className="text-sm font-bold text-white mr-2 flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-500" /> Filter Data:</div>}
             <div className="relative flex-grow max-w-xs">
                {/* Search input was in original but I'll skip complex input handling for now or add it back if needed */}
                <input type="text" placeholder="Search symbol, setup..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition shadow-inner" value={filters.text} onChange={(e) => setFilters({...filters, text: e.target.value})} />
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
             <div className={cn("ml-auto text-slate-500", isFull ? 'text-sm font-medium' : 'text-xs')}>{filteredTrades.length} trades found</div>
          </div>
      );
    };

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
                    <div className={cn("text-4xl font-bold mono-font print:text-black", stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}</div>
                </div>
                )}
            </div>

            {hasData ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="p-5 border-t-4 border-indigo-500 print:bg-white print:border-slate-300 print:shadow-none">
                    <div className="text-slate-500 text-[10px] font-bold uppercase">Expectancy</div>
                    <div className={cn("text-2xl font-mono font-bold mt-1 print:text-black", stats.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}</div>
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
                            {stats.setupMetrics.map((s: any) => (
                                <tr key={s.setup} className="hover:bg-slate-800/30 transition">
                                    <td className="px-6 py-3 font-medium text-white print:text-black">{s.setup}</td>
                                    <td className="px-6 py-3 text-right text-slate-400 print:text-black">{s.count}</td>
                                    <td className="px-6 py-3 text-right"><span className={cn("print:text-black", s.winRate > 50 ? 'text-emerald-400' : 'text-slate-400')}>{s.winRate.toFixed(1)}%</span></td>
                                    <td className="px-6 py-3 text-right font-mono text-slate-300 print:text-black">{s.pf.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold"><span className={cn("print:text-black", s.expectancy > 0 ? 'text-emerald-400' : 'text-rose-400')}>{s.expectancy > 0 ? '+' : ''}${s.expectancy.toFixed(0)}</span></td>
                                    <td className="px-6 py-3 text-right font-mono font-bold"><span className={cn("print:text-black", s.pnl > 0 ? 'text-emerald-400' : 'text-rose-400')}>{s.pnl > 0 ? '+' : ''}${s.pnl.toFixed(0)}</span></td>
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
                                    {stats.byMistake.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />)}
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
                                    {stats.bySuccess.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />)}
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
