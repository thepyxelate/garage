import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, set, remove, push, query, limitToLast, serverTimestamp, onDisconnect, onChildAdded, onChildChanged, onChildRemoved } from 'firebase/database';

// Firebase Realtime Database transport.
//   rooms/<room>/info/<uid>  { n: name, c: colour, look: JSON of the build }   written once when you enter
//   rooms/<room>/live/<uid>  [x, z, y, heading, speed]                          about 10 times a second while moving
//   rooms/<room>/chat/<id>   { u: uid, t: text, ts }
// The server only relays. Each car is simulated on its own computer, so a slow connection delays what you see of
// others but never your own steering. Entries are removed by onDisconnect when a tab closes or drops.
export async function firebaseTransport(config, net, room = 'city') {
  const app = initializeApp(config), db = getDatabase(app);
  const { user } = await signInAnonymously(getAuth(app));
  const uid = user.uid, base = 'rooms/' + room;
  const infoRef = ref(db, base + '/info/' + uid), liveRef = ref(db, base + '/live/' + uid);
  let unsub = [], joinedAt = 0, inRoom = false;
  const parse = (snap) => { const v = snap.val() || {}; let look = {}; try { look = JSON.parse(v.look || '{}'); } catch (e) { /* bad data: default car */ } return { name: v.n, color: v.c, look }; };
  const warn = (e) => console.warn('[net]', e && e.message ? e.message : e);
  return {
    enter(info) {
      inRoom = true; joinedAt = Date.now();
      onDisconnect(infoRef).remove().catch(warn); onDisconnect(liveRef).remove().catch(warn);
      set(infoRef, { n: info.name, c: info.color, look: JSON.stringify(info.look), ts: serverTimestamp() }).catch(warn);
      const infoQ = ref(db, base + '/info'), liveQ = ref(db, base + '/live'), chatQ = query(ref(db, base + '/chat'), limitToLast(1));
      unsub = [
        onChildAdded(infoQ, (s) => { if (s.key !== uid) net.join(s.key, parse(s)); }, warn),
        onChildRemoved(infoQ, (s) => net.leave(s.key)),
        onChildAdded(liveQ, (s) => { if (s.key !== uid) net.state(s.key, s.val()); }, warn),
        onChildChanged(liveQ, (s) => { if (s.key !== uid) net.state(s.key, s.val()); }),
        onChildAdded(chatQ, (s) => { const m = s.val(); if (m && m.u !== uid && (m.ts || 0) > joinedAt - 2000) net.chatIn(m.u, m.t); }, warn)
      ];
    },
    exit() {
      inRoom = false; unsub.forEach((off) => off()); unsub = [];
      remove(infoRef).catch(warn); remove(liveRef).catch(warn);
      onDisconnect(infoRef).cancel().catch(warn); onDisconnect(liveRef).cancel().catch(warn);
    },
    send(state) { if (inRoom) set(liveRef, state).catch(warn); },
    chat(text) { if (inRoom) push(ref(db, base + '/chat'), { u: uid, t: text, ts: serverTimestamp() }).catch(warn); }
  };
}
