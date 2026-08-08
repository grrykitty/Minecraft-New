// worldLoader.js
// Loads a world from worlds/<name>/world.db (JSON format for now) and optional per-chunk JSON files.
// If world.db is corrupted or unparsable, we present a small recovery UI that lets the user:
// - download a copy of the corrupted file
// - upload a replacement world.db
// - attempt a best-effort automatic recovery
// - regenerate procedurally (fallback)

async function fetchText(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('fetch failed: '+res.status);
  return await res.text();
}

function downloadText(filename, text){
  const a = document.createElement('a');
  const blob = new Blob([text], {type:'application/json'});
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1500);
}

function showRecoveryUI(worldName, rawText, onUploadCallback, onRecoverCallback, onRegenerateCallback){
  // If UI already exists, don't create another
  if(document.getElementById('world-recover-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'world-recover-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex: 9999
  });

  const box = document.createElement('div');
  Object.assign(box.style, { width: '480px', background:'#222', color:'#fff', padding:'16px', borderRadius:'8px', fontFamily:'sans-serif' });

  box.innerHTML = `
    <h2 style="margin-top:0">world.db appears corrupted</h2>
    <p>The world file for <strong>${worldName}</strong> couldn't be parsed. You can try to recover it or fall back to generating the world procedurally.</p>
    <p style="font-size:0.9em;color:#ddd">Choose an option below. If you have a backup, use Upload. If you want to inspect the file yourself, Download will save a copy.</p>
  `;

  const btnRow = document.createElement('div');
  Object.assign(btnRow.style, { display:'flex', gap:'8px', marginTop:'12px', flexWrap:'wrap' });

  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Download corrupted file';
  downloadBtn.onclick = ()=> downloadText(worldName + '.world.db.corrupt.json', rawText);

  const tryBtn = document.createElement('button');
  tryBtn.textContent = 'Try automatic recover';
  tryBtn.onclick = async ()=>{
    tryBtn.disabled = true;
    const ok = await onRecoverCallback(rawText);
    if(ok){
      document.body.removeChild(overlay);
    } else {
      tryBtn.disabled = false;
      alert('Automatic recovery failed. Try Upload or Regenerate.');
    }
  };

  const uploadBtn = document.createElement('button');
  uploadBtn.textContent = 'Upload replacement';
  uploadBtn.onclick = ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.db,.txt';
    input.onchange = async (e)=>{
      const f = input.files[0];
      if(!f) return;
      const txt = await f.text();
      const ok = await onUploadCallback(txt);
      if(ok) document.body.removeChild(overlay);
      else alert('Uploaded file failed to load.');
    };
    input.click();
  };

  const regenBtn = document.createElement('button');
  regenBtn.textContent = 'Regenerate procedurally';
  regenBtn.onclick = ()=>{
    const ok = onRegenerateCallback();
    if(ok) document.body.removeChild(overlay);
  };

  // style buttons a bit
  [downloadBtn, tryBtn, uploadBtn, regenBtn].forEach(b=>{
    Object.assign(b.style, { background:'#444', color:'#fff', border:'none', padding:'8px 12px', borderRadius:'6px', cursor:'pointer' });
    b.onmouseover = ()=> b.style.background = '#555';
    b.onmouseout = ()=> b.style.background = '#444';
  });

  btnRow.appendChild(downloadBtn);
  btnRow.appendChild(tryBtn);
  btnRow.appendChild(uploadBtn);
  btnRow.appendChild(regenBtn);

  box.appendChild(btnRow);

  const note = document.createElement('pre');
  note.textContent = rawText.slice(0, 2000);
  Object.assign(note.style, { marginTop:'12px', maxHeight:'220px', overflow:'auto', background:'#111', padding:'8px', borderRadius:'6px', color:'#ddd' });
  box.appendChild(note);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

