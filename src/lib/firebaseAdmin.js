import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "../../firebase-applet-config.json";

let adminDb = null;
let adminAuth = null;
let isInitialized = false;

function getFirebaseAdmin() {
  if (isInitialized) {
    return { adminDb, adminAuth };
  }

  isInitialized = true;
  try {
    const apps = getApps();
    let app;
    const projectId = firebaseConfig.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (apps.length > 0) {
      app = apps[0];
      const databaseId = firebaseConfig.firestoreDatabaseId || "";
      adminDb = getFirestore(app, databaseId);
      adminAuth = getAuth(app);
    } else if (projectId && clientEmail && privateKey) {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
      const databaseId = firebaseConfig.firestoreDatabaseId || "";
      adminDb = getFirestore(app, databaseId);
      adminAuth = getAuth(app);
    } else {
      console.warn("Firebase Admin: Missing credentials. Bypassing Admin SDK to use client-side fallback.");
      adminDb = null;
      adminAuth = null;
    }
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
  }

  return { adminDb, adminAuth };
}

export { getFirebaseAdmin };
