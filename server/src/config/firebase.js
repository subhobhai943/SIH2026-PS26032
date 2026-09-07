import admin from 'firebase-admin';
import { env } from './env.js';

let firebaseApp = null;

/**
 * Initialise Firebase Admin SDK.
 *
 * In production, provide a service-account JSON via FIREBASE_SERVICE_ACCOUNT_KEY
 * (the entire JSON string) or set GOOGLE_APPLICATION_CREDENTIALS to its file path.
 *
 * If neither is set, the SDK falls back to Application Default Credentials
 * (works on GCP, or locally with `gcloud auth application-default login`).
 */
export function initFirebase() {
  if (firebaseApp) return firebaseApp;

  const projectId = env.firebase.projectId;
  if (!projectId) {
    console.warn('[firebase] FIREBASE_PROJECT_ID not set — Firebase phone auth token verification disabled');
    return null;
  }

  try {
    const serviceAccountKey = env.firebase.serviceAccountKey;

    if (serviceAccountKey) {
      const serviceAccount = typeof serviceAccountKey === 'string' && serviceAccountKey.trim().startsWith('{')
        ? JSON.parse(serviceAccountKey)
        : serviceAccountKey;
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else {
      // Firebase Admin can verify ID tokens against Google's public keys with just projectId
      firebaseApp = admin.initializeApp({
        projectId,
      });
    }

    console.log(`[firebase] admin SDK initialised (project: ${projectId})`);
    return firebaseApp;
  } catch (err) {
    console.error(`[firebase] init failed: ${err.message}`);
    return null;
  }
}

/**
 * Verifies a Firebase ID token and extracts the phone number.
 * @param {string} idToken - Firebase ID token from the client
 * @returns {{ uid: string, phone: string }} - Firebase UID and phone
 */
export async function verifyFirebaseToken(idToken) {
  if (!firebaseApp) {
    initFirebase();
  }
  if (!firebaseApp) {
    throw new Error('Firebase is not configured on the server (FIREBASE_PROJECT_ID missing)');
  }

  const decoded = await admin.auth().verifyIdToken(idToken);

  if (!decoded.phone_number) {
    throw new Error('Token does not contain a verified phone number');
  }

  // Normalise: Firebase returns +91XXXXXXXXXX or +..., we store the 10-digit mobile number for Indian numbers
  let phone = decoded.phone_number;
  if (phone.startsWith('+91')) {
    phone = phone.slice(3);
  } else if (phone.startsWith('+')) {
    phone = phone.slice(1);
  }

  return { uid: decoded.uid, phone };
}

/**
 * Verifies a Firebase ID token from Google Sign-In and extracts profile details.
 * @param {string} idToken - Firebase ID token from the client
 * @returns {Promise<{ uid: string, email: string|null, name: string, picture: string, phone: string|null }>}
 */
export async function verifyFirebaseGoogleToken(idToken) {
  if (!firebaseApp) {
    initFirebase();
  }
  if (!firebaseApp) {
    throw new Error('Firebase is not configured on the server (FIREBASE_PROJECT_ID missing)');
  }

  const decoded = await admin.auth().verifyIdToken(idToken);

  let phone = decoded.phone_number || null;
  if (phone) {
    if (phone.startsWith('+91')) {
      phone = phone.slice(3);
    } else if (phone.startsWith('+')) {
      phone = phone.slice(1);
    }
  }

  return {
    uid: decoded.uid,
    email: decoded.email ? decoded.email.toLowerCase().trim() : null,
    name: decoded.name || '',
    picture: decoded.picture || '',
    phone,
  };
}
