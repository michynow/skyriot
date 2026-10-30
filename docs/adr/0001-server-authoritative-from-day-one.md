# Server-authoritative multiplayer from day one, no single-player

PvP feel is the product, and retrofitting netcode onto a local simulation means rewriting flight, hit detection and Projectiles. So the first playable already runs through an authoritative Colyseus server, with client prediction for the own Ship and Bots filling empty slots. Cost: slower first playable (~+30–40% on the vertical slice).
