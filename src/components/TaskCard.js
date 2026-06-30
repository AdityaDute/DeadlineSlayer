"use client";

import React, { useState } from "react";
import styles from "./TaskCard.module.css";
import { sanitizeForJSON } from "@/lib/utils";
import { 
  CheckCircle, 
  Circle, 
  Play, 
  ShieldCheck, 
  Trash2, 
  Clock, 
  Cpu, 
  Sparkles, 
  Loader 
} from "lucide-react";

export default function TaskCard({ 
  task, 
  goal = {},
  onToggleStatus, 
  onExecute, 
  isExecuting,
  onDelete,
  onExecutorResult
}) {
  const { id, name, description, priority, estimate, agent, status, aiOutput, deadline } = task;
  const isCompleted = status === "Completed";
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper to calculate remaining time
  const getTimeRemaining = (dl) => {
    if (!dl) return null;
    const now = new Date();
    const end = new Date(dl);
    const diff = end - now;
    
    if (diff < 0) return { text: 'OVERDUE', color: '#EF4444', urgent: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 6) return { text: `${hours}h left`, color: '#EF4444', urgent: true };
    if (hours < 24) return { text: `${hours}h left`, color: '#EF4444', urgent: false };
    if (days < 3) return { text: `${days}d ${hours % 24}h left`, color: '#F59E0B', urgent: false };
    return { text: `${days} days left`, color: '#10B981', urgent: false };
  };

  // Determine priority color class
  const getPriorityClass = () => {
    switch (priority) {
      case "Urgent-Important": return styles.priorityUrgentImportant;
      case "Important-Not-Urgent": return styles.priorityImportantNotUrgent;
      case "Urgent-Not-Important": return styles.priorityUrgentNotImportant;
      case "Not-Urgent-Not-Important": return styles.priorityNotUrgentNotImportant;
      default: return "";
    }
  };

  const handleGetAIHelp = async (e) => {
    e.stopPropagation();
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizeForJSON({
          agentName: "executor",
          task: task,
          goal: goal || {},
          uid: task.userId || ""
        }))
      });

      if (!response.ok) {
        throw new Error("Failed to generate AI product");
      }

      const result = await response.json();
      if (onExecutorResult) {
        onExecutorResult({ ...result, taskId: id });
      }
    } catch (err) {
      console.error("AI Help compilation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div 
      className={`${styles.card} ${isCompleted ? styles.completedCard : ""} ${isExecuting ? styles.executingCard : ""}`}
      id={`task-card-${id}`}
    >
      {/* Checkbox Trigger */}
      <button 
        onClick={() => onToggleStatus(id)} 
        className={styles.checkBtn}
        id={`toggle-task-btn-${id}`}
      >
        {isCompleted ? (
          <CheckCircle size={18} className={styles.checkedIcon} />
        ) : (
          <Circle size={18} className={styles.uncheckedIcon} />
        )}
      </button>

      {/* Task Info Body */}
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h4 className={`${styles.title} ${isCompleted ? styles.completedText : ""}`}>{name}</h4>
          <div className={styles.badges}>
            {aiOutput && (
              <span className={styles.aiDraftIndicator} id={`ai-draft-badge-${id}`}>
                <Sparkles size={10} />
                <span>DRAFT READY</span>
              </span>
            )}
            <span className={`${styles.badge} ${getPriorityClass()}`}>{priority}</span>
            <span className={styles.agentBadge}>
              <Cpu size={10} />
              <span>{agent}</span>
            </span>
          </div>
        </div>
        <p className={`${styles.desc} ${isCompleted ? styles.completedText : ""}`}>{description}</p>
        
        {/* Task Footer Meta */}
        <div className={styles.footer}>
          <div className={styles.metaRow}>
            <div className={styles.metaItem}>
              <Clock size={12} />
              <span>{estimate} mins</span>
            </div>
            {deadline && (
              (() => {
                const timeInfo = getTimeRemaining(deadline);
                if (!timeInfo) return null;
                return (
                  <div 
                    className={styles.metaItem} 
                    style={{ 
                      color: timeInfo.color, 
                      fontSize: '11px', 
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Clock size={12} className={timeInfo.urgent ? "urgent-pulse" : ""} />
                    <span className={timeInfo.urgent ? "urgent-pulse" : ""} style={{ fontWeight: timeInfo.urgent ? "700" : "500" }}>
                      {timeInfo.text}
                    </span>
                  </div>
                );
              })()
            )}
          </div>

          <div className={styles.actions}>
            <button 
              onClick={() => onDelete(id)} 
              className={styles.deleteBtn}
              id={`delete-task-btn-${id}`}
            >
              <Trash2 size={13} />
            </button>

            {/* AI Help Trigger */}
            {!isCompleted && (
              <button
                onClick={handleGetAIHelp}
                disabled={isGenerating}
                className={`${styles.aiHelpBtn} ${isGenerating ? styles.aiGenerating : ""}`}
                id={`ai-help-btn-${id}`}
              >
                {isGenerating ? (
                  <>
                    <Loader size={12} className={styles.spin} />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Get AI Help</span>
                  </>
                )}
              </button>
            )}

            {!isCompleted ? (
              <button 
                onClick={() => onExecute(task)}
                disabled={isExecuting}
                className={`${styles.executeBtn} ${isExecuting ? styles.executing : ""}`}
                id={`execute-task-btn-${id}`}
              >
                {isExecuting ? (
                  <>
                    <div className={styles.miniSpinner} />
                    <span>EXECUTING...</span>
                  </>
                ) : (
                  <>
                    <Play size={10} style={{ fill: "currentColor" }} />
                    <span>EXECUTE TASK</span>
                  </>
                )}
              </button>
            ) : (
              <span className={styles.slainIndicator}>
                <ShieldCheck size={12} />
                <span>SLAIN</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
