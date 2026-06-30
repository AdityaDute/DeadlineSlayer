"use client";

import React from "react";
import styles from "./ProcrastinationAlert.module.css";
import { AlertTriangle, Flame, ShieldAlert } from "lucide-react";

export default function ProcrastinationAlert({ procrastination, onDismiss, onBreakDown, allTasks }) {
  if (!procrastination || !procrastination.detected) return null;

  const { severity = "mild", pattern, affectedTasks = [], nudge } = procrastination;

  // Choose the visual indicator elements
  const severityClass = styles[`severity_${severity}`] || styles.severity_mild;
  const titleClass = styles[`title_${severity}`] || styles.title;
  const badgeClass = styles[`badge_${severity}`] || styles.badge_mild;

  // Icon chooser
  const getSeverityIcon = () => {
    switch (severity) {
      case "severe":
        return <ShieldAlert size={18} className="text-red-500 animate-bounce" />;
      case "moderate":
        return <AlertTriangle size={18} className="text-orange-500" />;
      default:
        return <Flame size={16} className="text-amber-500" />;
    }
  };

  // Find the first affected task object from our list so we can pass it to Break It Down
  const handleBreakDownClick = () => {
    if (!affectedTasks || affectedTasks.length === 0) return;
    
    // Attempt to locate a task object by title match
    const firstTaskTitle = affectedTasks[0];
    const matchingTask = allTasks.find(t => 
      t.name.toLowerCase() === firstTaskTitle.toLowerCase() ||
      t.name.toLowerCase().includes(firstTaskTitle.toLowerCase()) ||
      firstTaskTitle.toLowerCase().includes(t.name.toLowerCase())
    );

    // If matching task not found, build a virtual one so planner can still parse it
    const taskToPass = matchingTask || {
      id: "virtual-temp",
      name: firstTaskTitle,
      description: pattern || "Task identified with high procrastination factor."
    };

    onBreakDown(taskToPass);
  };

  return (
    <div className={`${styles.card} ${severityClass}`} id="procrastination-alert-card">
      <div className={styles.contentWrapper}>
        {/* Left Side: Large Emoji Icon */}
        <div className={styles.iconContainer}>
          🧠
        </div>

        {/* Right Side: Title, Badge, and Nudge */}
        <div className={styles.textBlock}>
          <div className={styles.titleRow}>
            <span className={`${styles.title} ${titleClass}`}>Procrastination Pattern Detected</span>
            <span className={`${styles.badge} ${badgeClass}`}>
              {severity} risk
            </span>
          </div>

          <p className={styles.nudge}>{nudge}</p>

          {/* Affected Tasks Pills */}
          {affectedTasks && affectedTasks.length > 0 && (
            <div className={styles.affectedContainer}>
              <span className={styles.affectedLabel}>Affected runway operations:</span>
              <div className={styles.pillsList}>
                {affectedTasks.map((tName, idx) => (
                  <span key={idx} className={styles.pill}>
                    {tName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Action Buttons */}
      <div className={styles.footer}>
        <button 
          type="button" 
          className={styles.dismissBtn} 
          onClick={onDismiss}
          title="Dismiss procrastination alert for this session"
        >
          🙈 Dismiss
        </button>

        {affectedTasks && affectedTasks.length > 0 && (
          <button 
            type="button" 
            className={styles.breakBtn} 
            onClick={handleBreakDownClick}
            title="Authorize the AI Planner Agent to split this stalled milestone into micro-runways"
          >
            ⚡ Break It Down
          </button>
        )}
      </div>
    </div>
  );
}
