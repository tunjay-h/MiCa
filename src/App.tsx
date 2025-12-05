import { useEffect } from 'react';
import { NodePanel } from './components/NodePanel';
import { SceneCanvas } from './scene/SceneCanvas';
import { SpaceSwitcher } from './components/SpaceSwitcher';
import { SearchBar } from './components/SearchBar';
import { useMiCa } from './state/store';
import { ImportExportPanel } from './components/ImportExportPanel';

function Header() {
  return (
    <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-aurora">MiCa / Mind Canvas</p>
        <h1 className="text-3xl font-semibold text-sand">Your personal planetarium for ideas</h1>
        <p className="text-sm text-slate-400">Local-first, offline-capable, crafted for calm thinking.</p>
      </div>
      <div className="rounded-full border border-aurora/40 bg-aurora/10 px-4 py-2 text-xs text-aurora">
        Dome mode • Hush-ready • Local only
      </div>
    </header>
  );
}

export default function App() {
  const { init, initialized } = useMiCa();

  useEffect(() => {
    init();
  }, [init]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-midnight text-sand">
        <div className="space-y-2 text-center">
          <p className="text-sm text-slate-400">Booting MiCa</p>
          <p className="text-xl font-semibold">Preparing spaces…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 md:px-10 md:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Header />
        <SearchBar />
        <SceneCanvas />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SpaceSwitcher />
          <NodePanel />
        </div>
        <ImportExportPanel />
        <footer className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-slate-400">
          Local-only by default • IndexedDB powered • Offline-ready via PWA. Future-proofed for XR + AI helpers.
        </footer>
      </div>
    </div>
  );
}
