/* The Grid · music and sound
   Two original loops (lobby: 110 bpm, focus: 84 bpm, both D minor) and two stings (a player joins, a prize is won).
   Web Audio plays the loops sample-accurately, so they repeat with no gap. Browsers only allow sound after a click,
   so music starts on the first click or key press once it's switched on. The Music button in the top bar
   turns everything on or off, and the choice is remembered on this computer. */
(function () {
  "use strict";
  const FILES = {
    lobby: {src: "audio/lobby.mp3?v=1", loop: 32 * 4 * 60 / 110, vol: 0.55},
    focus: {src: "audio/focus.mp3?v=1", loop: 16 * 4 * 60 / 84, vol: 0.42},
    join:  {src: "audio/join.mp3?v=1", vol: 0.55},
    prize: {src: "audio/prize.mp3?v=1", vol: 0.8},
  };
  const FADE = 1.6;
  const KEY = "mgr:music";
  let on = true;
  try { const v = localStorage.getItem(KEY); if (v !== null) on = v === "1"; } catch (e) {}
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, music = null;
  const buffers = {}, loading = {};
  let wanted = "lobby", playing = null;              // playing = {name, src, gain}

  function ensure() {
    if (ctx || !AC) return !!ctx;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 1; music.connect(master);
    return true;
  }
  function load(name) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    if (!loading[name]) loading[name] = fetch(FILES[name].src).then(r => r.arrayBuffer())
      .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then(b => (buffers[name] = b)).catch(() => { delete loading[name]; return null; });
    return loading[name];
  }
  function stopCurrent() {
    if (!playing) return;
    const p = playing, t = ctx.currentTime; playing = null;
    p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(p.gain.gain.value, t); p.gain.gain.linearRampToValueAtTime(0, t + FADE);
    try { p.src.stop(t + FADE + 0.05); } catch (e) {}
  }
  async function sync() {
    if (!ctx) return;
    if (!on || !wanted) return stopCurrent();
    if (ctx.state !== "running") return;           // waits for a click (see unlock)
    if (playing && playing.name === wanted) return;
    const name = wanted, buf = await load(name);
    if (!buf || name !== wanted || !on || (playing && playing.name === name)) return;
    stopCurrent();
    const f = FILES[name], src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.loop = true;
    const extra = buf.duration - f.loop;              // a browser that keeps the MP3's encoder padding: skip it
    if (extra > 0.01) { src.loopStart = Math.min(extra, 1105 / buf.sampleRate); src.loopEnd = src.loopStart + f.loop; }
    g.gain.value = 0; src.connect(g); g.connect(music);
    const t = ctx.currentTime; src.start(t, src.loopStart || 0); g.gain.linearRampToValueAtTime(f.vol, t + FADE);
    playing = {name, src, gain: g};
  }
  let sceneSet = false;
  function unlock(e) {
    if (!on || (e && e.target && e.target.closest && e.target.closest("#musicBtn"))) return;
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume().then(sync); else sync();
  }
  ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, unlock, true));

  const Sound = {
    get on() { return on; },
    /* "lobby" on the home page and in the join screen, "focus" during a game, null for silence */
    scene(name) { wanted = name; sceneSet = true; if (ctx) sync(); },
    async sting(name) {
      if (!on || !ensure() || ctx.state !== "running" || !FILES[name]) return;
      const buf = await load(name); if (!buf) return;
      const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
      s.buffer = buf; g.gain.value = FILES[name].vol; s.connect(g); g.connect(master); s.start(t);
      music.gain.cancelScheduledValues(t); music.gain.setValueAtTime(music.gain.value, t);   // dip the music under the sting
      music.gain.linearRampToValueAtTime(0.35, t + 0.15); music.gain.setValueAtTime(0.35, t + Math.min(buf.duration, 2.5));
      music.gain.linearRampToValueAtTime(1, t + Math.min(buf.duration, 2.5) + 1.2);
    },
    toggle(v) {
      on = v === undefined ? !on : !!v;
      try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
      if (on) unlock(); else if (ctx) stopCurrent();
      render();
      return on;
    },
  };
  function render() {
    const b = document.getElementById("musicBtn"); if (!b) return;
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.title = on ? "Music is on. Click to turn it off." : "Music is off. Click to turn it on.";
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (!sceneSet) wanted = location.hash.length > 1 ? "focus" : "lobby";   // the page script runs before this file loads
    render();
    const b = document.getElementById("musicBtn");
    if (b) b.addEventListener("click", () => Sound.toggle());
  });
  window.Sound = Sound;
})();