async function tryAutoRecover(rawText){
  // Best-effort: find a JSON object in the text by searching for first '{' and last '}' and try to parse substring.
  // Also try to find a "chunks": [...] array using regex and wrap into a minimal JSON if needed.
  try{
    const first = rawText.indexOf('{');
    const last = rawText.lastIndexOf('}');
    if(first!==-1 && last>first){
      const candidate = rawText.slice(first, last+1);
      try{ const meta = JSON.parse(candidate); return meta; } catch(e){}
    }

    // fallback: look for chunks array pattern
    const m = rawText.match(/"chunks"\s*:\s*(\[[\s\S]*?\])/);
    if(m && m[1]){
      const chunksText = m[1];
      try{ const chunks = JSON.parse(chunksText); return { chunks }; } catch(e){}
    }

    // last resort: try to pick any bracketed JSON-like substring
    const arrMatch = rawText.match(/\[[\s\S]*?\]/);
    if(arrMatch){
      try{ const parsed = JSON.parse(arrMatch[0]); return { chunks: parsed }; } catch(e){}
    }
  }catch(e){ /* ignore */ }
  return null;
}

async function loadChunksForMeta(base, meta, world, scene){
  const chunks = meta.chunks || [];
  if(!Array.isArray(chunks) || chunks.length===0) return false;
  const promises = chunks.map(async (coord)=>{
    const [cx,cy,cz] = coord;
    const url = `${base}/chunks/chunk_${cx}_${cy}_${cz}.json`;
    try{
      const r = await fetch(url);
      if(r.ok){
        const data = await r.json();
        let blocks = null;
        if(typeof data.blocks === 'string'){
          const bytes = Uint8Array.from(atob(data.blocks), c=>c.charCodeAt(0));
          blocks = bytes;
        } else if(Array.isArray(data.blocks)){
          blocks = data.blocks;
        }
        const c = world.createChunk(cx,cy,cz, blocks);
        scene.add(c.group);
        return true;
      }
    } catch(e){ /* ignore and fallback */ }
    const c2 = world.createChunk(cx,cy,cz);
    scene.add(c2.group);
    return false;
  });
  await Promise.all(promises);
  return true;
}

export async function loadWorld(worldName, world, scene){
  const base = `/worlds/${worldName}`;
  const dbUrl = `${base}/world.db`;
  let raw = null;
  try{
    raw = await fetchText(dbUrl);
  }catch(e){
    console.warn('world.db not found; falling back to procedural generation');
    return false;
  }

  let meta;
  try{
    meta = JSON.parse(raw);
  }catch(parseErr){
    console.warn('Failed to parse world.db — launching recovery UI', parseErr);

    // Handlers for recovery UI
    const onUpload = async (uploadedText)=>{
      try{
        const parsed = JSON.parse(uploadedText);
        const ok = await loadChunksForMeta(base, parsed, world, scene);
        return ok;
      }catch(e){
        return false;
      }
    };
    const onRecover = async (rawText)=>{
      const candidate = await tryAutoRecover(rawText);
      if(candidate){
        const ok = await loadChunksForMeta(base, candidate, world, scene);
        return ok;
      }
      return false;
    };
    const onRegenerate = ()=>{
      // regenerate the default 2x2x2 area
      for(let cx=0;cx<2;cx++){
        for(let cz=0;cz<2;cz++){
          for(let cy=0;cy<2;cy++){
            const c = world.createChunk(cx,cy,cz);
            scene.add(c.group);
          }
        }
      }
      return true;
    };

    showRecoveryUI(worldName, raw, onUpload, onRecover, onRegenerate);
    return false;
  }

  // meta parsed successfully. Validate minimal fields.
  if(!meta.chunks || !Array.isArray(meta.chunks) || meta.chunks.length===0){
    console.warn('world.db missing chunk list or chunks is empty — falling back to procedural generation');
    return false;
  }

  // load chunks (will fallback per chunk to procedural)
  await loadChunksForMeta(base, meta, world, scene);
  return true;
}
