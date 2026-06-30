"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there is a mock user in localStorage
    const savedMockUser = typeof window !== "undefined" ? localStorage.getItem("deadline_slayer_mock_user") : null;
    if (savedMockUser) {
      setUser(JSON.parse(savedMockUser));
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("deadline_slayer_mock_user");
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Auth Sign-In Error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInGuest = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("deadline_slayer_mock_user");
      await signInAnonymously(auth);
    } catch (err) {
      console.warn("Firebase Anonymous Auth failed, activating Sandbox Mock Login:", err);
      // Fallback to local sandbox mock user
      const mockUser = {
        uid: "sandbox-guest-user",
        displayName: "Sandbox Guest Operative",
        email: "guest@deadlineslayer.local",
        isAnonymous: true,
        isSandboxMock: true
      };
      localStorage.setItem("deadline_slayer_mock_user", JSON.stringify(mockUser));
      setUser(mockUser);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("deadline_slayer_mock_user");
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Auth Log-Out Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
