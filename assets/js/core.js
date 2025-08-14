// Core logic for Keep It Alive (ES Module)
// Exposes a single initKeepAlive() to wire up UI and behavior.

export function initKeepAlive(opts = {}) {
  // Detect Apple devices (iOS/iPadOS/macOS Safari)
  function isAppleDevice() {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (
      /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
    );
  }
  const btn = opts.btn || document.getElementById('keepBtn');
  const minutesInput = opts.minutesInput || document.getElementById('minutes');
  const minutesVisible = opts.minutesVisible || document.getElementById('minutesVisible');
  const countdownEl = opts.countdownEl || document.getElementById('countdown');
  const presetsEl = opts.presetsEl || document.getElementById('presets');
  const overlay = opts.overlay || document.getElementById('overlay');
  const overlayVideo = opts.overlayVideo || document.getElementById('overlayVideo');
  const fsBlackBtn = opts.fsBlackBtn || document.getElementById('fsBlackBtn');
  const fsClockBtn = opts.fsClockBtn || document.getElementById('fsClockBtn');
  const fsBlack = opts.fsBlack || document.getElementById('fsBlack');
  const fsClock = opts.fsClock || document.getElementById('fsClock');
  const clockDisplay = opts.clockDisplay || document.getElementById('clockDisplay');

  if (!btn || !minutesInput || !minutesVisible || !countdownEl || !presetsEl || !overlay || !overlayVideo) {
    console.warn('[KeepAlive] Some required DOM elements are missing.');
  }

  let wakeLock = null;
  let isOn = false;

  let autoOffId = 0;
  let countdownId = 0;
  let deadlineTs = 0;
  let noLimit = false;
  let clockTickId = 0;

  function clearAutoOff() { if (autoOffId) { clearTimeout(autoOffId); autoOffId = 0; } }
  function clearCountdown() { if (countdownId) { clearInterval(countdownId); countdownId = 0; } countdownEl.textContent = ''; }
  function pad(n){ return String(n).padStart(2,'0'); }
  function updateUI() { btn.classList.toggle('on', isOn); btn.setAttribute('aria-pressed', isOn ? 'true' : 'false'); }

  function startCountdown(minutes) {
    deadlineTs = Date.now() + minutes * 60000;
    updateCountdown();
    if (countdownId) clearInterval(countdownId);
    countdownId = setInterval(updateCountdown, 1000);
  }
  function updateCountdown() {
    if (!isOn || !deadlineTs) { countdownEl.textContent=''; return; }
    let ms = deadlineTs - Date.now();
  if (ms <= 0) { countdownEl.textContent = 'Remaining: 00:00:00'; if (countdownId) { clearInterval(countdownId); countdownId=0; } return; }
    const totalSec = Math.floor(ms/1000);
    const h = Math.floor(totalSec/3600);
    const m = Math.floor((totalSec%3600)/60);
    const s = totalSec%60;
  countdownEl.textContent = `Remaining: ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  // Clock overlay helpers
  function formatClock(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function startClock() {
    if (!clockDisplay) return;
    clockDisplay.textContent = formatClock(new Date());
    if (clockTickId) clearInterval(clockTickId);
    clockTickId = setInterval(() => {
      clockDisplay.textContent = formatClock(new Date());
    }, 1000);
  }
  function stopClock() { if (clockTickId) { clearInterval(clockTickId); clockTickId = 0; } }

  function updateChipsActive() {
    const chips = presetsEl.querySelectorAll('.chip');
    chips.forEach(ch => {
      const dm = parseInt(ch.dataset.min, 10);
      const selected = noLimit ? dm === 0 : (!isNaN(dm) && dm === parseInt(minutesInput.value || '0', 10));
      ch.classList.toggle('active', selected);
    });
  }

  function setMinutes(val) {
    if (val === null) {
      noLimit = true;
      minutesInput.value = '';
      minutesVisible.value = '';
      updateChipsActive();
  if (isOn) { clearAutoOff(); clearCountdown(); countdownEl.textContent = 'No limit'; }
      return;
    }
    const m = Math.max(1, parseInt(val,10) || 0);
    noLimit = false;
    minutesInput.value = String(m);
    minutesVisible.value = String(m);
    updateChipsActive();
    if (isOn) scheduleAutoOff();
  }

  function getMinutes() {
    if (noLimit) return null;
    const v = parseInt((minutesInput && minutesInput.value) || '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 60;
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

  // Fallbacks
  let audio = { ctx: null, osc: null, gain: null };
  function stopAudioKeepAlive() {
    try { if (audio.osc) audio.osc.stop(); } catch(_) {}
    audio.osc = null; audio.gain = null;
    if (audio.ctx) { try { audio.ctx.close(); } catch(_) {} audio.ctx = null; }
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
    let t = 0;
    function drawFrame() {
      // Toggle 1 pixel to force a new frame while staying invisible/minimal
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = (t++ % 2) ? 'rgb(0,0,0)' : 'rgb(0,0,1)';
      ctx.fillRect(0, 0, 1, 1);
    }
    drawFrame();
    fallback.iv = setInterval(drawFrame, 1000); // 1 fps low power

    const stream = canvas.captureStream(1);
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    video.srcObject = stream;
    Object.assign(video.style, { position:'fixed', opacity:'0', pointerEvents:'none', width:'1px', height:'1px', left:'-9999px', top:'-9999px' });
    document.body.appendChild(video);
    try { await video.play(); fallback.video = video; fallback.stream = stream; return true; }
    catch { stopFallbackKeepAlive(); return false; }
  }

  async function enterOverlay() {
    if (!fallback.stream) { const ok = await startFallbackKeepAlive(); if (!ok) return false; }
    if (overlayVideo.srcObject !== fallback.stream) overlayVideo.srcObject = fallback.stream;
    overlay.style.display = 'flex';
    try { await overlayVideo.play(); } catch(_) {}
    return true;
  }
  function exitOverlay() {
    overlay.style.display = 'none';
    if (document.fullscreenElement && document.fullscreenElement === overlay) {
      try { document.exitFullscreen(); } catch(_) {}
    }
  }

  async function enable() {
    isOn = true; updateUI();
    const ok = await acquireWakeLock();
    if (ok) { scheduleAutoOff(); return; }
    const videoOk = await startFallbackKeepAlive();
    if (videoOk) { scheduleAutoOff(); try { await enterOverlay(); } catch(_) {} return; }
    const audioOk = await startAudioKeepAlive();
    if (audioOk) { scheduleAutoOff(); try { await enterOverlay(); } catch(_) {} return; }
    isOn = false; updateUI();
  }

  async function disable() {
    exitOverlay();
    stopAudioKeepAlive();
    stopFallbackKeepAlive();
    if (wakeLock) { try { await wakeLock.release(); } catch(_) {} wakeLock = null; }
    clearAutoOff();
    clearCountdown();
    isOn = false; updateUI();
  }

  function scheduleAutoOff() {
    clearAutoOff();
    const mins = getMinutes();
  if (mins === null) { clearCountdown(); countdownEl.textContent = 'No limit'; return; }
    autoOffId = setTimeout(() => { disable(); }, mins * 60000);
    clearCountdown();
    startCountdown(mins);
  }

  // Events wiring
  presetsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const dm = parseInt(b.dataset.min, 10);
    if (dm === 0) setMinutes(null); else setMinutes(dm);
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
    if (!Number.isFinite(v) || v < 1) setMinutes(null); else setMinutes(v);
  });
  minutesInput.addEventListener('change', () => {
    const v = parseInt(minutesInput.value || '0', 10);
    if (!Number.isFinite(v) || v < 1) setMinutes(null); else setMinutes(v);
  });

  btn.addEventListener('click', async () => { if (isOn) await disable(); else await enable(); });
  minutesInput.addEventListener('change', () => { if (isOn) scheduleAutoOff(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' && isOn) { disable(); } });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      overlay.style.display = 'none';
      hideFsOverlays();
    }
  });

  // Full-screen overlays (black and clock)
  function hideFsOverlays() {
    if (fsBlack) fsBlack.classList.remove('show');
    if (fsClock) fsClock.classList.remove('show');
    stopClock();
  }
  async function enterFs(el) {
    if (!el) return;
    el.classList.add('show');
    // On Apple devices, use video element for fullscreen overlays
    if (isAppleDevice()) {
      // Use overlayVideo for fullscreen, overlay clock/black on top
      try {
        if (overlayVideo.requestFullscreen) {
          await overlayVideo.requestFullscreen();
        } else if (overlayVideo.webkitRequestFullscreen) {
          overlayVideo.webkitRequestFullscreen();
        }
      } catch (_) { /* ignore */ }
    } else {
      // Standard fullscreen for overlays
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen({ navigationUI: 'hide' });
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } catch (_) { /* ignore */ }
    }
  }
  async function exitFs() {
    hideFsOverlays();
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.webkitFullscreenElement) {
        document.webkitExitFullscreen && document.webkitExitFullscreen();
      }
    } catch (_) { /* ignore */ }
  }

  if (fsBlackBtn && fsBlack) {
    fsBlackBtn.addEventListener('click', () => { enterFs(fsBlack); });
    fsBlack.addEventListener('click', exitFs);
    fsBlack.addEventListener('touchstart', exitFs, { passive: true });
  }
  if (fsClockBtn && fsClock) {
    fsClockBtn.addEventListener('click', () => {
      startClock();
      // Show overlay before requesting fullscreen for reliable rendering
      fsClock.classList.add('show');
      setTimeout(() => enterFs(fsClock), 10);
    });
    fsClock.addEventListener('click', exitFs);
    fsClock.addEventListener('touchstart', exitFs, { passive: true });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') exitFs(); });

  // Init
  updateChipsActive();
  updateUI();

  // Provide minimal API for testing/extensions
  return { enable, disable, setMinutes, getMinutes };
}
