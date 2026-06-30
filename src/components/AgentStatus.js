"use client";

import React, { useEffect, useRef } from "react";
import styles from "./AgentStatus.module.css";
import { Cpu, Terminal, Sparkles, Activity, ShieldAlert, Heart } from "lucide-react";

export default function AgentStatus({ 
  activeAgent = "Orchestrator", 
  agentStates = {}, 
  agentLogs = []
}) {
  const terminalEndRef = useRef(null);

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentLogs]);

  // Agent descriptions and capabilities
  const agentDetails = {
    Orchestrator: {
      name: "AI Orchestrator",
      icon: Cpu,
      accent: "var(--accent-purple)",
      desc: "The master router. Classifies goals, monitors intent channels, and delegates agent loops."
    },
    Planner: {
      name: "AI Planner",
      icon: Terminal,
      accent: "var(--accent-blue)",
      desc: "Deconstructs vague commitments into highly granular, tactical workspace checklists."
    },
    Prioritizer: {
      name: "AI Prioritizer",
      icon: Sparkles,
      accent: "var(--warning)",
      desc: "Scores tasks 0-100 and aligns them into optimal Eisenhower matrix quadrants."
    },
    Executor: {
      name: "AI Executor",
      icon: Activity,
      accent: "var(--accent-purple)",
      desc: "Produces real-world drafts, study reviews, presentation outlines, and code segments."
    },
    Guardian: {
      name: "Deadline Guardian",
      icon: ShieldAlert,
      accent: "var(--danger)",
      desc: "Continuous watchdog. Calculates progress trends and launches panic mode rescues if needed."
    }
  };

  const current = agentDetails[activeAgent] || agentDetails.Orchestrator;
  const CurrentIcon = current.icon;
  const activeState = agentStates[activeAgent] || "Idle";

  return (
    <div className={styles.container} id="agent-status-panel">
      {/* Active Agent Info Bar */}
      <div className={styles.header} id="agent-status-header">
        <div className={styles.agentMeta}>
          <div className={styles.iconContainer} style={{ background: current.accent }}>
            <CurrentIcon size={18} style={{ color: "#ffffff" }} />
          </div>
          <div>
            <div className={styles.agentTitleRow}>
              <h3 className={styles.agentName}>{current.name}</h3>
              <span className={`${styles.badge} ${
                activeState === "Panicked" ? styles.badgePanic :
                activeState !== "Idle" ? styles.badgeActive : ""
              }`}>
                {activeState}
              </span>
            </div>
            <p className={styles.agentDesc}>{current.desc}</p>
          </div>
        </div>
      </div>

      {/* Terminal log panel */}
      <div className={styles.terminalContainer} id="agent-terminal">
        <div className={styles.terminalHeader}>
          <div className={styles.terminalDots}>
            <span className={styles.termDot} style={{ background: "#EF4444" }} />
            <span className={styles.termDot} style={{ background: "#F59E0B" }} />
            <span className={styles.termDot} style={{ background: "#10B981" }} />
          </div>
          <div className={styles.terminalTitle}>
            <Terminal size={12} />
            <span>AGENT_CORES://{activeAgent.toUpperCase().replace(/\s+/g, "_")}</span>
          </div>
          <span className={styles.terminalEncoding}>UTF-8</span>
        </div>

        <div className={styles.terminalBody}>
          {agentLogs.length === 0 ? (
            <div className={styles.emptyLogs}>
              <span className={styles.prompt}>$</span>
              <span className={styles.cursor}> Listening to micro-agent broadcast frequencies...</span>
            </div>
          ) : (
            agentLogs.map((log, index) => (
              <div key={index} className={styles.logLine} id={`log-line-${index}`}>
                <span className={styles.prompt}>$</span>
                <span className={styles.logContent}>{log}</span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
