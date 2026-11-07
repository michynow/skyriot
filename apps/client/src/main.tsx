import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root')!);
// Render preview is loaded on its own so it doesn't depend on the game's module graph.
if (location.search.includes('demo=render'))
  void import('./scene/demoEntry').then((m) => root.render(<m.RenderDemo />));
else if (import.meta.env.DEV && location.search.includes('dev=icons'))
  void import('./dev/IconSheet').then((m) => root.render(<m.default />));
else void import('./App').then((m) => root.render(<m.App />));
