# Minecraft-New — JS Starter

This is a minimal JavaScript starter prototype for grrykitty/Minecraft-New.

What it contains
- A small browser playable prototype using Three.js + Vite.
- World made from 8 chunks (2x2x2) of 16x16x16 blocks.
- Basic camera (pointer lock) and WASD movement.
- Left click to remove a block, right click to place a block.

Run locally
1. npm install
2. npm run dev
3. Open http://localhost:5173

Defaults chosen
- Plain JavaScript, Vite dev server, 8 chunks (2x2x2), MIT license, single-player prototype.

Notes
- This is a simple starting point. Performance is intentionally conservative (small world + merging geometries per chunk).
- Next improvements: greedy meshing, worker-based mesh generation, texture atlas, lighting, and multiplayer.
