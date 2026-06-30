import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getFirebaseAdmin } from "./firebaseAdmin";

/**
 * Logs all agent actions into a central Firestore log trace collection.
 */
export async function logAgentAction(agentName, actionType, details = {}, uid = "system") {
  try {
    const { adminDb } = getFirebaseAdmin();
    let logged = false;
    if (adminDb) {
      try {
        await adminDb.collection("agentActions").add({
          agent: agentName,
          action: actionType,
          details: typeof details === "string" ? details : JSON.stringify(details),
          userId: uid,
          timestamp: new Date().toISOString(),
        });
        logged = true;
      } catch (adminErr) {
        console.warn("Failed to write to adminDb, trying fallback client db:", adminErr.message || adminErr);
      }
    }
    if (!logged) {
      await addDoc(collection(db, "agentActions"), {
        agent: agentName,
        action: actionType,
        details: typeof details === "string" ? details : JSON.stringify(details),
        userId: uid,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to log agent action to Firestore:", err);
  }
}
