import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { parseCSVLine } from "@/lib/trade-utils";

interface ImportWizardProps {
  csvContent: string;
  onComplete: (data: any[]) => void;
  onCancel: () => void;
}

export const ImportWizard = ({ csvContent, onComplete, onCancel }: ImportWizardProps) => {
  const [lines] = useState(() => csvContent.trim().split('\n'));
  const [headers] = useState(() => lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '')));
  const [preview] = useState(() => lines.slice(1, 6).map(parseCSVLine));

  const [mapping, setMapping] = useState({
      instrument: '',
      direction: '',
      entryPrice: '',
      exitPrice: '',
      qty: '',
      entryTime: '',
      exitTime: '',
      pnl: ''
  });

  const fields = [
      { key: 'instrument', label: 'Symbol / Instrument' },
      { key: 'direction', label: 'Direction (Long/Short or Buy/Sell)' },
      { key: 'entryPrice', label: 'Entry Price' },
      { key: 'exitPrice', label: 'Exit Price' },
      { key: 'qty', label: 'Quantity / Size' },
      { key: 'entryTime', label: 'Entry Time' },
      { key: 'exitTime', label: 'Exit Time' },
      { key: 'pnl', label: 'PnL (Optional)' }
  ];

  const handleFinish = () => {
      // Validate mapping
      if (!mapping.instrument || !mapping.entryPrice || !mapping.entryTime) {
          alert("Please map at least Instrument, Entry Price, and Entry Time.");
          return;
      }

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const row: any = {};

          // Map standard fields to internal format used by processCompletedTrades or processImport
          // We'll verify against a standard intermediate format

          const getVal = (key: keyof typeof mapping) => {
             const headerName = mapping[key];
             const idx = headers.indexOf(headerName);
             return idx >= 0 ? cols[idx] : null;
          };

          row['ContractName'] = getVal('instrument');
          row['Type'] = getVal('direction');
          row['EntryPrice'] = getVal('entryPrice');
          row['ExitPrice'] = getVal('exitPrice');
          row['Size'] = getVal('qty');
          row['EnteredAt'] = getVal('entryTime');
          row['ExitedAt'] = getVal('exitTime');
          row['PnL'] = getVal('pnl');

          rows.push(row);
      }
      onComplete(rows);
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <Card className="w-full max-w-4xl bg-slate-900 border-slate-700 p-6 max-h-[90vh] flex flex-col">
              <h2 className="text-xl font-bold text-white mb-4">Import Wizard</h2>
              <p className="text-slate-400 text-sm mb-6">We couldn't automatically detect the format. Please map the columns.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto flex-grow">
                  <div className="space-y-4">
                      {fields.map(f => (
                          <div key={f.key}>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{f.label}</label>
                              <select
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm"
                                value={mapping[f.key as keyof typeof mapping]}
                                onChange={(e) => setMapping({...mapping, [f.key]: e.target.value})}
                              >
                                  <option value="">-- Select Column --</option>
                                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                          </div>
                      ))}
                  </div>

                  <div>
                      <h3 className="text-sm font-bold text-white mb-2">Data Preview</h3>
                      <div className="overflow-x-auto border border-slate-800 rounded-lg">
                          <table className="w-full text-xs text-left text-slate-300">
                              <thead className="bg-slate-950 font-bold text-slate-500">
                                  <tr>
                                      {headers.map(h => <th key={h} className="p-2 border-b border-slate-800 whitespace-nowrap">{h}</th>)}
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                  {preview.map((row, idx) => (
                                      <tr key={idx}>
                                          {row.map((cell, cIdx) => <td key={cIdx} className="p-2 whitespace-nowrap">{cell}</td>)}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                  <button onClick={onCancel} className="px-4 py-2 text-slate-400 font-bold hover:text-white">Cancel</button>
                  <button onClick={handleFinish} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-500">Finish Import</button>
              </div>
          </Card>
      </div>
  );
};
