import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FRAMES, RUSTWATER_CANYONS, generateHeightfield, sampleHeight, type FrameId, type NationId, type ShipState } from '@skyriot/shared';
import { Ships } from '../frames/Ships';
import { ProjectilesFx } from '../fx/ProjectilesFx';
import { world } from '../state/world';
import { ChaseCamera } from './ChaseCamera';
import { MapScene } from './MapScene';
import { PostFx, type Quality } from './PostFx';

const FRAME_IDS: FrameId[] = ['wasp', 'anvil', 'halo', 'bulwark'];
const NATIONS: NationId[] = ['concord', 'vex'];
const TIERS = [2, 5, 8, 10];
const UPGRADES = [0, 3, 7, 10];
const rnd = Math.random;

function mk(id: string, frame: FrameId, nation: NationId, tier: number, upgrade: number): ShipState {
  const d = FRAMES[frame];
  return {
    id, nation, frame, name: id, isBot: true, tier, upgrade,
    pos: [0, 0, 0], rot: [0, 0, 0, 1], vel: [0, 0, 0], hp: d.maxHp, maxHp: d.maxHp, shield: d.maxShield, maxShield: d.maxShield,
    fuel: 1, speed: 100, alive: true, respawnAtTick: 0, rollTicks: 0, rollCooldownTicks: 0, sieged: false, cooldowns: [], lockTarget: null, ammo1: 100, ammo2: 4, docked: false,
    angVel: [0, 0, 0], brakeHeld: false, dashTicks: 0, ghostTicks: 0, ironTicks: 0, flareTicks: 0, dockTicks: 0, grounded: false,
  };
}

interface Opts { showcase: boolean; focus: number; dist: number; yaw: number; pitch: number }

