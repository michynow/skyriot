# Custom snapshot messages instead of Colyseus Schema state sync for Ships

Colyseus is used for rooms, matchmaking and transport, but Ship state is sent as our own 20 Hz snapshot messages rather than Schema auto-sync. Prediction needs per-client `lastProcessedSeq`, a fixed snapshot rate decoupled from the 30 Hz tick, and control over quantization and (later) interest management — Schema's change-based patches give none of these cleanly. Schema may still be used for slow room metadata (event timers, scores).
