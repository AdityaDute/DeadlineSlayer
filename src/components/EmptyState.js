"use client";

import React from "react";
import styles from "./EmptyState.module.css";
import { Sparkles, Terminal, Flame, ShieldCheck } from "lucide-react";

export default function EmptyState({ onSelectSuggestion }) {
  const suggestions = [
    {
      text: "Help me study for my math exam and draft review notes",
      icon: <Flame size={14} className={styles.flameColor} />,
      label: "STUDY PLAN"
    },
    {
      text: "Help me plan my project and launch my SaaS landing page",
      icon: <Terminal size={14} className={styles.terminalColor} />,
      label: "PROJECT PLAN"
    },
    {
      text: "Analyze and organize my upcoming sprint backlog",
      icon: <ShieldCheck size={14} className={styles.shieldColor} />,
      label: "SPRINT BACKLOG"
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.iconCircle}>
        <Sparkles size={24} className={styles.glowIcon} />
      </div>
      <h3 className={styles.title}>All Tasks Completed!</h3>
      <p className={styles.description}>
        There are currently no active tasks. Enter an instruction below to command the <strong>AI Agent</strong>, or select a preset to begin:
      </p>
      
      <div className={styles.suggestionsGrid}>
        {suggestions.map((s, idx) => (
          <button 
            key={idx}
            onClick={() => onSelectSuggestion(s.text)}
            className={styles.suggestionCard}
          >
            <div className={styles.suggestionHeader}>
              {s.icon}
              <span className={styles.suggestionLabel}>{s.label}</span>
            </div>
            <p className={styles.suggestionText}>&ldquo;{s.text}&rdquo;</p>
          </button>
        ))}
      </div>
    </div>
  );
}
