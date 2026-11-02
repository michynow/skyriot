/**
 * Dev lag simulator: wraps delivery in both directions. All zero in production. Models the WebSocket
 * it sits on: delivery stays in order per direction, and a lost packet is resent (fast retransmit,
 * ~one RTT later) and holds up everything behind it, instead of vanishing.
 */
export const lag = { latencyMs: 0, jitterMs: 0, loss: 0 };

const RETRANSMIT_EXTRA_MS = 100; // duplicate-ack wait on top of the round trip

// A FIFO per direction drained by one timer: separate setTimeouts don't keep order in the browser.
const queues = {
  up: [] as { at: number; fn: () => void }[],
  down: [] as { at: number; fn: () => void }[],
};

function pump(dir: 'up' | 'down'): void {
  const q = queues[dir];
  while (q.length && q[0]!.at <= performance.now()) {
    try {
      q.shift()!.fn();
    } catch (err) {
      console.error(err); // a throwing handler must not stall the queue
    }
  }
  if (q.length) setTimeout(() => pump(dir), q[0]!.at - performance.now());
}

export function throughLag(dir: 'up' | 'down', fn: () => void): void {
  const q = queues[dir];
  if (lag.latencyMs <= 0 && lag.jitterMs <= 0 && lag.loss <= 0 && !q.length) return fn();
  let delay = lag.latencyMs + Math.random() * lag.jitterMs;
  if (lag.loss > 0 && Math.random() < lag.loss) delay += 2 * lag.latencyMs + RETRANSMIT_EXTRA_MS;
  const at = Math.max(performance.now() + delay, q.length ? q[q.length - 1]!.at : 0);
  q.push({ at, fn });
  if (q.length === 1) setTimeout(() => pump(dir), at - performance.now());
}
