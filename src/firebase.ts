import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from 'firebase/firestore';

// This file will be created by the set_up_firebase tool
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Handle IndexedDB quota or iframe restrictions gracefully
let localCacheConfig;
try {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  if (isIframe) {
    localCacheConfig = memoryLocalCache();
  } else {
    localCacheConfig = persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    });
  }
} catch (e) {
  localCacheConfig = memoryLocalCache();
}

export const db = initializeFirestore(app, {
  localCache: localCacheConfig
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
