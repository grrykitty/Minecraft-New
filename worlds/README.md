This directory holds saved worlds for the JS starter prototype.

Format (simple example)
- worlds/<worldName>/world.json — world metadata and chunk index.
- Future per-chunk files can be placed under worlds/<worldName>/chunks/

Default world included here:
- worlds/default/world.json — has seed, chunkSize, and an explicit list of chunk coordinates present in the world.

Notes for developers
- The prototype currently generates terrain procedurally from a deterministic function. In future we can load chunk data from JSON files in this folder and use them to build chunk voxel arrays.
- Suggested per-chunk filename: chunk_<cx>_<cy>_<cz>.json with a compact encoding. Example schema:
  {
    "cx": 0, "cy": 0, "cz": 0,
    "blocks": "base64-encoded-bytes"  // or an array of numbers
  }

- Keep chunkSize consistent with src/world.js (currently 16).

Add your own worlds by copying the `default` folder and editing world.json.
