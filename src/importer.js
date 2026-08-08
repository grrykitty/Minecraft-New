import JSZip from 'jszip';

// importer.js
// Loads a .zip or .epk archive (Eaglercraft exports are typically zip-like) and imports a world into memory.
// The importer looks for world.db or level.db inside the archive and chunk_<cx>_<cy>_<cz>.json files under chunks/.

function isCreativeMeta(meta){
  if(!meta) return false;
  const keys = Object.keys(meta).map(k=>k.toLowerCase());
  // common fields: gamemode, gameMode, mode, type
  const gm = meta.gamemode ?? meta.gameMode ?? meta.mode ?? meta.type ?? meta.GameMode ?? meta.game_mode;
  if(typeof gm === 'string'){
    if(gm.toLowerCase().includes('creative')) return true;
  }
  if(typeof gm === 'number'){
    // Minecraft: 1 usually means creative
    if(gm === 1) return true;
  }
  // some exports embed playerData or level.dat with GameType
  if(meta.Player && meta.Player.gamemode) return String(meta.Player.gamemode).toLowerCase().includes('creative');
  return false;
}

function showUnsupportedGamemodeOverlay(worldName){
  if(document.getElementById('unsupported-gamemode-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'unsupported-gamemode-overlay';
  Object.assign(overlay.style, { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 });
  const box = document.createElement('div');
  Object.assign(box.style, { background:'#400', color:'#fff', padding:'20px', borderRadius:'8px', width:'480px', fontFamily:'sans-serif' });
  const h = document.createElement('h2'); h.textContent = 'Unsupported gamemode'; h.style.margin='0 0 8px 0';
  const p = document.createElement('p'); p.innerHTML = `<strong style="color:#ff8080">The world has been loaded in a unsupported gamemode.</strong><br/>This game only supports Survival mode.`;
  const btn = document.createElement('button'); btn.textContent = 'Regenerate procedurally instead';
  Object.assign(btn.style, { marginTop:'12px', padding:'8px 12px', background:'#600', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer' });
  btn.onclick = ()=>{
    // remove overlay and regenerate default procedural 2x2x2
    const overlayEl = document.getElementById('unsupported-gamemode-overlay');
    if(overlayEl) document.body.removeChild(overlayEl);
    const ev = new CustomEvent('regenerateProcedural', {});
    window.dispatchEvent(ev);
  };
  box.appendChild(h); box.appendChild(p); box.appendChild(btn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export async function importArchive(file, world, scene){
  const text = await file.text();
  // attempt to load as zip via JSZip
  try{
    const zip = await JSZip.loadAsync(file);
    // find candidate world.db or level.db at root
    let metaFile = null;
    zip.forEach((relativePath, zipEntry)=>{
      const name = relativePath.toLowerCase();
      if(!metaFile && (name.endsWith('world.db') || name.endsWith('level.db') || name.endsWith('world.json'))){
        metaFile = zipEntry.name;
      }
    });
    if(!metaFile){
      // maybe archive contains a folder like world/world.db
      zip.forEach((relativePath, zipEntry)=>{
        const name = relativePath.toLowerCase();
        if(!metaFile && (name.includes('/world.db') || name.includes('/level.db'))){
          metaFile = zipEntry.name;
        }
      });
    }
    let meta = null;
    if(metaFile){
      const raw = await zip.file(metaFile).async('string');
      try{ meta = JSON.parse(raw); } catch(e){
        // try to auto-recover similar to worldLoader heuristics
        const first = raw.indexOf('{'); const last = raw.lastIndexOf('}');
        if(first!==-1 && last>first){
          try{ meta = JSON.parse(raw.slice(first,last+1)); } catch(e){}
        }
      }
    }

    if(isCreativeMeta(meta)){
      showUnsupportedGamemodeOverlay(file.name);
      return false;
    }

    if(meta && Array.isArray(meta.chunks)){
      // load chunks present in meta; for each chunk try to find chunk_<cx>_<cy>_<cz>.json in the zip
      const chunks = meta.chunks;
      for(const coord of chunks){
        const [cx,cy,cz] = coord;
        const name1 = `chunks/chunk_${cx}_${cy}_${cz}.json`;
        const name2 = `chunk_${cx}_${cy}_${cz}.json`;
        let entry = zip.file(name1) || zip.file(name2);
        if(entry){
          const data = JSON.parse(await entry.async('string'));
          let blocks = null;
          if(typeof data.blocks === 'string'){
            const bytes = Uint8Array.from(atob(data.blocks), c=>c.charCodeAt(0));
            blocks = bytes;
          } else if(Array.isArray(data.blocks)){
            blocks = data.blocks;
          }
          const c = world.createChunk(cx,cy,cz, blocks);
          scene.add(c.group);
        } else {
          // fallback procedural
          const c = world.createChunk(cx,cy,cz);
          scene.add(c.group);
        }
      }
      return true;
    }

    // if no meta or no chunks, try to search for any chunk_*.json files and load those
    const chunkFiles = [];
    zip.forEach((relativePath, zipEntry)=>{
      const ln = zipEntry.name.toLowerCase();
      if(ln.includes('chunk_') && ln.endsWith('.json')) chunkFiles.push(zipEntry.name);
    });
    if(chunkFiles.length>0){
      for(const name of chunkFiles){
        try{
          const raw = await zip.file(name).async('string');
          const data = JSON.parse(raw);
          const fname = name.split('/').pop();
          const m = fname.match(/chunk_(-?\d+)_(-?\d+)_(-?\d+)\.json/i);
          if(m){
            const cx = parseInt(m[1],10), cy = parseInt(m[2],10), cz = parseInt(m[3],10);
            let blocks = null;
            if(typeof data.blocks === 'string'){
              blocks = Uint8Array.from(atob(data.blocks), c=>c.charCodeAt(0));
            } else if(Array.isArray(data.blocks)){
              blocks = data.blocks;
            }
            const c = world.createChunk(cx,cy,cz, blocks);
            scene.add(c.group);
          }
        }catch(e){ /* ignore individual chunk parse errors */ }
      }
      return true;
    }

    // nothing found: inform user and fallback
    alert('No recognizable world files found in archive. Falling back to procedural generation.');
    return false;
  }catch(e){
    console.warn('Failed to import archive', e);
    alert('Failed to read archive or unsupported format.');
    return false;
  }
}
