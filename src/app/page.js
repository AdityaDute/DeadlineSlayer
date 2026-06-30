"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import styles from "./page.module.css";
import { Shield, Sparkles, Flame, CheckSquare, BrainCircuit, Terminal, ArrowRight } from "lucide-react";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function Home() {
  const { user, loading, signInWithGoogle, signInGuest } = useAuth();
  const router = useRouter();
  const showToast = useToast();

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      showToast("Access granted. Initializing neural bridge...", "success");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/popup-closed-by-user" || err.message?.includes("closed")) {
        showToast("Sign-in popup closed. Try again or use Secure Guest Access.", "warning");
      } else {
        showToast("Neural link failed. Verification error.", "error");
      }
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInGuest();
      showToast("Guest access granted. Booting local sandbox runway...", "success");
    } catch (err) {
      console.error(err);
      showToast("Guest link failed. Re-verifying fallback protocols.", "error");
    }
  };

  if (loading || user) {
    return (
      <div className={styles.loaderContainer}>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <main className={styles.mainContainer} id="landing-main">
      {/* Background Grid */}
      <div className={styles.gridOverlay}></div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoGroup}>
          <Flame className={styles.logoIcon} />
          <span className={styles.logoText}>DEADLINE<span>SLAYER</span></span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.guestLoginBtn} onClick={handleGuestLogin}>
            GUEST ACCESS
          </button>
          <button className={styles.loginBtn} onClick={handleLogin}>
            SECURE LOG IN
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.badge}>
          <Sparkles size={12} className={styles.badgeIcon} />
          <span>RUNWAY DEFENSE TERMINAL v2.4</span>
        </div>

        <h1 className={styles.title}>
          Slay Your Deadlines <br />
          With <span>Autonomous AI Agents</span>
        </h1>

        <p className={styles.subtitle} id="hero-subtitle">
          The autonomous multi-agent productivity defense network. Command your Orchestrator, Executor, 
          and Guardian as they analyze critical bottlenecks, auto-draft deliverables, and safeguard your runway in real-time.
        </p>

        <div className={styles.ctaGroup}>
          <button className={styles.primaryCta} onClick={handleLogin}>
            SLAY RUNWAY (GOOGLE)
            <ArrowRight size={18} />
          </button>
          <button className={styles.secondaryCta} onClick={handleGuestLogin}>
            ENTER GUEST TERMINAL
          </button>
        </div>
      </section>

      {/* Agent Pillars Section */}
      <section className={styles.agentSection}>
        <h2 className={styles.sectionTitle}>THE NEURAL RESCUE TEAM</h2>
        
        <div className={styles.agentGrid}>
          {/* Orchestrator */}
          <div className={styles.agentCard} id="agent-orchestrator">
            <div className={`${styles.agentIconWrapper} ${styles.orchestratorColor}`}>
              <BrainCircuit size={24} />
            </div>
            <h3 className={styles.agentName}>AI Orchestrator</h3>
            <p className={styles.agentRole}>STRATEGIC INTENT ENGINE</p>
            <p className={styles.agentDesc}>
              Intercepts panic prompts, computes work paths, and schedules subtasks in parallel queues.
            </p>
          </div>

          {/* Executor */}
          <div className={styles.agentCard} id="agent-executor">
            <div className={`${styles.agentIconWrapper} ${styles.executorColor}`}>
              <Terminal size={24} />
            </div>
            <h3 className={styles.agentName}>AI Executor</h3>
            <p className={styles.agentRole}>RUNWAY COMPILATION CONTROLLER</p>
            <p className={styles.agentDesc}>
              Assembles code templates, executes draft tasks, and populates your workspace streams.
            </p>
          </div>

          {/* Guardian */}
          <div className={styles.agentCard} id="agent-guardian">
            <div className={`${styles.agentIconWrapper} ${styles.guardianColor}`}>
              <Shield size={24} />
            </div>
            <h3 className={styles.agentName}>AI Guardian</h3>
            <p className={styles.agentRole}>THREAT MITIGATION AUDITOR</p>
            <p className={styles.agentDesc}>
              Evaluates risk vectors, checks work safety profiles, and stops failure cascades in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>Built by <span style={{ color: "var(--accent-blue)", fontWeight: "600" }}>Aditya Dute</span> · Powered by Google Gemini AI</p>
        <p style={{ marginTop: "0.25rem", opacity: 0.6 }}>Vibe2Ship Hackathon 2026</p>
      </footer>
    </main>
  );
}
