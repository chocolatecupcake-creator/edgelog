import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Trade, cn } from "@/lib/trade-utils";

interface CalendarProps {
  trades: Trade[];
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  calendarData: Record<string, { pnl: number, count: number, trades: Trade[] }>;
}

export const Calendar = ({ trades, calendarDate, setCalendarDate, calendarData }: CalendarProps) => {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for(let i=0; i<firstDay; i++) days.push(null);
  for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));

  const changeMonth = (delta: number) => setCalendarDate(new Date(year, month + delta, 1));

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
                          <Card key={i} className={cn("aspect-square p-2 border flex flex-col transition cursor-pointer group relative", bg)}>
                              <div className="flex justify-between items-start">
                                  <span className={cn("text-sm font-bold", hasTrades ? 'text-white' : 'text-slate-600')}>{date.getDate()}</span>
                                  {hasTrades && (
                                      <div className={cn("text-xs font-mono font-bold", pnl > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                          {pnl > 0 ? '+' : ''}{Math.round(pnl)}
                                      </div>
                                  )}
                              </div>
                              {hasTrades && (
                                  <div className="mt-auto">
                                      <div className="text-[10px] text-slate-500">{dayData.count} trades</div>
                                      <div className="flex gap-1 mt-1 flex-wrap">
                                           {dayData.trades.slice(0,3).map((t, idx) => (
                                               <div key={idx} className={cn("w-1.5 h-1.5 rounded-full", t.pnl > 0 ? 'bg-emerald-500' : 'bg-rose-500')} />
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
