import type { Sim, ShipId } from '@skyriot/shared';

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
      const on = !sim.tuning.god.has(shipId);
      if (on) sim.tuning.god.add(shipId);
      else sim.tuning.god.delete(shipId);
      return `god ${on ? 'on' : 'off'}`;
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
      const ship = sim.getShip(shipId);
      if (!ship || p.length !== 3 || p.some((v) => !Number.isFinite(v)))
        return 'usage: /tp <x> <y> <z>';
      sim.setShipState(shipId, { ...ship, pos: [p[0]!, p[1]!, p[2]!] });
      return `teleported to ${p.join(' ')}`;
    }
    case 'level':
    case 'glory':
    case 'spawn':
      return STUB_M2;
    case 'event':
      return 'events: not yet implemented';
    case 'help':
      return '/god, /bots <n>, /timescale <x>, /tp <x> <y> <z>, /level <n>, /glory <n>, /spawn <item> [+n], /event start <type>, /help';
    default:
      return `unknown command: /${cmd} (try /help)`;
  }
}
