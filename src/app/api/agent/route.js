import { NextResponse } from "next/server";
import { executeTask } from "../../../agents/executor";
import { generateBriefing, checkDeadlines } from "../../../agents/guardian";
import { breakdownTask } from "../../../agents/planner";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const { agentName, task, goal, allTasks, goals, feedback, uid } = body;

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY environment variable is not configured. Agents will execute using resilient offline simulations.");
    }

    if (!agentName) {
      return NextResponse.json(
        { error: "Missing required parameter: agentName" },
        { status: 400 }
      );
    }

    if (agentName === "executor") {
      if (!task) {
        return NextResponse.json(
          { error: "Missing required parameter: task" },
          { status: 400 }
        );
      }

      const result = await executeTask(task, goal || {}, allTasks || [], uid, feedback || "");
      return NextResponse.json(result);
    }

    if (agentName === "guardian_briefing") {
      const result = await generateBriefing(allTasks || [], goals || [], new Date().toISOString(), uid);
      return NextResponse.json(result);
    }

    if (agentName === "guardian_audit") {
      const result = await checkDeadlines(allTasks || [], goals || [], new Date().toISOString(), uid);
      return NextResponse.json(result);
    }

    if (agentName === "planner_breakdown") {
      if (!task) {
        return NextResponse.json(
          { error: "Missing required parameter: task for breakdown" },
          { status: 400 }
        );
      }
      const result = await breakdownTask(task, uid);
      return NextResponse.json({ microtasks: result });
    }

    return NextResponse.json(
      { error: `Agent ${agentName} is not supported on this endpoint.` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Agent API route error:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during agent execution." },
      { status: 500 }
    );
  }
}
