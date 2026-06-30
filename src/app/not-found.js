import React from "react";
import Link from "next/link";
import { Flame, ShieldAlert, ArrowLeft } from "lucide-react";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.container} id="notfound-main">
      <div className={styles.gridOverlay}></div>
      
      <div className={styles.card} id="notfound-card">
        <div className={styles.iconWrapper}>
          <ShieldAlert className={styles.icon} size={48} />
        </div>
        
        <h1 className={styles.title}>404 - SECTOR NOT FOUND</h1>
        <p className={styles.subtitle}>
          The agent coordinates you requested are outside the defense perimeter. 
          Your runway cannot be defended at this location.
        </p>
        
        <Link href="/" className={styles.button} id="notfound-back-link">
          <ArrowLeft size={18} />
          RETURN TO HOME BASE
        </Link>
      </div>

      <footer className={styles.footer}>
        <div className={styles.logoGroup}>
          <Flame className={styles.logoIcon} />
          <span className={styles.logoText}>DEADLINE<span>SLAYER</span></span>
        </div>
      </footer>
    </main>
  );
}
