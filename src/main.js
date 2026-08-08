import './styles.css';
import { init as initRenderer, startRenderLoop, getScene, getCamera, getRenderer } from './renderer.js';
import World from './world.js';
import Player from './player.js';

async function main(){
  initRenderer(document.getElementById('app'));

  const world = new World({chunkSize:16});
  // create 2x2x2 = 8 chunks around origin
  for(let cx=0;cx<2;cx++){
    for(let cz=0;cz<2;cz++){
      for(let cy=0;cy<2;cy++){
        world.createChunk(cx,cy,cz);
      }
    }
  }

  world.addToScene(getScene());

  const player = new Player(getCamera(), getRenderer().domElement, world);

  startRenderLoop((dt)=>{
    player.update(dt);
    world.update(dt);
  });
}

main();
