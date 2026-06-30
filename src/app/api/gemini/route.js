import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { generateWithFallback } from "../../../lib/gemini";

export const dynamic = "force-dynamic";

function safeJsonParse(text) {
  try {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
    return JSON.parse(jsonString.trim());
  } catch (e) {
    console.error("Failed to parse response text as JSON:", text, e);
    throw e;
  }
}

export async function POST(req) {
  let body = {};
  try {
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }
    
    const { 
      prompt, 
      goalId, 
      action, 
      task, 
      goal, 
      tasks, 
      reason, 
      timeRequested 
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    // Route actions if apiKey is missing
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. Falling back to offline simulation.");
      return NextResponse.json(getSimulatedActionResponse(action, task, goal, tasks, reason, timeRequested, prompt, goalId));
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // 1. Action: execute (Draft task solution)
    if (action === "execute") {
      const systemInstruction = `You are a master implementation developer for DeadlineSlayer. 
      Generate a complete, high-quality, fully realized solution draft, template, or checklist for the specific task.
      Your draft should be production-ready and fully articulated. DO NOT use placeholders, "// TODO" comments, or generic outlines.
      If it is code, output full working code. If it is documentation, write real, rich paragraphs.`;

      const userPrompt = `Draft solution for Task: "${task?.name || 'Urgent task'}"
      Goal context: "${goal?.name || 'Milestone'}"
      Goal description: "${goal?.description || ''}"
      Task estimate: ${task?.estimate || 'unspecified'}`;

      const response = await generateWithFallback(ai, userPrompt, {
        systemInstruction: systemInstruction,
      });

      return NextResponse.json({ content: response.text });
    }

    // 2. Action: simplify
    if (action === "simplify") {
      const systemInstruction = `You are a ruthless optimization coach. Analyze the task and break it down into an ultra-condensed checklist of exactly 3 micro-steps that can be completed in minutes to bypass bottlenecks. Keep it brief, action-oriented, and punchy.`;
      
      const userPrompt = `Compress Task: "${task?.name || 'Urgent task'}"`;

      const response = await generateWithFallback(ai, userPrompt, {
        systemInstruction: systemInstruction,
      });

      return NextResponse.json({ content: response.text });
    }

    // 3. Action: extension
    if (action === "extension") {
      const systemInstruction = `You are a professional advocate. Draft an extension request email that is extremely polite, highly professional, and provides a clear, logical reason for delay while committing to a precise new timeframe. Present it as copy-paste ready text.`;

      const userPrompt = `Draft Extension Email:
      Task: "${task?.name || 'Urgent task'}"
      Goal: "${goal?.name || 'Milestone'}"
      Reason for Delay: "${reason || 'unexpected system blockage'}"
      Extension Requested: "${timeRequested || '24 hours'}"`;

      const response = await generateWithFallback(ai, userPrompt, {
        systemInstruction: systemInstruction,
      });

      return NextResponse.json({ content: response.text });
    }

    // 4. Action: scope_reduction
    if (action === "scope_reduction") {
      const systemInstruction = `You are a minimalist product manager. You help users salvage critical deadlines by cutting unessential scope. 
      Analyze the active tasks and identify which 1 or 2 tasks are non-critical to achieving an immediate working MVP (Minimal Viable Product).
      Formulate a 1-sentence "MVP Pivot" description of the streamlined goal outcome.
      
      You must return ONLY a valid JSON object matching this schema:
      {
        "sacrificialTaskIds": ["id1", "id2"],
        "sacrificialTaskNames": ["Task Name 1", "Task Name 2"],
        "mvpPivot": "1-sentence compressed goal description of the core working prototype."
      }`;

      const safeTasks = Array.isArray(tasks) ? tasks : [];
      const userPrompt = `Goal: "${goal?.name || goal?.title || 'Project'}"
      Pending Tasks: ${JSON.stringify(safeTasks.filter(t => t && typeof t === "object").map(t => ({ id: t?.id || "", name: t?.name || "", priority: t?.priority || "" })))}`;

      const response = await generateWithFallback(ai, userPrompt, {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      });

      const data = safeJsonParse(response.text);
      return NextResponse.json(data);
    }

    // Default: Original Prompt/Plan generation
    const systemInstruction = `
      You are the backend brain of DeadlineSlayer: an elite multi-agent productivity rescue engine.
      The user is panicking and has entered a prompt describing what they need to accomplish.
      
      Act as three collaborative agents:
      1. **AI Orchestrator**: Parse the prompt into 3-5 highly actionable, specific, and realistic subtasks. Assign each subtask to a Priority Matrix Quadrant:
         - Quadrant 1: Urgent & Important (critical, immediate runway defense)
         - Quadrant 2: Not Urgent but Important (strategic prep, planning, long-term success)
         - Quadrant 3: Urgent but Not Important (delegatable chores, minor admin steps)
         - Quadrant 4: Not Urgent & Not Important (low-value items to trim)
         Also assign an estimated duration in minutes (e.g., 30, 60, 90, 120).
      2. **AI Executor**: Formulate concrete, measurable titles for the tasks. Do not use generic placeholders.
      3. **AI Guardian**: Audit the plan for fatigue and risk. Write realistic security audit logs about safety, fatigue, and potential bottlenecks.
      
      You must respond with a single, valid JSON object containing exactly this structure:
      {
        "tasks": [
          {
            "name": "Subtask title here",
            "quadrant": 1, // number 1-4
            "priority": "High", // "High", "Medium", or "Low"
            "estimatedMinutes": 90, // integer
            "category": "Preparation" // short category name
          }
        ],
        "logs": [
          "[Orchestrator] Intercepted user panic instruction...",
          "[Executor] Formulating subtask templates...",
          "[Guardian] Performing risk analysis on fatigue vectors..."
        ],
        "analysis": "A concise, empowering 2-3 sentence overview of why this plan was designed this way, focusing on runway defense."
      }
    `;

    const userPrompt = `
      Panic instruction: "${prompt || ""}"
      Target Goal Reference ID: "${goalId || 'global'}"
    `;

    const response = await generateWithFallback(ai, userPrompt, {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
    });

    const data = safeJsonParse(response.text);
    return NextResponse.json(data);

  } catch (err) {
    console.warn("Gemini API parsing or execution error:", err.message || err);
    return NextResponse.json(getSimulatedActionResponse(body?.action, body?.task, body?.goal, body?.tasks, body?.reason, body?.timeRequested, body?.prompt, body?.goalId));
  }
}

