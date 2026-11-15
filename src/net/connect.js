import { FIREBASE_CONFIG, ROOM } from './config.js';

// Chooses the transport: Firebase when configured, otherwise the same-browser one the game starts with.
export async function connect(net) {
  if (!net || !FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) return 'local';
  try {
    const { firebaseTransport } = await import('./firebase.js'); // loaded only when it is needed
    net.setTransport(await firebaseTransport(FIREBASE_CONFIG, net, ROOM));
    console.info('[net] connected to Firebase room "' + ROOM + '"');
    return 'firebase';
  } catch (e) {
    console.warn('[net] Firebase is not available; staying on the same-browser transport.', e);
    return 'local';
  }
}
