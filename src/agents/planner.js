import { Type } from "@google/genai";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getFirebaseAdmin } from "../lib/firebaseAdmin";
import { logAgentAction } from "../lib/agentLogger";
import { getAiClient, generateWithFallback } from "../lib/gemini";

/**
 * Takes a vague goal, produces structured subtasks, and automatically persists them in Firestore.
 * @param {string} goalDescription - The description of the goal
 * @param {string} deadline - Suggested goal deadline date/time
 * @param {Array} existingTasks - Array of existing tasks for context/conflict detection
 * @param {string} uid - User ID
 * @param {string} goalId - The associated goal ID in Firestore
 */
export async function planGoal(goalDescription, deadline, existingTasks = [], uid, goalId) {
  await logAgentAction("Planner", "start_planning", { goalDescription, deadline, goalId }, uid);

  try {
    const ai = getAiClient();
    const prompt = `Goal: "${goalDescription}"
Deadline context: "${deadline || "Not specified (assume 3 days from now)"}"
Existing tasks in workspace for context: ${JSON.stringify(existingTasks)}`;

    const response = await generateWithFallback(ai, prompt, {
      systemInstruction: `You are a master project planner. Break down goals into specific, actionable subtasks. Each subtask must have a clear title, estimated hours, a suggested sequential order, and a realistic suggestedDeadline.
Consider dependencies between tasks. Be realistic with time estimates.
IMPORTANT: You MUST generate sequentially staggered deadlines (as ISO-8601 strings) for each subtask that lead up to the goal's final deadline (specified as: ${deadline || "3 days from now"}). Stagger the subtask deadlines across the timeline so they are realistic (e.g., first few tasks due earlier, final tasks due close to the overall goal deadline).
Return ONLY a valid JSON object matching the requested schema. Do not output markdown code blocks.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["goalSummary", "totalEstimatedHours", "feasibilityWarning", "subtasks"],
        properties: {
          goalSummary: {
            type: Type.STRING,
            description: "A cleaned up, punchy title for the goal",
          },
          totalEstimatedHours: {
            type: Type.NUMBER,
            description: "Total estimated hours for all subtasks combined",
          },
          feasibilityWarning: {
            type: Type.STRING,
            description: "Warning message if the total hours exceed realistic available time, otherwise null",
          },
          subtasks: {
            type: Type.ARRAY,
            description: "List of actionable subtasks",
            items: {
              type: Type.OBJECT,
              required: ["title", "description", "estimatedHours", "order", "dependsOn", "category", "suggestedDeadline"],
              properties: {
                title: { type: Type.STRING, description: "Short task name" },
                description: { type: Type.STRING, description: "1-2 sentences on what to do" },
                estimatedHours: { type: Type.NUMBER, description: "Hours to complete this subtask" },
                order: { type: Type.INTEGER, description: "Sequence order (1-indexed)" },
                dependsOn: { type: Type.INTEGER, description: "The order number of the dependency, or null" },
                category: {
                  type: Type.STRING,
                  enum: ["research", "writing", "coding", "study", "communication", "creative", "admin"],
                },
                suggestedDeadline: {
                  type: Type.STRING,
                  description: "Sequentially staggered deadline for this subtask as an ISO-8601 UTC date-time string (e.g., YYYY-MM-DDTHH:MM:SSZ) which falls strictly before the goal's final deadline."
                },
              },
            },
          },
        },
      },
    });

    const parsedPlan = JSON.parse(response.text.trim());
    const generatedTasks = [];

    // Map each category to a responsible multi-agent role
    const agentMapping = {
      coding: "Executor",
      writing: "Executor",
      creative: "Executor",
      research: "Optimizer",
      study: "Optimizer",
      communication: "Orchestrator",
      admin: "Orchestrator",
    };

    // Save each subtask in Firestore
    const { adminDb } = getFirebaseAdmin();
    for (const sub of parsedPlan.subtasks) {
      const taskDoc = {
        name: sub.title,
        description: sub.description,
        priority: "Important-Not-Urgent", // Will be dynamically ranked by the Prioritizer Agent
        estimate: Math.round(sub.estimatedHours * 60) || 30, // Convert hours to minutes
        agent: agentMapping[sub.category] || "Executor",
        status: "Pending",
        goalId: goalId,
        userId: uid,
        order: sub.order,
        dependsOn: sub.dependsOn || null,
        category: sub.category,
        deadline: sub.suggestedDeadline ? new Date(sub.suggestedDeadline).toISOString() : null,
        createdAt: new Date().toISOString(),
      };

      let taskSaved = false;
      if (adminDb) {
        try {
          const docRef = await adminDb.collection("tasks").add(taskDoc);
          generatedTasks.push({ id: docRef.id, ...taskDoc });
          taskSaved = true;
        } catch (adminErr) {
          console.warn("Failed to save subtask via adminDb, trying client fallback:", adminErr.message || adminErr);
        }
      }
      if (!taskSaved) {
        const docRef = await addDoc(collection(db, "tasks"), taskDoc);
        generatedTasks.push({ id: docRef.id, ...taskDoc });
      }
    }

    await logAgentAction(
      "Planner",
      "planning_completed",
      {
        goalSummary: parsedPlan.goalSummary,
        totalTasksCreated: generatedTasks.length,
        totalEstimatedHours: parsedPlan.totalEstimatedHours,
      },
      uid
    );

    return {
      goalSummary: parsedPlan.goalSummary,
      totalEstimatedHours: parsedPlan.totalEstimatedHours,
      feasibilityWarning: parsedPlan.feasibilityWarning,
      subtasks: generatedTasks,
    };
  } catch (error) {
    console.error("Planner agent failed:", error);
    await logAgentAction("Planner", "error", { error: error.message }, uid);
    throw error;
  }
}

/**
 * Takes a specific task description and name, and splits it into 3-4 micro-tasks (15-30 min each).
 * @param {Object} taskToBreak - The task object to break down
 * @param {string} uid - User ID
 */
export async function breakdownTask(taskToBreak, uid) {
  await logAgentAction("Planner", "start_breakdown", { taskId: taskToBreak?.id, name: taskToBreak?.name }, uid);

  try {
    const ai = getAiClient();
    const prompt = `Task to break down: "${taskToBreak.name}" - ${taskToBreak.description || "No description provided."}
Goal ID: "${taskToBreak.goalId || ""}"
Please split this task into 3-4 micro-tasks (each taking 15 to 30 minutes, or 0.25 to 0.5 hours). These should be highly specific, extremely manageable steps that reduce starting friction.`;

    const response = await generateWithFallback(ai, prompt, {
      systemInstruction: `You are an expert personal productivity assistant. You break complex, stalled tasks into ultra-small micro-tasks that are incredibly easy to start.
Return ONLY a valid JSON object matching this schema:
{
  "microtasks": [
    {
      "title": "Short actionable action",
      "description": "Short microtask instruction",
      "estimatedMinutes": 15, // must be between 15 and 30
      "category": "research | writing | coding | study | communication | creative | admin"
    }
  ]
}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["microtasks"],
        properties: {
          microtasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["title", "description", "estimatedMinutes", "category"],
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                estimatedMinutes: { type: Type.NUMBER },
                category: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    await logAgentAction("Planner", "breakdown_completed", { taskCount: parsed.microtasks?.length }, uid);
    return parsed.microtasks;

  } catch (err) {
    console.error("Breakdown failed, returning simulated microtasks:", err);
    // Simulating fallback micro-tasks
    return [
      {
        title: `Draft first 5 lines for: ${taskToBreak.name}`,
        description: "Set a 15-minute timer and write the initial opening setup outline.",
        estimatedMinutes: 15,
        category: taskToBreak.category || "study"
      },
      {
        title: `Gather and open primary references for: ${taskToBreak.name}`,
        description: "Open all browser tabs, files, and folders required to execute this.",
        estimatedMinutes: 15,
        category: taskToBreak.category || "research"
      },
      {
        title: `Complete the core high-priority block`,
        description: "Focus on the single most critical block with zero notifications.",
        estimatedMinutes: 30,
        category: taskToBreak.category || "coding"
      }
    ];
  }
}