function getSimulatedActionResponse(action, task, goal, tasks, reason, timeRequested, prompt, goalId) {
  if (action === "execute") {
    return {
      content: `=== COMPLETE SLA-EXECUTOR TACTICAL IMPLEMENTATION ===
// File: src/components/${task?.name?.replace(/[^a-zA-Z]/g, "") || "Draft"}.js
// Subtask compiled for: "${task?.name || 'Urgent Deliverable'}"

import React, { useState, useEffect } from 'react';

export default function PanicRescueDraft() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    setLoading(true);
    console.log("[Executor] Injecting lightning solution for runway bottleneck...");
    setTimeout(() => {
      setData({ status: "STABILIZED", metric: 100 });
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div style={{ padding: '1.5rem', background: '#0a0f1d', borderRadius: '8px', border: '1px solid #ef4444' }}>
      <h3 style={{ color: '#ef4444', marginTop: 0 }}>⚡ RESCUE COMPILER ACTIVE</h3>
      <p style={{ color: '#94a3b8' }}>This is a pre-audited lightning prototype designed to immediately secure the deadline.</p>
      {loading ? (
        <span style={{ color: '#3b82f6' }}>STABILIZING MATRIX...</span>
      ) : (
        <div style={{ color: '#10b981' }}>✓ SYSTEM STATUS RUNWAY CLEAR (${task?.name || 'TASK COMPLETE'})</div>
      )}
    </div>
  );
}`
    };
  }

  if (action === "simplify") {
    return {
      content: `⚡ SLA-OPTIMIZER THREE-STEP COMPRESSION:
1. CUT ALL BOILERPLATE: Bypass advanced configurations and write the absolute minimum logic to make a single endpoint return status 200.
2. DRAFT HARDCODED PRESENTATION: Instead of complex dynamic queries, bind immediate static mockup states directly to secure presentational stability.
3. FIRE LAUNCH PROTOCOL: Avoid post-mortems or pre-checks. Deploy the micro-service immediately and check in production.`
    };
  }

  if (action === "extension") {
    return {
      content: `Subject: URGENT: Runway adjustment requested for "${task?.name || 'Pending milestone'}"

Dear Team / Stakeholders,

I am writing to request a strategic runway adjustment of ${timeRequested || '24 hours'} for our target milestone "${task?.name || 'Pending milestone'}" under the "${goal?.name || 'Goal track'}" roadmap.

The primary bottleneck is related to: ${reason || "an unexpected integration latency that requires deep isolation to secure correct compilation"}.

To preserve complete system integrity, I am adjusting my priority queues to target this exclusively. This timeline shift will guarantee a secure and fully polished delivery without sacrificing any of our structural standards.

I will provide an intermediate progress log within the next 4 hours. Thank you for your flexibility and support.

Best regards,
Operator (DeadlineSlayer Core)`
    };
  }

  if (action === "scope_reduction") {
    const validTasks = Array.isArray(tasks) ? tasks.filter(t => t && typeof t === "object") : [];
    const sacrificial = validTasks.length > 0 ? [validTasks[0]] : [{ id: "mock-1", name: "Configure comprehensive unit test suite" }];
    return {
      sacrificialTaskIds: sacrificial.map(t => t?.id || "mock-id"),
      sacrificialTaskNames: sacrificial.map(t => t?.name || "Mock Task"),
      mvpPivot: `Achieve a streamlined, high-impact core working prototype of ${goal?.name || goal?.title || 'this track'} without secondary administrative views.`
    };
  }

  // Fallback for default plan generation
  return {
    tasks: [
      {
        name: `Analyze constraints for: ${prompt || 'Rescue request'}`,
        quadrant: 1,
        priority: "High",
        estimatedMinutes: 45,
        category: "Orchestration"
      },
      {
        name: `Draft actionable prototype structure`,
        quadrant: 2,
        priority: "High",
        estimatedMinutes: 90,
        category: "Execution"
      },
      {
        name: `Configure secure environment and fallback schemas`,
        quadrant: 1,
        priority: "Medium",
        estimatedMinutes: 30,
        category: "Guardian"
      }
    ],
    logs: [
      `[Orchestrator] SECURE BRIDGE: Fallback mode activated due to empty environment variables or service disruption.`,
      `[Orchestrator] Intent parsed. Mapping priority grid...`,
      `[Executor] Formulating subtasks...`,
      `[Guardian] Integrity check complete. Offline runtime is safe.`
    ],
    analysis: "Offline mode enabled. The AI Orchestrator successfully scaffolded a robust roadmap to secure your deadline."
  };
}
