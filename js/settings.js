/* The Grid · presenter settings
   Appearance (dark, light, or match this computer), music and sound, glow and motion.
   Saved on this computer. Loaded in <head> (not deferred) so the right theme is on before the page paints.
   Other files read it through window.GridSettings: get(key), set(key, value), onChange(fn), reduceMotion(), open(). */
(function () {
  "use strict";
  const KEY = "mgr:settings";
  const DEF = {theme: "dark", volume: 60, lobby: true, game: true, fx: true, glow: true, motion: "auto"};
  const s = Object.assign({}, DEF);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (saved) Object.assign(s, saved);
  else { try { if (localStorage.getItem("mgr:music") === "0") s.lobby = s.game = s.fx = false; } catch (e) {} }   // the old Music button was off

  const mm = q => (window.matchMedia ? matchMedia(q) : {matches: false, addEventListener() {}});
  const mqDark = mm("(prefers-color-scheme: dark)"), mqMotion = mm("(prefers-reduced-motion: reduce)");
  const subs = [];
  const reduceMotion = () => s.motion === "reduce" || (s.motion === "auto" && mqMotion.matches);

  function apply() {
    const d = document.documentElement;
    const theme = s.theme === "auto" ? (mqDark.matches ? "dark" : "light") : s.theme;
    d.dataset.theme = theme;
    if (s.glow) delete d.dataset.glow; else d.dataset.glow = "off";
    if (reduceMotion()) d.dataset.motion = "reduce"; else delete d.dataset.motion;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = theme === "light" ? "#F5F6F8" : "#0A0E15";
  }
  const onSys = () => { apply(); subs.forEach(f => f("system")); };
  try { mqDark.addEventListener("change", onSys); mqMotion.addEventListener("change", onSys); } catch (e) {}
  apply();

  function set(k, v) {
    s[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    apply(); subs.forEach(f => f(k, v));
  }

  /* ---------- the dialog ---------- */
  const PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const mini = cls => `<div class="set-mini ${cls}" aria-hidden="true"><div class="tb"><i class="a"></i><i style="width:22px;height:3px"></i></div><div class="bd"><div><i class="a"></i></div><div><i style="height:30%"></i><i style="height:55%"></i><i class="a" style="height:80%"></i><i style="height:45%"></i></div></div></div>`;
  const look = (val, title, sub, pic) => `<button type="button" class="set-look" role="radio" aria-checked="${s.theme === val}" data-theme-pick="${val}">${pic}<b>${title}</b><span>${sub}</span></button>`;
  const sw = (key, title, sub, preview) => `<div class="set-row"><div class="txt"><b id="sl-${key}">${title}</b><span>${sub}</span></div>${preview ? `<button type="button" class="set-play" data-preview="${preview}" aria-label="Play a sample: ${title.toLowerCase()}" title="Play a sample">${PLAY}</button>` : ""}<button type="button" class="switch" role="switch" aria-checked="${key === "motion" ? reduceMotion() : !!s[key]}" aria-labelledby="sl-${key}" data-switch="${key}"><i></i></button></div>`;
  let lastFocus = null;
  function render() {
    const box = document.getElementById("setBox"); if (!box) return;
    box.innerHTML = `<div class="ldlg-head"><h2 id="setTitle">Settings</h2><button type="button" class="btn primary" id="setDone">Done</button></div>
      <section class="set-sec"><h3 id="setApp">Appearance</h3>
        <div class="set-looks" role="radiogroup" aria-labelledby="setApp">
          ${look("dark", "Dark", "Quiet Neon. Best with the lights down.", mini("dark"))}
          ${look("light", "Light", "Crisp and clear in bright rooms and on older projectors.", mini("light"))}
          ${look("auto", "Match this computer", "Follows the computer's own light or dark setting.", `<div class="set-auto">${mini("dark")}${mini("light")}</div>`)}
        </div></section>
      <section class="set-sec"><h3>Music and sound</h3>
        <div class="set-row"><label for="setVol" class="txt"><b>Volume</b></label><input id="setVol" type="range" min="0" max="100" step="5" value="${s.volume}"><output for="setVol" id="setVolOut">${s.volume}%</output></div>
        ${sw("lobby", "Lobby music", "Home page and the join screen.", "lobby")}
        ${sw("game", "Game music", "A quieter loop during games, low enough to talk over.", "focus")}
        ${sw("fx", "Sound effects", "A chime when someone joins, a sting when a prize is won.", "prize")}
      </section>
      <section class="set-sec"><h3>Display</h3>
        ${sw("glow", "Glow", "Soft light on the number just called, the newest player and winners.")}
        ${sw("motion", "Reduce motion", "Dice land without rolling and nothing pulses.")}
      </section>
      <p class="set-foot">Saved on this computer. Music starts after your first click on the page, as browsers require.</p>`;
  }
  function open() {
    const d = document.getElementById("setDlg"); if (!d) return;
    lastFocus = document.activeElement; render(); d.hidden = false;
    const b = document.getElementById("setDone"); if (b) b.focus();
  }
  function close() {
    const d = document.getElementById("setDlg"); if (!d || d.hidden) return;
    d.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("setDlg")) {
      const d = document.createElement("div");
      d.className = "ldlg"; d.id = "setDlg"; d.hidden = true;
      d.innerHTML = '<div class="ldlg-box set-box" role="dialog" aria-modal="true" aria-labelledby="setTitle" id="setBox"></div>';
      document.body.appendChild(d);
    }
    const dlg = document.getElementById("setDlg");
    dlg.addEventListener("click", e => {
      if (e.target === dlg || e.target.closest("#setDone")) return close();
      const t = e.target.closest("[data-theme-pick]");
      if (t) { set("theme", t.dataset.themePick); dlg.querySelectorAll("[data-theme-pick]").forEach(x => x.setAttribute("aria-checked", x === t)); return; }
      const w = e.target.closest("[data-switch]");
      if (w) {
        const k = w.dataset.switch, on = w.getAttribute("aria-checked") !== "true";
        set(k, k === "motion" ? (on ? "reduce" : "full") : on);
        w.setAttribute("aria-checked", on); return;
      }
      const p = e.target.closest("[data-preview]");
      if (p && window.Sound) Sound.preview(p.dataset.preview);
    });
    dlg.addEventListener("input", e => {
      if (e.target.id !== "setVol") return;
      set("volume", +e.target.value); const o = document.getElementById("setVolOut"); if (o) o.textContent = e.target.value + "%";
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !dlg.hidden) { e.stopPropagation(); close(); } }, true);
    const btn = document.getElementById("setBtn"); if (btn) btn.addEventListener("click", open);
  });

  window.GridSettings = {get: k => s[k], set, onChange: f => subs.push(f), reduceMotion, open, close, get isOpen() { const d = document.getElementById("setDlg"); return !!(d && !d.hidden); }};
})();
