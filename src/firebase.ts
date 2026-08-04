import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, getFirestore, disableNetwork, enableNetwork } from 'firebase/firestore';

// This file will be created by the set_up_firebase tool
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
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

