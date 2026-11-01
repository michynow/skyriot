import type { NationId, Sim, ShipId, StructureKind } from '@skyriot/shared';

const NATION_IDS: NationId[] = ['concord', 'vex'];
const STRUCTURE_KINDS: Record<string, StructureKind> = {
  core: 'core',
  stations: 'shieldStation',
  turrets: 'turret',
};

export interface DevHost {
  sim: Sim;
  setBotsPerNation(n: number): number;
}

const STUB_M2 = 'stored (M2 persistence)';

/** Handle a '/command' chat line. Caller has already checked isDevAllowed. Returns the reply text. */
export function runDevCommand(host: DevHost, shipId: ShipId, line: string): string {
  const [cmd = '', ...args] = line.slice(1).trim().split(/\s+/);
  const { sim } = host;
  switch (cmd.toLowerCase()) {
    case 'god': {
      const arg = args[0]?.toLowerCase();
      const on = arg === 'on' ? true : arg === 'off' ? false : !sim.tuning.god.has(shipId);
      if (on) sim.tuning.god.add(shipId);
      else sim.tuning.god.delete(shipId);
      return `god ${on ? 'on' : 'off'} (ship ${shipId})`;
    }
    case 'bots': {
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n < 0) return 'usage: /bots <n per nation>';
      return `bots per nation: ${host.setBotsPerNation(n)}`;
    }
    case 'timescale': {
      const x = Number(args[0]);
      if (!Number.isFinite(x) || x <= 0) return 'usage: /timescale <x>';
      sim.tuning.timescale = x;
      return `timescale ${x}`;
    }
    case 'tp': {
      const p = args.map(Number);
      if (!sim.getShip(shipId) || p.length !== 3 || p.some((v) => !Number.isFinite(v)))
        return 'usage: /tp <x> <y> <z>';
      sim.teleport(shipId, [p[0]!, p[1]!, p[2]!]);
      const at = sim.getShip(shipId)!.pos;
      return `teleported to ${at.map((v) => v.toFixed(0)).join(' ')}`;
    }
    case 'base': {
      const nation = args[0] as NationId;
      const kind = STRUCTURE_KINDS[args[1] ?? ''];
      if (!NATION_IDS.includes(nation) || !kind)
        return 'usage: /base <concord|vex> <stations|core|turrets>';
      return `destroyed ${sim.destroyStructures(nation, kind)} ${args[1]} of ${nation}`;
    }
    case 'battle': {
      const winner = args[1] as NationId;
      if (args[0] !== 'end' || !NATION_IDS.includes(winner))
        return 'usage: /battle end <winner nation>';
      sim.endBattle(winner);
      return `battle ended, ${winner} wins; Bases rebuild shortly`;
    }
    case 'level':
    case 'glory':
    case 'spawn':
      return STUB_M2;
    case 'event':
      return 'events: not yet implemented';
    case 'help':
      return '/god, /bots <n>, /timescale <x>, /tp <x> <y> <z>, /base <nation> <stations|core|turrets>, /battle end <winner>, /level <n>, /glory <n>, /spawn <item> [+n], /event start <type>, /help';
    default:
      return `unknown command: /${cmd} (try /help)`;
  }
}
