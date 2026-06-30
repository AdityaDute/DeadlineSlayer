import { Type } from "@google/genai";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getFirebaseAdmin } from "../lib/firebaseAdmin";
import { logAgentAction } from "../lib/agentLogger";
import { getAiClient, generateWithFallback } from "../lib/gemini";

/**
 * Prioritizes tasks using a multi-factor formula, updates them in Firestore, and returns sorted tasks.
 * @param {Array} tasks - Array of task objects
 * @param {string} currentTime - ISO string of current time
 * @param {string} uid - User ID
 */
export async function prioritizeTasks(tasks = [], currentTime = new Date().toISOString(), uid) {
  if (tasks.length === 0) {
    return { rankedTasks: [], dailyPlan: "No active tasks in queue to prioritize." };
  }

  await logAgentAction("Prioritizer", "start_prioritization", { taskCount: tasks.length }, uid);

  try {
    const ai = getAiClient();
    const prompt = `Current Local Time: ${currentTime}
Tasks to prioritize:
${JSON.stringify(
  tasks.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    estimate: t.estimate,
    status: t.status,
    priority: t.priority,
    order: t.order || null,
    dependsOn: t.dependsOn || null,
    category: t.category || "coding",
  }))
)}`;

    const response = await generateWithFallback(ai, prompt, {
      systemInstruction: `You are a task prioritization expert. Score each task from 0-100 using this formula:
1. Deadline Proximity (35%) — tasks due sooner score higher.
2. Task Importance (25%) — based on type and description.
3. Dependency Chain (20%) — tasks that block others score higher.
4. Estimated Effort vs Time Available (20%) — tasks that take longer relative to remaining time score higher.

Sort the tasks by priority score, highest first.
Assign each task to an Eisenhower quadrant: 'urgent-important', 'not-urgent-important', 'urgent-not-important', or 'not-urgent-not-important'.

Return ONLY a valid JSON object matching the requested schema. Do not output markdown backticks.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["rankedTasks", "dailyPlan"],
        properties: {
          rankedTasks: {
            type: Type.ARRAY,
            description: "The ranked task details with scores and quadrants",
            items: {
              type: Type.OBJECT,
              required: ["taskId", "priorityScore", "quadrant", "reasoning", "suggestedTimeSlot"],
              properties: {
                taskId: { type: Type.STRING, description: "The ID of the task" },
                priorityScore: { type: Type.NUMBER, description: "A score from 0 to 100" },
                quadrant: {
                  type: Type.STRING,
                  enum: [
                    "urgent-important",
                    "not-urgent-important",
                    "urgent-not-important",
                    "not-urgent-not-important",
                  ],
                },
                reasoning: { type: Type.STRING, description: "1 sentence explaining why this priority was given" },
                suggestedTimeSlot: { type: Type.STRING, description: "e.g., 'Morning (high energy)'" },
              },
            },
          },
          dailyPlan: {
            type: Type.STRING,
            description: "A friendly suggested daily plan and sequential order in natural language",
          },
        },
      },
    });

    const result = JSON.parse(response.text.trim());

    // Map quadrant strings to Firestore Priority format
    const priorityMap = {
      "urgent-important": "Urgent-Important",
      "not-urgent-important": "Important-Not-Urgent",
      "urgent-not-important": "Urgent-Not-Important",
      "not-urgent-not-important": "Not-Urgent-Not-Important",
    };

    // Update each task in Firestore
    const { adminDb } = getFirebaseAdmin();
    for (const ranked of result.rankedTasks) {
      const dbPriority = priorityMap[ranked.quadrant] || "Important-Not-Urgent";
      try {
        let taskUpdated = false;
        if (adminDb) {
          try {
            await adminDb.collection("tasks").doc(ranked.taskId).update({
              priority: dbPriority,
              priorityScore: ranked.priorityScore,
              reasoning: ranked.reasoning,
              suggestedTimeSlot: ranked.suggestedTimeSlot,
            });
            taskUpdated = true;
          } catch (adminErr) {
            console.warn(`Failed to update task ${ranked.taskId} via adminDb, trying client fallback:`, adminErr.message || adminErr);
          }
        }
        if (!taskUpdated) {
          await updateDoc(doc(db, "tasks", ranked.taskId), {
            priority: dbPriority,
            priorityScore: ranked.priorityScore,
            reasoning: ranked.reasoning,
            suggestedTimeSlot: ranked.suggestedTimeSlot,
          });
        }
      } catch (err) {
        console.error(`Failed to update task ${ranked.taskId} priority:`, err);
      }
    }

    await logAgentAction(
      "Prioritizer",
      "prioritization_completed",
      {
        rankedCount: result.rankedTasks.length,
        dailyPlanSummary: result.dailyPlan.substring(0, 100) + "...",
      },
      uid
    );

    return result;
  } catch (error) {
    console.error("Prioritizer agent failed:", error);
    await logAgentAction("Prioritizer", "error", { error: error.message }, uid);
    throw error;
  }
}
