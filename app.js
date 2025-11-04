/* V2 core logic with extended field types, IA upload, and i18n */
(()=>{
  const t = (k)=> window.I18N?.t(k) || k;

  const cameraBtn = document.getElementById('cameraBtn');
  const scanBtn   = document.getElementById('scanBtn');
  const geoBtn    = document.getElementById('geoBtn');
  const resetBtn  = document.getElementById('resetBtn');
  const videoEl   = document.getElementById('camera');
  const qrFile    = document.getElementById('qrFile');
  const rawInput  = document.getElementById('rawQrInput');
  const parseRawBtn = document.getElementById('parseRawBtn');
  const dynFields = document.getElementById('dynamicFields');
  const compiledPrompt = document.getElementById('compiledPrompt');
  const infosEl   = document.getElementById('infosComplementaires');
  const ficheMeta = document.getElementById('ficheMeta');
  const iaButtons = document.getElementById('iaButtons');
  const zipBtn    = document.getElementById('zipBtn');

  let detector = null;
  let state = { qr:null, stream:null, capturedPhotos:{}, gps:null };

  function toast(msg){ alert(msg); }

  function resetAll(){
    if (state.stream){ state.stream.getTracks().forEach(t=>t.stop()); state.stream=null; }
    videoEl.classList.remove('hidden');
    dynFields.innerHTML='';
    compiledPrompt.value='';
    infosEl.textContent='';
    iaButtons.innerHTML='';
    ficheMeta.textContent='Catégorie – Titre – Version – QR CODE flashé';
    state={ qr:null, stream:null, capturedPhotos:{}, gps:null };
  }

  function parseJSONSafe(s){ try{ return JSON.parse(s); } catch(e){ toast('JSON invalide.'); return null; } }

  function updateFicheMeta(){
    const q=state.qr; if(!q) return;
    ficheMeta.textContent = `${q.categorie||'–'} – ${q.titre_fiche||'–'} – ${q.version||'–'} – QR OK`;
  }
  function updateInfosComplementaires(){
    const q=state.qr; if(!q) return;
    const refs = Array.isArray(q.references_bibliographiques)? q.references_bibliographiques.join(', ') : '';
    const suivi = q.infos_complementaires || '';
    const objectif = q.objectif ? `Objectif: ${q.objectif}\n` : '';
    const refsTxt = refs ? `Références: ${refs}\n` : '';
    infosEl.textContent = `${objectif}${refsTxt}${suivi}`.trim();
  }

  // --------- Field generation (extended types) ---------
  function createField(field){
    const wrap = document.createElement('div'); wrap.className='field';
    const lab = document.createElement('label'); lab.htmlFor=field.id; lab.textContent = field.label + (field.obligatoire?' *':'');
    wrap.appendChild(lab);

    let input;
    switch(field.type){
      case 'text':
      case 'number':
      case 'date':
      case 'time':
      case 'datetime':
        input = document.createElement('input');
        input.type = (field.type==='datetime')?'datetime-local':field.type;
        input.id = field.id;
        if (field.placeholder) input.placeholder = field.placeholder;
        wrap.appendChild(input);
        break;
      case 'textarea':
        input = document.createElement('textarea');
        input.id = field.id;
        input.rows = field.rows || 3;
        wrap.appendChild(input);
        break;
      case 'radio':
        input = document.createElement('div');
        (field.options||[]).forEach((opt,i)=>{
          const id = `${field.id}_${i}`;
          const r = document.createElement('input'); r.type='radio'; r.name=field.id; r.id=id; r.value=opt.value;
          const l = document.createElement('label'); l.htmlFor=id; l.textContent=opt.label; l.style.marginRight='10px';
          input.appendChild(r); input.appendChild(l);
        });
        wrap.appendChild(input);
        break;
      case 'multiselect':
        input = document.createElement('select'); input.id=field.id; input.multiple=true;
        (field.options||[]).forEach(opt=>{
          const o=document.createElement('option'); o.value=opt.value; o.textContent=opt.label; input.appendChild(o);
        });
        wrap.appendChild(input);
        break;
      case 'select':
        input = document.createElement('select'); input.id=field.id;
        (field.options||[]).forEach(opt=>{
          const o=document.createElement('option'); o.value=opt.value; o.textContent=opt.label; input.appendChild(o);
        });
        wrap.appendChild(input);
        break;
      case 'gps':
        input = document.createElement('div'); input.id = field.id; input.textContent = t('gpsNotAcquired'); wrap.appendChild(input);
        break;
      case 'photo':
        input = document.createElement('input');
        input.type='file'; input.accept='image/*'; input.capture='environment'; input.id=field.id;
        input.addEventListener('change', e=>{ const file=e.target.files?.[0]; if(file) state.capturedPhotos[field.id]=file; });
        wrap.appendChild(input);
        break;
      default:
        input = document.createElement('input'); input.type='text'; input.id=field.id; wrap.appendChild(input);
    }
    dynFields.appendChild(wrap);
  }
  function renderFields(){ dynFields.innerHTML=''; (state.qr.champs_entree||[]).forEach(createField); }
  dynFields.addEventListener('input', compilePrompt);

  // --------- Prompt compilation ---------
  function getFieldValue(f){
    if (f.type==='gps') return state.gps ? `${state.gps.lat}, ${state.gps.lon} (±${Math.round(state.gps.accuracy)} m)` : '';
    if (f.type==='radio'){
      const sel = dynFields.querySelector(`input[name="${f.id}"]:checked`);
      return sel? sel.value : '';
    }
    if (f.type==='multiselect'){
      const el = document.getElementById(f.id);
      return Array.from(el.selectedOptions).map(o=>o.value).join(', ');
    }
    const el = document.getElementById(f.id);
    return el && el.value ? el.value : '';
  }

  function compilePrompt(){
    if(!state.qr) return '';
    const values={};
    (state.qr.champs_entree||[]).forEach(f=> values[f.id]=getFieldValue(f));

    let template = state.qr.prompt || '';
    Object.entries(values).forEach(([k,v])=>{
      const re = new RegExp(`{{\\s*${k}\\s*}}`,'gi');
      template = template.replace(re, v || '');
    });
    const blocChamps = Object.entries(values).filter(([,v])=>v && v.toString().trim()!=='')
      .map(([k,v])=>`- ${k}: ${v}`).join('\n');
    const refs = Array.isArray(state.qr.references_bibliographiques)? state.qr.references_bibliographiques.join(', '):'';
    const header = [`# Fiche: ${state.qr.titre_fiche||''} (${state.qr.version||''}) – Catégorie: ${state.qr.categorie||''}`, refs?`# Références: ${refs}`:''].filter(Boolean).join('\n');
    const full = [header, template, '', '# Données saisies', blocChamps].join('\n').trim();
    compiledPrompt.value = full;
    return full;
  }

  // --------- IA routing with optional upload ---------
  function openIA(key, meta){
    const prompt = compilePrompt();
    const url = (meta.url && meta.url.replace('%q%', encodeURIComponent(prompt))) 
              || `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;

    // If upload_url defined: try POST attachments + prompt as multipart/form-data
    if (meta.upload_url){
      const fd = new FormData();
      fd.append(meta.upload_prompt_field||'prompt', new Blob([prompt], {type:'text/plain'}), 'prompt.txt');
      Object.entries(state.capturedPhotos).forEach(([fid, file], idx)=>{
        fd.append((meta.upload_file_field_prefix||'file') + String(idx+1), file, file.name||`photo_${idx+1}.jpg`);
      });
      fetch(meta.upload_url, { method:'POST', body: fd, mode: 'cors' })
        .then(()=> window.open(url, '_blank'))
        .catch(()=> {
          // Fallback: zip then open
          createZip(true);
          window.open(url, '_blank');
        });
    } else {
      // No upload endpoint => create ZIP locally (prompt + photos) so user has it while opening the IA.
      createZip(true);
      window.open(url, '_blank');
    }

    // Optional deep link to native client
    if (meta.client_uri){
      setTimeout(()=> window.location.href = meta.client_uri.replace('%q%', encodeURIComponent(prompt)), 300);
    }
  }

  function renderIABtns(){
    iaButtons.innerHTML='';
    const q=state.qr; if(!q || !q.ia_cotation) return;
    Object.entries(q.ia_cotation).forEach(([key, meta])=>{
      const score = Number(meta.score||0);
      if (score<=1) return;
      const btn = document.createElement('button');
      btn.className = 'ia-btn ' + (score===3?'green':'orange');
      btn.textContent = meta.label + (meta.paid?(' ' + t('paidVersion')):'');
      btn.addEventListener('click', ()=> openIA(key, meta));
      iaButtons.appendChild(btn);
    });
  }

  // --------- Geolocation ---------
  geoBtn.addEventListener('click', ()=>{
    if (!('geolocation' in navigator)) return toast('Géolocalisation non disponible.');
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude, longitude, accuracy} = pos.coords;
      state.gps = {lat:latitude, lon:longitude, accuracy};
      (state.qr?.champs_entree||[]).forEach(f=>{
        if (f.type==='gps'){
          const el = document.getElementById(f.id);
          if (el) el.textContent = `${latitude}, ${longitude} (±${Math.round(accuracy)} m)`;
        }
      });
      compilePrompt();
    }, err=> toast(t('geolocFail') + err.message), {enableHighAccuracy:true, timeout:10000});
  });

  // --------- Camera & QR ---------
  async function ensureCamera(){
    if (state.stream) return;
    try{
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoEl.srcObject = state.stream;
    }catch(e){ toast(t('cannotAccessCamera')); }
  }
  cameraBtn.addEventListener('click', ensureCamera);

  async function detectLoop(){
    if (!('BarcodeDetector' in window)) return toast(t('noBarcode'));
    if (!detector) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    for (let i=0;i<300;i++){
      if (!videoEl.srcObject) break;
      const bmp = await createImageBitmap(videoEl);
      try{
        const codes = await detector.detect(bmp);
        if (codes && codes.length) { handleQrRaw(codes[0].rawValue); break; }
      }catch(e){}
      await new Promise(r=>setTimeout(r,30));
    }
  }
  scanBtn.addEventListener('click', async()=>{ await ensureCamera(); await new Promise(r=>setTimeout(r,200)); detectLoop(); });

  qrFile.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    if (!('BarcodeDetector' in window)) return toast(t('noBarcode'));
    const bmp = await createImageBitmap(file);
    if (!detector) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(bmp);
    if (codes && codes.length) handleQrRaw(codes[0].rawValue); else toast(t('noQrInImage'));
  });
  parseRawBtn.addEventListener('click', ()=>{ const raw=rawInput.value.trim(); if(raw) handleQrRaw(raw); });

  function handleQrRaw(raw){
    let jsonStr = raw;
    try{
      if (raw.startsWith('data:application/json')){
        const b64 = raw.split(',')[1]; jsonStr = atob(b64);
      }
    }catch(_){}
    const obj = parseJSONSafe(jsonStr); if(!obj) return;
    state.qr = obj;
    updateFicheMeta(); updateInfosComplementaires(); renderFields(); compilePrompt(); renderIABtns();
    if (state.stream){ state.stream.getTracks().forEach(t=>t.stop()); state.stream=null; }
    videoEl.classList.add('hidden');
  }

  // --------- Clipboard + ZIP ---------
  document.getElementById('copyPromptBtn').addEventListener('click', ()=>{
    compilePrompt();
    navigator.clipboard.writeText(compiledPrompt.value).then(()=> toast(t('promptCopied')));
  });

  function createZip(silent=false){
    // Use browser Zip via a simple on-the-fly trick: create a Blob and download;
    // For demo, we concatenate files in a simplistic way (not true ZIP). In production, include a small zip library.
    // Here we fallback to a .txt bundle to stay dependency-free.
    const parts = [];
    parts.push('--- prompt.txt ---\n');
    parts.push(compiledPrompt.value + '\n\n');
    const files = Object.entries(state.capturedPhotos);
    files.forEach(([id,file],i)=>{
      parts.push(`--- ${file.name || ('photo_'+(i+1)+'.jpg')} (binaire non inclus dans ce pseudo-zip) ---\n`);
    });
    const blob = new Blob(parts, {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bundle_prompt_et_pieces_jointes.txt';
    a.click();
    if(!silent) toast(t('zipReady'));
  }
  zipBtn.addEventListener('click', ()=> createZip(false));

  resetBtn.addEventListener('click', resetAll);
  resetAll();
})();
