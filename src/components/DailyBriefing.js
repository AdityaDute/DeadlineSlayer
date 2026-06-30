"use client";

import React from "react";
import styles from "./DailyBriefing.module.css";
import { Play, X } from "lucide-react";

export default function DailyBriefing({ briefing, onDismiss, onStartUrgent }) {
  if (!briefing) return null;

  const { greeting, summary, urgentTask, mood, recommendedAction } = briefing;

  // Map mood to emoji
  const moodEmoji = {
    crushing_it: "🚀",
    on_track: "✅",
    falling_behind: "⚠️",
    critical: "🚨"
  }[mood] || "🎯";

  // Map mood to appropriate border class
  const borderClass = styles[`moodBorder_${mood}`] || styles.moodBorder_on_track;

  return (
    <div className={`${styles.card} ${borderClass}`} id="daily-briefing-card">
      {/* Dismiss Button */}
      <button 
        className={styles.dismissBtn} 
        onClick={onDismiss} 
        title="Dismiss daily briefing for this session"
        aria-label="Dismiss briefing"
      >
        <X size={16} />
      </button>

      <div className={styles.contentWrapper}>
        {/* Left Side: Large Emoji */}
        <div className={styles.emojiContainer}>
          {moodEmoji}
        </div>

        {/* Right Side: Text & Greeting */}
        <div className={styles.textBlock}>
          <div className={styles.greeting}>{greeting}</div>
          <p className={styles.summary}>{summary}</p>
        </div>
      </div>

      {/* Footer: Recommended Action & Button */}
      <div className={styles.footer}>
        <div className={styles.recommendationBox}>
          <span className={styles.recLabel}>Recommended:</span>
          <span className={styles.recAction}>{recommendedAction}</span>
        </div>

        {urgentTask && (
          <button 
            type="button" 
            className={styles.startBtn} 
            onClick={() => onStartUrgent(urgentTask)}
            title={`Locate and activate: ${urgentTask}`}
          >
            <Play size={12} fill="currentColor" />
            Start This
          </button>
        )}
      </div>
    </div>
  );
}
