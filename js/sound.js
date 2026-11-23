/* The Grid · music and sound
   Two original loops (lobby: 110 bpm, game: 84 bpm, both D minor) and two stings (a player joins, a prize is won).
   Web Audio plays the loops sample-accurately, so they repeat with no gap. Browsers only allow sound after a click,
   so music starts on the first click or key press. Volume and the lobby / game / effects switches live in
   Settings (js/settings.js), saved on this computer. */
(function () {
  "use strict";
  const FILES = {
    lobby: {src: "audio/lobby.mp3?v=1", loop: 32 * 4 * 60 / 110, vol: 0.6},
    focus: {src: "audio/focus.mp3?v=1", loop: 16 * 4 * 60 / 84, vol: 0.45},
    join:  {src: "audio/join.mp3?v=1", vol: 0.6},
    prize: {src: "audio/prize.mp3?v=1", vol: 0.85},
  };
  const FADE = 1.6;
  const S = () => window.GridSettings || {get: k => ({volume: 60, lobby: true, game: true, fx: true})[k]};
  const allowed = name => name === "lobby" ? !!S().get("lobby") : name === "focus" ? !!S().get("game") : false;
  const volume = () => Math.max(0, Math.min(100, +S().get("volume") || 0)) / 100;
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, music = null;
  const buffers = {}, loading = {};
  let wanted = "lobby", sceneSet = false, playing = null;              // playing = {name, src, gain}

  function ensure() {
    if (ctx || !AC) return !!ctx;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume(); master.connect(ctx.destination);
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
  function source(buf, f, loop) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
    const extra = buf.duration - (f.loop || buf.duration);          // a browser that keeps the MP3's encoder padding: skip it
    if (loop && extra > 0.01) { src.loopStart = Math.min(extra, 1105 / buf.sampleRate); src.loopEnd = src.loopStart + f.loop; }
    return src;
  }
  async function sync() {
    if (!ctx) return;
    const name = wanted && allowed(wanted) ? wanted : null;
    if (!name) return stopCurrent();
    if (ctx.state !== "running") return;                              // waits for a click (see unlock)
    if (playing && playing.name === name) return;
    const buf = await load(name);
    const still = wanted && allowed(wanted) ? wanted : null;
    if (!buf || name !== still || (playing && playing.name === name)) return;
    stopCurrent();
    const f = FILES[name], src = source(buf, f, true), g = ctx.createGain();
    g.gain.value = 0; src.connect(g); g.connect(music);
    const t = ctx.currentTime; src.start(t, src.loopStart || 0); g.gain.linearRampToValueAtTime(f.vol, t + FADE);
    playing = {name, src, gain: g};
  }
  function anyOn() { const s = S(); return s.get("lobby") || s.get("game") || s.get("fx"); }
  function unlock(e) {
    if (!anyOn() || (e && e.target && e.target.closest && e.target.closest("#setDlg"))) return;
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume().then(sync); else sync();
  }
  ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, unlock, true));
  function duck(t, len) {
    music.gain.cancelScheduledValues(t); music.gain.setValueAtTime(music.gain.value, t);
    music.gain.linearRampToValueAtTime(0.3, t + 0.15); music.gain.setValueAtTime(0.3, t + len);
    music.gain.linearRampToValueAtTime(1, t + len + 1.2);
  }
  async function play(name, len) {
    const buf = await load(name); if (!buf) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime, d = Math.min(buf.duration, len || buf.duration);
    s.buffer = buf; g.gain.value = FILES[name].vol; s.connect(g); g.connect(master); s.start(t);
    if (len && len < buf.duration) { g.gain.setValueAtTime(FILES[name].vol, t + d - 1.2); g.gain.linearRampToValueAtTime(0, t + d); s.stop(t + d + 0.05); }
    duck(t, d);
  }

  if (window.GridSettings) GridSettings.onChange(k => {
    if (!ctx) return;
    if (k === "volume") master.gain.setTargetAtTime(volume(), ctx.currentTime, 0.05);
    if (k === "lobby" || k === "game") { if (ctx.state === "suspended") ctx.resume().then(sync); else sync(); }
  });

  window.Sound = {
    /* "lobby" on the home page and in the join screen, "focus" during a game, null for silence */
    scene(name) { wanted = name; sceneSet = true; if (ctx) sync(); },
    sting(name) { if (!S().get("fx") || !ctx || ctx.state !== "running" || !FILES[name]) return; play(name); },
    /* a sample from Settings: ignores the switches, since the teacher asked to hear it */
    async preview(name) {
      if (!ensure() || !FILES[name]) return;
      if (ctx.state === "suspended") await ctx.resume();
      play(name, FILES[name].loop ? 8 : 0);
    },
  };
  document.addEventListener("DOMContentLoaded", () => { if (!sceneSet) wanted = location.hash.length > 1 ? "focus" : "lobby"; });
})();
