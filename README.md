# MiCa — Mind Canvas

Local-first, offline-capable 3D mind mapper prototype built with React, Vite, Tailwind, Zustand, Dexie, and react-three-fiber.

## Getting started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Notes
- Data is stored locally in IndexedDB (no accounts or network calls).
- PWA manifest and service worker are provided via `vite-plugin-pwa` for offline use after first load.
- Templates seed several starter Spaces with basic nodes/edges; create additional spaces from the UI.
