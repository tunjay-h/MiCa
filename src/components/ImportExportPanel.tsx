import { useState } from 'react';
import { useMiCa } from '../state/store';

export function ImportExportPanel() {
  const { activeSpaceId, exportAll, exportSpace, importData } = useMiCa();
  const [message, setMessage] = useState('Local-only backups keep your Spaces safe.');

  const download = (data: string, filename: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (scope: 'space' | 'all') => {
    const payload = scope === 'space' && activeSpaceId ? await exportSpace(activeSpaceId) : await exportAll();
    download(payload, `mica-${scope}-backup-${Date.now()}.json`);
    setMessage(scope === 'space' ? 'Exported current Space.' : 'Exported all Spaces.');
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await importData(payload);
      if (result) {
        setMessage(`Imported ${result.addedSpaces} space(s), ${result.addedNodes} nodes, ${result.addedEdges} edges.`);
      } else {
        setMessage('Import did not contain any Spaces.');
      }
    } catch (error) {
      console.error(error);
      setMessage('Import failed. Ensure the file is a valid MiCa backup.');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Import & Export</p>
          <p className="text-sm text-slate-300">Offline backups with schema versioned JSON.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sand hover:border-aurora/60"
            onClick={() => handleExport('space')}
            disabled={!activeSpaceId}
          >
            Export space
          </button>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sand hover:border-aurora/60"
            onClick={() => handleExport('all')}
          >
            Export all
          </button>
        </div>
      </div>
      <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-white/10 bg-white/5 p-3 text-sm text-slate-300 hover:border-aurora/40">
        <span className="font-semibold text-sand">Import backup</span>
        <span className="text-xs text-slate-400">Adds Spaces from a MiCa JSON backup.</span>
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => handleImport(event.target.files?.[0] ?? null)}
        />
      </label>
      <p className="text-xs text-slate-400">{message}</p>
    </div>
  );
}
