"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import styles from "./Toast.module.css";
import { X, CheckCircle, AlertTriangle, Info, ShieldAlert } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    
    // Defer state update to next tick to avoid "Cannot update a component while rendering a different component"
    setTimeout(() => {
      setToasts((prev) => [...prev, { id, message, type }]);
    }, 0);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case "success": return <CheckCircle size={18} className={styles.successIcon} />;
      case "error": return <ShieldAlert size={18} className={styles.errorIcon} />;
      case "warning": return <AlertTriangle size={18} className={styles.warningIcon} />;
      default: return <Info size={18} className={styles.infoIcon} />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            <span className={styles.icon}>{getIcon(toast.type)}</span>
            <span className={styles.message}>{toast.message}</span>
            <button className={styles.closeBtn} onClick={() => removeToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.showToast;
}
