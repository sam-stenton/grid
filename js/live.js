/* The Grid · live play
   Connects the projector (the host) and students' phones (players) through Firebase Realtime Database.
   Every game talks to Firebase only through this file.

   Data layout (one branch per game room, keyed by a 4-letter code):
     rooms/ABCD/meta     { host, created }          who runs the room; only the host can change it
     rooms/ABCD/state    { phase, locked, ... }     what the board is showing; only the host writes it
     rooms/ABCD/players/<id> { name, joined, online, score }   each phone writes only its own entry
     rooms/ABCD/cards/<id>   [ ... ]                a player's card; refused once the host sets state.locked
     rooms/ABCD/marks/<id>/<cell>  "c12"            a mark: only for the number just called, only before the next call
   The rules in database.rules.json enforce all of this on Google's servers, so a phone can't cheat by
   editing the page. */
(function () {
  "use strict";
  const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";          // no I or O, so codes can't be misread as 1 or 0
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = !!(cfg.apiKey && cfg.databaseURL && !/PASTE/i.test(cfg.apiKey + cfg.databaseURL));
  let db = null, uid = null, ready = null;

  function start() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      if (!configured) return reject(new Error("not-configured"));
      if (typeof window.firebase === "undefined" || !firebase.database || !firebase.auth) return reject(new Error("sdk-blocked"));
      try { if (!firebase.apps.length) firebase.initializeApp(cfg); db = firebase.database(); }
      catch (e) { return reject(e); }
      const timer = setTimeout(() => reject(new Error("timeout")), 12000);
      firebase.auth().onAuthStateChanged(u => { if (u) { clearTimeout(timer); uid = u.uid; resolve(uid); } });
      firebase.auth().signInAnonymously().catch(e => { clearTimeout(timer); reject(e); });
    });
    ready.catch(() => { ready = null; });              // allow a retry after a failure
    return ready;
  }
  const ref = p => db.ref(p);
  const STAMP = () => firebase.database.ServerValue.TIMESTAMP;
  const randomCode = () => Array.from({length: 4}, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
  const cleanName = s => String(s || "").replace(/[<>&"]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
  const cleanCode = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

  /* ---------- the projector ---------- */
  const host = {
    code: null, _offs: [],
    /* Make a new room, or take back `prefer` after a page refresh (same browser = same host id). */
    async create(prefer) {
      await start();
      for (let tries = 0; tries < 10; tries++) {
        const code = tries === 0 && prefer ? cleanCode(prefer) : randomCode();
        if (code.length !== 4) continue;
        let resumed = false;
        const res = await ref(`rooms/${code}/meta`).transaction(cur => {
          resumed = !!(cur && cur.host === uid);
          return cur === null || resumed || cur.created < Date.now() - 12 * 3600e3 ? {host: uid, created: resumed ? cur.created : Date.now()} : undefined;
        });
        if (!res.committed) continue;
        this.code = code;
        if (!resumed) await ref(`rooms/${code}`).update({state: null, players: null, cards: null, marks: null});   // clear anything left from an old room
        const st = await ref(`rooms/${code}/state`).once("value");
        if (!st.exists()) await this.setState({phase: "lobby", game: null, locked: false});
        return code;
      }
      throw new Error("no-code");
    },
    _listen(path, cb) {
      const r = ref(`rooms/${this.code}/${path}`), f = s => cb(s.val() || {});
      r.on("value", f); this._offs.push(() => r.off("value", f));
    },
    onPlayers(cb) { this._listen("players", cb); },
    onCards(cb) { this._listen("cards", cb); },
    onMarks(cb) { this._listen("marks", cb); },
    setScore(id, n) { return ref(`rooms/${this.code}/players/${id}`).update({score: n}); },
    clearGame() { return ref(`rooms/${this.code}`).update({cards: null, marks: null}); },
    setState(obj) { return ref(`rooms/${this.code}/state`).set({...obj, t: STAMP()}); },
    updateState(patch) { return ref(`rooms/${this.code}/state`).update({...patch, t: STAMP()}); },
    kick(id) { return ref(`rooms/${this.code}`).update({[`players/${id}`]: null, [`cards/${id}`]: null, [`marks/${id}`]: null}); },
    clearCards() { return ref(`rooms/${this.code}/cards`).remove(); },
    async end() {
      const code = this.code; if (!code) return;
      this._offs.forEach(f => f()); this._offs = []; this.code = null;
      await ref(`rooms/${code}`).update({state: null, players: null, cards: null, marks: null});
      await ref(`rooms/${code}/meta`).remove();
    },
  };

  /* ---------- a phone ---------- */
  const player = {
    code: null, name: null, _offs: [],
    async join(code, name) {
      await start();
      code = cleanCode(code); name = cleanName(name);
      if (code.length !== 4) throw new Error("bad-code");
      if (!name) throw new Error("no-name");
      const meta = await ref(`rooms/${code}/meta`).once("value");
      if (!meta.exists()) throw new Error("no-room");
      // two students called Sam become "Sam" and "Sam 2", so the board never shows the same name twice
      const others = (await ref(`rooms/${code}/players`).once("value")).val() || {};
      const taken = new Set(Object.entries(others).filter(([id]) => id !== uid).map(([, p]) => String(p.name || "").toLowerCase()));
      const base = name.slice(0, 13);
      for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${base} ${k}`;
      this.code = code; this.name = name;
      const me = ref(`rooms/${code}/players/${uid}`);
      await me.update({name, joined: STAMP(), online: true});
      me.child("online").onDisconnect().set(false);
      return uid;
    },
    _listen(path, cb) {
      const r = ref(`rooms/${this.code}/${path}`), f = s => cb(s.val());
      r.on("value", f); this._offs.push(() => r.off("value", f));
    },
    onState(cb) { this._listen("state", cb); },                   // null means the room has closed
    onMe(cb) { this._listen(`players/${uid}`, cb); },             // null means the teacher removed you
    onCard(cb) { this._listen(`cards/${uid}`, cb); },
    onMarks(cb) { this._listen(`marks/${uid}`, cb); },
    setCard(card) { return ref(`rooms/${this.code}/cards/${uid}`).set(card); },
    /* The database accepts a mark only if it's for the number just called and that cell holds it. */
    mark(cell, callKey) { return ref(`rooms/${this.code}/marks/${uid}/${cell}`).set(callKey); },
    async leave() {
      const code = this.code; this._offs.forEach(f => f()); this._offs = []; this.code = null;
      if (code && uid) { try { await ref(`rooms/${code}`).update({[`players/${uid}`]: null, [`cards/${uid}`]: null, [`marks/${uid}`]: null}); } catch (e) {} }
    },
  };

  /* ---------- connection test (test.html) ---------- */
  async function roundTrip() {
    await start();
    const t0 = performance.now(), r = ref(`tests/${uid}`);
    await r.set({at: STAMP()});
    const snap = await r.once("value");
    await r.remove();
    return {ms: Math.round(performance.now() - t0), ok: snap.exists()};
  }

  window.Live = {configured, start, host, player, roundTrip, cleanName, cleanCode, get uid() { return uid; }};
})();
