// worldLoader.js
// Loads a world from worlds/<name>/world.db (JSON format for now) and optional per-chunk JSON files.

export async function loadWorld(worldName, world, scene){
  const base = `/worlds/${worldName}`;
  const dbUrl = `${base}/world.db`;
  try{
    const res = await fetch(dbUrl);
    if(!res.ok) throw new Error('world.db not found');
    const text = await res.text();
    let meta;
    try{ meta = JSON.parse(text); } catch(e){
      console.warn('world.db is not JSON — loader only supports JSON-encoded world.db for now');
      throw e;
    }
    const chunks = meta.chunks || [];
    // load chunks in parallel
    const promises = chunks.map(async (coord)=>{
      const [cx,cy,cz] = coord;
      const url = `${base}/chunks/chunk_${cx}_${cy}_${cz}.json`;
      try{
        const r = await fetch(url);
        if(r.ok){
          const data = await r.json();
          let blocks = null;
          if(typeof data.blocks === 'string'){
            // assume base64
            const bytes = Uint8Array.from(atob(data.blocks), c=>c.charCodeAt(0));
            blocks = bytes;
          } else if(Array.isArray(data.blocks)){
            blocks = data.blocks;
          }
          const c = world.createChunk(cx,cy,cz, blocks);
          scene.add(c.group);
          return true;
        }
      } catch(e){
        // ignore and fallback to procedural
      }
      // fallback to procedural generation for this chunk
      const c2 = world.createChunk(cx,cy,cz);
      scene.add(c2.group);
      return false;
    });
    await Promise.all(promises);
    return true;
  }catch(e){
    console.warn('Failed to load world.db:', e);
    return false;
  }
}
