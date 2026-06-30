"use client";

import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export function useTasks(uid) {
  // Initialize states with defaults to avoid synchronous setters in useEffect
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(!!uid);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const colRef = collection(db, "users", uid, "tasks");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const taskList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTasks(taskList);
        setLoading(false);
      },
      (error) => {
        console.error("Error listing real-time tasks:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { tasks, loading };
}
