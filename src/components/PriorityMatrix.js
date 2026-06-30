"use client";

import React, { useState } from "react";
import styles from "./PriorityMatrix.module.css";
import { Sparkles, Calendar, Clock, Cpu, Play, CheckCircle, HelpCircle } from "lucide-react";

export default function PriorityMatrix({ 
  tasks = [], 
  onTaskClick,
  onSelectTask,
  onPrioritizeAll,
  isPrioritizing
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Helper to determine deadline proximity color
  const getDeadlineProximity = (task) => {
    let targetDate = null;
    if (task.dueDate) {
      targetDate = new Date(task.dueDate);
    } else if (task.deadline) {
      targetDate = new Date(task.deadline);
    } else if (task.createdAt) {
      // Deterministic fallback based on task ID
      const base = new Date(task.createdAt);
      const idHash = task.id ? task.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 5;
      const daysOffset = (idHash % 4) + 1; // 1 to 4 days
      base.setDate(base.getDate() + daysOffset);
      targetDate = base;
    } else {
      return "green";
    }

    const diffMs = targetDate - new Date();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 1) {
      return "red";
    } else if (diffDays >= 1 && diffDays <= 3) {
      return "yellow";
    } else {
      return "green";
    }
  };

  const truncateText = (text, max = 30) => {
    if (!text) return "";
    return text.length > max ? text.substring(0, max) + "..." : text;
  };

  // Determine quadrant from priority
  const quadrants = [
    {
      id: "Urgent-Important",
      title: "🔥 DO FIRST",
      subtitle: "Urgent & Important",
      class: styles.doFirst,
      dotClass: styles.dotRed,
      tasks: tasks.filter(t => t.priority === "Urgent-Important" || t.quadrant === "Urgent-Important")
    },
    {
      id: "Important-Not-Urgent",
      title: "📅 SCHEDULE",
      subtitle: "Important, Not Urgent",
      class: styles.schedule,
      dotClass: styles.dotBlue,
      tasks: tasks.filter(t => t.priority === "Important-Not-Urgent" || t.quadrant === "Important-Not-Urgent")
    },
    {
      id: "Urgent-Not-Important",
      title: "👥 DELEGATE",
      subtitle: "Urgent, Not Important",
      class: styles.delegate,
      dotClass: styles.dotWarning,
      tasks: tasks.filter(t => t.priority === "Urgent-Not-Important" || t.quadrant === "Urgent-Not-Important")
    },
    {
      id: "Not-Urgent-Not-Important",
      title: "🗑️ MINIMIZE",
      subtitle: "Neither Urgent nor Important",
      class: styles.minimize,
      dotClass: styles.dotMuted,
      tasks: tasks.filter(t => t.priority === "Not-Urgent-Not-Important" || t.priority === "Eliminate" || t.quadrant === "Not-Urgent-Not-Important" || t.quadrant === "Eliminate")
    }
  ];

  const handlePillClick = (task, e) => {
    e.stopPropagation();
    setSelectedTaskId(selectedTaskId === task.id ? null : task.id);
    
    if (onTaskClick) {
      onTaskClick(task);
    }
    // Highlight or scroll to TaskCard below
    const cardEl = document.getElementById(`task-card-${task.id}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      cardEl.classList.add(styles.temporaryHighlight);
      setTimeout(() => {
        cardEl.classList.remove(styles.temporaryHighlight);
      }, 1500);
    }
  };

  const handleExecutePill = (task, e) => {
    e.stopPropagation();
    if (onSelectTask) {
      onSelectTask(task);
    }
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <div className={styles.matrixContainer} id="priority-matrix-section">
      <div className={styles.matrixHeader} id="matrix-header">
        <div className={styles.matrixTitleGroup}>
          <h2 className={styles.matrixTitle}>📊 Priority Matrix</h2>
          <p className={styles.matrixSubtitle}>Dynamic Eisenhower workspace mapping threat urgency against yield priority.</p>
        </div>
        
        {onPrioritizeAll && (
          <button 
            onClick={onPrioritizeAll}
            disabled={isPrioritizing || tasks.length === 0}
            className={`${styles.prioritizeBtn} glow-btn`}
            id="auto-prioritize-btn"
          >
            <Sparkles size={13} className={isPrioritizing ? styles.spin : ""} />
            <span>{isPrioritizing ? "RANKING..." : "AUTO-PRIORITIZE"}</span>
          </button>
        )}
      </div>

      <div className={styles.matrixGrid} id="matrix-2x2-grid">
        {quadrants.map((quad) => (
          <div 
            key={quad.id} 
            className={`${styles.quadrant} ${quad.class}`} 
            id={`quadrant-${quad.id.toLowerCase()}`}
          >
            <div className={styles.quadrantHeader}>
              <h3 className={styles.quadTitle}>{quad.title}</h3>
              <span className={`${styles.taskBadge} ${quad.dotClass}`}>{quad.tasks.length}</span>
            </div>

            <div className={styles.taskList}>
              {quad.tasks.length === 0 ? (
                <div className={styles.emptyState}>No tasks here</div>
              ) : (
                <div className={styles.pillsWrapper}>
                  {quad.tasks.map((task) => {
                    const proximity = getDeadlineProximity(task);
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <div 
                        key={task.id} 
                        onClick={(e) => handlePillClick(task, e)}
                        className={`${styles.taskPill} ${isSelected ? styles.selectedPill : ""} ${task.status === "Completed" ? styles.completedPill : ""}`}
                        id={`matrix-task-pill-${task.id}`}
                      >
                        <span className={`${styles.statusDot} ${styles[proximity]}`} />
                        <span className={styles.pillText}>{truncateText(task.name, 28)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Tooltip / Detail Drawer for selected task */}
      {selectedTask && (
        <div className={styles.detailDrawer} id="matrix-task-tooltip">
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitleRow}>
              <h4 className={styles.drawerTitle}>{selectedTask.name}</h4>
              <span className={styles.drawerPriority}>{selectedTask.priority}</span>
            </div>
            <button onClick={() => setSelectedTaskId(null)} className={styles.drawerClose}>✕</button>
          </div>
          <p className={styles.drawerDesc}>{selectedTask.description || "No description provided."}</p>
          <div className={styles.drawerMetaRow}>
            <div className={styles.drawerMetaItem}>
              <Clock size={12} />
              <span>{selectedTask.estimate} mins</span>
            </div>
            <div className={styles.drawerMetaItem}>
              <Cpu size={12} />
              <span>{selectedTask.agent} Agent</span>
            </div>
            {selectedTask.status !== "Completed" && onSelectTask && (
              <button 
                onClick={(e) => handleExecutePill(selectedTask, e)}
                className={styles.drawerExecuteBtn}
              >
                <Play size={10} style={{ fill: "currentColor" }} />
                <span>EXECUTE NOW</span>
              </button>
            )}
            {selectedTask.status === "Completed" && (
              <span className={styles.drawerSlain}>
                <CheckCircle size={12} />
                <span>SLAIN</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
