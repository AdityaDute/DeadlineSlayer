import { Type } from "@google/genai";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getFirebaseAdmin } from "../lib/firebaseAdmin";
import { planGoal } from "./planner";
import { prioritizeTasks } from "./prioritizer";
import { executeTask } from "./executor";
import { checkDeadlines } from "./guardian";
import { getAiClient, generateWithFallback } from "../lib/gemini";
import { logAgentAction } from "../lib/agentLogger";

/**
 * The core orchestration node that parses user command intent and deploys the appropriate sub-agent loops.
 * @param {string} userMessage - Natural language input
 * @param {Array} existingTasks - Active task list for context
 * @param {Array} existingGoals - Active goal list for context
 * @param {string} uid - Authenticated user ID
 */
export async function orchestrate(userMessage, existingTasks = [], existingGoals = [], uid) {
  if (!uid) throw new Error("Authenticated user ID (uid) is required for orchestration.");

  await logAgentAction("Orchestrator", "receive_command", { message: userMessage }, uid);

  try {
    const ai = getAiClient();
    const prompt = `User Message: "${userMessage}"
Current Local Time: "${new Date().toISOString()}"
Workspace Tasks: ${JSON.stringify(existingTasks.map(t => ({ id: t.id, name: t.name, status: t.status })))}
Workspace Goals: ${JSON.stringify(existingGoals.map(g => ({ id: g.id, title: g.title || g.name })))}`;

    // 1. Classify User Intent using Gemini 3.5 Flash
    const response = await generateWithFallback(ai, prompt, {
      systemInstruction: `You are the chief command router and orchestrator for "DeadlineSlayer".
Analyze the user's natural language input and classify it into exactly one of these intents:
- "create_goal": User wants to start a new goal, track a target, plan an exam, build a site, etc.
- "ask_help": User is asking for help, explanations, drafts, or suggestions regarding a task or topic.
- "check_status": User wants a status report, runway check, or overall checklist review.
- "execute_task": User explicitly wants to trigger or run a task.
- "general_chat": Conversational greetings, general questions, or non-action requests.

For "create_goal", extract/clean up a punchy title and description for the goals.
For "ask_help" or "execute_task", try to identify the targetTaskId from the user's message if they refer to a task name or task ID, otherwise set it to null.
For "general_chat", generate a conversational response right now in 'chatResponse'.

Return ONLY a valid JSON object matching the requested schema. Do not output markdown backticks.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["intent", "goalDetails", "targetTaskId", "chatResponse"],
        properties: {
          intent: {
            type: Type.STRING,
            enum: ["create_goal", "ask_help", "check_status", "execute_task", "general_chat"],
          },
          goalDetails: {
            type: Type.OBJECT,
            required: ["title", "description", "deadline"],
            properties: {
              title: { type: Type.STRING, description: "Punchy goal title or null" },
              description: { type: Type.STRING, description: "Goal description or null" },
              deadline: { type: Type.STRING, description: "Parsed goal deadline strictly formatted as an ISO-8601 UTC date-time string (e.g., 'YYYY-MM-DDTHH:MM:SSZ') calculated relative to Current Local Time, or null if not specified." },
            },
          },
          targetTaskId: {
            type: Type.STRING,
            description: "The task ID or name if explicitly referenced, otherwise null",
          },
          chatResponse: {
            type: Type.STRING,
            description: "Direct response if intent is general_chat, otherwise empty",
          },
        },
      },
    });

    const parsed = JSON.parse(response.text.trim());
    let finalResult = {
      intent: parsed.intent,
      agentsUsed: ["Orchestrator"],
      result: parsed.chatResponse || "",
      tasks: [],
      panicMode: false,
    };

    // 2. Route based on classified user intent
    if (parsed.intent === "create_goal") {
      // Step A: Create Goal in Firestore
      const goalTitle = parsed.goalDetails?.title || (userMessage.length > 25 ? userMessage.substring(0, 22) + "..." : userMessage);
      const goalDesc = parsed.goalDetails?.description || `AI deconstructed goal: "${userMessage}"`;
      
      let goalId;
      const goalDoc = {
        title: goalTitle,
        name: goalTitle,
        description: goalDesc,
        deadline: parsed.goalDetails?.deadline || null,
        status: 'in_progress',
        progress: 0,
        userId: uid,
        createdAt: new Date().toISOString(),
      };
      
      const { adminDb } = getFirebaseAdmin();
      let goalCreated = false;
      if (adminDb) {
        try {
          const goalRef = await adminDb.collection("goals").add(goalDoc);
          goalId = goalRef.id;
          goalCreated = true;
        } catch (err) {
          console.warn("Failed to create goal via adminDb, trying client-side db fallback:", err.message || err);
        }
      }
      if (!goalCreated) {
        const goalRef = await addDoc(collection(db, "goals"), goalDoc);
        goalId = goalRef.id;
      }

      // Step B: Spawn Planner Agent to generate subtasks and save to DB
      const plannedOutput = await planGoal(
        userMessage,
        parsed.goalDetails.deadline,
        existingTasks,
        uid,
        goalId
      );

      // Step C: Call Prioritizer Agent on newly created tasks
      const prioritizerOutput = await prioritizeTasks(plannedOutput.subtasks, new Date().toISOString(), uid);

      finalResult.agentsUsed.push("Planner", "Prioritizer");
      finalResult.tasks = plannedOutput.subtasks;
      finalResult.result = `Successfully created goal **"${goalTitle}"** and planned **${plannedOutput.subtasks.length}** tactical subtasks.\n\n**Daily Briefing:** ${prioritizerOutput.dailyPlan}\n\n${plannedOutput.feasibilityWarning ? `⚠️ **Feasibility Warning:** ${plannedOutput.feasibilityWarning}` : ""}`;
    } 
    else if (parsed.intent === "ask_help") {
      // Find relevant task or use first pending
      let task = null;
      if (parsed.targetTaskId) {
        task = existingTasks.find(t => t && t.id && t.name && (
          t.id === parsed.targetTaskId || 
          t.name.toLowerCase().includes(String(parsed.targetTaskId).toLowerCase())
        ));
      }
      if (!task) {
        task = existingTasks.find(t => t && t.status !== "Completed") || existingTasks[0];
      }

      if (!task) {
        finalResult.result = "No active tasks in your queue to execute. Create a goal or add a task first!";
      } else {
        // Retrieve parent goal details for rich context
        let goalData = {};
        if (task.goalId) {
          try {
            const { adminDb } = getFirebaseAdmin();
            let goalFetched = false;
            if (adminDb) {
              try {
                const goalSnap = await adminDb.collection("goals").doc(task.goalId).get();
                if (goalSnap.exists) {
                  goalData = goalSnap.data();
                  goalFetched = true;
                }
              } catch (adminErr) {
                console.warn("Failed to fetch goal via adminDb, trying client db fallback:", adminErr.message || adminErr);
              }
            }
            if (!goalFetched) {
              const goalSnap = await getDoc(doc(db, "goals", task.goalId));
              if (goalSnap.exists()) goalData = goalSnap.data();
            }
          } catch (e) {
            console.error("Failed to retrieve goal context:", e);
          }
        }

        // Run Executor Agent
        const execOutput = await executeTask(task, goalData, existingTasks, uid);
        finalResult.agentsUsed.push("Executor");
        finalResult.result = execOutput; // Return whole structured artifact
      }
    } 
    else if (parsed.intent === "check_status") {
      // Run Guardian Agent
      const guardianOutput = await checkDeadlines(existingTasks, existingGoals, new Date().toISOString(), uid);
      finalResult.agentsUsed.push("Guardian");
      finalResult.panicMode = guardianOutput.panicMode;
      finalResult.result = guardianOutput;
    } 
    else if (parsed.intent === "execute_task") {
      // Find relevant task to execute
      let task = null;
      if (parsed.targetTaskId) {
        task = existingTasks.find(t => t && t.id && t.name && (
          t.id === parsed.targetTaskId || 
          t.name.toLowerCase().includes(String(parsed.targetTaskId).toLowerCase())
        ));
      }
      if (!task) {
        task = existingTasks.find(t => t && t.status !== "Completed") || existingTasks[0];
      }

      if (!task) {
        finalResult.result = "No active tasks are available in your workspace queue to run.";
      } else {
        let goalData = {};
        if (task.goalId) {
          try {
            const { adminDb } = getFirebaseAdmin();
            let goalFetched = false;
            if (adminDb) {
              try {
                const goalSnap = await adminDb.collection("goals").doc(task.goalId).get();
                if (goalSnap.exists) {
                  goalData = goalSnap.data();
                  goalFetched = true;
                }
              } catch (adminErr) {
                console.warn("Failed to fetch goal via adminDb, trying client db fallback:", adminErr.message || adminErr);
              }
            }
            if (!goalFetched) {
              const goalSnap = await getDoc(doc(db, "goals", task.goalId));
              if (goalSnap.exists()) goalData = goalSnap.data();
            }
          } catch (e) {
            console.error("Failed to retrieve goal context:", e);
          }
        }

        // Run Executor Agent
        const execOutput = await executeTask(task, goalData, existingTasks, uid);
        
        // Mark task complete in Firestore
        try {
          const { adminDb } = getFirebaseAdmin();
          let taskUpdated = false;
          if (adminDb) {
            try {
              await adminDb.collection("tasks").doc(task.id).update({ status: "Completed" });
              taskUpdated = true;
            } catch (adminErr) {
              console.warn("Failed to update task via adminDb, trying client db fallback:", adminErr.message || adminErr);
            }
          }
          if (!taskUpdated) {
            await updateDoc(doc(db, "tasks", task.id), { status: "Completed" });
          }
        } catch (e) {
          console.error("Failed to mark task completed in Firestore:", e);
        }

        finalResult.agentsUsed.push("Executor");
        finalResult.result = execOutput;
      }
    }

    await logAgentAction("Orchestrator", "command_completed", { intent: parsed.intent, agentsCount: finalResult.agentsUsed.length }, uid);
    return finalResult;
  } catch (error) {
    console.error("Orchestrator failed:", error);
    await logAgentAction("Orchestrator", "error", { error: error.message }, uid);
    throw error;
  }
}
