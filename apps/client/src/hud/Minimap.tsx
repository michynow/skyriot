import { useEffect, useRef } from 'react';
import { sampleHeight, type Heightfield } from '@skyriot/shared';
import { world } from '../state/world';
import { NATION_COLOR } from './Reticles';

const SIZE = 200;

function shadeTerrain(hf: Heightfield, maxH: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SIZE, SIZE);
  const half = hf.size / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const wx = (x / (SIZE - 1)) * hf.size - half;
      const wz = (y / (SIZE - 1)) * hf.size - half;
      const h = sampleHeight(hf, wx, wz);
      // Cheap hillshade from the west-north neighbour.
      const hn = sampleHeight(hf, wx - 40, wz - 40);
      const shade = Math.min(1.4, Math.max(0.5, 1 + (h - hn) / 60));
      const t = Math.min(1, h / maxH);
      const i = (y * SIZE + x) * 4;
      img.data[i] = (30 + 90 * t) * shade;
      img.data[i + 1] = (38 + 70 * t) * shade;
      img.data[i + 2] = (46 + 40 * t) * shade;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const g = ref.current!.getContext('2d')!;
    let terrain: HTMLCanvasElement | null = null;
    let terrainFor: Heightfield | null = null;
    const timer = setInterval(() => {
      const hf = world.heightfield;
      if (hf && terrainFor !== hf) {
        terrain = shadeTerrain(hf, world.map?.maxHeight ?? 400);
        terrainFor = hf;
      }
      g.clearRect(0, 0, SIZE, SIZE);
      if (terrain) g.drawImage(terrain, 0, 0);
      const size = world.map?.size ?? 4000;
      const own = world.ownId ? world.ships.get(world.ownId) : undefined;
      for (const s of world.ships.values()) {
        if (!s.alive) continue;
        const x = (s.pos[0] / size + 0.5) * SIZE;
        const y = (s.pos[2] / size + 0.5) * SIZE;
        const [qx, qy, qz, qw] = s.rot;
        const heading = Math.atan2(-(1 - 2 * (qx * qx + qy * qy)), -2 * (qx * qz + qw * qy)); // canvas angle of (fx, fz)
        const isOwn = s.id === own?.id;
        g.save();
        g.translate(x, y);
        g.rotate(heading);
        g.fillStyle = isOwn ? '#ffffff' : NATION_COLOR[s.nation];
        g.strokeStyle = 'rgba(0,0,0,0.8)';
        g.lineWidth = 1;
        const r = isOwn ? 7 : 5;
        g.beginPath();
        g.moveTo(r, 0);
        g.lineTo(-r * 0.8, r * 0.65);
        g.lineTo(-r * 0.4, 0);
        g.lineTo(-r * 0.8, -r * 0.65);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="minimap">
      <canvas ref={ref} width={SIZE} height={SIZE} />
      <span className="mm-n">N</span>
    </div>
  );
}
