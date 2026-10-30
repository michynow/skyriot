import { lazy, Suspense, useState } from 'react';
import type { JoinOptions } from '@skyriot/shared';
import { Game } from './Game';
import { Lobby } from './ui/Lobby';

const RenderDemo = lazy(() => import('./scene/demoEntry').then((m) => ({ default: m.RenderDemo })));

export function App() {
  const [options, setOptions] = useState<JoinOptions | null>(null);
  if (new URLSearchParams(location.search).get('demo') === 'render') {
    return (
      <Suspense fallback={null}>
        <RenderDemo />
      </Suspense>
    );
  }
  return options ? <Game options={options} onExit={() => setOptions(null)} /> : <Lobby onLaunch={setOptions} />;
}
