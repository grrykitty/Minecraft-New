import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CHUNK_SIZE = 16;

function idx(x,y,z){ return (y*CHUNK_SIZE + z)*CHUNK_SIZE + x; }

class Chunk {
  constructor(cx,cy,cz){
    this.cx = cx; this.cy = cy; this.cz = cz;
    this.size = CHUNK_SIZE;
    this.blocks = new Uint8Array(CHUNK_SIZE*CHUNK_SIZE*CHUNK_SIZE);
    this.mesh = null;
    this.group = new THREE.Group();
    this.group.userData.chunk = this;
  }

  setBlock(x,y,z, v){
    if(x<0||x>=CHUNK_SIZE||y<0||y>=CHUNK_SIZE||z<0||z>=CHUNK_SIZE) return;
    this.blocks[idx(x,y,z)] = v;
  }
  getBlock(x,y,z){
    if(x<0||x>=CHUNK_SIZE||y<0||y>=CHUNK_SIZE||z<0||z>=CHUNK_SIZE) return 0;
    return this.blocks[idx(x,y,z)];
  }

  rebuildMesh(){
    // Dispose old mesh
    if(this.mesh){
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    const geoms = [];
    const materials = [];

    for(let x=0;x<CHUNK_SIZE;x++){
      for(let y=0;y<CHUNK_SIZE;y++){
        for(let z=0;z<CHUNK_SIZE;z++){
          const b = this.getBlock(x,y,z);
          if(!b) continue;
          const geo = new THREE.BoxGeometry(1,1,1);
          geo.translate(this.cx*CHUNK_SIZE + x + 0.5, this.cy*CHUNK_SIZE + y + 0.5, this.cz*CHUNK_SIZE + z + 0.5);
          // set simple color attribute per vertex
          const color = new THREE.Color(b===1?0x55aa33:0x888888);
          const count = geo.attributes.position.count;
          const colors = new Float32Array(count*3);
          for(let i=0;i<count;i++){
            colors[i*3+0]=color.r; colors[i*3+1]=color.g; colors[i*3+2]=color.b;
          }
          geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
          geoms.push(geo);
        }
      }
    }

    if(geoms.length===0) return;

    const merged = mergeBufferGeometries(geoms, false);
    const mat = new THREE.MeshLambertMaterial({vertexColors: true});
    this.mesh = new THREE.Mesh(merged, mat);
    this.group.add(this.mesh);
  }
}

class World {
  constructor(opts={}){
    this.chunkSize = CHUNK_SIZE;
    this.chunks = new Map();
    this.chunkMeshes = [];
  }

  key(cx,cy,cz){ return `${cx},${cy},${cz}`; }

  createChunk(cx,cy,cz){
    const key = this.key(cx,cy,cz);
    if(this.chunks.has(key)) return this.chunks.get(key);
    const c = new Chunk(cx,cy,cz);
    // Fill blocks with a simple heightmap
    for(let x=0;x<CHUNK_SIZE;x++){
      for(let z=0;z<CHUNK_SIZE;z++){
        // world coords
        const wx = cx*CHUNK_SIZE + x;
        const wz = cz*CHUNK_SIZE + z;
        const height = Math.floor(6 + 4*Math.sin((wx+wz)/8));
        for(let y=0;y<CHUNK_SIZE;y++){
          const wy = cy*CHUNK_SIZE + y;
          if(wy<=height) c.setBlock(x,y,z, wy===height?1:2);
        }
      }
    }
    c.rebuildMesh();
    this.chunks.set(key,c);
    return c;
  }

  addToScene(scene){
    for(const c of this.chunks.values()){
      scene.add(c.group);
    }
  }

  update(){ }

  raycast(raycaster){
    const intersects = [];
    for(const c of this.chunks.values()){
      if(!c.mesh) continue;
      const hits = raycaster.intersectObject(c.mesh, true);
      if(hits.length) intersects.push(...hits.map(h=>({hit:h, chunk:c}))); 
    }
    intersects.sort((a,b)=>a.hit.distance-b.hit.distance);
    return intersects;
  }

  worldToChunkPos(wx,wy,wz){
    const cx = Math.floor(wx/CHUNK_SIZE);
    const cy = Math.floor(wy/CHUNK_SIZE);
    const cz = Math.floor(wz/CHUNK_SIZE);
    const lx = ((wx%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
    const ly = ((wy%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
    const lz = ((wz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
    return {cx,cy,cz,lx,ly,lz};
  }

  setBlockAtWorld(wx,wy,wz, val){
    const p = this.worldToChunkPos(wx,wy,wz);
    const key = this.key(p.cx,p.cy,p.cz);
    const c = this.chunks.get(key);
    if(!c) return;
    c.setBlock(p.lx,p.ly,p.lz,val);
    c.rebuildMesh();
  }

  getBlockAtWorld(wx,wy,wz){
    const p = this.worldToChunkPos(wx,wy,wz);
    const key = this.key(p.cx,p.cy,p.cz);
    const c = this.chunks.get(key);
    if(!c) return 0;
    return c.getBlock(p.lx,p.ly,p.lz);
  }
}

export default World;
