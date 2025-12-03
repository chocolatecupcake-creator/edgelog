import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { TradeConfig } from "@/lib/trade-utils";

interface SettingsProps {
  config: TradeConfig;
  setConfig: React.Dispatch<React.SetStateAction<TradeConfig>>;
}

export const Settings = ({ config, setConfig }: SettingsProps) => {

  const addConfigItem = (key: keyof TradeConfig, value: string) => {
      if(!value.trim()) return;
      setConfig(prev => ({ ...prev, [key]: [...prev[key], value.trim()] }));
  };

  const removeConfigItem = (key: keyof TradeConfig, itemToRemove: string) => {
      setConfig(prev => ({ ...prev, [key]: prev[key].filter(i => i !== itemToRemove) }));
  };

  return (
    <div className="p-10 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <div><h2 className="text-2xl font-bold text-white">Journal Configuration</h2><p className="text-slate-400 text-sm">Customize tags and dropdowns.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(config).map(([key, items]) => (
            <Card key={key} className="p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">{key}</h3>
              <div className="flex gap-2 mb-3">
                 <input
                    type="text"
                    placeholder="Add new..."
                    className="flex-grow bg-slate-950 border border-slate-800 rounded px-2 text-sm text-white focus:border-indigo-500 outline-none h-8"
                    onKeyDown={(e) => {
                        if(e.key === 'Enter') {
                            addConfigItem(key as keyof TradeConfig, e.currentTarget.value);
                            e.currentTarget.value = '';
                        }
                    }}
                 />
                 <button className="bg-indigo-600 hover:bg-indigo-500 text-white w-8 h-8 rounded flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                 {items.map((item: string) => (
                   <div key={item} className="flex justify-between items-center bg-slate-800/30 px-2 py-2 rounded border border-slate-700/30 group">
                      <span className="text-xs text-slate-300">{item}</span>
                      <button onClick={() => removeConfigItem(key as keyof TradeConfig, item)} className="text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3 h-3" /></button>
                   </div>
                 ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
