import { Type } from "@google/genai";
import { logAgentAction } from "../lib/agentLogger";
import { getAiClient, generateWithFallback } from "../lib/gemini";

/**
 * Analyzes active tasks and goals, calculates completion probabilities, detects bottleneck risks, 
 * schedules panic actions if critical, and analyzes procrastination patterns.
 * @param {Array} tasks - All tasks
 * @param {Array} goals - All goals
 * @param {string} currentTime - ISO local time string
 * @param {string} uid - User ID
 */
export async function checkDeadlines(tasks = [], goals = [], currentTime = new Date().toISOString(), uid) {
  await logAgentAction("Guardian", "start_deadline_audit", { taskCount: tasks.length, goalCount: goals.length }, uid);

  // If empty, return standard healthy template
  if (tasks.length === 0) {
    return {
      overallStatus: "healthy",
      panicMode: false,
      panicTask: {
        taskId: null,
        taskTitle: "None",
        timeRemaining: "No active runway constraints",
        completionPercentage: 100,
        rescuePlan: "Your target queue is entirely clean and vacant. Set a new target to mobilize.",
      },
      taskStatuses: [],
      dailyBriefing: "AI systems are standing by. Enter a target goal in the command bar to begin.",
      procrastination: {
        detected: false,
        severity: "mild",
        pattern: "None detected.",
        affectedTasks: [],
        nudge: "Runway clear. No procrastination anomalies detected.",
      }
    };
  }

  try {
    const ai = getAiClient();
    const prompt = `Current Local Time: ${currentTime}
Active Goals:
${JSON.stringify(goals.map(g => ({ id: g.id, title: g.name || g.title, description: g.description, progress: g.progress })))}
Active Tasks:
${JSON.stringify(
  tasks.map(t => ({
    id: t.id,
    name: t.name,
    estimate: t.estimate,
    status: t.status,
    priority: t.priority,
    goalId: t.goalId,
    createdAt: t.createdAt,
    category: t.category,
  }))
)}`;

    const response = await generateWithFallback(ai, prompt, {
      systemInstruction: `You are a strict productivity deadline guardian and risk analyst.
Analyze all active tasks and goals against the current time. Calculate the expected progress vs. the actual progress.
For each task, classify its status as: 'on_track', 'at_risk', 'critical', or 'overdue'.

Also analyze procrastination patterns. Look for:
- Tasks that have been in 'Pending' (not started) status for more than 2 days
- Tasks whose deadlines are approaching but have 0% progress (e.g. status is 'Pending')
- Tasks that were created early but never touched (user had time but didn't start)
- Multiple tasks piling up without any being completed
If procrastination is detected, return a procrastination alert.

CRITICAL RULE: If any important task has less than 24 hours remaining AND is less than 50% complete, set 'panicMode' to true and fill 'panicTask' with detailed rescue instructions. Otherwise, 'panicMode' is false and 'panicTask' has null taskId and general placeholder fields.

Return ONLY a valid JSON object matching the requested schema. Do not output markdown backticks.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["overallStatus", "panicMode", "panicTask", "taskStatuses", "dailyBriefing", "procrastination"],
        properties: {
          overallStatus: { type: Type.STRING, enum: ["healthy", "warning", "critical"] },
          panicMode: { type: Type.BOOLEAN },
          panicTask: {
            type: Type.OBJECT,
            required: ["taskId", "taskTitle", "timeRemaining", "completionPercentage", "rescuePlan"],
            properties: {
              taskId: { type: Type.STRING, nullable: true },
              taskTitle: { type: Type.STRING },
              timeRemaining: { type: Type.STRING },
              completionPercentage: { type: Type.NUMBER },
              rescuePlan: { type: Type.STRING },
            },
          },
          taskStatuses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["taskId", "status", "timeRemaining", "progressPercentage", "recommendation"],
              properties: {
                taskId: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["on_track", "at_risk", "critical", "overdue"] },
                timeRemaining: { type: Type.STRING },
                progressPercentage: { type: Type.NUMBER },
                recommendation: { type: Type.STRING },
              },
            },
          },
          dailyBriefing: { type: Type.STRING, description: "A detailed summary of today's deadline state in natural language" },
          procrastination: {
            type: Type.OBJECT,
            required: ["detected", "severity", "pattern", "affectedTasks", "nudge"],
            properties: {
              detected: { type: Type.BOOLEAN },
              severity: { type: Type.STRING, enum: ["mild", "moderate", "severe"] },
              pattern: { type: Type.STRING },
              affectedTasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              nudge: { type: Type.STRING }
            }
          }
        },
      },
    });

    const parsedStatus = JSON.parse(response.text.trim());

    await logAgentAction(
      "Guardian",
      "deadline_audit_completed",
      {
        overallStatus: parsedStatus.overallStatus,
        panicMode: parsedStatus.panicMode,
        taskCount: parsedStatus.taskStatuses.length,
        procrastinationDetected: parsedStatus.procrastination?.detected || false
      },
      uid
    );

    return parsedStatus;
  } catch (error) {
    console.error("Guardian agent failed:", error);
    await logAgentAction("Guardian", "error", { error: error.message }, uid);
    // Fallback response with procrastination
    return {
      overallStatus: "healthy",
      panicMode: false,
      panicTask: {
        taskId: null,
        taskTitle: "None",
        timeRemaining: "No active runway constraints",
        completionPercentage: 100,
        rescuePlan: "System safe.",
      },
      taskStatuses: [],
      dailyBriefing: "Audit failed. System is standing by under offline safety guidelines.",
      procrastination: {
        detected: false,
        severity: "mild",
        pattern: "None detected.",
        affectedTasks: [],
        nudge: "Stay vigilant and tackle your top goals today.",
      }
    };
  }
}

/**
 * Generates a morning briefing for the user based on their current tasks and goals.
 * @param {Array} tasks - All tasks
 * @param {Array} goals - All goals
 * @param {string} currentTime - ISO local time string
 * @param {string} uid - User ID
 */
export async function generateBriefing(tasks = [], goals = [], currentTime = new Date().toISOString(), uid) {
  await logAgentAction("Guardian", "start_briefing_generation", { taskCount: tasks.length, goalCount: goals.length }, uid);

  try {
    const ai = getAiClient();
    const prompt = `Current Local Time: ${currentTime}
Active Goals:
${JSON.stringify(goals.map(g => ({ id: g.id, title: g.name || g.title, description: g.description, progress: g.progress })))}
Active Tasks:
${JSON.stringify(
  tasks.map(t => ({
    id: t.id,
    name: t.name,
    status: t.status,
    priority: t.priority,
    category: t.category,
    createdAt: t.createdAt,
    deadline: t.deadline || null,
  }))
)}`;

    const response = await generateWithFallback(ai, prompt, {
      systemInstruction: `You are a friendly but direct productivity coach. Generate a morning briefing for the user based on their current tasks and goals. Be specific, use actual task names and deadlines. Keep it concise — max 4-5 sentences. Include:
- A greeting based on time of day (Good morning/afternoon/evening)
- How many tasks are due today and this week
- Which task is most urgent and why
- One specific recommendation for what to do RIGHT NOW
- A motivational nudge if they have overdue tasks, or encouragement if they're on track

Return ONLY a valid JSON object matching this schema:
{
  "greeting": "Good evening!",
  "summary": "The full briefing text as one paragraph",
  "urgentTask": "Task name that needs immediate attention or null",
  "mood": "on_track | falling_behind | critical | crushing_it",
  "recommendedAction": "What to do right now in one sentence"
}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["greeting", "summary", "urgentTask", "mood", "recommendedAction"],
        properties: {
          greeting: { type: Type.STRING },
          summary: { type: Type.STRING },
          urgentTask: { type: Type.STRING, nullable: true },
          mood: { type: Type.STRING, enum: ["on_track", "falling_behind", "critical", "crushing_it"] },
          recommendedAction: { type: Type.STRING }
        }
      }
    });

    const parsedBriefing = JSON.parse(response.text.trim());
    await logAgentAction("Guardian", "briefing_generation_completed", { mood: parsedBriefing.mood }, uid);
    return parsedBriefing;

  } catch (error) {
    console.error("Briefing generation failed:", error);
    await logAgentAction("Guardian", "error", { error: error.message }, uid);
    // Graceful fallback
    return {
      greeting: "Greetings, Operator.",
      summary: "Your AI agent system is active. Review your task matrix and priority zones to keep your runway clear.",
      urgentTask: tasks.find(t => t.status !== "Completed")?.name || null,
      mood: "on_track",
      recommendedAction: "Verify your priority matrix and start on your next strategic task."
    };
  }
}
