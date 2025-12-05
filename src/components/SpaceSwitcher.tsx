import { availableTemplates } from '../data/templates';
import { useMiCa } from '../state/store';

export function SpaceSwitcher() {
  const { spaces, activeSpaceId, setActiveSpace, addSpaceFromTemplate, renameSpace, deleteSpace } = useMiCa();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-300 uppercase tracking-[0.2em]">Spaces</p>
          <p className="text-sm text-slate-400">Local-only</p>
        </div>
        <button
          className="rounded-md bg-aurora/20 px-3 py-1 text-sm text-aurora hover:bg-aurora/30"
          onClick={() => addSpaceFromTemplate('Blank Space')}
        >
          + New
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {spaces.map((space) => (
          <button
            key={space.id}
            onClick={() => setActiveSpace(space.id)}
            className={`flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-left transition hover:border-aurora/30 hover:bg-white/10 ${
              activeSpaceId === space.id ? 'border-aurora/50' : ''
            }`}
          >
            <span className="text-xl" aria-hidden>
              {space.icon}
            </span>
            <div>
              <p className="font-semibold text-sand">{space.name}</p>
              <p className="text-xs text-slate-400">Updated {new Date(space.updatedAt).toLocaleDateString()}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                <button
                  className="rounded-full bg-white/5 px-2 py-1 hover:text-sand"
                  onClick={(event) => {
                    event.stopPropagation();
                    const next = window.prompt('Rename space', space.name);
                    if (next?.trim()) renameSpace(space.id, next.trim());
                  }}
                >
                  Rename
                </button>
                <button
                  className="rounded-full bg-red-500/10 px-2 py-1 text-red-200 hover:bg-red-500/20"
                  onClick={(event) => {
                    event.stopPropagation();
                    const confirmed = window.confirm('Delete this Space and all its contents?');
                    if (confirmed) deleteSpace(space.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-xs text-slate-300 uppercase tracking-[0.2em] mb-2">Templates</p>
        <div className="flex flex-wrap gap-2">
          {availableTemplates.map((template) => (
            <button
              key={template.key}
              className="rounded-md border border-white/10 px-3 py-1 text-sm text-sand hover:border-aurora/40"
              onClick={() => addSpaceFromTemplate(template.name)}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
