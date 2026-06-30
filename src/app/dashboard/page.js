"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import styles from "./page.module.css";
import { 
  Flame, 
  LogOut, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  ShieldAlert, 
  Sparkles, 
  Activity, 
  TrendingUp, 
  Clock, 
  Terminal, 
  FileText, 
  Grid, 
  Zap,
  Play,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  Lock
} from "lucide-react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title as ChartTitle, Tooltip, Legend, Filler } from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import ChatInput from "@/components/ChatInput";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import DailyBriefing from "@/components/DailyBriefing";
import ProcrastinationAlert from "@/components/ProcrastinationAlert";
import PanicMode from "@/components/PanicMode";
import Sidebar from "@/components/Sidebar";
import { sanitizeForJSON } from "@/lib/utils";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ChartTitle, Tooltip, Legend, Filler);

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const showToast = useToast();

  // Firebase states
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeGoalId, setActiveGoalId] = useState(null);

  // App UI states
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDesc, setNewGoalDesc] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isPanicActive, setIsPanicActive] = useState(false);
  const [isManualPanic, setIsManualPanic] = useState(false);
  const [isFocusLock, setIsFocusLock] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatInputValue, setChatInputValue] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState(null);

  const [dismissedThreatIds, setDismissedThreatIds] = useState([]);

  // AI Coaching & Procrastination states
  const [dailyBriefing, setDailyBriefing] = useState(null);
  const [procrastinationAlert, setProcrastinationAlert] = useState(null);
  const [isBriefingDismissed, setIsBriefingDismissed] = useState(false);
  const [isProcrastinationDismissed, setIsProcrastinationDismissed] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [pipelineSort, setPipelineSort] = useState("order");
  const hasTriggeredBriefing = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Agent states
  const [agentStatus, setAgentStatus] = useState({
    Orchestrator: "Idle",
    Executor: "Idle",
    Guardian: "Idle"
  });
  const [agentLogs, setAgentLogs] = useState([
    "[System] Tactical defense systems online.",
    "[System] Standing by for agent orchestration requests..."
  ]);

  const chatInputRef = useRef(null);
  const logsEndRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Handle keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        window.dispatchEvent(new Event("toggle-sidebar"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Subscribe to user goals
  useEffect(() => {
    if (!user) return;

    if (user.isSandboxMock) {
      const loadLocalGoals = () => {
        try {
          const localGoals = JSON.parse(localStorage.getItem("deadline_slayer_local_goals") || "[]");
          setGoals(localGoals);
        } catch (err) {
          console.error("Local goals parse error:", err);
        }
      };
      loadLocalGoals();
      return;
    }

    const q = query(collection(db, "goals"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gList = [];
      snapshot.forEach((doc) => {
        gList.push({ id: doc.id, ...doc.data() });
      });
      setGoals(gList);
    }, (err) => {
      console.error("Goals sync error:", err);
      setTimeout(() => {
        showToast("Failed to sync operational tracks.", "error");
      }, 0);
    });
    return () => unsubscribe();
  }, [user, showToast]);

  // Subscribe to user tasks
  useEffect(() => {
    if (!user) return;

    if (user.isSandboxMock) {
      const loadLocalTasks = () => {
        try {
          const localTasks = JSON.parse(localStorage.getItem("deadline_slayer_local_tasks") || "[]");
          setTasks(localTasks);
        } catch (err) {
          console.error("Local tasks parse error:", err);
        }
      };
      loadLocalTasks();
      return;
    }

    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tList = [];
      snapshot.forEach((doc) => {
        tList.push({ id: doc.id, ...doc.data() });
      });
      setTasks(tList);
    }, (err) => {
      console.error("Tasks sync error:", err);
      setTimeout(() => {
        showToast("Failed to sync subtask runway queues.", "error");
      }, 0);
    });
    return () => unsubscribe();
  }, [user, showToast]);

  // Combined Daily Briefing and Procrastination Audit trigger
  useEffect(() => {
    if (!user) return;

    // Load cached briefing if present
    const todayStr = new Date().toISOString().slice(0, 10);
    const cacheKey = `briefing-${todayStr}`;
    const cachedBriefing = sessionStorage.getItem(cacheKey);
    if (cachedBriefing && !dailyBriefing) {
      try {
        setDailyBriefing(JSON.parse(cachedBriefing));
      } catch (e) {
        console.error("Error reading cached briefing:", e);
      }
    }

    const dismissedProc = sessionStorage.getItem("procrastination-dismissed");
    if (dismissedProc === "true") {
      setIsProcrastinationDismissed(true);
    }

    // Trigger AI checks once mounted and if not already triggered in this session mount
    if (isMounted && !hasTriggeredBriefing.current) {
      hasTriggeredBriefing.current = true;

      const fetchBriefingAndAudit = async () => {
        try {
          appendAgentLog("[Guardian] Initializing daily runway inspection and risk assessments...");

          // Wait briefly to allow onSnapshot / localStorage loads to populate state
          await new Promise((r) => setTimeout(r, 1200));

          // Use latest state values at function execution time
          const currentGoals = goals;
          const currentTasks = tasks;

          // Call Guardian Agent checkDeadlines (incorporates Procrastination check)
          const auditRes = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentName: "guardian_audit",
              allTasks: sanitizeForJSON(currentTasks),
              goals: sanitizeForJSON(currentGoals),
              uid: user.uid
            })
          });

          if (auditRes.ok) {
            const auditData = await auditRes.json();
            if (auditData.procrastination) {
              setProcrastinationAlert(auditData.procrastination);
            }
            if (auditData.panicMode) {
              setIsPanicActive(true);
              appendAgentLog(`[Guardian] ALERT: Panic mode vector active! Urgent focus needed on: ${auditData.panicTask?.taskTitle || "unresolved milestone"}`);
            }
          }

          // Call generateBriefing (if not cached)
          const sessionCached = sessionStorage.getItem(cacheKey);
          if (sessionCached) {
            appendAgentLog("[Guardian] Morning briefing successfully retrieved from memory cache.");
          } else {
            appendAgentLog("[Orchestrator] Requesting daily briefing compilation from Guardian Agent...");
            const briefingRes = await fetch("/api/agent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agentName: "guardian_briefing",
                allTasks: sanitizeForJSON(currentTasks),
                goals: sanitizeForJSON(currentGoals),
                uid: user.uid
              })
            });

            if (briefingRes.ok) {
              const briefingData = await briefingRes.json();
              setDailyBriefing(briefingData);
              sessionStorage.setItem(cacheKey, JSON.stringify(briefingData));
              appendAgentLog(`[Guardian] Briefing finalized. Current Operator mood evaluated as: ${briefingData.mood?.toUpperCase()}`);
            }
          }
        } catch (err) {
          console.error("AI briefing/audit pipeline error:", err);
          appendAgentLog("[Guardian] Inspection pipeline stalled due to network or service constraints.");
        }
      };

      fetchBriefingAndAudit();
    }
  }, [user, isMounted, goals, tasks, dailyBriefing]);

  // Auto-detect panic mode from deadlines
  useEffect(() => {
    const checkPanic = () => {
      const now = new Date();
      const activeOverdueGoals = goals.filter(g => g.deadline && new Date(g.deadline) < now && g.status !== 'completed' && g.status !== 'Completed');
      const activeImpendingTasks = tasks.filter(t => {
        if (!t.deadline || t.status === 'Completed' || t.status === 'completed') return false;
        const hoursLeft = (new Date(t.deadline) - now) / (1000 * 60 * 60);
        return hoursLeft > 0 && hoursLeft < 2 && (t.priority === 'Urgent-Important' || t.priority === 'Urgent');
      });
      
      const activeThreatKeys = [
        ...activeOverdueGoals.map(g => `goal-${g.id}`),
        ...activeImpendingTasks.map(t => `task-${t.id}`)
      ];

      const newThreats = activeThreatKeys.filter(key => !dismissedThreatIds.includes(key));
      
      if (activeThreatKeys.length === 0) {
        if (isPanicActive && !isManualPanic) {
          setIsPanicActive(false);
          appendAgentLog("[Guardian] Threat resolved. Panic signal neutralized. Decelerating system loads.");
          showToast("Threat neutralized successfully! Returning to regular operations.", "success");
        }
      } else if (newThreats.length > 0) {
        if (!isPanicActive) {
          setIsPanicActive(true);
          appendAgentLog("[Guardian] CRITICAL WARNING: Impending deadline detected! Automatically engaging Panic Rescue Mode.");
        }
      }
    };
    checkPanic();
    const interval = setInterval(checkPanic, 30000);
    return () => clearInterval(interval);
  }, [goals, tasks, isPanicActive, isManualPanic, dismissedThreatIds, showToast]);

  // Handler for Start urgent task recommendation
  const handleStartUrgent = (taskName) => {
    if (!taskName) return;

    const matchedTask = tasks.find(t => 
      t.name.toLowerCase() === taskName.toLowerCase() ||
      t.name.toLowerCase().includes(taskName.toLowerCase()) ||
      taskName.toLowerCase().includes(t.name.toLowerCase())
    );

    if (matchedTask) {
      setHighlightedTaskId(matchedTask.id);

      // Scroll to the card element
      setTimeout(() => {
        const el = document.getElementById(`task-card-${matchedTask.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);

      // Clear highlighted state after 4 seconds
      setTimeout(() => {
        setHighlightedTaskId(null);
      }, 4000);

      showToast(`Locating and highlighting: "${matchedTask.name}"`, "success");
      appendAgentLog(`[Orchestrator] Operator selected briefing recommendation. Directing focus to: "${matchedTask.name}"`);
    } else {
      showToast(`Urgent task "${taskName}" not found in current view.`, "warning");
    }
  };

  // Handler for Break It Down procrastination action
  const handleBreakDown = async (taskToBreak) => {
    if (!user || !taskToBreak) return;

    setIsPlanning(true);
    setAgentStatus({
      Orchestrator: "Analyzing",
      Executor: "Waiting",
      Guardian: "Waiting"
    });
    appendAgentLog(`[Planner] Tactical breakdown authorized for stalled task: "${taskToBreak.name}"`);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: "planner_breakdown",
          task: sanitizeForJSON(taskToBreak),
          uid: user.uid
        })
      });

      if (!res.ok) {
        throw new Error("Breakdown service responded with error");
      }

      const { microtasks } = await res.json();
      if (!microtasks || microtasks.length === 0) {
        throw new Error("No microtasks returned from Planner");
      }

      appendAgentLog(`[Planner] Successfully generated ${microtasks.length} frictionless subtasks. Deploying to queue...`);

      if (user.isSandboxMock) {
        // LocalStorage logic
        let updatedTasks = [...tasks];

        // Remove the original stalled task
        updatedTasks = updatedTasks.filter(t => t.id !== taskToBreak.id);

        // Add the new microtasks
        microtasks.forEach((mt, idx) => {
          updatedTasks.push({
            id: "local-task-" + Date.now() + "-" + idx,
            name: mt.title,
            description: mt.description,
            quadrant: 1, // High urgency since they are quick starts!
            priority: "High",
            estimatedMinutes: mt.estimatedMinutes || 20,
            category: mt.category || "General",
            status: "Pending",
            goalId: taskToBreak.goalId || activeGoalId || "",
            userId: user.uid,
            createdAt: new Date().toISOString()
          });
        });

        localStorage.setItem("deadline_slayer_local_tasks", JSON.stringify(updatedTasks));
        setTasks(updatedTasks);
      } else {
        // Real Firestore transaction
        // First, delete the original task
        if (taskToBreak.id && taskToBreak.id !== "virtual-temp") {
          await deleteDoc(doc(db, "tasks", taskToBreak.id));
        }

        // Add each microtask
        const batch = writeBatch(db);
        microtasks.forEach((mt) => {
          const newTaskRef = doc(collection(db, "tasks"));
          batch.set(newTaskRef, {
            name: mt.title,
            description: mt.description,
            quadrant: 1, // High urgency for micro tasks
            priority: "High",
            estimatedMinutes: mt.estimatedMinutes || 20,
            category: mt.category || "General",
            status: "Pending",
            goalId: taskToBreak.goalId || activeGoalId || "",
            userId: user.uid,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }

      setAgentStatus({
        Orchestrator: "Idle",
        Executor: "Idle",
        Guardian: "Monitoring"
      });

      showToast("Task broken into smaller pieces!", "success");
      appendAgentLog(`[Planner] Breakdown execution complete. Original stalled milestone replaced with microtask runways.`);
      setIsProcrastinationDismissed(true); // Dismiss current alert once solved
      sessionStorage.setItem("procrastination-dismissed", "true");

    } catch (err) {
      console.error("Procrastination breakdown failed:", err);
      showToast("Could not break down task. Please try again.", "error");
      appendAgentLog(`[Planner] ERROR: Breakdown generation aborted: ${err.message}`);
    } finally {
      setIsPlanning(false);
    }
  };

  // Scroll terminal logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentLogs]);

  // Helper to log agent steps
  const appendAgentLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setAgentLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  // Create new goal manually
  const handleAddGoalSubmit = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !user) return;

    if (user.isSandboxMock) {
      try {
        const newGoal = {
          id: "local-goal-" + Date.now(),
          name: newGoalTitle.trim(),
          description: newGoalDesc.trim() || "Manual operational goal",
          deadline: newGoalDeadline ? new Date(newGoalDeadline).toISOString() : null,
          status: 'in_progress',
          completionPercentage: 0,
          userId: user.uid,
          createdAt: new Date().toISOString()
        };
        const nextGoals = [...goals, newGoal];
        localStorage.setItem("deadline_slayer_local_goals", JSON.stringify(nextGoals));
        setGoals(nextGoals);
        setNewGoalTitle("");
        setNewGoalDesc("");
        setNewGoalDeadline("");
        setShowAddGoal(false);
        setActiveGoalId(newGoal.id);
        appendAgentLog(`Created target Goal Track (Offline Sandbox): "${newGoal.name}"`);
        showToast("Manual track created successfully (Offline Sandbox)!", "success");
      } catch (err) {
        console.error(err);
        showToast("Could not create local track.", "error");
      }
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "goals"), {
        name: newGoalTitle.trim(),
        description: newGoalDesc.trim() || "Manual operational goal",
        deadline: newGoalDeadline ? new Date(newGoalDeadline).toISOString() : null,
        status: 'in_progress',
        completionPercentage: 0,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewGoalTitle("");
      setNewGoalDesc("");
      setNewGoalDeadline("");
      setShowAddGoal(false);
      setActiveGoalId(docRef.id);
      appendAgentLog(`Created target Goal Track: "${newGoalTitle.trim()}"`);
      showToast("Manual track created successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not create track.", "error");
    }
  };

  // Delete goal and all associated tasks
  const executeDeleteGoal = async (goalId) => {
    if (!user) return;

    if (user.isSandboxMock) {
      try {
        const nextGoals = goals.filter((g) => g.id !== goalId);
        const nextTasks = tasks.filter((t) => t.goalId !== goalId);
        localStorage.setItem("deadline_slayer_local_goals", JSON.stringify(nextGoals));
        localStorage.setItem("deadline_slayer_local_tasks", JSON.stringify(nextTasks));
        setGoals(nextGoals);
        setTasks(nextTasks);
        if (activeGoalId === goalId) {
          setActiveGoalId(nextGoals[0]?.id || null);
        }
        appendAgentLog("Successfully slayed and discarded target local tracks.");
        showToast("Local track and its tasks discarded successfully.", "info");
      } catch (err) {
        console.error(err);
        showToast("Failed to delete local track.", "error");
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // Slay child tasks in the same batch
      const childTasks = tasks.filter((t) => t.goalId === goalId);
      childTasks.forEach((t) => {
        if (t.id && !t.id.startsWith("local-task-")) {
          batch.delete(doc(db, "tasks", t.id));
        }
      });

      // Slay goal doc in the same batch
      batch.delete(doc(db, "goals", goalId));
      
      // Execute atomic transaction
      await batch.commit();

      if (activeGoalId === goalId) {
        const remainingGoals = goals.filter((g) => g.id !== goalId);
        setActiveGoalId(remainingGoals[0]?.id || null);
      }
      appendAgentLog("Successfully slayed and discarded target tracks.");
      showToast("Track and its tasks discarded successfully.", "info");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete track.", "error");
    }
  };

  // Toggle task complete
  const handleToggleTaskStatus = async (taskOrId) => {
    let task = null;
    let taskId = "";
    if (typeof taskOrId === "string") {
      taskId = taskOrId;
      task = tasks.find((t) => t.id === taskId);
    } else if (taskOrId && typeof taskOrId === "object") {
      task = taskOrId;
      taskId = task.id;
    }

    if (!task || !taskId) {
      console.error("Invalid task or task ID passed to handleToggleTaskStatus", taskOrId);
      showToast("Could not identify the task.", "error");
      return;
    }

    const nextStatus = task.status === "Completed" ? "Pending" : "Completed";
    const goalId = task.goalId;

    if (user?.isSandboxMock) {
      try {
        const nextTasks = tasks.map((t) => t.id === taskId ? { ...t, status: nextStatus } : t);
        localStorage.setItem("deadline_slayer_local_tasks", JSON.stringify(nextTasks));
        setTasks(nextTasks);
        appendAgentLog(`Manually set "${task.name}" state to ${nextStatus} (Offline Sandbox).`);
        showToast(nextStatus === "Completed" ? "Task successfully slain! 🎉" : "Task restored to pending queue", "success");

        // Sync parent goal status
        if (goalId) {
          const goalTasks = nextTasks.filter((t) => t.goalId === goalId);
          const allCompleted = goalTasks.length > 0 && goalTasks.every((t) => t.status === "Completed");
          const nextGoalStatus = allCompleted ? "Completed" : "in_progress";
          const currentGoal = goals.find((g) => g.id === goalId);
          if (currentGoal && currentGoal.status !== nextGoalStatus) {
            const nextGoals = goals.map((g) => g.id === goalId ? { ...g, status: nextGoalStatus } : g);
            setGoals(nextGoals);
            localStorage.setItem("deadline_slayer_local_goals", JSON.stringify(nextGoals));
            appendAgentLog(`Goal track "${currentGoal.name}" auto-updated to ${nextGoalStatus} (Offline Sandbox).`);
          }
        }
      } catch (err) {
        console.error(err);
        showToast("Failed to update local task status.", "error");
      }
      return;
    }

    try {
      await updateDoc(doc(db, "tasks", taskId), { status: nextStatus });
      appendAgentLog(`Manually set "${task.name}" state to ${nextStatus}.`);
      showToast(nextStatus === "Completed" ? "Task successfully slain! 🎉" : "Task restored to pending queue", "success");

      // Sync parent goal status in Firestore
      if (goalId) {
        const nextTasksState = tasks.map((t) => t.id === taskId ? { ...t, status: nextStatus } : t);
        const goalTasks = nextTasksState.filter((t) => t.goalId === goalId);
        const allCompleted = goalTasks.length > 0 && goalTasks.every((t) => t.status === "Completed");
        const nextGoalStatus = allCompleted ? "Completed" : "in_progress";
        const currentGoal = goals.find((g) => g.id === goalId);
        if (currentGoal && currentGoal.status !== nextGoalStatus) {
          await updateDoc(doc(db, "goals", goalId), { status: nextGoalStatus });
          appendAgentLog(`Goal track "${currentGoal.name}" auto-updated to ${nextGoalStatus}.`);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update task status.", "error");
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const goalId = task.goalId;

    if (user.isSandboxMock) {
      try {
        const nextTasks = tasks.filter((t) => t.id !== taskId);
        localStorage.setItem("deadline_slayer_local_tasks", JSON.stringify(nextTasks));
        setTasks(nextTasks);
        appendAgentLog("Task eliminated from local matrix queues.");
        showToast("Local task removed from pipeline.", "info");

        // Sync parent goal status after task deletion
        if (goalId) {
          const goalTasks = nextTasks.filter((t) => t.goalId === goalId);
          const allCompleted = goalTasks.length > 0 && goalTasks.every((t) => t.status === "Completed");
          const nextGoalStatus = allCompleted ? "Completed" : "in_progress";
          const currentGoal = goals.find((g) => g.id === goalId);
          if (currentGoal && currentGoal.status !== nextGoalStatus) {
            const nextGoals = goals.map((g) => g.id === goalId ? { ...g, status: nextGoalStatus } : g);
            setGoals(nextGoals);
            localStorage.setItem("deadline_slayer_local_goals", JSON.stringify(nextGoals));
            appendAgentLog(`Goal track "${currentGoal.name}" auto-updated to ${nextGoalStatus} after task elimination (Offline Sandbox).`);
          }
        }
      } catch (err) {
        console.error(err);
        showToast("Could not delete local task.", "error");
      }
      return;
    }

    try {
      await deleteDoc(doc(db, "tasks", taskId));
      appendAgentLog("Task eliminated from matrix queues.");
      showToast("Task removed from pipeline.", "info");

      // Sync parent goal status in Firestore after task deletion
      if (goalId) {
        const nextTasksState = tasks.filter((t) => t.id !== taskId);
        const goalTasks = nextTasksState.filter((t) => t.goalId === goalId);
        const allCompleted = goalTasks.length > 0 && goalTasks.every((t) => t.status === "Completed");
        const nextGoalStatus = allCompleted ? "Completed" : "in_progress";
        const currentGoal = goals.find((g) => g.id === goalId);
        if (currentGoal && currentGoal.status !== nextGoalStatus) {
          await updateDoc(doc(db, "goals", goalId), { status: nextGoalStatus });
          appendAgentLog(`Goal track "${currentGoal.name}" auto-updated to ${nextGoalStatus} after task elimination.`);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Could not delete task.", "error");
    }
  };

  // Close Panic Mode (Saves current active threats into dismissedThreatIds so it won't instantly reopen)
  const handleClosePanicMode = () => {
    const now = new Date();
    const activeOverdueGoals = goals.filter(g => g.deadline && new Date(g.deadline) < now && g.status !== 'completed' && g.status !== 'Completed');
    const activeImpendingTasks = tasks.filter(t => {
      if (!t.deadline || t.status === 'Completed' || t.status === 'completed') return false;
      const hoursLeft = (new Date(t.deadline) - now) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft < 2 && (t.priority === 'Urgent-Important' || t.priority === 'Urgent');
    });
    
    const activeThreatKeys = [
      ...activeOverdueGoals.map(g => `goal-${g.id}`),
      ...activeImpendingTasks.map(t => `task-${t.id}`)
    ];

    setDismissedThreatIds(activeThreatKeys);
    setIsPanicActive(false);
    setIsManualPanic(false);
    appendAgentLog("[Guardian] Panic signal neutralized manually. Decelerating system loads.");
    showToast("System normalized. Return to regular runway defense.", "success");
    setIsFocusLock(false);
  };

  // Trigger Panic Mode
  const handleTriggerPanic = () => {
    setIsPanicActive((prev) => {
      const nextState = !prev;
      if (nextState) {
        setIsManualPanic(true);
        appendAgentLog("!!! PANIC LEVEL CRITICAL: GUARDIAN INITIATING AIRLOCK ENGAGEMENT !!!");
        showToast("Panic mode active! Guardian auditing risk profiles.", "warning");
        setDismissedThreatIds([]);
      } else {
        setIsManualPanic(false);
        const now = new Date();
        const activeOverdueGoals = goals.filter(g => g.deadline && new Date(g.deadline) < now && g.status !== 'completed' && g.status !== 'Completed');
        const activeImpendingTasks = tasks.filter(t => {
          if (!t.deadline || t.status === 'Completed' || t.status === 'completed') return false;
          const hoursLeft = (new Date(t.deadline) - now) / (1000 * 60 * 60);
          return hoursLeft > 0 && hoursLeft < 2 && (t.priority === 'Urgent-Important' || t.priority === 'Urgent');
        });
        const activeThreatKeys = [
          ...activeOverdueGoals.map(g => `goal-${g.id}`),
          ...activeImpendingTasks.map(t => `task-${t.id}`)
        ];
        setDismissedThreatIds(activeThreatKeys);
        
        appendAgentLog("[Guardian] Panic signal neutralized manually. Decelerating system loads.");
        showToast("System normalized. Return to regular runway defense.", "success");
        setIsFocusLock(false);
      }
      return nextState;
    });
  };

  // Update Goal description in Firestore or Sandbox local storage
  const handleUpdateGoalDescription = async (goalId, newDescription) => {
    if (user.isSandboxMock) {
      try {
        const nextGoals = goals.map((g) => g.id === goalId ? { ...g, description: newDescription } : g);
        localStorage.setItem("deadline_slayer_local_goals", JSON.stringify(nextGoals));
        setGoals(nextGoals);
        appendAgentLog(`Updated goal track description to MVP pivot (Offline Sandbox).`);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    try {
      await updateDoc(doc(db, "goals", goalId), { description: newDescription });
      appendAgentLog(`Updated goal track description to MVP pivot.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Disengage focus lock automatically when panic mode is exited
  useEffect(() => {
    if (!isPanicActive) {
      setIsFocusLock(false);
    }
  }, [isPanicActive]);

  // Handle tasks extracted via Gemini Photo Vision
  const handlePhotoTasksExtracted = async (extractedGoals) => {
    if (!user || extractedGoals.length === 0) return;

    setIsPlanning(true);
    setAgentStatus({
      Orchestrator: "Analyzing",
      Executor: "Waiting",
      Guardian: "Waiting"
    });
    appendAgentLog("[Orchestrator] Photo upload detected. Initiating tactical runway mapping...");
    await new Promise((r) => setTimeout(r, 600));

    let createdGoalIds = [];
    let totalTasksAdded = 0;

    try {
      if (user.isSandboxMock) {
        let updatedGoals = [...goals];
        let updatedTasks = [...tasks];

        for (const goal of extractedGoals) {
          const newGoalId = "local-goal-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
          const newGoal = {
            id: newGoalId,
            name: goal.title,
            description: `Extracted via Vision. Deadline: ${goal.deadline || "None"}`,
            userId: user.uid,
            createdAt: new Date().toISOString()
          };
          updatedGoals.push(newGoal);
          createdGoalIds.push(newGoalId);

          const newTasks = (goal.subtasks || []).map((t, tIdx) => {
            totalTasksAdded++;
            return {
              id: "local-task-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5) + "-" + tIdx,
              name: t.title,
              quadrant: goal.deadline ? 1 : 2,
              priority: goal.deadline ? "High" : "Medium",
              estimatedMinutes: Math.round(Number(t.estimatedHours || 1) * 60) || 60,
              category: t.category || "General",
              status: "Pending",
              goalId: newGoalId,
              userId: user.uid,
              createdAt: new Date().toISOString()
            };
          });

          updatedTasks.push(...newTasks);
        }

        localStorage.setItem("deadline_slayer_local_goals", JSON.stringify(updatedGoals));
        localStorage.setItem("deadline_slayer_local_tasks", JSON.stringify(updatedTasks));
        setGoals(updatedGoals);
        setTasks(updatedTasks);

        if (createdGoalIds.length > 0) {
          setActiveGoalId(createdGoalIds[0]);
        }
      } else {
        // Real Firebase transaction
        for (const goal of extractedGoals) {
          const goalRef = await addDoc(collection(db, "goals"), {
            name: goal.title,
            description: `Extracted via Vision. Deadline: ${goal.deadline || "None"}`,
            userId: user.uid,
            createdAt: serverTimestamp()
          });
          createdGoalIds.push(goalRef.id);

          const batch = writeBatch(db);
          (goal.subtasks || []).forEach((t) => {
            totalTasksAdded++;
            const newTaskRef = doc(collection(db, "tasks"));
            batch.set(newTaskRef, {
              name: t.title,
              quadrant: goal.deadline ? 1 : 2,
              priority: goal.deadline ? "High" : "Medium",
              estimatedMinutes: Math.round(Number(t.estimatedHours || 1) * 60) || 60,
              category: t.category || "General",
              status: "Pending",
              goalId: goalRef.id,
              userId: user.uid,
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
        }

        if (createdGoalIds.length > 0) {
          setActiveGoalId(createdGoalIds[0]);
        }
      }

      // Prioritizer agent logging
      setAgentStatus({
        Orchestrator: "Complete",
        Executor: "Executing",
        Guardian: "Auditing"
      });

      appendAgentLog(`[Executor] Successfully created ${extractedGoals.length} Goal Tracks from photo layout.`);
      await new Promise((r) => setTimeout(r, 600));

      setAgentStatus({
        Orchestrator: "Idle",
        Executor: "Idle",
        Guardian: "Monitoring"
      });

      appendAgentLog("[Prioritizer] Activating multi-factor deadline algorithms on new tasks...");
      await new Promise((r) => setTimeout(r, 800));
      appendAgentLog(`[Prioritizer] Successfully prioritized and allocated ${totalTasksAdded} new runway operations.`);
      
      showToast(`Added ${totalTasksAdded} tasks from your photo!`, "success");

    } catch (err) {
      console.error("Failed to add photo tasks:", err);
      showToast("Could not save extracted vision tasks.", "error");
      appendAgentLog(`[Orchestrator] ERROR: Save sequence failed: ${err.message}`);
    } finally {
      setIsPlanning(false);
    }
  };

  // Handle Chat Submit to AI Orchestrator
  const handleChatSubmit = async (prompt) => {
    if (!prompt.trim() || !user) return;

    let targetGoalId = activeGoalId;

    // If no active goal track exists, automatically build a new one
    if (!targetGoalId) {
      if (user.isSandboxMock) {
        try {
          const newGoal = {
            id: "local-goal-" + Date.now(),
            name: prompt.length > 25 ? prompt.substring(0, 25) + "..." : prompt,
            description: `Auto-generated runway for: "${prompt}"`,
            userId: user.uid,
            createdAt: new Date().toISOString()
          };
          const nextGoals = [...goals, newGoal];
          localStorage.setItem("deadline_slayer_local_goals", JSON.stringify(nextGoals));
          setGoals(nextGoals);
          targetGoalId = newGoal.id;
          setActiveGoalId(newGoal.id);
          appendAgentLog(`Created target Goal Track (Offline Sandbox): "${newGoal.name}"`);
        } catch (err) {
          console.error("Local auto goal creation error:", err);
          showToast("Could not allocate operational track.", "error");
          return;
        }
      } else {
        try {
          const docRef = await addDoc(collection(db, "goals"), {
            name: prompt.length > 25 ? prompt.substring(0, 25) + "..." : prompt,
            description: `Auto-generated runway for: "${prompt}"`,
            userId: user.uid,
            createdAt: serverTimestamp()
          });
          targetGoalId = docRef.id;
          setActiveGoalId(docRef.id);
          appendAgentLog(`Created new Goal Track for plan: "${prompt}"`);
        } catch (err) {
          console.error("Auto goal creation error:", err);
          showToast("Could not allocate operational track.", "error");
          return;
        }
      }
    }

    setAgentStatus({
      Orchestrator: "Analyzing",
      Executor: "Waiting",
      Guardian: "Waiting"
    });
    setIsPlanning(true);
    appendAgentLog(`Initializing multi-agent intent parsing for prompt: "${prompt}"`);
    showToast("Dispatching instruction to AI Orchestrator...", "info");

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, goalId: targetGoalId })
      });

      if (!response.ok) {
        throw new Error(`Orchestrator HTTP failure: ${response.status}`);
      }

      const result = await response.json();
      
      // Phase 1: Orchestrator Logs
      setAgentStatus({
        Orchestrator: "Synthesizing",
        Executor: "Compiling",
        Guardian: "Waiting"
      });

      // Stream logs slowly for authentic terminal feel
      if (result.logs && result.logs.length > 0) {
        for (const logLine of result.logs) {
          appendAgentLog(logLine);
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      // Phase 2: Executor populating DB
      setAgentStatus({
        Orchestrator: "Complete",
        Executor: "Executing",
        Guardian: "Auditing"
      });

      if (result.tasks && result.tasks.length > 0) {
        appendAgentLog(`[Executor] Pushing ${result.tasks.length} subtasks to pipeline...`);
        
        if (user.isSandboxMock) {
          const newTasks = result.tasks.map((t, idx) => ({
            id: "local-task-" + Date.now() + "-" + idx,
            name: t.name,
            quadrant: Number(t.quadrant) || 1,
            priority: t.priority || "High",
            estimatedMinutes: Number(t.estimatedMinutes) || 45,
            category: t.category || "General",
            status: "Pending",
            goalId: targetGoalId,
            userId: user.uid,
            createdAt: new Date().toISOString()
          }));
          const nextTasks = [...tasks, ...newTasks];
          localStorage.setItem("deadline_slayer_local_tasks", JSON.stringify(nextTasks));
          setTasks(nextTasks);
          appendAgentLog(`[Executor] Local transaction complete. Sandbox Pipeline live!`);
        } else {
          const batch = writeBatch(db);
          result.tasks.forEach((t) => {
            const newTaskRef = doc(collection(db, "tasks"));
            batch.set(newTaskRef, {
              name: t.name,
              quadrant: Number(t.quadrant) || 1,
              priority: t.priority || "High",
              estimatedMinutes: Number(t.estimatedMinutes) || 45,
              category: t.category || "General",
              status: "Pending",
              goalId: targetGoalId,
              userId: user.uid,
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
          appendAgentLog(`[Executor] Database transaction complete. Pipeline live!`);
        }
      }

      // Phase 3: Guardian review
      setAgentStatus({
        Orchestrator: "Idle",
        Executor: "Idle",
        Guardian: "Monitoring"
      });

      if (result.analysis) {
        appendAgentLog(`[Guardian] ANALYSIS ADVISORY: "${result.analysis}"`);
      }

      showToast("AI Orchestration complete!", "success");

    } catch (err) {
      console.error("Orchestrator submit error:", err);
      appendAgentLog(`ERROR: Orchestrator dispatch loop failed: ${err.message}`);
      setAgentStatus({
        Orchestrator: "Idle",
        Executor: "Idle",
        Guardian: "Idle"
      });
      showToast("Orchestration encountered an error.", "error");
    } finally {
      setIsPlanning(false);
    }
  };

  // Compute stats for selected goal track
  const activeGoalTasks = activeGoalId ? tasks.filter((t) => t.goalId === activeGoalId) : tasks;
  
  // Sort and filter activeGoalTasks for rendering
  const processedTasks = [...activeGoalTasks]
    .filter((t) => {
      if (pipelineFilter === "pending") return t.status !== "Completed";
      if (pipelineFilter === "completed") return t.status === "Completed";
      if (pipelineFilter === "critical") {
        const isUrgent = t.priorityScore >= 70 || 
                         t.priority === "Urgent-Important" || 
                         t.priority === "High" || 
                         Number(t.quadrant) === 1;
        return t.status !== "Completed" && isUrgent;
      }
      if (pipelineFilter === "urgent") {
        if (t.status === "Completed") return false;
        const dl = t.deadline || (goals.find(g => g.id === t.goalId)?.deadline);
        if (!dl) return false;
        const hoursLeft = (new Date(dl) - new Date()) / (1000 * 60 * 60);
        return hoursLeft < 24;
      }
      if (pipelineFilter === "soon") {
        if (t.status === "Completed") return false;
        const dl = t.deadline || (goals.find(g => g.id === t.goalId)?.deadline);
        if (!dl) return false;
        const hoursLeft = (new Date(dl) - new Date()) / (1000 * 60 * 60);
        return hoursLeft >= 24 && hoursLeft < 72;
      }
      if (pipelineFilter === "ok") {
        if (t.status === "Completed") return false;
        const dl = t.deadline || (goals.find(g => g.id === t.goalId)?.deadline);
        if (!dl) return false;
        const hoursLeft = (new Date(dl) - new Date()) / (1000 * 60 * 60);
        return hoursLeft >= 72;
      }
      return true;
    })
    .sort((a, b) => {
      if (pipelineSort === "priority") {
        const scoreA = Number(a.priorityScore) || (a.priority === "Urgent-Important" || a.priority === "High" ? 90 : a.priority === "Important-Not-Urgent" || a.priority === "Medium" ? 60 : 30);
        const scoreB = Number(b.priorityScore) || (b.priority === "Urgent-Important" || b.priority === "High" ? 90 : b.priority === "Important-Not-Urgent" || b.priority === "Medium" ? 60 : 30);
        return scoreB - scoreA; // Highest priority score first
      }
      if (pipelineSort === "duration") {
        const durA = Number(a.estimatedMinutes) || Number(a.estimate) || 0;
        const durB = Number(b.estimatedMinutes) || Number(b.estimate) || 0;
        return durA - durB; // Quickest first
      }
      // Default: "order"
      const orderA = Number(a.order) || 999;
      const orderB = Number(b.order) || 999;
      return orderA - orderB;
    });

  const totalTasks = activeGoalTasks.length;
  const completedTasks = activeGoalTasks.filter((t) => t.status === "Completed").length;
  const pendingTasks = totalTasks - completedTasks;
  const slayRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const savedMinutes = activeGoalTasks
    .filter((t) => t.status === "Completed")
    .reduce((sum, t) => sum + (Number(t.estimatedMinutes) || Number(t.estimate) || 30), 0);

  const formatRunwayRecovery = (minutes) => {
    if (!minutes || minutes <= 0) return "0m";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0 && mins > 0) {
      return `${hrs}h ${mins}m`;
    } else if (hrs > 0) {
      return `${hrs}h`;
    } else {
      return `${mins}m`;
    }
  };

  // Compute Priority Matrix Quadrant listings
  const getTasksByQuadrant = (qNum) => activeGoalTasks.filter((t) => Number(t.quadrant) === Number(qNum));

  // Chart Data: Task Category Distribution (Completed vs Pending Ratio)
  const categoryCounts = activeGoalTasks.reduce((acc, t) => {
    const cat = t.category || "General";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categoriesList = Object.keys(categoryCounts).length > 0 ? Object.keys(categoryCounts) : ["General"];
  const completedCountsByCat = categoriesList.map((cat) => 
    activeGoalTasks.filter((t) => (t.category || "General") === cat && t.status === "Completed").length
  );
  const pendingCountsByCat = categoriesList.map((cat) => 
    activeGoalTasks.filter((t) => (t.category || "General") === cat && t.status !== "Completed").length
  );

  const chartData = {
    labels: categoriesList,
    datasets: [
      {
        label: "Slayed",
        data: completedCountsByCat,
        backgroundColor: "rgba(16, 185, 129, 0.45)",
        borderColor: "#10b981",
        borderWidth: 1.5,
        borderRadius: 4,
        barPercentage: 0.6
      },
      {
        label: "Pending",
        data: pendingCountsByCat,
        backgroundColor: "rgba(139, 92, 246, 0.45)",
        borderColor: "#8b5cf6",
        borderWidth: 1.5,
        borderRadius: 4,
        barPercentage: 0.6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true,
        position: "top",
        align: "end",
        labels: {
          color: "#94a3b8",
          font: { family: "Inter", size: 10, weight: "600" },
          boxWidth: 12,
          padding: 8
        }
      },
      tooltip: {
        backgroundColor: "rgba(12, 17, 32, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        titleFont: { family: "Outfit", size: 12, weight: "bold" },
        bodyFont: { family: "Inter", size: 11 },
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: "#94a3b8", font: { family: "Inter", size: 10 } }
      },
      y: {
        stacked: true,
        grid: { color: "rgba(255, 255, 255, 0.05)", drawTicks: false },
        ticks: { color: "#94a3b8", font: { family: "Inter", size: 10 }, stepSize: 1 }
      }
    }
  };

  if (authLoading) {
    return (
      <div className={styles.loaderContainer}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div 
      className={`${styles.dashboardContainer} ${isPanicActive ? styles.panicGlow : ""}`}
      style={{
        "--sidebar-width-current": isFocusLock ? "0px" : (sidebarCollapsed ? "68px" : "280px")
      }}
    >
      {/* Sidebar Navigation */}
      {!isFocusLock && (
        <Sidebar 
          tasks={tasks}
          goals={goals}
          activeGoalId={activeGoalId}
          setActiveGoalId={setActiveGoalId}
          onGoalSelect={setActiveGoalId}
          showAddGoal={showAddGoal}
          setShowAddGoal={setShowAddGoal}
          newGoalTitle={newGoalTitle}
          setNewGoalTitle={setNewGoalTitle}
          newGoalDesc={newGoalDesc}
          setNewGoalDesc={setNewGoalDesc}
          newGoalDeadline={newGoalDeadline}
          setNewGoalDeadline={setNewGoalDeadline}
          handleAddGoalSubmit={handleAddGoalSubmit}
          setGoalToDelete={setGoalToDelete}
          user={user}
          logout={logout}
          activeAgent="Orchestrator"
          agentStates={agentStatus}
          onTriggerPanic={handleTriggerPanic}
          isPanicMode={isPanicActive}
          actionsLog={agentLogs}
          onCollapseChange={setSidebarCollapsed}
          pipelineFilter={pipelineFilter}
          setPipelineFilter={setPipelineFilter}
        />
      )}

      {/* Main Control Center */}
      <main className={isFocusLock ? styles.mainContentFocus : (sidebarCollapsed ? styles.mainContentCollapsed : styles.mainContent)}>
        {isFocusLock ? (
          <div className={styles.blackoutContainer}>
            <div className={styles.blackoutContent}>
              <div className={styles.lockIconGlow}>
                <Lock size={48} className={styles.lockActiveIcon} />
              </div>
              <span className={styles.blackoutSubtitle}>Focus Lock Engaged</span>
              <h2 className={styles.blackoutTitle}>
                {tasks.find(t => t.status !== "Completed" && (!activeGoalId || t.goalId === activeGoalId))?.name || "Current Target Runway"}
              </h2>
              <p className={styles.blackoutGoalText}>
                Active Goal Track: {goals.find(g => g.id === activeGoalId)?.name || "All Tracks"}
              </p>
            </div>
          </div>
        ) : goals.length === 0 && tasks.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            textAlign: "center",
            padding: "3rem 2rem",
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            borderRadius: "16px",
            maxWidth: "600px",
            margin: "4rem auto",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
          }}>
            <span style={{ fontSize: "4rem", marginBottom: "1.5rem", display: "block" }}>🎯</span>
            <h2 style={{
              fontSize: "2rem",
              fontWeight: "800",
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
              marginBottom: "0.75rem",
              letterSpacing: "-0.02em"
            }}>
              What&apos;s your next deadline?
            </h2>
            <p style={{
              fontSize: "1rem",
              color: "var(--text-secondary)",
              lineHeight: "1.6",
              marginBottom: "2rem",
              maxWidth: "450px"
            }}>
              Tell me your goal and deadline. I&apos;ll break it into tasks, prioritize them, and help you complete each one with AI.
            </p>
            <button 
              onClick={() => {
                setShowAddGoal(true);
                if (sidebarCollapsed) {
                  setSidebarCollapsed(false);
                }
              }} 
              style={{
                padding: "0.875rem 2rem",
                background: "var(--accent-gradient)",
                color: "#ffffff",
                borderRadius: "12px",
                fontSize: "1rem",
                fontWeight: "700",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(59, 130, 246, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(59, 130, 246, 0.3)";
              }}
            >
              + Create Your First Goal
            </button>
          </div>
        ) : (
          <>
            {/* Top Operational Header */}
            <header className={styles.mainHeader}>
              <div>
                <div className={styles.titleRow}>
                  {activeGoalId ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                        <span>Runway Track</span>
                        <span style={{ opacity: 0.3 }}>/</span>
                        <button 
                          onClick={() => setActiveGoalId(null)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent-purple)",
                            cursor: "pointer",
                            padding: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            textDecoration: "underline",
                            textUnderlineOffset: "3px"
                          }}
                        >
                          Reset Filter
                        </button>
                      </div>
                      <h1 className={styles.dashboardTitle} style={{ marginTop: "4px", fontSize: "2.25rem", backgroundImage: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>
                        {goals.find((g) => g.id === activeGoalId)?.name}
                      </h1>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                        <span>System Status</span>
                        <span style={{ opacity: 0.3 }}>/</span>
                        <span style={{ color: "#34D399", fontWeight: 600 }}>Nominal</span>
                      </div>
                      <h1 className={styles.dashboardTitle} style={{ marginTop: "4px", fontSize: "2.25rem", backgroundImage: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>
                        System Dashboard
                      </h1>
                    </div>
                  )}
                </div>
              </div>

              <button 
                className={`${styles.panicBtn} ${isPanicActive ? styles.panicBtnActive : ""}`}
                onClick={handleTriggerPanic}
              >
                <ShieldAlert size={18} />
                {isPanicActive ? "🚨 SLAYER PROTOCOL ACTIVE" : "⚔️ SLAYER PROTOCOL"}
              </button>
            </header>

            {/* Daily Briefing component */}
            {dailyBriefing && !isBriefingDismissed && (
              <DailyBriefing 
                briefing={dailyBriefing} 
                onDismiss={() => {
                  setIsBriefingDismissed(true);
                  appendAgentLog("[Orchestrator] Daily briefing dismissed by Operator.");
                }}
                onStartUrgent={handleStartUrgent}
              />
            )}

            {/* Procrastination Alert component */}
            {procrastinationAlert && procrastinationAlert.detected && !isProcrastinationDismissed && (
              <ProcrastinationAlert 
                procrastination={procrastinationAlert} 
                onDismiss={() => {
                  setIsProcrastinationDismissed(true);
                  sessionStorage.setItem("procrastination-dismissed", "true");
                  appendAgentLog("[Orchestrator] Procrastination pattern warning dismissed by Operator.");
                }}
                onBreakDown={handleBreakDown}
                allTasks={tasks}
              />
            )}

            {/* Operational Metrics Row */}
            <div className={styles.metricsGrid} id="analytics-section">
              {/* Metric 1: Deadline Slay Rate */}
              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <span className={styles.metricTitle}>DEADLINE SLAY RATE</span>
                  <Flame className={styles.metricIconFlame} size={16} />
                </div>
                <div className={styles.metricValueWrapper}>
                  <span className={styles.metricValue}>{slayRate}%</span>
                  <span className={styles.metricTrend}>
                    <TrendingUp size={12} style={{ marginRight: "4px" }} />
                    +{slayRate > 0 ? 10 : 0}%
                  </span>
                </div>
                <div className={styles.metricProgressBarWrapper}>
                  <div className={styles.metricProgressBar} style={{ width: `${slayRate}%` }}></div>
                </div>
                <span className={styles.metricSubtitle}>{completedTasks} of {totalTasks} subtasks slain</span>
              </div>

              {/* Metric 2: Runway Remaining */}
              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <span className={styles.metricTitle}>RUNWAY RECOVERED</span>
                  <Clock className={styles.metricIconClock} size={16} />
                </div>
                <div className={styles.metricValueWrapper}>
                  <span className={styles.metricValue}>{formatRunwayRecovery(savedMinutes)}</span>
                  <span className={styles.metricTrend}>
                    🧬 Active
                  </span>
                </div>
                <div className={styles.metricProgressBarWrapper}>
                  <div className={styles.metricProgressBar} style={{ width: `${Math.min(100, (savedMinutes / 480) * 100)}%` }}></div>
                </div>
                <span className={styles.metricSubtitle}>Focus duration accumulated</span>
              </div>

              {/* Metric 3: Active Pressure */}
              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <span className={styles.metricTitle}>PENDING BURNDOWN</span>
                  <Activity className={styles.metricIconActivity} size={16} />
                </div>
                <div className={styles.metricValueWrapper}>
                  <span className={styles.metricValue}>{pendingTasks}</span>
                  <span className={styles.metricTrend} style={{ color: pendingTasks > 3 ? "var(--accent-pink)" : "var(--success-green)" }}>
                    {pendingTasks > 3 ? "🔥 High Load" : "⚡ Controlled"}
                  </span>
                </div>
                <div className={styles.metricProgressBarWrapper}>
                  <div className={styles.metricProgressBar} style={{ 
                    width: `${totalTasks > 0 ? (pendingTasks / totalTasks) * 100 : 0}%`,
                    background: pendingTasks > 3 ? "var(--danger-gradient)" : "var(--accent-gradient)"
                  }}></div>
                </div>
                <span className={styles.metricSubtitle}>Threat vectors remaining</span>
              </div>
            </div>

        {/* Primary Dashboard Area */}
        <div className={styles.dashboardGrid}>
            {/* Priority Matrix */}
            <div className={styles.matrixContainer}>
              <div className={styles.panelTitle}>
                <Grid size={16} />
                PRIORITY MATRIX (URGENCY/IMPORTANCE)
              </div>

              <div className={styles.matrixGrid}>
                {/* Q1 */}
                <div className={`${styles.matrixQuadrant} ${styles.quadrantQ1}`}>
                  <div className={styles.quadrantHeader}>
                    <span className={styles.quadrantNumber}>Q1</span>
                    <span className={styles.quadrantTitle}>URGENT & IMPORTANT</span>
                  </div>
                  <div className={styles.quadrantTasks}>
                    {getTasksByQuadrant(1).length === 0 ? (
                      <p className={styles.emptyQuadrantText}>No immediate critical threats.</p>
                    ) : (
                      getTasksByQuadrant(1).map((t) => (
                        <div key={t.id} className={styles.miniTaskItem}>
                          <span className={`${styles.statusIndicator} ${t.status === "Completed" ? styles.statusCompleted : ""}`}></span>
                          <span className={t.status === "Completed" ? styles.taskLineThrough : ""}>{t.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Q2 */}
                <div className={`${styles.matrixQuadrant} ${styles.quadrantQ2}`}>
                  <div className={styles.quadrantHeader}>
                    <span className={styles.quadrantNumber}>Q2</span>
                    <span className={styles.quadrantTitle}>STRATEGIC VALUE (IMPORTANT)</span>
                  </div>
                  <div className={styles.quadrantTasks}>
                    {getTasksByQuadrant(2).length === 0 ? (
                      <p className={styles.emptyQuadrantText}>No strategic operations logged.</p>
                    ) : (
                      getTasksByQuadrant(2).map((t) => (
                        <div key={t.id} className={styles.miniTaskItem}>
                          <span className={`${styles.statusIndicator} ${t.status === "Completed" ? styles.statusCompleted : ""}`}></span>
                          <span className={t.status === "Completed" ? styles.taskLineThrough : ""}>{t.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Q3 */}
                <div className={`${styles.matrixQuadrant} ${styles.quadrantQ3}`}>
                  <div className={styles.quadrantHeader}>
                    <span className={styles.quadrantNumber}>Q3</span>
                    <span className={styles.quadrantTitle}>MINOR DELEGATIONS (URGENT)</span>
                  </div>
                  <div className={styles.quadrantTasks}>
                    {getTasksByQuadrant(3).length === 0 ? (
                      <p className={styles.emptyQuadrantText}>No low-priority urgent actions.</p>
                    ) : (
                      getTasksByQuadrant(3).map((t) => (
                        <div key={t.id} className={styles.miniTaskItem}>
                          <span className={`${styles.statusIndicator} ${t.status === "Completed" ? styles.statusCompleted : ""}`}></span>
                          <span className={t.status === "Completed" ? styles.taskLineThrough : ""}>{t.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Q4 */}
                <div className={`${styles.matrixQuadrant} ${styles.quadrantQ4}`}>
                  <div className={styles.quadrantHeader}>
                    <span className={styles.quadrantNumber}>Q4</span>
                    <span className={styles.quadrantTitle}>TRIVIAL ENTRIES (ELIMINATE)</span>
                  </div>
                  <div className={styles.quadrantTasks}>
                    {getTasksByQuadrant(4).length === 0 ? (
                      <p className={styles.emptyQuadrantText}>Empty. Trivial loads eliminated.</p>
                    ) : (
                      getTasksByQuadrant(4).map((t) => (
                        <div key={t.id} className={styles.miniTaskItem}>
                          <span className={`${styles.statusIndicator} ${t.status === "Completed" ? styles.statusCompleted : ""}`}></span>
                          <span className={t.status === "Completed" ? styles.taskLineThrough : ""}>{t.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Runway Analysis Chart */}
            <div className={styles.chartContainer} id="productivity-charts-panel">
              <div className={styles.panelTitle}>
                <TrendingUp size={16} />
                RUNWAY PIPELINE DISTRIBUTION (SLAYED VS PENDING BY CATEGORY)
              </div>
              <div className={styles.chartWrapper}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* AI Orchestrator Control Hub */}
            <div className={styles.aiTerminalContainer}>
              <div className={styles.panelTitle}>
                <Terminal size={16} />
                AI MULTI-AGENT ORCHESTRATION HUB
              </div>

              {/* Agent Status Indicators */}
              <div className={styles.agentsStatusGrid}>
                {Object.entries(agentStatus).map(([agent, status]) => (
                  <div key={agent} className={styles.agentStatusBadge}>
                    <span className={`${styles.agentStatusDot} ${status !== "Idle" && status !== "Complete" ? styles.dotActive : ""}`}></span>
                    <span className={styles.agentStatusName}>{agent}:</span>
                    <span className={styles.agentStatusText}>{status}</span>
                  </div>
                ))}
              </div>

              {/* Terminal Logs */}
              <div className={styles.terminalLogs}>
                {agentLogs.map((log, idx) => (
                  <div key={idx} className={styles.logLine}>
                    <span className={styles.logSymbol}>&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              {/* Chat Input */}
              <ChatInput 
                onSubmit={handleChatSubmit} 
                isPlanning={isPlanning} 
                inputRef={chatInputRef}
                value={chatInputValue}
                onChange={setChatInputValue}
                onAddPhotoTasks={handlePhotoTasksExtracted}
              />
            </div>

            {/* Active Subtask Stream */}
            <div className={styles.tasksSection}>
              <div className={styles.pipelineHeader}>
                <div className={styles.pipelineTitleRow}>
                  <div className={styles.panelTitle} style={{ margin: 0 }}>
                    <CheckSquare size={16} />
                    RUNWAY PIPELINE OPERATIONS
                  </div>
                  <div className={styles.taskTime}>
                    <Activity size={12} />
                    <span>{pendingTasks} of {totalTasks} Pending</span>
                  </div>
                </div>

                <div className={styles.pipelineControls}>
                  <div className={styles.pipelineTabs}>
                    <button 
                      className={`${styles.pipelineTabBtn} ${pipelineFilter === "all" ? styles.pipelineTabBtnActive : ""}`}
                      onClick={() => setPipelineFilter("all")}
                    >
                      📋 ALL
                    </button>
                    <button 
                      className={`${styles.pipelineTabBtn} ${pipelineFilter === "critical" ? styles.pipelineTabBtnActive : ""}`}
                      onClick={() => setPipelineFilter("critical")}
                    >
                      ⚡ CRITICAL
                    </button>
                    <button 
                      className={`${styles.pipelineTabBtn} ${pipelineFilter === "pending" ? styles.pipelineTabBtnActive : ""}`}
                      onClick={() => setPipelineFilter("pending")}
                    >
                      ⏳ PENDING
                    </button>
                    <button 
                      className={`${styles.pipelineTabBtn} ${pipelineFilter === "completed" ? styles.pipelineTabBtnActive : ""}`}
                      onClick={() => setPipelineFilter("completed")}
                    >
                      ✅ SLAYED
                    </button>
                    {(pipelineFilter === "urgent" || pipelineFilter === "soon" || pipelineFilter === "ok") && (
                      <button 
                        className={`${styles.pipelineTabBtn} ${styles.pipelineTabBtnActive}`}
                        onClick={() => setPipelineFilter("all")}
                        style={{ border: "1px solid #a5b4fc" }}
                      >
                        ⏱️ {pipelineFilter.toUpperCase()} ACTIVE (×)
                      </button>
                    )}
                  </div>

                  <div className={styles.pipelineSortWrapper}>
                    <span className={styles.pipelineSortLabel}>Sort By:</span>
                    <select 
                      className={styles.pipelineSortSelect}
                      value={pipelineSort}
                      onChange={(e) => setPipelineSort(e.target.value)}
                    >
                      <option value="order">🔢 Sequential Order</option>
                      <option value="priority">🎯 Priority Score</option>
                      <option value="duration">⏱️ Quickest First</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.tasksList}>
                {activeGoalTasks.length === 0 ? (
                  <EmptyState 
                    onSelectSuggestion={(suggestion) => {
                      setChatInputValue(suggestion);
                      if (chatInputRef.current) {
                        chatInputRef.current.focus();
                      }
                      showToast(`Selected suggestion! Click SEND to begin.`, "info");
                    }}
                  />
                ) : processedTasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.825rem", fontFamily: "var(--font-mono)" }}>
                    NO RUNWAY OPERATIONS MATCH THE SELECTED FILTER CRITERIA.
                  </div>
                ) : (
                  processedTasks.map((task, idx) => {
                    const isBlocked = task.dependsOn && activeGoalTasks.some(pt => Number(pt.order) === Number(task.dependsOn) && pt.status !== "Completed");
                    const parentTask = task.dependsOn ? activeGoalTasks.find(pt => Number(pt.order) === Number(task.dependsOn)) : null;

                    const getPriorityStyles = (p) => {
                      const priorityStr = (p || "").toLowerCase();
                      if (priorityStr.includes("high") || priorityStr.includes("urgent-important")) {
                        return { label: "Urgent-Important", className: styles.priorityHigh };
                      }
                      if (priorityStr.includes("medium") || priorityStr.includes("important-not-urgent")) {
                        return { label: "Strategic Value", className: styles.priorityMedium };
                      }
                      if (priorityStr.includes("low") || priorityStr.includes("not-urgent-not-important") || priorityStr.includes("urgent-not-important")) {
                        return { label: "Trivial/Delegate", className: styles.priorityLow };
                      }
                      return { label: p || "Strategic", className: styles.priorityMedium };
                    };
                    const pStyle = getPriorityStyles(task.priority);

                    return (
                      <div 
                        key={task.id} 
                        id={`task-card-${task.id}`}
                        className={`${styles.taskCard} ${task.status === "Completed" ? styles.taskCardCompleted : ""} ${isBlocked ? styles.taskCardBlocked : ""} ${highlightedTaskId === task.id ? styles.taskCardHighlighted : ""}`}
                      >
                        <button 
                          className={styles.taskCheckbox} 
                          onClick={() => handleToggleTaskStatus(task)}
                        >
                          {task.status === "Completed" ? (
                            <CheckSquare className={styles.checkedIcon} size={18} />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>

                        <div className={styles.orderIndexBadge}>
                          #{task.order || idx + 1}
                        </div>

                        <div className={styles.taskCardInfo}>
                          <p className={`${styles.taskCardName} ${task.status === "Completed" ? styles.taskCardNameCompleted : ""}`}>
                            {task.name}
                          </p>
                          
                          {/* Blocked or dependency status alerts */}
                          {isBlocked && parentTask && (
                            <div className={styles.blockedBadge}>
                              <span>⚠️ BLOCKED: Requires sequence #{task.dependsOn} &ldquo;{parentTask.name}&rdquo;</span>
                            </div>
                          )}
                          {!isBlocked && task.dependsOn && parentTask && (
                            <div className={styles.dependencyBadge}>
                              <span>⛓️ Sequence #{task.dependsOn} Completed</span>
                            </div>
                          )}

                          <div className={styles.taskMetaGroup}>
                            <span className={styles.taskCategory}>{task.category || "General"}</span>
                            <span className={styles.taskTime}>
                              <Clock size={10} />
                              {task.estimatedMinutes || task.estimate || 30}m
                            </span>
                            <span className={`${styles.taskPriority} ${pStyle.className}`}>
                              {pStyle.label}
                            </span>
                            {task.priorityScore !== undefined && task.priorityScore !== null && (
                              <span className={styles.priorityScoreBadge}>
                                🎯 {task.priorityScore}% Score
                              </span>
                            )}
                          </div>
                        </div>

                        <button 
                          className={styles.deleteTaskBtn} 
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
        </div>
          </>
        )}
      </main>

      {isPanicActive && (
        <PanicMode
          onClose={handleClosePanicMode}
          tasks={tasks}
          goals={goals}
          activeGoalId={activeGoalId}
          uid={user.uid}
          onTaskCompleted={handleToggleTaskStatus}
          onDeleteTask={handleDeleteTask}
          onUpdateGoalDescription={handleUpdateGoalDescription}
          isFocusLock={isFocusLock}
          setIsFocusLock={setIsFocusLock}
        />
      )}

      {/* Custom Confirmation Modal */}
      {goalToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <ShieldAlert className={styles.modalIcon} size={24} />
              <h3 className={styles.modalTitle}>CONFIRM OPERATIONS DISCARD</h3>
            </div>
            <p className={styles.modalMessage}>
              Are you sure you want to slay and discard track <strong>&ldquo;{goalToDelete.name}&rdquo;</strong>? All associated subtasks and runway protocols will be permanently lost.
            </p>
            <div className={styles.modalActions}>
              <button 
                className={styles.modalCancelBtn} 
                onClick={() => setGoalToDelete(null)}
              >
                ABORT
              </button>
              <button 
                className={styles.modalConfirmBtn} 
                onClick={() => {
                  executeDeleteGoal(goalToDelete.id);
                  setGoalToDelete(null);
                }}
              >
                DISCARD TRACK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
