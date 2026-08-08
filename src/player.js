import * as THREE from 'three';
import { getCamera, getControls } from './renderer.js';

class Player {
  constructor(camera, domElement, world){
    this.camera = camera;
    this.dom = domElement;
    this.world = world;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.move = {forward:false,back:false,left:false,right:false};

    this.speed = 10;
    this.raycaster = new THREE.Raycaster();

    this.initControls();
    this.bindEvents();
  }

  initControls(){
    // camera is controlled by PointerLockControls attached in renderer; we'll just move camera.position
    this.camera.position.set(8,20,8);
  }

  bindEvents(){
    window.addEventListener('keydown', (e)=>{
      if(e.code==='KeyW') this.move.forward=true;
      if(e.code==='KeyS') this.move.back=true;
      if(e.code==='KeyA') this.move.left=true;
      if(e.code==='KeyD') this.move.right=true;
    });
    window.addEventListener('keyup', (e)=>{
      if(e.code==='KeyW') this.move.forward=false;
      if(e.code==='KeyS') this.move.back=false;
      if(e.code==='KeyA') this.move.left=false;
      if(e.code==='KeyD') this.move.right=false;
    });

    // Mouse clicks for block interaction
    this.dom.addEventListener('pointerdown', (e)=>{
      if(e.button===0){ // left = remove
        this.interact(false);
      } else if(e.button===2){ // right = place
        this.interact(true);
      }
    });
    // prevent context menu on right click
    window.addEventListener('contextmenu', (e)=>e.preventDefault());
  }

  interact(place){
    const cam = this.camera;
    this.raycaster.setFromCamera(new THREE.Vector2(0,0), cam);
    const hits = this.world.raycast(this.raycaster);
    if(hits.length===0) return;
    const first = hits[0];
    const point = first.hit.point;
    const normal = first.hit.face.normal.clone();
    // compute world block position
    const hitPos = point.clone().sub(normal.multiplyScalar(0.5));
    const wx = Math.floor(hitPos.x);
    const wy = Math.floor(hitPos.y);
    const wz = Math.floor(hitPos.z);
    if(place){
      // place adjacent
      const placePos = new THREE.Vector3(point.x, point.y, point.z).add(first.hit.face.normal);
      const px = Math.floor(placePos.x);
      const py = Math.floor(placePos.y);
      const pz = Math.floor(placePos.z);
      this.world.setBlockAtWorld(px,py,pz,1);
    } else {
      this.world.setBlockAtWorld(wx,wy,wz,0);
    }
  }

  update(dt){
    const forward = (this.move.forward?1:0) - (this.move.back?1:0);
    const sideways = (this.move.right?1:0) - (this.move.left?1:0);
    const speed = this.speed;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), dir).normalize();
    const moveVec = dir.multiplyScalar(forward).add(right.multiplyScalar(sideways)).multiplyScalar(speed*dt);
    this.camera.position.add(moveVec);
  }
}

export default Player;
