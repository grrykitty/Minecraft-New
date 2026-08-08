import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

let scene, camera, renderer, controls;

export function init(container){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x88ccff);

  camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(8, 20, 8);

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(10,20,10);
  scene.add(dir);

  controls = new PointerLockControls(camera, renderer.domElement);
  renderer.domElement.addEventListener('click', ()=>{
    controls.lock();
  });

  window.addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

export function getScene(){ return scene; }
export function getCamera(){ return camera; }
export function getRenderer(){ return renderer; }
export function getControls(){ return controls; }

export function startRenderLoop(update){
  const clock = new THREE.Clock();
  function loop(){
    const dt = clock.getDelta();
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}