/** Standalone render preview: fake ships + fake events, no network. Mount inside <Canvas>. */
export function DemoScene({ quality, opts }: { quality: Quality; opts: Opts }) {
  const map = RUSTWATER_CANYONS;
  const demo = useMemo(() => {
    const hf = generateHeightfield(map);
    world.map = map;
    world.heightfield = hf;
    world.ships.clear();
    const list: ShipState[] = [];
    let n = 0;
    for (const nation of NATIONS) {
      for (const frame of FRAME_IDS) {
        list.push(mk(`${nation}-${frame}`, frame, nation, TIERS[n % 4]!, UPGRADES[(n + 1) % 4]!));
        n++;
      }
    }
    const own = mk('own', 'wasp', 'concord', 5, 3);
    own.name = 'You';
    list.unshift(own);
    for (const s of list) world.ships.set(s.id, s);
    world.ownId = opts.showcase ? list[1 + opts.focus]!.id : 'own';
    // altitude: above the highest ground within the flight circle
    let hmax = 0;
    for (let a = 0; a < 64; a++) hmax = Math.max(hmax, sampleHeight(hf, Math.cos(a / 10) * 260, Math.sin(a / 10) * 260));
    return { list, hmax, t: 0, nextId: 1, ev: 0, timers: { fire: 0, missile: 2, hit: 1, kill: 6, roll: 3, impact: 4, flare: 5 }, deadUntil: new Map<string, number>() };
  }, [map, opts.showcase, opts.focus]);

  (window as unknown as { __world: unknown }).__world = world;
  const o = useMemo(() => new THREE.Object3D(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const gl = useThree((s) => s.gl);
  const stats = useMemo(() => ({ frames: 0, acc: 0 }), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    demo.t += dt;
    const t = demo.t;
    const alt = demo.hmax + 70;
    const list = demo.list;

    for (let i = 0; i < list.length; i++) {
      const s = list[i]!;
      if (opts.showcase) {
        if (i === 0) { s.alive = false; continue; }
        const k = i - 1, row = Math.floor(k / 4), col = k % 4;
        s.pos = [(col - 1.5) * 16, alt, row * 16];
        o.position.set(s.pos[0], s.pos[1], s.pos[2]);
        o.rotation.set(0, Math.PI * 0 + 0.0, 0);
        o.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
        s.rot = [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w];
        s.sieged = k % 4 === 3 && Math.floor(t / 4) % 2 === 1;
        if (k === 0 || k === 5) world.boosting.add(s.id); else world.boosting.delete(s.id);
        continue;
      }
      if (i === 0 && location.search.includes('dock')) {
        const d = map.launchDecks.concord[0]!;
        s.pos = [d.pos[0] + 12, d.pos[1] + 2.5, d.pos[2] + 12];
        s.rot = [0, 0.38, 0, 0.92];
        s.docked = true;
        continue;
      }
      // formation circle: own ship leads, others orbit nearby on staggered radii
      const ph = i === 0 ? 0 : 0.5 + i * 0.16;
      const R = 260 + (i === 0 ? 0 : (i % 3) * 18);
      const w = 0.2 - (i === 0 ? 0 : 0.002 * i);
      const a = t * w + ph;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const y = alt + (i === 0 ? 0 : Math.sin(t * 0.7 + i) * 12 + (i % 4) * 7);
      const a2 = a + 0.02;
      // moving direction (tangent) – object faces +Z toward target, we want -Z so look at the mirror point
      o.position.set(x, y, z);
      o.up.set(0, 1, 0);
      o.lookAt(2 * x - Math.cos(a2) * R, y - Math.cos(t * 0.7 + i) * 0.4, 2 * z - Math.sin(a2) * R);
      o.rotateZ(-0.35 + Math.sin(t * 0.5 + i) * 0.1); // bank into the turn
      s.pos = [x, y, z];
      s.rot = [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w];
      s.sieged = false;
      if (i === 0 || i % 3 === 0) world.boosting.add(s.id); else world.boosting.delete(s.id);
      const dead = demo.deadUntil.get(s.id);
      if (dead !== undefined && t > dead) { demo.deadUntil.delete(s.id); s.alive = true; s.hp = s.maxHp; push({ type: 'shipRespawned', id: s.id, pos: s.pos }); }
      s.hp = Math.max(s.maxHp * 0.2, s.maxHp * (0.6 + 0.4 * Math.sin(t * 0.3 + i)) );
    }

    // fake events
    const T = demo.timers;
    const alive = list.filter((s) => s.alive && s.id !== 'own' && !opts.showcase);
    const pick = () => alive[Math.floor(rnd() * alive.length)];
    if (!opts.showcase && alive.length) {
      T.fire -= dt;
      if (T.fire < 0) {
        T.fire = 0.06;
        for (const s of [list[0]!, pick()!]) {
          v.set(0, 0, -1).applyQuaternion(o.quaternion.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]));
          push({ type: 'projectileSpawned', id: demo.nextId++, owner: s.id, kind: 'tracer', weapon: 'needle-cannon', origin: [s.pos[0] + v.x * 5, s.pos[1] + v.y * 5, s.pos[2] + v.z * 5], dir: [v.x, v.y, v.z], speed: 900, target: null, tick: 0 });
        }
      }
      T.missile -= dt;
      if (T.missile < 0) {
        T.missile = 2.5;
        const a = pick()!, b = pick()!;
        v.set(0, 0, -1).applyQuaternion(o.quaternion.set(a.rot[0], a.rot[1], a.rot[2], a.rot[3]));
        push({ type: 'projectileSpawned', id: demo.nextId++, owner: a.id, kind: 'missile', weapon: 'sting-missile', origin: [a.pos[0], a.pos[1] - 1, a.pos[2]], dir: [v.x, v.y, v.z], speed: 190, target: b.id, tick: 0 });
        const r = list[0]!;
        v.set(0, 0, -1).applyQuaternion(o.quaternion.set(r.rot[0], r.rot[1], r.rot[2], r.rot[3]));
        push({ type: 'projectileSpawned', id: demo.nextId++, owner: r.id, kind: 'rocket', weapon: 'brick-bomb', origin: [r.pos[0], r.pos[1] - 1, r.pos[2]], dir: [v.x, v.y - 0.1, v.z], speed: 140, target: null, tick: 0 });
      }
      T.hit -= dt;
      if (T.hit < 0) {
        T.hit = 0.5;
        const s = pick()!;
        push({ type: 'hit', projectile: -1, attacker: 'own', victim: s.id, damage: 30, deflected: rnd() < 0.2, pos: [s.pos[0] + rnd() - 0.5, s.pos[1], s.pos[2]] });
      }
      T.kill -= dt;
      if (T.kill < 0) {
        T.kill = 8;
        const s = pick()!;
        s.alive = false;
        demo.deadUntil.set(s.id, t + 3);
        push({ type: 'shipDestroyed', victim: s.id, killer: 'own', pos: s.pos });
      }
      T.roll -= dt;
      if (T.roll < 0) { T.roll = 4; push({ type: 'barrelRoll', id: pick()!.id, dir: rnd() < 0.5 ? -1 : 1 }); }
      T.impact -= dt;
      if (T.impact < 0) {
        T.impact = 6;
        const s = pick()!;
        push({ type: 'terrainImpact', id: s.id, damage: 120, bounced: rnd() < 0.6, pos: [s.pos[0], sampleHeight(world.heightfield!, s.pos[0], s.pos[2]), s.pos[2]] });
        push({ type: 'launched', id: pick()!.id });
        push({ type: 'resupplied', id: pick()!.id });
      }
      T.flare -= dt;
      if (T.flare < 0) {
        T.flare = 5;
        const s = pick()!;
        push({ type: 'projectileSpawned', id: demo.nextId++, owner: s.id, kind: 'flare', weapon: 'flares', origin: s.pos, dir: [0.2, -0.3, 0.9], speed: 40, target: null, tick: 0 });
      }
    }

    // showcase camera + fps stats
    if (opts.showcase) {
      // tweakable at runtime from the console: window.__cam.focus = 3, .yaw = 1, ...
      const cam = ((window as unknown as { __cam?: Opts }).__cam ??= { ...opts });
      const f = list[1 + cam.focus]!;
      world.ownId = f.id;
      state.camera.position.set(
        f.pos[0] + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
        f.pos[1] + Math.sin(cam.pitch) * cam.dist,
        f.pos[2] + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      );
      state.camera.lookAt(f.pos[0], f.pos[1], f.pos[2]);
    }
    stats.frames++;
    stats.acc += dtRaw;
    if (stats.acc >= 2) {
      (window as unknown as { __stats: unknown }).__stats = {
        fps: Math.round(stats.frames / stats.acc),
        calls: gl.info.render.calls,
        tris: gl.info.render.triangles,
        geos: gl.info.memory.geometries,
        tex: gl.info.memory.textures,
      };
      stats.frames = 0;
      stats.acc = 0;
    }
  });

  return (
    <>
      <MapScene map={map} />
      <Ships />
      <ProjectilesFx />
      {!opts.showcase && <ChaseCamera />}
      <PostFx quality={quality} />
    </>
  );
}

function push(e: Parameters<typeof world.fxQueue.push>[0]) {
  world.fxQueue.push(e);
}
