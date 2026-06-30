"use client";

import React from "react";
import styles from "./LoadingSkeleton.module.css";
import { Flame } from "lucide-react";

export default function LoadingSkeleton() {
  return (
    <div className={styles.skeletonContainer}>
      <div className={styles.logoGroup}>
        <Flame className={styles.logoIcon} />
        <span className={styles.logoText}>DEADLINE<span>SLAYER</span></span>
      </div>
      <div className={styles.progressBarWrapper}>
        <div className={styles.progressBar}></div>
      </div>
      <p className={styles.loadingText}>BOOTING NEURAL RUNWAY ENGINE...</p>
    </div>
  );
}
