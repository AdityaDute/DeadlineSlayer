import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";

/**
 * Creates a new goal for a user
 */
export async function createGoal(uid, goalData) {
  try {
    const colRef = collection(db, "users", uid, "goals");
    const docRef = await addDoc(colRef, {
      name: goalData.name,
      deadline: goalData.deadline,
      status: goalData.status || "active",
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error in createGoal:", error);
    throw error;
  }
}

/**
 * Retrieves all goals for a user
 */
export async function getGoals(uid) {
  try {
    const colRef = collection(db, "users", uid, "goals");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error in getGoals:", error);
    throw error;
  }
}

/**
 * Creates a new task under a user
 */
export async function createTask(uid, taskData) {
  try {
    const colRef = collection(db, "users", uid, "tasks");
    const docRef = await addDoc(colRef, {
      title: taskData.title,
      description: taskData.description || "",
      goalId: taskData.goalId || "",
      priority: taskData.priority || "Medium", // High, Medium, Low
      status: taskData.status || "Pending", // Pending, Completed, Blocked
      deadline: taskData.deadline,
      estimatedHours: taskData.estimatedHours || 1,
      completedAt: null,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error in createTask:", error);
    throw error;
  }
}

/**
 * Retrieves all tasks for a user
 */
export async function getTasks(uid) {
  try {
    const colRef = collection(db, "users", uid, "tasks");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error in getTasks:", error);
    throw error;
  }
}

/**
 * Updates an existing task
 */
export async function updateTask(uid, taskId, updates) {
  try {
    const docRef = doc(db, "users", uid, "tasks", taskId);
    const dataToUpdate = { ...updates };
    if (updates.status === "Completed") {
      dataToUpdate.completedAt = new Date().toISOString();
    } else if (updates.status === "Pending") {
      dataToUpdate.completedAt = null;
    }
    await updateDoc(docRef, dataToUpdate);
  } catch (error) {
    console.error("Error in updateTask:", error);
    throw error;
  }
}

/**
 * Deletes a task
 */
export async function deleteTask(uid, taskId) {
  try {
    const docRef = doc(db, "users", uid, "tasks", taskId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error in deleteTask:", error);
    throw error;
  }
}

/**
 * Logs an action taken by an AI agent
 */
export async function logAgentAction(uid, agentName, action, input, output) {
  try {
    const colRef = collection(db, "users", uid, "agentLogs");
    await addDoc(colRef, {
      agentName,
      action,
      input: typeof input === "object" ? JSON.stringify(input) : input || "",
      output: typeof output === "object" ? JSON.stringify(output) : output || "",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Error logging agent action:", error);
  }
}
