"use client";

import React, { useState, useEffect } from "react";
import styles from "./PhotoUpload.module.css";
import { Sparkles, Calendar, Brain, Edit3, Check, X, ShieldAlert } from "lucide-react";

export default function PhotoUpload({ imageSrc, onDismiss, onAddAllTasks }) {
  const [isLoading, setIsLoading] = useState(true);
  const [extractedData, setExtractedData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedGoals, setEditedGoals] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!imageSrc) return;

    let isSubscribed = true;
    const analyzeImage = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageSrc })
        });

        if (!response.ok) {
          throw new Error(`Vision service failed: Status ${response.status}`);
        }

        const data = await response.json();
        if (!isSubscribed) return;

        if (data.error) {
          throw new Error(data.error);
        }

        setExtractedData(data);
        // Pre-populate edited goals
        const formattedGoals = (data.extractedGoals || []).map((goal) => ({
          ...goal,
          deadline: goal.deadline || "",
          subtasks: (goal.subtasks || []).map((task) => ({
            ...task,
            selected: true // selected by default
          }))
        }));
        setEditedGoals(formattedGoals);
      } catch (err) {
        console.error("Analysis failed:", err);
        if (isSubscribed) {
          setError(err.message || "Failed to parse target assets from image.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    analyzeImage();

    return () => {
      isSubscribed = false;
    };
  }, [imageSrc]);

  // Handle toggle task selection
  const toggleTaskSelection = (goalIdx, taskIdx) => {
    setEditedGoals((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[goalIdx].subtasks[taskIdx].selected = !next[goalIdx].subtasks[taskIdx].selected;
      return next;
    });
  };

  // Inline edits
  const updateGoalTitle = (goalIdx, newTitle) => {
    setEditedGoals((prev) => {
      const next = [...prev];
      next[goalIdx].title = newTitle;
      return next;
    });
  };

  const updateGoalDeadline = (goalIdx, newDeadline) => {
    setEditedGoals((prev) => {
      const next = [...prev];
      next[goalIdx].deadline = newDeadline;
      return next;
    });
  };

  const updateTaskTitle = (goalIdx, taskIdx, newTitle) => {
    setEditedGoals((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[goalIdx].subtasks[taskIdx].title = newTitle;
      return next;
    });
  };

  const updateTaskCategory = (goalIdx, taskIdx, newCategory) => {
    setEditedGoals((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[goalIdx].subtasks[taskIdx].category = newCategory;
      return next;
    });
  };

  const handleAddClick = () => {
    // Filter selected tasks
    const goalsToAdd = editedGoals.map((g) => ({
      ...g,
      subtasks: g.subtasks.filter((t) => t.selected !== false)
    })).filter((g) => g.subtasks.length > 0);

    if (goalsToAdd.length === 0) {
      alert("Please select or include at least one subtask to deploy.");
      return;
    }

    onAddAllTasks(goalsToAdd);
  };

  // Get color badge based on confidence level
  const getConfidenceBadgeClass = (conf) => {
    const val = conf || 0;
    if (val >= 0.8) return `${styles.badge} ${styles.badgeHigh}`;
    if (val >= 0.5) return `${styles.badge} ${styles.badgeMedium}`;
    return `${styles.badge} ${styles.badgeLow}`;
  };

  return (
    <div className={styles.container}>
      {/* 1. Shimmer/Loading Image Container */}
      {isLoading && (
        <div className={styles.imageContainer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="Analyzing Workspace Assets" className={styles.imagePreview} />
          <div className={styles.loadingOverlay}>
            <Brain className={styles.loadingIcon} size={32} />
            <div className={styles.shimmer}></div>
            <span className={styles.loadingText}>🧠 ANALYZING IMAGE...</span>
          </div>
        </div>
      )}

      {/* 2. Error Display */}
      {!isLoading && error && (
        <div className={styles.resultsCard}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsTitle} style={{ color: "var(--danger-red)" }}>
              <ShieldAlert size={18} /> VISION EXTRACTION ERROR
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {error}
          </p>
          <div className={styles.actionsRow}>
            <button className={styles.dismissBtn} onClick={onDismiss}>DISMISS</button>
          </div>
        </div>
      )}

      {/* 3. Results Panel */}
      {!isLoading && !error && extractedData && (
        <div className={styles.resultsCard}>
          {/* Header */}
          <div className={styles.resultsHeader}>
            <span className={styles.resultsTitle}>
              📸 Found {editedGoals.length} Track{editedGoals.length !== 1 ? "s" : ""} from your {extractedData.imageType || "document"}
            </span>
            <span className={getConfidenceBadgeClass(extractedData.confidence)}>
              {Math.round((extractedData.confidence || 0.8) * 100)}% CONFIDENCE
            </span>
          </div>

          {/* Goals and subtasks items list */}
          <div className={styles.goalsList}>
            {editedGoals.map((goal, gIdx) => (
              <div key={gIdx} className={styles.goalGroup}>
                {isEditing ? (
                  <div className={styles.editGoalRow}>
                    <input 
                      type="text" 
                      value={goal.title} 
                      onChange={(e) => updateGoalTitle(gIdx, e.target.value)} 
                      className={styles.editInput}
                      placeholder="Goal Track Title"
                    />
                    <input 
                      type="date" 
                      value={goal.deadline} 
                      onChange={(e) => updateGoalDeadline(gIdx, e.target.value)} 
                      className={styles.editDateInput}
                      title="Deadline"
                    />
                  </div>
                ) : (
                  <div className={styles.goalHeader}>
                    <span className={styles.goalTitle}>{goal.title}</span>
                    {goal.deadline && (
                      <span className={styles.goalDeadline}>
                        <Calendar size={10} style={{ display: "inline", marginRight: "3px" }} />
                        {goal.deadline}
                      </span>
                    )}
                  </div>
                )}

                {/* Nested subtasks */}
                <div className={styles.subtasksList}>
                  {goal.subtasks.map((task, tIdx) => (
                    <div key={tIdx} className={styles.subtaskRow}>
                      {isEditing ? (
                        <div className={styles.editTaskRow}>
                          <input 
                            type="text" 
                            value={task.title} 
                            onChange={(e) => updateTaskTitle(gIdx, tIdx, e.target.value)} 
                            className={styles.editInput}
                            placeholder="Subtask description"
                          />
                          <select
                            value={task.category}
                            onChange={(e) => updateTaskCategory(gIdx, tIdx, e.target.value)}
                            className={styles.editSelect}
                          >
                            <option value="research">research</option>
                            <option value="writing">writing</option>
                            <option value="coding">coding</option>
                            <option value="study">study</option>
                            <option value="communication">communication</option>
                            <option value="creative">creative</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>
                      ) : (
                        <label className={styles.subtaskLabel}>
                          <input 
                            type="checkbox" 
                            checked={task.selected !== false} 
                            onChange={() => toggleTaskSelection(gIdx, tIdx)} 
                            className={styles.subtaskCheckbox}
                          />
                          <span className={styles.subtaskText}>{task.title}</span>
                          <span className={styles.subtaskMeta}>
                            {task.category || "study"} ({task.estimatedHours || 1}h)
                          </span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Action Row Buttons */}
          <div className={styles.actionsRow}>
            <button className={styles.dismissBtn} onClick={onDismiss}>
              DISMISS
            </button>
            <div className={styles.rightActions}>
              <button className={styles.editBtn} onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? (
                  <>
                    <Check size={12} /> LOCK EDITS
                  </>
                ) : (
                  <>
                    <Edit3 size={12} /> EDIT FIRST
                  </>
                )}
              </button>
              <button className={styles.addBtn} onClick={handleAddClick}>
                ✅ ADD ALL TASKS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
