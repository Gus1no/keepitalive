(() => {
  let wakeLock = null;
  let isOn = false;
  const btn = document.getElementById('keepBtn');
  const minutesInput = document.getElementById('minutes');
  const minutesVisible = document.getElementById('minutesVisible');
  const countdownEl = document.getElementById('countdown');
  const presetsEl = document.getElementById('presets');
  const chips = presetsEl.querySelectorAll('.chip');

  let autoOffId = 0;
  let countdownId = 0;
  let deadlineTs = 0;
  let noLimit = false;

  function clearAutoOff() {
    if (autoOffId) { clearTimeout(autoOffId); autoOffId = 0; }
  }
  function clearCountdown() {
    if (countdownId) { clearInterval(countdownId); countdownId = 0; }
    countdownEl.textContent = '';
  }
  function startCountdown(minutes) {
    deadlineTs = Date.now() + minutes * 60000;
    updateCountdown();
    if (countdownId) clearInterval(countdownId);
    countdownId = setInterval(updateCountdown, 1000);
  }
  function pad(n){ return String(n).padStart(2,'0'); }
  function updateCountdown() {
    if (!isOn || !deadlineTs) { countdownEl.textContent=''; return; }
    let ms = deadlineTs - Date.now();
    if (ms <= 0) { countdownEl.textContent = 'Restante: 00:00:00'; if (countdownId) { clearInterval(countdownId); countdownId=0; } return; }
    const totalSec = Math.floor(ms/1000);
    const h = Math.floor(totalSec/3600);
    const m = Math.floor((totalSec%3600)/60);
    const s = totalSec%60;
    countdownEl.textContent = `Restante: ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function setMinutes(val) {
    if (val === null) {
      noLimit = true;
      minutesInput.value = '';
      minutesVisible.value = '';
      updateChipsActive();
      if (isOn) { clearAutoOff(); clearCountdown(); countdownEl.textContent = 'Sin límite'; }
      return;
    }
    const m = Math.max(1, parseInt(val,10) || 0);
    noLimit = false;
    minutesInput.value = String(m);
    minutesVisible.value = String(m);
    updateChipsActive();
    if (isOn) scheduleAutoOff();
  }

  function updateChipsActive() {
    chips.forEach(ch => {
      const dm = parseInt(ch.dataset.min, 10);
      const selected = noLimit ? dm === 0 : (!isNaN(dm) && dm === parseInt(minutesInput.value || '0', 10));
      ch.classList.toggle('active', selected);
    });
  }

  presetsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const dm = parseInt(btn.dataset.min, 10);
    if (dm === 0) {
      setMinutes(null);
    } else {
      setMinutes(dm);
    }
  });

  document.getElementById('minus5').addEventListener('click', () => {
    if (noLimit) setMinutes(60);
    const cur = parseInt(minutesVisible.value || '60', 10);
    setMinutes(Math.max(1, cur - 5));
  });
  document.getElementById('plus5').addEventListener('click', () => {
    if (noLimit) setMinutes(60);
    const cur = parseInt(minutesVisible.value || '60', 10);
    setMinutes(cur + 5);
  });

  minutesVisible.addEventListener('change', () => {
    const v = parseInt(minutesVisible.value || '0', 10);
    if (!Number.isFinite(v) || v < 1) {
      setMinutes(null); // tratar vacío/0 como sin límite
    } else {
      setMinutes(v);
    }
  });

  // Reprogramar si cambia el tiempo estando activo (input oculto legacy)
  minutesInput.addEventListener('change', () => {
    const v = parseInt(minutesInput.value || '0', 10);
    if (!Number.isFinite(v) || v < 1) {
      setMinutes(null);
    } else {
      setMinutes(v);
    }
  });

  // Sobrescribir helpers para soportar "Sin límite"
  function getMinutes() {
    if (noLimit) return null;
    const v = parseInt((minutesInput && minutesInput.value) || '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 60;
  }

  function scheduleAutoOff() {
    clearAutoOff();
    const mins = getMinutes();
    if (mins === null) { // sin límite
      clearCountdown();
      countdownEl.textContent = 'Sin límite';
      return;
    }
    autoOffId = setTimeout(() => { disable(); }, mins * 60000);
    clearCountdown();
    startCountdown(mins);
  }

  // Fallback 1: audio casi inaudible para prevenir suspensión en algunos PCs
  let audio = { ctx: null, osc: null, gain: null };
  function stopAudioKeepAlive() {
    try { if (audio.osc) audio.osc.stop(); } catch(_) {}
    audio.osc = null;
    audio.gain = null;
    if (audio.ctx) {
      try { audio.ctx.close(); } catch(_) {}
      audio.ctx = null;
    }
  }
  async function startAudioKeepAlive() {
    if (audio.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      const ctx = new AC();
      await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.000001; // inaudible
      osc.type = 'sine';
      osc.frequency.value = 440;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audio.ctx = ctx; audio.osc = osc; audio.gain = gain;
      return true;
    } catch (_) {
      stopAudioKeepAlive();
      return false;
    }
  }

  // Fallback: mantener vivo mediante un vídeo oculto de un canvas (para equipos/navegadores sin Wake Lock)
  let fallback = { video: null, stream: null, raf: 0, iv: 0 };
  function stopFallbackKeepAlive() {
    if (fallback.raf) { cancelAnimationFrame(fallback.raf); fallback.raf = 0; }
    if (fallback.iv) { clearInterval(fallback.iv); fallback.iv = 0; }
    if (fallback.video) { try { fallback.video.pause(); } catch(_) {} fallback.video.remove(); fallback.video = null; }
    if (fallback.stream) { try { fallback.stream.getTracks().forEach(t=>t.stop()); } catch(_) {} fallback.stream = null; }
  }
  async function startFallbackKeepAlive() {
    if (fallback.video) return true;
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    // Negro sólido y refresco mínimo para generar frames continuos
    let t = 0;
    function drawFrame() {
      // Alteramos 1 píxel imperceptible para forzar frame nuevo
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = (t++ % 2) ? 'rgb(0,0,0)' : 'rgb(0,0,1)';
      ctx.fillRect(0, 0, 1, 1);
    }
    drawFrame();
    // 1 fps para bajo consumo, suficiente para mantener reproducción activa
    fallback.iv = setInterval(drawFrame, 1000);

    const stream = canvas.captureStream(1);
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    video.srcObject = stream;
    // Mantenerlo completamente oculto
    Object.assign(video.style, { position:'fixed', opacity:'0', pointerEvents:'none', width:'1px', height:'1px', left:'-9999px', top:'-9999px' });
    document.body.appendChild(video);
    try {
      await video.play();
      fallback.video = video; fallback.stream = stream;
      return true;
    } catch (_) {
      stopFallbackKeepAlive();
      return false;
    }
  }

  function updateUI() {
    btn.classList.toggle('on', isOn);
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  }

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return false;
    try {
      const wl = await navigator.wakeLock.request('screen');
      wakeLock = wl;
      wl.addEventListener('release', () => {
        wakeLock = null;
        isOn = false; // al liberarse, queda desactivado
        updateUI();
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  const overlay = document.getElementById('overlay');
  const overlayVideo = document.getElementById('overlayVideo');

  async function enterFullscreenOverlay() {
    // Asegura que existe el stream del canvas
    if (!fallback.stream) {
      const ok = await startFallbackKeepAlive();
      if (!ok) return false;
    }
    // Conectar stream al vídeo del overlay
    if (overlayVideo.srcObject !== fallback.stream) {
      overlayVideo.srcObject = fallback.stream;
    }
    // Mostrar overlay sin solicitar pantalla completa
    overlay.style.display = 'flex';
    try { await overlayVideo.play(); } catch(_) {}
    return true;
  }

  function exitFullscreenOverlay() {
    overlay.style.display = 'none';
    // No usamos modo fullscreen aquí
    if (document.fullscreenElement && document.fullscreenElement === overlay) {
      try { document.exitFullscreen(); } catch(_) {}
    }
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      overlay.style.display = 'none';
    }
  });

  async function enable() {
    // Encendido optimista del botón
    isOn = true;
    updateUI();

    // 1) Wake Lock (oficial)
    const ok = await acquireWakeLock();
    if (ok) {
      scheduleAutoOff();
      return;
    }

    // 2) Vídeo (canvas) reproduciéndose, visible (1px) como YouTube
    const videoOk = await startFallbackKeepAlive();
    if (videoOk) {
      scheduleAutoOff();
      try { await enterFullscreenOverlay(); } catch(_) {}
      return;
    }

    // 3) Último recurso: audio inaudible + overlay negro
    const audioOk = await startAudioKeepAlive();
    if (audioOk) {
      scheduleAutoOff();
      try { await enterFullscreenOverlay(); } catch(_) {}
      return;
    }

    // Si todo falla, revertir estado
    isOn = false;
    updateUI();
  }

  async function disable() {
    exitFullscreenOverlay();
    stopAudioKeepAlive();
    stopFallbackKeepAlive();
    if (wakeLock) {
      try { await wakeLock.release(); } catch (_) {}
      wakeLock = null;
    }
    clearAutoOff();
    clearCountdown();
    isOn = false;
    updateUI();
  }

  // Listener del botón (alternar ON/OFF)
  btn.addEventListener('click', async () => {
    if (isOn) {
      await disable();
    } else {
      await enable();
    }
  });

  // Reprogramar si cambia el tiempo estando activo
  minutesInput.addEventListener('change', () => {
    if (isOn) scheduleAutoOff();
  });

  // Al salir de la página/pestaña, se desactiva y cancelamos el temporizador
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' && isOn) {
      disable();
    }
  });

  // Inicializar UI de tiempo
  updateChipsActive();
  updateUI();
})();
