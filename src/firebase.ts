import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, disableNetwork, enableNetwork } from 'firebase/firestore';

// This file will be created by the set_up_firebase tool
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Handle IndexedDB quota or iframe restrictions gracefully
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

export const disableFirestore = async () => {
  try {
    await disableNetwork(db);
    console.log('Firestore network disabled successfully');
  } catch (error) {
    console.error('Error disabling Firestore network:', error);
  }
};

export const enableFirestore = async () => {
  try {
    await enableNetwork(db);
    console.log('Firestore network enabled successfully');
  } catch (error) {
    console.error('Error enabling Firestore network:', error);
  }
};

