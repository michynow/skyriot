import { lazy, Suspense, useEffect, useState } from 'react';
import type { JoinOptions, TravelOrder } from '@skyriot/shared';
import { Game } from './Game';
import { useHud } from './hud/hudStore';
import { Lobby } from './ui/Lobby';

const FADE_MS = 350;

const RenderDemo = lazy(() => import('./scene/demoEntry').then((m) => ({ default: m.RenderDemo })));

export function App() {
  const [options, setOptions] = useState<JoinOptions | null>(null);
  /** Gate travel: 'out' = fading to black, 'wait' = rejoining; fades back in once deployed (or failed). */
  const [fade, setFade] = useState<'out' | 'wait' | null>(null);
  const status = useHud((h) => h.status);
  useEffect(() => {
    if (fade === 'wait' && status !== 'connecting') setFade(null);
  }, [fade, status]);
  const travel = (order: TravelOrder) => {
    setFade('out');
    setTimeout(() => {
      useHud.setState({ status: 'connecting' });
      setFade('wait');
      setOptions((o) => o && { ...o, mapId: order.mapId, travel: order.travel });
    }, FADE_MS);
  };
  if (new URLSearchParams(location.search).get('demo') === 'render') {
    return (
      <Suspense fallback={null}>
        <RenderDemo />
      </Suspense>
    );
  }
  return (
    <>
      {options ? (
        <Game options={options} onExit={() => setOptions(null)} onTravel={travel} />
      ) : (
        <Lobby onLaunch={setOptions} />
      )}
      <div className={`travel-fade ${fade ? 'on' : ''}`} />
    </>
  );
}
