/** Dev lag simulator: wraps delivery in both directions. All zero in production. */
export const lag = { latencyMs: 0, jitterMs: 0, loss: 0 };

export function throughLag(fn: () => void): void {
  if (lag.loss > 0 && Math.random() < lag.loss) return;
  const delay = lag.latencyMs + Math.random() * lag.jitterMs;
  if (delay <= 0) fn();
  else setTimeout(fn, delay);
}
