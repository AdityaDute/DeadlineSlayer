"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./Sidebar.module.css";
import { 
  Flame, 
  LayoutDashboard, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Trash2,
  X,
  Sliders,
  Volume2,
  VolumeX,
  Shield,
  Cpu,
  RefreshCw,
  User,
  Calendar,
  Target
} from "lucide-react";
import { useToast } from "./Toast";

export default function Sidebar({ 
  tasks = [], 
  goals = [], 
  activeGoalId,
  setActiveGoalId,
  showAddGoal,
  setShowAddGoal,
  newGoalTitle,
  setNewGoalTitle,
  newGoalDesc,
  setNewGoalDesc,
  newGoalDeadline = "",
  setNewGoalDeadline = () => {},
  handleAddGoalSubmit,
  setGoalToDelete,
  user,
  logout,
  activeAgent = "Orchestrator",
  agentStates = {},
  onTriggerPanic,
  isPanicMode = false,
  actionsLog = [],
  onCollapseChange,
  onGoalSelect,
  pipelineFilter = "all",
  setPipelineFilter = () => {}
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeNav, setActiveNav] = useState("Dashboard");

  // Custom states for settings customization
  const [displayName, setDisplayName] = useState("");
  const [customRole, setCustomRole] = useState("SYSTEM OPERATIVE");
  const [showSettings, setShowSettings] = useState(false);
  const [prefModel, setPrefModel] = useState("gemini-3.5-flash");
  const [prefVigilance, setPrefVigilance] = useState("Standard");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const showToast = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("deadline_slayer_custom_name");
      if (savedName) setDisplayName(savedName);
      else if (user?.displayName) setDisplayName(user.displayName);
      else setDisplayName("Operator");

      const savedRole = localStorage.getItem("deadline_slayer_custom_role");
      if (savedRole) setCustomRole(savedRole);

      const savedModel = localStorage.getItem("deadline_slayer_ai_model");
      if (savedModel) setPrefModel(savedModel);

      const savedVigilance = localStorage.getItem("deadline_slayer_alert_level");
      if (savedVigilance) setPrefVigilance(savedVigilance);

      const savedSound = localStorage.getItem("deadline_slayer_sound_enabled");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");
    }
  }, [user]);

  const handleSaveSettings = () => {
    localStorage.setItem("deadline_slayer_custom_name", displayName);
    localStorage.setItem("deadline_slayer_custom_role", customRole);
    localStorage.setItem("deadline_slayer_ai_model", prefModel);
    localStorage.setItem("deadline_slayer_alert_level", prefVigilance);
    localStorage.setItem("deadline_slayer_sound_enabled", String(soundEnabled));
    
    // Attempt updating local mock user name if stored
    const mockUserStr = localStorage.getItem("deadline_slayer_mock_user");
    if (mockUserStr) {
      try {
        const parsed = JSON.parse(mockUserStr);
        parsed.displayName = displayName;
        localStorage.setItem("deadline_slayer_mock_user", JSON.stringify(parsed));
      } catch (e) {}
    }
    
    showToast("Resilience matrix and operator preferences synchronized successfully.", "success");
    
    setShowSettings(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("deadline_slayer_settings_updated"));
    }
  };

  const handleResetSettings = () => {
    if (window.confirm("Restore default operating preferences? This will clear custom names, model choices, and auditory triggers.")) {
      localStorage.removeItem("deadline_slayer_custom_name");
      localStorage.removeItem("deadline_slayer_custom_role");
      localStorage.removeItem("deadline_slayer_ai_model");
      localStorage.removeItem("deadline_slayer_alert_level");
      localStorage.removeItem("deadline_slayer_sound_enabled");
      
      setDisplayName(user?.displayName || "Operator");
      setCustomRole("SYSTEM OPERATIVE");
      setPrefModel("gemini-3.5-flash");
      setPrefVigilance("Standard");
      setSoundEnabled(true);
      
      showToast("Settings rolled back to baseline operating parameters.", "info");
      
      setShowSettings(false);
      window.dispatchEvent(new Event("deadline_slayer_settings_updated"));
    }
  };

  const setDeadlineFromNow = (hours) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    // Format for datetime-local input YYYY-MM-DDTHH:MM in local timezone
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - offset * 60 * 1000);
    const formatted = localDate.toISOString().slice(0, 16);
    setNewGoalDeadline(formatted);
  };

  const enterTimeoutRef = useRef(null);
  const leaveTimeoutRef = useRef(null);

  // Initialize collapse state on mount
  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    } else {
      // Default: expanded on desktop, collapsed on tablet
      const width = window.innerWidth;
      if (width >= 768 && width <= 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    }
  }, []);

  // Notify parent on collapse change
  useEffect(() => {
    if (isMounted && onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed, onCollapseChange, isMounted]);

  // Handle external toggle event
  useEffect(() => {
    const handleExternalToggle = () => {
      setIsCollapsed(prev => {
        const next = !prev;
        localStorage.setItem("sidebar-collapsed", String(next));
        return next;
      });
      setIsHoverExpanded(false);
    };
    window.addEventListener("toggle-sidebar", handleExternalToggle);
    return () => window.removeEventListener("toggle-sidebar", handleExternalToggle);
  }, []);

  // Hover handlers for collapsible sidebar
  const handleMouseEnter = () => {
    if (isCollapsed) {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
      enterTimeoutRef.current = setTimeout(() => {
        setIsHoverExpanded(true);
      }, 300);
    }
  };

  const handleMouseLeave = () => {
    if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
    leaveTimeoutRef.current = setTimeout(() => {
      setIsHoverExpanded(false);
    }, 200);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
    setIsHoverExpanded(false);
  };

  const handleCreateGoalClick = () => {
    if (isCollapsedActual) {
      // Automatically expand first so form is visible and editable
      setIsCollapsed(false);
      localStorage.setItem("sidebar-collapsed", "false");
    }
    
    setShowAddGoal(!showAddGoal);

    // Try to find the chat input or a goals trigger to focus
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
      chatInput.focus();
      chatInput.value = "Create a new goal: ";
    }
  };

  const handleNavClick = (id) => {
    setActiveNav(id);
    if (id === "Dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (id === "My Tasks") {
      // Find Runway Pipeline container and scroll
      const pipelineEl = document.querySelector('[class*="pipelineContainer"]') || 
                         document.querySelector('[class*="pipeline"]') || 
                         document.getElementById("pipeline-section");
      if (pipelineEl) {
        pipelineEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 400, behavior: "smooth" });
      }
    } else if (id === "Analytics") {
      // Find Analytics/Metrics container and scroll
      const metricsEl = document.querySelector('[class*="metricsSection"]') || 
                        document.querySelector('[class*="charts"]') || 
                        document.getElementById("analytics-section");
      if (metricsEl) {
        metricsEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 1000, behavior: "smooth" });
      }
    }
  };

  const handleBadgeClick = (filterType) => {
    if (setPipelineFilter) {
      setPipelineFilter(prev => prev === filterType ? "all" : filterType);
      
      // Find Runway Pipeline container and scroll
      const pipelineEl = document.querySelector('[class*="pipelineContainer"]') || 
                         document.querySelector('[class*="pipeline"]') || 
                         document.getElementById("pipeline-section");
      if (pipelineEl) {
        pipelineEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 400, behavior: "smooth" });
      }
    }
  };

  // Stats calculation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "Completed").length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

  const urgent = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'Completed') return false;
    const dl = t.deadline || (goals.find(g => g.id === t.goalId)?.deadline);
    if (!dl) return false;
    const hoursLeft = (new Date(dl) - new Date()) / (1000 * 60 * 60);
    return hoursLeft < 24;
  }).length;
  const soon = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'Completed') return false;
    const dl = t.deadline || (goals.find(g => g.id === t.goalId)?.deadline);
    if (!dl) return false;
    const hoursLeft = (new Date(dl) - new Date()) / (1000 * 60 * 60);
    return hoursLeft >= 24 && hoursLeft < 72;
  }).length;
  const ok = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'Completed') return false;
    const dl = t.deadline || (goals.find(g => g.id === t.goalId)?.deadline);
    if (!dl) return false;
    const hoursLeft = (new Date(dl) - new Date()) / (1000 * 60 * 60);
    return hoursLeft >= 72;
  }).length;

  // Status calculation
  const urgentTasksCount = tasks.filter(t => t.priority === "Urgent-Important" && t.status !== "Completed").length;
  
  let statusText = "On Track";
  let statusColorClass = styles.textSuccess;
  if (isPanicMode) {
    statusText = "Critical";
    statusColorClass = styles.textDanger;
  } else if (urgentTasksCount > 2) {
    statusText = "Critical";
    statusColorClass = styles.textDanger;
  } else if (urgentTasksCount > 0) {
    statusText = "At Risk";
    statusColorClass = styles.textWarning;
  }

  // AI Agents status
  const agents = [
    { id: "Orchestrator", name: "AI Orchestrator" },
    { id: "Planner", name: "AI Planner" },
    { id: "Prioritizer", name: "AI Prioritizer" },
    { id: "Executor", name: "AI Executor" },
    { id: "Guardian", name: "Deadline Guardian" }
  ];

  const isCollapsedActual = isCollapsed && !isHoverExpanded;

  const sidebarClass = [
    styles.sidebar,
    isCollapsedActual ? styles.sidebarCollapsed : "",
    isHoverExpanded ? styles.sidebarHoverExpanded : ""
  ].filter(Boolean).join(" ");

  return (
    <aside 
      className={sidebarClass} 
      id="sidebar-panel"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.scrollContainer}>
        {/* SECTION 1: App Logo */}
        <div className={styles.logoGroup} id="sidebar-logo">
          <Flame className={styles.logoIcon} size={20} />
          {!isCollapsedActual && (
            <h2 className={styles.logoText}>
              <span>DeadlineSlayer</span>
            </h2>
          )}
          {isCollapsedActual && (
            <span className={styles.logoTextShort}>⚡</span>
          )}
        </div>

      {/* SECTION 2: Stats Cards */}
      {!isCollapsedActual && (
        <div className={styles.statsSection}>
          {/* Card 1: Status */}
          <div className={styles.statItem}>
            <div className={styles.statLabel}>STATUS</div>
            <div className={`${styles.statValue} ${statusColorClass}`}>{statusText}</div>
          </div>

          {/* Card 2: Completion */}
          <div className={styles.statItem}>
            <div className={styles.statLabel}>COMPLETION</div>
            <div className={`${styles.statValue} ${styles.textAccent}`}>{completionRate}%</div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${completionRate}%` }} />
            </div>
          </div>

          {/* Card 3: Pending */}
          <div className={styles.statItem}>
            <div className={styles.statLabel}>PENDING</div>
            <div className={styles.statValue}>{pendingTasks}</div>
            <div className={styles.statSubtitle}>
              {pendingTasks === 1 ? "task remaining" : "tasks remaining"}
            </div>
          </div>

          {/* Indicators Row */}
          <div className={styles.indicatorsRow}>
            <div 
              className={`${styles.indicatorBadge} ${pipelineFilter === "urgent" ? styles.indicatorBadgeActive : ""}`} 
              title="Due in < 24 hours" 
              style={{ borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: '#EF4444' }}
              onClick={() => handleBadgeClick("urgent")}
            >
              <span className="urgent-pulse" style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444', marginRight: '4px' }} />
              <span>URGENT: {urgent}</span>
            </div>
            <div 
              className={`${styles.indicatorBadge} ${pipelineFilter === "soon" ? styles.indicatorBadgeActive : ""}`} 
              title="Due in 24 - 72 hours" 
              style={{ borderColor: 'rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.05)', color: '#F59E0B' }}
              onClick={() => handleBadgeClick("soon")}
            >
              <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', marginRight: '4px' }} />
              <span>SOON: {soon}</span>
            </div>
            <div 
              className={`${styles.indicatorBadge} ${pipelineFilter === "ok" ? styles.indicatorBadgeActive : ""}`} 
              title="Due in > 72 hours" 
              style={{ borderColor: 'rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)', color: '#10B981' }}
              onClick={() => handleBadgeClick("ok")}
            >
              <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', marginRight: '4px' }} />
              <span>OK: {ok}</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Create Goal Button */}
      <div className={styles.createGoalSection}>
        {!isCollapsedActual ? (
          <button 
            className={styles.createGoalBtn}
            onClick={handleCreateGoalClick}
            id="create-goal-btn"
          >
            <Plus size={16} />
            <span>Create Goal</span>
          </button>
        ) : (
          <button 
            className={styles.createGoalBtnCollapsed}
            onClick={handleCreateGoalClick}
            title="Create Goal"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Goal Creation Form */}
      {!isCollapsedActual && showAddGoal && (
        <form onSubmit={handleAddGoalSubmit} className={styles.addGoalForm}>
          <div>
            <label className={styles.addGoalFormLabel}>
              <Target size={12} className={styles.labelIcon} />
              <span>What&apos;s your goal?</span>
            </label>
            <input 
              type="text" 
              placeholder="e.g., Complete ML Project" 
              className={styles.formInput}
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          
          <div>
            <label className={styles.addGoalFormLabel}>
              <Calendar size={12} className={styles.labelIcon} />
              <span>When is it due?</span>
            </label>
            <input 
              type="datetime-local" 
              className={styles.formInput}
              style={{ colorScheme: 'dark' }}
              value={newGoalDeadline}
              onChange={(e) => setNewGoalDeadline(e.target.value)}
              required
            />
          </div>

          {/* Quick deadline buttons for fast input */}
          <div className={styles.quickDeadlinesRow}>
            <button type="button" onClick={() => setDeadlineFromNow(24)} className={styles.quickDeadlineBtn}>
              Tomorrow
            </button>
            <button type="button" onClick={() => setDeadlineFromNow(72)} className={styles.quickDeadlineBtn}>
              3 Days
            </button>
            <button type="button" onClick={() => setDeadlineFromNow(168)} className={styles.quickDeadlineBtn}>
              1 Week
            </button>
            <button type="button" onClick={() => setDeadlineFromNow(336)} className={styles.quickDeadlineBtn}>
              2 Weeks
            </button>
          </div>

          <div>
            <label className={styles.addGoalFormLabel}>
              <Sliders size={12} className={styles.labelIcon} />
              <span>Details (optional)</span>
            </label>
            <input 
              type="text" 
              placeholder="Any extra context..." 
              className={styles.formInput}
              value={newGoalDesc}
              onChange={(e) => setNewGoalDesc(e.target.value)}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowAddGoal(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn}>
              Create
            </button>
          </div>
        </form>
      )}

      {/* MY GOALS Section */}
      <div className={`${styles.goalsSection} ${isCollapsedActual ? styles.goalsSectionCollapsed : ""}`}>
        {!isCollapsedActual && <div className={styles.sectionTitle}>MY GOALS</div>}
        <div className={styles.goalsList}>
          {/* ALL OPERATIONS OPTION */}
          <div
            className={`${styles.goalItem} ${activeGoalId === null ? styles.goalItemActive : ''} ${isCollapsedActual ? styles.tooltipContainer : ''}`}
            onClick={() => {
              if (onGoalSelect) onGoalSelect(null);
              else if (setActiveGoalId) setActiveGoalId(null);
            }}
          >
            <div className={styles.goalLeft}>
              <span className={styles.goalDot} style={{ background: '#38BDF8' }} />
              {!isCollapsedActual && (
                <div className={styles.goalInfo}>
                  <span className={styles.goalName} style={{ fontWeight: '700' }}>ALL OPERATIONS</span>
                  <span className={styles.goalDeadline}>Show entire battlefield</span>
                </div>
              )}
            </div>
            {isCollapsedActual && (
              <span className={styles.tooltip}>All Operations</span>
            )}
          </div>

          {goals && goals.length > 0 ? (
            goals.map((goal) => {
              const goalTasks = tasks.filter(t => t.goalId === goal.id);
              const totalGoalTasks = goalTasks.length;
              const completedGoalTasks = goalTasks.filter(t => t.status === "Completed").length;
              
              let computedStatus = "not_started";
              if (totalGoalTasks > 0) {
                if (completedGoalTasks === totalGoalTasks) {
                  computedStatus = "completed";
                } else {
                  computedStatus = "in_progress";
                }
              } else if (goal.status) {
                computedStatus = goal.status;
              }

              let displayDeadline = "No deadline";
              if (goal.deadline) {
                displayDeadline = `Due ${new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
              } else if (totalGoalTasks > 0) {
                const taskDeadlines = goalTasks.map(t => t.deadline).filter(Boolean);
                if (taskDeadlines.length > 0) {
                  const nearest = new Date(taskDeadlines.sort()[0]);
                  displayDeadline = `Due ${nearest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                }
              }

              const dotColor = computedStatus === 'completed' ? '#10B981' : 
                               computedStatus === 'in_progress' ? '#3B82F6' : 
                               '#F59E0B';

              return (
                <div
                  key={goal.id}
                  className={`${styles.goalItem} ${activeGoalId === goal.id ? styles.goalItemActive : ''} ${isCollapsedActual ? styles.tooltipContainer : ''}`}
                  onClick={() => {
                    if (onGoalSelect) onGoalSelect(goal.id);
                    else if (setActiveGoalId) setActiveGoalId(goal.id);
                  }}
                >
                  <div className={styles.goalLeft}>
                    <span className={styles.goalDot} style={{ background: dotColor }} />
                    {!isCollapsedActual && (
                      <div className={styles.goalInfo}>
                        <span className={styles.goalName}>{goal.name}</span>
                        <span className={styles.goalDeadline}>{displayDeadline}</span>
                      </div>
                    )}
                  </div>
                  {!isCollapsedActual && setGoalToDelete && (
                    <button 
                      className={styles.deleteTrackBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setGoalToDelete(goal);
                      }}
                      title="Delete Track"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  {isCollapsedActual && (
                    <span className={styles.tooltip}>{goal.name}</span>
                  )}
                </div>
              );
            })
          ) : (
            !isCollapsedActual && <div className={styles.noGoals}>No goals yet</div>
          )}
        </div>
      </div>

      {/* SECTION 4: Navigation Links */}
      <div className={styles.navSection}>
        {[
          { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "My Tasks", label: "My Tasks", icon: CheckSquare },
          { id: "Analytics", label: "Analytics", icon: BarChart3 }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <div 
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${isCollapsedActual ? styles.tooltipContainer : ""}`}
              onClick={() => handleNavClick(item.id)}
            >
              <Icon size={18} className={styles.navIcon} />
              {!isCollapsedActual && (
                <span className={styles.navLabel}>{item.label}</span>
              )}
              {isCollapsedActual && (
                <span className={styles.tooltip}>{item.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* SECTION 5: Agent Status */}
      <div className={styles.agentSection}>
        {!isCollapsedActual && (
          <div className={styles.agentTitle}>AI AGENTS</div>
        )}
        <div className={styles.agentList}>
          {agents.map((agent) => {
            const rawStatus = agentStates[agent.id] || "Idle";
            const isRunning = rawStatus === "Thinking" || rawStatus === "Executing" || rawStatus === "Running";
            const isDone = rawStatus === "Complete" || rawStatus === "Done";
            
            let dotClass = styles.agentDotIdle;
            let statusLabel = "Idle";

            if (isRunning) {
              dotClass = styles.agentDotRunning;
              statusLabel = "Running";
            } else if (isDone) {
              dotClass = styles.agentDotIdle;
              statusLabel = "Done ✓";
            } else if (rawStatus === "Inactive") {
              dotClass = styles.agentDotInactive;
              statusLabel = "Inactive";
            }

            return (
              <div 
                key={agent.id}
                className={`${styles.agentRow} ${isRunning ? styles.agentRowRunning : ""} ${isCollapsedActual ? styles.tooltipContainer : ""}`}
              >
                <div className={`${styles.agentDot} ${dotClass}`} />
                {!isCollapsedActual && (
                  <>
                    <span className={styles.agentName}>{agent.name}</span>
                    <span className={styles.agentStatusText}>{statusLabel}</span>
                  </>
                )}
                {isCollapsedActual && (
                  <span className={styles.tooltip}>{agent.name}: {statusLabel}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 6: Bottom Area */}
      <div className={`${styles.bottomSection} ${isCollapsedActual ? styles.bottomSectionCollapsed : ""}`}>
        <div className={styles.bottomSeparator} />
        <div className={styles.userRow}>
          <div className={`${styles.avatar} ${isCollapsedActual ? styles.tooltipContainer : ""}`} id="user-avatar-trigger">
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt={displayName || user.displayName || "Operator"} referrerPolicy="no-referrer" />
            ) : (
              <span>{displayName?.charAt(0) || "O"}</span>
            )}
            {isCollapsedActual && (
              <span className={styles.tooltip}>{displayName || "Operator"}</span>
            )}
          </div>

          {!isCollapsedActual && (
            <>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{displayName || "Operator"}</span>
                <span className={styles.userRole}>{customRole}</span>
              </div>
              <button className={styles.actionBtn} onClick={() => setShowSettings(true)} title="Settings">
                <Settings size={16} />
              </button>
              <button className={`${styles.actionBtn} ${styles.signoutBtn}`} onClick={logout} title="Sign Out">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Toggle Button */}
      <button 
        className={styles.toggleButton} 
        onClick={handleToggleClick}
        aria-label="Toggle Sidebar"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Settings Modal Custom Control Center */}
      {showSettings && (
        <div className={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Sliders size={20} className={styles.logoIcon} />
                <span>OPERATING CONFIGURATIONS</span>
              </h3>
              <button className={styles.closeButton} onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.settingsGroup}>
              {/* Operator Name */}
              <div className={styles.settingsField}>
                <label className={styles.fieldLabel}>
                  <User size={12} />
                  Operator Identifier
                </label>
                <input 
                  type="text" 
                  className={styles.fieldInput} 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Chief Operative"
                />
              </div>

              {/* Operator Role */}
              <div className={styles.settingsField}>
                <label className={styles.fieldLabel}>
                  <Shield size={12} />
                  Operational Security Rank
                </label>
                <input 
                  type="text" 
                  className={styles.fieldInput} 
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. SYSTEM OPERATIVE"
                />
              </div>

              {/* AI Brain Model */}
              <div className={styles.settingsField}>
                <label className={styles.fieldLabel}>
                  <Cpu size={12} />
                  Generative Intelligence Core
                </label>
                <select 
                  className={styles.fieldSelect} 
                  value={prefModel}
                  onChange={(e) => setPrefModel(e.target.value)}
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Resilient Speed)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Reasoning Engine)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Speed Balanced)</option>
                </select>
              </div>

              {/* Alarm/Sounds Switch */}
              <div className={styles.toggleRow}>
                <div className={styles.toggleLabelGroup}>
                  <span className={styles.toggleTitle}>Auditory Alarms</span>
                  <span className={styles.toggleDesc}>Trigger low-frequency sound loop on urgent threats</span>
                </div>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <button className={styles.resetBtn} onClick={handleResetSettings} title="Reset to baseline configs">
                <RefreshCw size={14} />
                RESET
              </button>
              <button className={styles.saveBtn} onClick={handleSaveSettings}>
                SYNC Matrix
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
