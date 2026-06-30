"use client";

import React from "react";
import styles from "./GoalCard.module.css";
import { Target, CheckCircle2, Trash2 } from "lucide-react";

export default function GoalCard({ 
  goal, 
  isActive, 
  onSelect, 
  onDelete 
}) {
  const { title, description, progress = 0 } = goal;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to slay and delete "${title}"?`)) {
      onDelete(goal.id);
    }
  };

  return (
    <div 
      onClick={() => onSelect(goal.id)}
      className={`${styles.card} ${isActive ? styles.active : ""}`}
      id={`goal-card-${goal.id}`}
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Target size={16} className={styles.icon} />
          <h4 className={styles.title}>{title}</h4>
        </div>
        <button 
          onClick={handleDeleteClick} 
          className={styles.deleteBtn}
          id={`delete-goal-btn-${goal.id}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
      
      <p className={styles.desc}>{description}</p>
      
      {/* Progress Bar Group */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Burndown Progress</span>
          <span className={styles.progressVal}>{progress}%</span>
        </div>
        <div className={styles.progressBarBg}>
          <div 
            className={styles.progressBarFill} 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>
    </div>
  );
}
