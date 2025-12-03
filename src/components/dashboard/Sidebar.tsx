import React, { useRef } from 'react';
import {
  LayoutDashboard, BookOpen, Settings, PlayCircle, Upload, Calendar as CalendarIcon,
  TrendingUp, FileText, CheckCircle2, Save, Printer
} from 'lucide-react';
import { cn } from "@/lib/trade-utils";

interface SidebarProps {
  view: string;
  setView: (view: string) => void;
  isSaved: boolean;
  onLoadDemo: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  onManualSave: () => void;
  user: any; // User type from supabase
  onLogout: () => void;
  onExportCSV: () => void;
}

export const Sidebar = ({ view, setView, isSaved, onLoadDemo, onImport, onPrint, onManualSave, user, onLogout, onExportCSV }: SidebarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
      <aside className="w-16 lg:w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 z-30 no-print">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
          <BookOpen className="text-indigo-500 w-6 h-6" />
          <h1 className="hidden lg:block text-lg font-bold text-white tracking-tight ml-2">Edge<span className="text-indigo-500">Log</span> Pro</h1>
        </div>

        <nav className="p-2 lg:p-4 space-y-2 flex-grow">
          {[
            { id: 'journal', label: 'Journal', icon: LayoutDashboard },
            { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
            { id: 'stats', label: 'Analytics', icon: TrendingUp },
            { id: 'settings', label: 'Config', icon: Settings },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} className={cn("w-full flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-4 py-3 rounded-xl transition-all group", view === item.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white border border-transparent')}>
              <item.icon className="w-5 h-5" />
              <span className="hidden lg:inline font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-2">
           <button onClick={onLoadDemo} className="w-full flex items-center justify-center lg:justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg border border-slate-700 transition">
             <PlayCircle className="w-4 h-4" />
             <span className="hidden lg:inline text-xs font-medium">Load Demo</span>
           </button>
           <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center lg:justify-start gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-3 rounded-lg border border-indigo-500 transition shadow-lg shadow-indigo-500/20">
             <Upload className="w-4 h-4" />
             <span className="hidden lg:inline text-xs font-medium">Import Data</span>
           </button>
           <input type="file" ref={fileInputRef} onChange={onImport} className="hidden" accept=".csv,.json" />

           <button onClick={onPrint} className="w-full flex items-center justify-center lg:justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg border border-slate-700 transition">
             <Printer className="w-4 h-4" />
             <span className="hidden lg:inline text-xs font-medium">Print / PDF</span>
           </button>

           <button onClick={onExportCSV} className="w-full flex items-center justify-center lg:justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg border border-slate-700 transition">
             <FileText className="w-4 h-4" />
             <span className="hidden lg:inline text-xs font-medium">Export CSV</span>
           </button>

           {!user && (
             <button onClick={onManualSave} className={cn("w-full flex items-center justify-center lg:justify-start gap-2 bg-slate-800 hover:bg-slate-700 transition py-2 px-3 rounded-lg border border-slate-700", isSaved ? 'text-emerald-400 border-emerald-500/50' : 'text-amber-400')}>
               {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
               <span className="hidden lg:inline text-xs font-medium">{isSaved ? 'Saved!' : 'Save Workspace'}</span>
             </button>
           )}

           <div className="pt-2 border-t border-slate-800">
             {user ? (
               <div className="flex flex-col gap-2">
                 <div className="text-[10px] text-slate-500 truncate px-2 text-center lg:text-left">
                    <div className="flex items-center gap-1 justify-center lg:justify-start mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-emerald-500 font-bold uppercase tracking-wider">Cloud Sync</span>
                    </div>
                    <span className="text-slate-400">Logged in as</span> <span className="text-indigo-400 block truncate">{user.email}</span>
                 </div>
                 <button onClick={onLogout} className="w-full text-xs text-rose-400 hover:text-rose-300 py-1">Logout</button>
               </div>
             ) : (
               <a href="/login" className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-3 rounded-lg border border-indigo-500 transition shadow-lg shadow-indigo-500/20 text-xs font-bold">
                 Login / Sign Up
               </a>
             )}
           </div>
        </div>
      </aside>
  );
};
