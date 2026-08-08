import './styles.css';
import { init as initRenderer, startRenderLoop, getScene, getCamera, getRenderer } from './renderer.js';
import World from './world.js';
import Player from './player.js';
import { loadWorld } from './worldLoader.js';

async function main(){
  initRenderer(document.getElementById('app'));

  const world = new World({chunkSize:16});

  // Try to load the default world (world.db) under /worlds/default/world.db
  await loadWorld('default', world, getScene());

  // If loader didn't add chunks (failed), fallback to procedural 2x2x2
  if([...world.chunks.keys()].length === 0){
    for(let cx=0;cx<2;cx++){
      for(let cz=0;cz<2;cz++){
        for(let cy=0;cy<2;cy++){
          world.createChunk(cx,cy,cz);
        }
      }
    }
    world.addToScene(getScene());
  }

  const player = new Player(getCamera(), getRenderer().domElement, world);

  startRenderLoop((dt)=>{
    player.update(dt);
    world.update(dt);
  });
}

main();
