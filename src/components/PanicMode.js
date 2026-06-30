"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./PanicMode.module.css";
import { 
  AlertOctagon, 
  Flame, 
  ShieldAlert, 
  Play, 
  Pause, 
  X, 
  Music, 
  CheckSquare, 
  Zap, 
  ClipboardList, 
  Mail, 
  Copy, 
  Check, 
  Loader2,
  Scissors,
  Lock,
  Sparkles
} from "lucide-react";

import { useToast } from "./Toast";
import { triggerConfetti } from "../utils/confetti";
import { sanitizeForJSON } from "@/lib/utils";

export default function PanicMode({ 
  onClose, 
  panicPlan = null,
  isGeneratingPlan = false,
  tasks = [],
  goals = [],
  activeGoalId = null,
  uid,
  onTaskCompleted,
  onDeleteTask,
  onUpdateGoalDescription,
  isFocusLock = false,
  setIsFocusLock
}) {
  const showToast = useToast();
  
  // Basic states
  const [isPlayingTimer, setIsPlayingTimer] = useState(true);
  const [audioActive, setAudioActive] = useState(false);
  const [showConfirmDismiss, setShowConfirmDismiss] = useState(false);
  const [activeQuote, setActiveQuote] = useState("");

  useEffect(() => {
    const quotes = [
      "🔥 The only way out is through. Focus is your greatest weapon — engage focus lock, slay this sprint, and secure your victory!",
      "🚀 Slay your excuses. Build your legacy. Every minute of deep work buys you freedom and peace of mind.",
      "🛡️ Focus is a muscle. Block the distractions. You have solved harder problems than this. Slay it now!",
      "⚡ Breathe. Plan. Execute. One 15-minute sprint is all it takes to build massive momentum. Start now!",
      "🏆 Runway is temporary, victory is permanent! Let's clear these milestones and execute with clean precision."
    ];
    setActiveQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);
  
  // Quick Actions States
  const [executorOutput, setExecutorOutput] = useState("");
  const [executingAction, setExecutingAction] = useState(null); // 'draft' | 'simplify' | 'extension' | 'scope_reduction'
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Audio nodes refs
  const audioContextRef = useRef(null);
  const noiseNodeRef = useRef(null);

  // Stabilize the goal selection on mount so that toggling tasks doesn't cause the active goal to dynamically switch
  const getInitialGoalId = React.useCallback(() => {
    if (panicPlan?.goalId) return panicPlan.goalId;
    if (panicPlan?.goal?.id) return panicPlan.goal.id;
    
    // Fallback to activeGoalId if we passed it
    if (activeGoalId) {
      const activeGoalHasTasks = tasks.some(t => t.goalId === activeGoalId);
      if (activeGoalHasTasks) {
        return activeGoalId;
      }
    }
    
    // Fallback to first incomplete task's goal
    const firstIncomplete = tasks.find(t => t.status !== "Completed");
    if (firstIncomplete && firstIncomplete.goalId) {
      return firstIncomplete.goalId;
    }
    
    // Ultimate fallback
    return goals[0]?.id || null;
  }, [panicPlan, activeGoalId, tasks, goals]);

  const [stableGoalId, setStableGoalId] = useState(getInitialGoalId);

  useEffect(() => {
    if (!stableGoalId && (goals.length > 0 || tasks.length > 0)) {
      const initialId = getInitialGoalId();
      if (initialId) {
        setStableGoalId(initialId);
      }
    }
  }, [goals, tasks, activeGoalId, panicPlan, stableGoalId, getInitialGoalId]);

  const atRiskGoal = React.useMemo(() => {
    return goals.find(g => g.id === stableGoalId) || goals[0] || {};
  }, [goals, stableGoalId]);

  const atRiskTask = React.useMemo(() => {
    return tasks.find(t => t.goalId === stableGoalId && t.status !== "Completed") || tasks.find(t => t.goalId === stableGoalId) || {
      id: "global-risk",
      name: "Runway Under Stress",
      description: "Unplanned deadline threats pending in system pipeline.",
      goalId: stableGoalId,
      timeRemaining: "45m"
    };
  }, [tasks, stableGoalId]);

  const incompleteSubtasks = React.useMemo(() => {
    return tasks.filter(t => t.status !== "Completed" && t.goalId === stableGoalId);
  }, [tasks, stableGoalId]);

  // Parse timeRemaining string to establish total minutes
  const parseTimeRemaining = (timeStr) => {
    if (!timeStr) return 60;
    const minutesMatch = timeStr.match(/(\d+)\s*m/i);
    if (minutesMatch) return parseInt(minutesMatch[1]);
    const hoursMatch = timeStr.match(/(\d+)\s*h/i);
    if (hoursMatch) return parseInt(hoursMatch[1]) * 60;
    return 60; // default 60 mins
  };

  // 1. SPRINT TIMER Setup
  const totalMinutes = parseTimeRemaining(panicPlan?.timeRemaining || atRiskTask?.timeRemaining);
  const sprintCount = Math.max(1, Math.ceil(totalMinutes / 15));
  
  // Create sprints array based on total minutes
  const sprints = Array.from({ length: sprintCount }).map((_, index) => {
    const assignedTask = incompleteSubtasks[index];
    return {
      id: index,
      title: `Sprint ${index + 1}`,
      duration: 15,
      deliverable: assignedTask ? assignedTask.name : "Buffer, Verification & Deploy Checks",
      taskId: assignedTask ? assignedTask.id : null,
    };
  });

  const [activeSprintIndex, setActiveSprintIndex] = useState(0);
  const [sprintTimeLeft, setSprintTimeLeft] = useState(15 * 60); // 15 mins in seconds

  // Timer countdown hook
  useEffect(() => {
    let interval = null;
    if (isPlayingTimer && sprintTimeLeft > 0) {
      interval = setInterval(() => {
        setSprintTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (sprintTimeLeft === 0) {
      playChime();
      triggerConfetti();
      
      const completedSprintNum = activeSprintIndex + 1;
      showToast(`🏆 Sprint ${completedSprintNum} complete! Deliverable achieved.`, "success");

      if (activeSprintIndex < sprints.length - 1) {
        setActiveSprintIndex((prev) => prev + 1);
        setSprintTimeLeft(15 * 60);
      } else {
        setIsPlayingTimer(false);
        showToast("🌟 All sprints completed! Outstanding deadline runway secured!", "success");
      }
    }
    return () => clearInterval(interval);
  }, [isPlayingTimer, sprintTimeLeft, activeSprintIndex, showToast, sprints.length]);

  // Dual tone Synth chime for sprint completions
  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.error("Failed to compile Web Audio chime:", e);
    }
  };

  // Play short click/tick sound for subtask toggle
  const playClickSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  // 2. AUTO-DRAFT EVERYTHING State
  const [draftsQueue, setDraftsQueue] = useState({}); // { [taskId]: draftContent }
  const [isDraftingAll, setIsDraftingAll] = useState(false);
  const [draftingProgress, setDraftingProgress] = useState({ current: 0, total: 0 });

  const handleAutoDraftAll = async () => {
    if (isDraftingAll || incompleteSubtasks.length === 0) return;
    
    setIsDraftingAll(true);
    setDraftingProgress({ current: 0, total: incompleteSubtasks.length });
    showToast(`⚡ Starting parallel AI drafting of ${incompleteSubtasks.length} tasks...`, "info");

    const drafts = {};
    
    // Draft each incomplete task in sequence or parallel (limit concurrency to keep it robust)
    for (let i = 0; i < incompleteSubtasks.length; i++) {
      const currentTask = incompleteSubtasks[i];
      try {
        const response = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sanitizeForJSON({
            action: "execute",
            task: currentTask,
            goal: atRiskGoal,
            uid
          }))
        });
        
        if (response.ok) {
          const data = await response.json();
          drafts[currentTask.id] = data.content;
        } else {
          drafts[currentTask.id] = `⚠️ AI failed to draft this specific deliverable automatically.`;
        }
      } catch (err) {
        drafts[currentTask.id] = `⚠️ Connectivity interruption during draft formulation.`;
      }
      setDraftingProgress((prev) => ({ ...prev, current: prev.current + 1 }));
    }

    setDraftsQueue(drafts);
    setIsDraftingAll(false);
    triggerConfetti();
    showToast("🎉 Draft Queue fully formulated! Select any task below to view.", "success");
  };

  // 3. SMART SCOPE REDUCER State
  const [scopeReduction, setScopeReduction] = useState(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isScopeLoading, setIsScopeLoading] = useState(false);

  // Fetch scope reduction advice
  const fetchScopeReduction = React.useCallback(async () => {
    if (incompleteSubtasks.length === 0 || isScopeLoading) return;
    setIsScopeLoading(true);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizeForJSON({
          action: "scope_reduction",
          tasks: incompleteSubtasks,
          goal: atRiskGoal,
          uid
        }))
      });

      if (response.ok) {
        const data = await response.json();
        setScopeReduction(data);
      } else {
        console.warn("Server returned non-ok response, falling back to client-side compression calculation.");
        const sacrificial = incompleteSubtasks.length > 0 ? [incompleteSubtasks[0]] : [{ id: "mock-1", name: "Configure comprehensive unit test suite" }];
        setScopeReduction({
          sacrificialTaskIds: sacrificial.map(t => t.id),
          sacrificialTaskNames: sacrificial.map(t => t.name),
          mvpPivot: `Achieve a streamlined, high-impact core working prototype of ${atRiskGoal?.name || atRiskGoal?.title || 'this track'} without secondary administrative views.`
        });
      }
    } catch (err) {
      console.error("Failed to load scope compression advise:", err);
      const sacrificial = incompleteSubtasks.length > 0 ? [incompleteSubtasks[0]] : [{ id: "mock-1", name: "Configure comprehensive unit test suite" }];
      setScopeReduction({
        sacrificialTaskIds: sacrificial.map(t => t.id),
        sacrificialTaskNames: sacrificial.map(t => t.name),
        mvpPivot: `Achieve a streamlined, high-impact core working prototype of ${atRiskGoal?.name || atRiskGoal?.title || 'this track'} without secondary administrative views.`
      });
    } finally {
      setIsScopeLoading(false);
    }
  }, [incompleteSubtasks, isScopeLoading, atRiskGoal, uid]);

  useEffect(() => {
    if (atRiskGoal && atRiskGoal.id) {
      fetchScopeReduction();
    }
  }, [atRiskGoal, tasks.length, fetchScopeReduction]);

  const handleAcceptAndTrim = async () => {
    if (!scopeReduction || isTrimming) return;
    setIsTrimming(true);

    try {
      const targetIds = scopeReduction.sacrificialTaskIds || [];
      const pivotDesc = scopeReduction.mvpPivot;

      // Call parent delete callback for each task
      for (const tId of targetIds) {
        if (onDeleteTask) {
          await onDeleteTask(tId);
        }
      }

      // Update goal description
      if (onUpdateGoalDescription && atRiskGoal.id && pivotDesc) {
        await onUpdateGoalDescription(atRiskGoal.id, pivotDesc);
      }

      triggerConfetti();
      showToast("✂️ Scope trimmed! Non-essential tasks purged from target matrix.", "success");
      setScopeReduction(null);
    } catch (err) {
      console.error("Scope trim operations aborted:", err);
      showToast("Could not prune target scope.", "error");
    } finally {
      setIsTrimming(false);
    }
  };

  // 4. EXTENSION REQUEST DRAFTER state
  const [delayReason, setDelayReason] = useState("");
  const [extensionTime, setExtensionTime] = useState("24 hours");

  // Format countdown time (MM:SS)
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Synthesize ambient focus noise using Web Audio API
  const toggleAmbientAudio = () => {
    if (audioActive) {
      if (noiseNodeRef.current) {
        try {
          noiseNodeRef.current.stop();
        } catch (e) {}
        noiseNodeRef.current = null;
      }
      setAudioActive(false);
      showToast("Ambient focus audio paused", "info");
    } else {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const bufferSize = 4 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;
          output[i] = pink * 0.04; // low comfortable gain
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 350; // soft soothing low rumble

        whiteNoise.connect(filter);
        filter.connect(ctx.destination);
        
        whiteNoise.start();
        noiseNodeRef.current = whiteNoise;
        setAudioActive(true);
        showToast("Synthesizing binaural focus pink noise... Concentrate.", "info");
      } catch (err) {
        console.error("Failed to compile Web Audio focus synth:", err);
        showToast("Web Audio synthesis failed.", "error");
      }
    }
  };

  // Cleanup synthesizer on unmount
  useEffect(() => {
    return () => {
      if (noiseNodeRef.current) {
        try {
          noiseNodeRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const handleStepToggle = async (taskItem) => {
    playClickSound();
    triggerConfetti();
    
    try {
      await onTaskCompleted(taskItem.id);
      
      // Check if all subtasks of the active goal are completed now
      const remaining = tasks.filter(t => t.id !== taskItem.id && t.status !== "Completed" && t.goalId === taskItem.goalId);
      if (remaining.length === 0 && taskItem.status !== "Completed") {
        playChime();
        triggerConfetti();
        showToast("🎉 HIGH-VELOCITY RUNWAY SECURED! All goal milestones cleared successfully!", "success");
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  // Dispatch API actions
  const handleQuickAction = async (actionType) => {
    if (isActionLoading) return;
    setIsActionLoading(true);
    setExecutingAction(actionType);
    setExecutorOutput("");
    setCopied(false);

    try {
      let endpointPayload = {
        action: actionType,
        task: atRiskTask,
        goal: atRiskGoal,
        uid
      };

      if (actionType === "extension") {
        endpointPayload.reason = delayReason || "unforeseen API dependency bottlenecks";
        endpointPayload.timeRequested = extensionTime;
      }

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizeForJSON(endpointPayload))
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content || data.text || "No draft content returned.";
        setExecutorOutput(content);
      } else {
        throw new Error("Server returned an error status.");
      }
    } catch (err) {
      console.error("Tactical action generation failed:", err);
      setExecutorOutput(`⚠️ Critical rescue draft failed: ${err.message}.`);
      showToast("Tactical draft failed.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopyOutput = () => {
    if (!executorOutput) return;
    navigator.clipboard.writeText(executorOutput);
    setCopied(true);
    showToast("Tactical template copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseOutput = async () => {
    if (atRiskTask && atRiskTask.id) {
      try {
        await onTaskCompleted(atRiskTask.id);
        showToast("Success! At-risk task marked complete!", "success");
      } catch (err) {
        showToast("Could not complete task.", "error");
      }
    }
    onClose();
  };

  const completedCount = tasks.filter(t => t.status === "Completed" && t.goalId === atRiskTask.goalId).length;
  const totalInTrack = tasks.filter(t => t.goalId === atRiskTask.goalId).length;
  const progress = totalInTrack > 0 ? Math.round((completedCount / totalInTrack) * 100) : 0;

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={styles.overlay} id="panic-overlay">
      <div className={styles.container} id="panic-container">
        {/* Warning Hazard Bar */}
        <div className={styles.hazardBar} />

        {/* Modal Header */}
        <div className={styles.header}>
          <div className={styles.warningTitleGroup}>
            <AlertOctagon size={24} className={styles.warningIcon} />
            <div>
              <h2 className={styles.title}>🚨 DEADLINE RESCUE MODE</h2>
              <span className={styles.atRiskTaskLabel}>
                ACTIVE TARGET: <span className={styles.atRiskTaskName}>{atRiskGoal?.name || "Global Track"}</span>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* 5. FOCUS LOCK Toggle */}
            <div className={styles.headerToggleGroup}>
              <Lock size={12} style={{ color: isFocusLock ? "var(--panic-primary)" : "inherit" }} />
              <span>FOCUS LOCK</span>
              <label className={styles.toggleSwitch}>
                <input 
                  type="checkbox" 
                  checked={isFocusLock} 
                  onChange={(e) => {
                    setIsFocusLock(e.target.checked);
                    showToast(e.target.checked ? "🔒 Focus Lock engaged! Blackout distractions." : "Focus lock disabled.", "info");
                  }} 
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <button onClick={() => setShowConfirmDismiss(true)} className={styles.closeBtn} id="close-panic-btn">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Inner Panel Content */}
        <div className={styles.panelContent}>
          
          {/* Dual Widget Overview Panel */}
          <div className={styles.topOverview}>
            {/* Realtime Sprint Countdown Timer */}
            <div className={styles.timerBox}>
              <div className={styles.timerVal}>{formatTime(sprintTimeLeft)}</div>
              <div className={styles.timerLabelRow}>
                <span className={styles.timerLabel}>SPRINT {activeSprintIndex + 1} TIMER</span>
                <button 
                  onClick={() => setIsPlayingTimer(!isPlayingTimer)} 
                  className={styles.timerPlayBtn}
                  id="panic-timer-play-pause"
                >
                  {isPlayingTimer ? <Pause size={10} /> : <Play size={10} />}
                  <span>{isPlayingTimer ? "PAUSE" : "RESUME"}</span>
                </button>
              </div>
            </div>

            {/* Circular Progress Ring */}
            <div className={styles.progressRingContainer}>
              <svg width="84" height="84" className={styles.progressRing}>
                <circle
                  className={styles.progressRingBackground}
                  stroke="rgba(239, 68, 68, 0.08)"
                  strokeWidth="5"
                  fill="transparent"
                  r={radius}
                  cx="42"
                  cy="42"
                />
                <circle
                  className={styles.progressRingIndicator}
                  stroke="var(--panic-primary)"
                  strokeWidth="5"
                  fill="transparent"
                  r={radius}
                  cx="42"
                  cy="42"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
                <text
                  x="42"
                  y="47"
                  textAnchor="middle"
                  className={styles.progressText}
                  transform="rotate(90 42 42)"
                >
                  {progress}%
                </text>
              </svg>
              <span className={styles.progressLabel}>TRACK SLAYED</span>
            </div>
          </div>

          {/* Reassurance Quote */}
          <div className={styles.reassuranceCard}>
            <p className={styles.reassuranceText}>
              {activeQuote || "🔥 The only way out is through. Focus is your greatest weapon — engage focus lock, slay this sprint, and secure your victory!"}
            </p>
          </div>

          {/* SPRINT SCHEDULER SECTION */}
          <div className={styles.timelineSection}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 className={styles.sectionTitle}>
                <Flame size={14} />
                <span>15-MINUTE COMPRESSED SPRINTS</span>
              </h4>
              
              {/* 2. AUTO-DRAFT ALL Trigger Button */}
              <button 
                onClick={handleAutoDraftAll} 
                className={`${styles.timerPlayBtn} ${styles.draftBtn}`}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.7rem" }}
                disabled={isDraftingAll || incompleteSubtasks.length === 0}
              >
                {isDraftingAll ? <Loader2 size={12} className={styles.spin} /> : <Sparkles size={12} />}
                <span>⚡ AUTO-DRAFT ALL</span>
              </button>
            </div>

            {/* Drafting Progress Bar */}
            {isDraftingAll && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", margin: "0.5rem 0" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--panic-accent)" }}>
                  Drafting progress: {draftingProgress.current}/{draftingProgress.total} tasks completed...
                </span>
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${(draftingProgress.current / draftingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Sprints List */}
            <div className={styles.sprintsGrid}>
              {sprints.map((s, idx) => {
                const isActive = idx === activeSprintIndex;
                const isCompleted = idx < activeSprintIndex;
                return (
                  <div 
                    key={s.id} 
                    className={`${styles.sprintItem} ${isActive ? styles.sprintItemActive : ""} ${isCompleted ? styles.sprintItemCompleted : ""}`}
                  >
                    <div className={styles.sprintLeft}>
                      <div className={styles.sprintTitleRow}>
                        <span className={styles.sprintTitle}>{s.title}</span>
                        <span className={`${styles.sprintBadge} ${isActive ? styles.sprintBadgeActive : isCompleted ? styles.sprintBadgeCompleted : ""}`}>
                          {isActive ? "ACTIVE" : isCompleted ? "DONE" : "PENDING"}
                        </span>
                      </div>
                      <span className={styles.sprintDeliverable}>
                        🎯 {s.deliverable}
                      </span>
                    </div>
                    {isActive && (
                      <span className={styles.sprintCountdown}>{formatTime(sprintTimeLeft)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. SMART SCOPE REDUCER PROPOSAL CARD */}
          {scopeReduction && (
            <div className={styles.scopeReductionCard}>
              <div className={styles.scopeTitleGroup}>
                <Scissors size={14} style={{ color: "var(--panic-primary)" }} />
                <span className={styles.scopeTitle}>✂️ SMART SCOPE COMPRESSION ADVISE</span>
              </div>
              
              <div className={styles.sacrificialList}>
                <span className={styles.formLabel}>SACRIFICIAL FEATURES (RECOMMENDED SKIPS):</span>
                {scopeReduction.sacrificialTaskNames?.map((name, i) => (
                  <div key={i} className={styles.sacrificialItem}>
                    <span>✖ {name}</span>
                  </div>
                ))}
              </div>

              <div className={styles.mvpPivotBlock}>
                <span className={styles.mvpLabel}>PROPOSED MVP PIVOT</span>
                <p className={styles.mvpText}>{scopeReduction.mvpPivot}</p>
              </div>

              <button 
                onClick={handleAcceptAndTrim} 
                className={styles.trimBtn}
                disabled={isTrimming}
              >
                {isTrimming ? <Loader2 size={12} className={styles.spin} /> : <Scissors size={12} />}
                <span>ACCEPT & TRIM RUNWAY</span>
              </button>
            </div>
          )}

          {/* SUBTASK CHECKLIST (Micro-celebrations enabled) */}
          <div className={styles.timelineSection}>
            <h4 className={styles.sectionTitle}>
              <ClipboardList size={14} />
              <span>DEADLINE MILISTONE RUNWAY</span>
            </h4>
            <div className={styles.timeline} id="panic-rescue-timeline">
              {tasks.filter(t => t.goalId === atRiskGoal.id).map((task, idx) => {
                const isCompleted = task.status === "Completed";
                
                return (
                  <div 
                    key={task.id}
                    onClick={() => handleStepToggle(task)}
                    className={`${styles.timelineStep} ${isCompleted ? styles.stepChecked : ""}`}
                    id={`panic-step-${idx}`}
                  >
                    <div className={styles.checkboxContainer}>
                      {isCompleted ? (
                        <CheckSquare size={16} className={styles.checkboxChecked} />
                      ) : (
                        <span className={styles.checkboxUnchecked} />
                      )}
                    </div>
                    <div className={styles.stepContent}>
                      <div className={styles.stepHeaderRow}>
                        <span className={styles.stepNum}>MILESTONE {idx + 1} ({task.estimate || "30"} MIN)</span>
                        {draftsQueue[task.id] && (
                          <span style={{ fontSize: "0.65rem", color: "#8b5cf6", fontWeight: "bold" }}>⚡ DRAFT READY</span>
                        )}
                      </div>
                      <p className={styles.stepAction}>{task.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DRAFTS QUEUE PORTAL */}
          {Object.keys(draftsQueue).length > 0 && (
            <div className={styles.draftQueueSection}>
              <div className={styles.draftQueueHeader}>
                <span className={styles.draftQueueTitle}>⚡ AUTO-DRAFTED CORE QUEUE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {incompleteSubtasks.map((t) => {
                  const hasDraft = !!draftsQueue[t.id];
                  if (!hasDraft) return null;
                  return (
                    <div 
                      key={t.id} 
                      onClick={() => {
                        setExecutorOutput(draftsQueue[t.id]);
                        setExecutingAction("draft");
                      }}
                      className={styles.draftItem}
                    >
                      <span className={styles.draftItemText}>{t.name}</span>
                      <Check className={styles.draftStatusIcon} size={14} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. EXTENSION REQUEST DRAFER CARD */}
          <div className={styles.timelineSection}>
            <h4 className={styles.sectionTitle}>
              <Mail size={14} />
              <span>CAN&apos;T MAKE IT? ADVOCATE REQUEST</span>
            </h4>
            
            <div className={styles.extensionForm}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span className={styles.formLabel}>Reason for delay:</span>
                <input 
                  type="text" 
                  className={styles.formInput}
                  placeholder="e.g. Server down, Sick, 3rd-party integration bugs" 
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span className={styles.formLabel}>Requested extension limit:</span>
                <select 
                  className={styles.formSelect}
                  value={extensionTime}
                  onChange={(e) => setExtensionTime(e.target.value)}
                >
                  <option value="2 hours">2 Hours Buffer</option>
                  <option value="24 hours">24 Hours Extension</option>
                  <option value="3 days">3 Days Grace Period</option>
                </select>
              </div>

              <button 
                onClick={() => handleQuickAction("extension")}
                className={styles.quickActionBtn}
                style={{ background: "rgba(139, 92, 246, 0.1)", borderColor: "rgba(139, 92, 246, 0.3)", width: "100%", padding: "0.6rem" }}
                disabled={isActionLoading}
              >
                <Mail size={14} style={{ color: "#8b5cf6" }} />
                <span>GENERATE FORMAL EMAIL REQUEST</span>
              </button>
            </div>
          </div>

          {/* COGNITIVE RESCUE TRIGGERS */}
          <div className={styles.timelineSection}>
            <h4 className={styles.sectionTitle}>
              <Zap size={14} />
              <span>COGNITIVE RESCUE TRIGGERS</span>
            </h4>
            <div className={styles.actionsGrid}>
              <button 
                onClick={() => handleQuickAction("draft")}
                className={`${styles.quickActionBtn} ${styles.draftBtn}`}
                disabled={isActionLoading}
                id="panic-btn-draft"
              >
                <Zap size={14} />
                <span>⚡ AI Draft Task</span>
              </button>
              <button 
                onClick={() => handleQuickAction("simplify")}
                className={styles.quickActionBtn}
                disabled={isActionLoading}
                id="panic-btn-simplify"
              >
                <ClipboardList size={14} />
                <span>📋 AI Simplify Task</span>
              </button>
              <button 
                onClick={fetchScopeReduction}
                className={styles.quickActionBtn}
                disabled={isActionLoading || isScopeLoading}
                id="panic-btn-reducer"
              >
                <Scissors size={14} />
                <span>✂️ Request Scope Compression</span>
              </button>
            </div>
          </div>

          {/* Live Action Compilation Output Panel */}
          {(isActionLoading || executorOutput) && (
            <div className={styles.outputContainer}>
              <div className={styles.outputHeader}>
                <span className={styles.outputTitle}>
                  {executingAction === "draft" && "SLAYER EXECUTOR AGENT ACTIVE"}
                  {executingAction === "simplify" && "SLAYER OPTIMIZER SCOPE COMPRESSION"}
                  {executingAction === "extension" && "SLAYER ADVOCATE ESCALATION DRAFT"}
                </span>
                
                {executorOutput && !isActionLoading && (
                  <div className={styles.outputControlRow}>
                    <button onClick={handleCopyOutput} className={styles.controlBtn}>
                      {copied ? <Check size={10} className={styles.checkboxChecked} /> : <Copy size={10} />}
                      <span>{copied ? "COPIED" : "COPY"}</span>
                    </button>
                    <button onClick={handleUseOutput} className={`${styles.controlBtn} ${styles.useThisBtn}`}>
                      <Check size={10} />
                      <span>USE THIS</span>
                    </button>
                  </div>
                )}
              </div>

              {isActionLoading ? (
                <div className={styles.loadingSpinner}>
                  <Loader2 size={24} className={`${styles.spin} ${styles.warningIcon}`} />
                  <span className={styles.loadingText}>Compiling tactical asset...</span>
                </div>
              ) : (
                <div className={styles.outputBody}>{executorOutput}</div>
              )}
            </div>
          )}

        </div>

        {/* Footer Area with ambient sounds and Dismiss options */}
        <div className={styles.footer}>
          {showConfirmDismiss ? (
            <div className={styles.confirmBlock}>
              <p className={styles.confirmText}>
                Are you sure you want to disengage Deadline Rescue? Your core runway metrics are still at critical risk.
              </p>
              <div className={styles.confirmActions}>
                <button onClick={onClose} className={styles.confirmYesBtn}>YES, DISENGAGE</button>
                <button onClick={() => setShowConfirmDismiss(false)} className={styles.confirmNoBtn}>CANCEL</button>
              </div>
            </div>
          ) : (
            <div className={styles.footerRow}>
              <button 
                onClick={toggleAmbientAudio} 
                className={`${styles.secondaryAudioBtn} ${audioActive ? styles.audioActiveBtn : ""}`}
                id="panic-ambient-toggle"
              >
                <Music size={14} />
                <span>{audioActive ? "MUTE FOCUS NOISE" : "PLAY FOCUS NOISE"}</span>
              </button>
              <button 
                onClick={() => setShowConfirmDismiss(true)} 
                className={styles.dismissBtn}
                id="panic-dismiss-btn"
              >
                <ShieldAlert size={14} />
                <span>I&apos;ve Got This</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
