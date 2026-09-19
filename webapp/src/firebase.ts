import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyCthlB5ULzizA0pBq17Ee_YWxtTIitvjKI',
  authDomain: 'pallonetti-fi.firebaseapp.com',
  projectId: 'pallonetti-fi',
  storageBucket: 'pallonetti-fi.firebasestorage.app',
  messagingSenderId: '982192735469',
  appId: '1:982192735469:web:dec18ac92a741e5bffb8e4',
  measurementId: 'G-L80JJ9V5YE',
};

const app = initializeApp(firebaseConfig);

let analytics: Analytics | null = null;
try {
  analytics = getAnalytics(app);
} catch {
  // Analytics ei käytettävissä esim. ad-blockerin takia
}

export { analytics, logEvent };
