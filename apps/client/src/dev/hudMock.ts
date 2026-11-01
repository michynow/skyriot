import {
  TICK_HZ,
  type LaunchPhase,
  type NationId,
  type ShipState,
  type StructureState,
} from '@skyriot/shared';
import { world } from '../state/world';
import { devHooks, enemyOf, handleHudEvent } from '../hud/hudStore';
import { session } from '../net/session';

export type MockScenario =
  | 'off'
  | 'intact'
  | 'enemyStationDown'
  | 'enemyShieldDown'
  | 'ourShieldDown'
  | 'coreCritical'
  | 'bothExposed';
export type MockBattle = 'battle' | 'victory' | 'defeat';

/**
 * Fakes what the server does not send yet on this branch: Base structures, Battle state, Launch Queue phases and
 * stall. Applied on every HUD read of the own Ship (devHooks.ownShip), so it survives snapshot overwrites.
 */
export const hudMock = {
  scenario: 'off' as MockScenario,
  battle: 'battle' as MockBattle,
  launchPhase: 'none' as LaunchPhase,
  queuePos: 2,
  tunnel: 1,
  /** -1 = leave the real value. */
  speed: -1,
  stalled: false,
};

const structureId = (n: NationId, kind: StructureState['kind'], i: number) => `${n}:${kind}:${i}`;
let endedAtTick = -1;
let phaseStartedMs = 0;
let lastPhase: LaunchPhase = 'none';

function makeStructures(me: NationId): StructureState[] {
  const bases = world.map?.bases;
  if (!bases) return [];
  const sc = hudMock.scenario;
  const out: StructureState[] = [];
  for (const n of ['concord', 'vex'] as const) {
    const def = bases[n];
    const ours = n === me;
    const stationsDown =
      (sc === 'enemyShieldDown' || sc === 'bothExposed' || sc === 'coreCritical') && !ours
        ? 2
        : (sc === 'ourShieldDown' || sc === 'bothExposed') && ours
          ? 2
          : sc === 'enemyStationDown' && !ours
            ? 1
            : 0;
    const coreHp = sc === 'coreCritical' && !ours ? 0.18 : 1;
    out.push({
      id: structureId(n, 'core', 0),
      kind: 'core',
      nation: n,
      pos: def.core,
      hp: coreHp * 20000,
      maxHp: 20000,
      alive: true,
      aim: [0, 0, -1],
    });
    def.shieldStations.forEach((pos, i) =>
      out.push({
        id: structureId(n, 'shieldStation', i),
        kind: 'shieldStation',
        nation: n,
        pos,
        hp: i < stationsDown ? 0 : 5000,
        maxHp: 5000,
        alive: i >= stationsDown,
        aim: [0, 0, -1],
      }),
    );
    def.turrets.forEach((pos, i) =>
      out.push({
        id: structureId(n, 'turret', i),
        kind: 'turret',
        nation: n,
        pos,
        hp: i < (ours ? 1 : 2) ? 0 : 1500,
        maxHp: 1500,
        alive: i >= (ours ? 1 : 2),
        aim: [0, 0, -1],
      }),
    );
  }
  return out;
}

function apply(own: ShipState): ShipState {
  if (hudMock.scenario === 'off') return own;
  const me = own.nation;
  world.structures.clear();
  for (const st of makeStructures(me)) world.structures.set(st.id, st);
  const alive = (n: NationId) =>
    [...world.structures.values()].some(
      (s) => s.kind === 'shieldStation' && s.nation === n && s.alive,
    );
  const tick = session.interp?.latestTick(performance.now()) ?? 0;
  if (hudMock.battle === 'battle') endedAtTick = -1;
  else if (endedAtTick < 0) endedAtTick = tick;
  const allies = [...world.ships.values()]
    .filter((s) => s.nation === me && s.id !== own.id)
    .map((s) => s.id);
  const queue = [
    ...allies.slice(0, hudMock.queuePos),
    own.id,
    ...allies.slice(hudMock.queuePos, hudMock.queuePos + 2),
  ];
  world.match = {
    phase: hudMock.battle === 'battle' ? 'battle' : 'ended',
    winner: hudMock.battle === 'victory' ? me : hudMock.battle === 'defeat' ? enemyOf(me) : null,
    restartAtTick: endedAtTick >= 0 ? endedAtTick + 20 * TICK_HZ : 0,
    shielded: { concord: alive('concord'), vex: alive('vex') },
    queues: { [me]: hudMock.launchPhase === 'hangar' ? queue : [], [enemyOf(me)]: [] } as Record<
      NationId,
      string[]
    >,
  };
  if (hudMock.launchPhase !== lastPhase) {
    lastPhase = hudMock.launchPhase;
    phaseStartedMs = performance.now();
    if (lastPhase === 'catapult')
      handleHudEvent({ type: 'catapult', id: own.id, tunnel: hudMock.tunnel });
  }
  const stagingSec = Math.max(0, 4 - (performance.now() - phaseStartedMs) / 1000);
  return {
    ...own,
    launchPhase: hudMock.launchPhase,
    queuePos: hudMock.launchPhase === 'hangar' ? hudMock.queuePos : -1,
    tunnel:
      hudMock.launchPhase === 'none' || hudMock.launchPhase === 'hangar' ? -1 : hudMock.tunnel,
    launchTicks: Math.round(stagingSec * TICK_HZ),
    stalled: hudMock.stalled,
    speed: hudMock.speed >= 0 ? hudMock.speed : own.speed,
  };
}

devHooks.ownShip = apply;

/** Fire a Battle SimEvent through the real HUD event path. */
export function mockEvent(
  kind:
    | 'enemyShieldDown'
    | 'ourShieldDown'
    | 'enemyStationDestroyed'
    | 'ourStationDestroyed'
    | 'ourStationHit'
    | 'battleStarted'
    | 'catapult',
): void {
  const own = world.ownId ? world.ships.get(world.ownId) : undefined;
  if (!own) return;
  const me = own.nation;
  const en = enemyOf(me);
  if (hudMock.scenario === 'off') hudMock.scenario = 'intact';
  apply(own);
  const station = (n: NationId) => world.structures.get(structureId(n, 'shieldStation', 1))!;
  switch (kind) {
    case 'enemyShieldDown':
      return handleHudEvent({ type: 'shieldDown', nation: en });
    case 'ourShieldDown':
      return handleHudEvent({ type: 'shieldDown', nation: me });
    case 'enemyStationDestroyed':
      return handleHudEvent({
        type: 'structureDestroyed',
        structure: station(en).id,
        killer: own.id,
        pos: station(en).pos,
      });
    case 'ourStationDestroyed':
      return handleHudEvent({
        type: 'structureDestroyed',
        structure: station(me).id,
        killer: null,
        pos: station(me).pos,
      });
    case 'ourStationHit':
      return handleHudEvent({
        type: 'structureHit',
        projectile: 0,
        attacker: own.id,
        structure: station(me).id,
        damage: 120,
        pos: station(me).pos,
        shielded: false,
      });
    case 'battleStarted':
      return handleHudEvent({ type: 'matchStarted' });
    case 'catapult':
      return handleHudEvent({ type: 'catapult', id: own.id, tunnel: hudMock.tunnel });
  }
}

// Console handle: __hudMock.scenario = 'coreCritical'; __mockEvent('enemyShieldDown').
Object.assign(window, { __hudMock: hudMock, __mockEvent: mockEvent });
