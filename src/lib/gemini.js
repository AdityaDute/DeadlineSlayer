import { GoogleGenAI } from "@google/genai";

// Initialize client lazily to avoid crashing if GEMINI_API_KEY is not defined
let aiClient = null;

export const rateLimitedUntil = {};

export function getAvailableModels(baseModels) {
  const now = Date.now();
  let models = baseModels.filter(m => !rateLimitedUntil[m] || rateLimitedUntil[m] < now);
  if (models.length === 0) {
    return baseModels;
  }
  return models;
}

export function recordModelRateLimit(model) {
  rateLimitedUntil[model] = Date.now() + 5 * 60 * 1000; // block for 5 minutes
}

export function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in environment variables. Gemini calls will fail.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || "dummy-key" });
  }
  return aiClient;
}

/**
 * Highly resilient content generator with multiple fallback models to survive high demand/quota issues.
 * 
 * @param {GoogleGenAI} ai - Initialized GoogleGenAI client
 * @param {string|Array} contents - Prompt contents
 * @param {object} config - Configuration options (systemInstruction, responseMimeType, responseSchema, etc.)
 * @param {boolean} isProTask - If true, tries pro reasoning models first
 */
export async function generateWithFallback(ai, contents, config = {}, isProTask = false) {
  // Ordered preference of models.
  const baseModels = isProTask 
    ? ["gemini-3.1-pro-preview", "gemini-3.5-flash", "gemini-3.1-flash-lite"]
    : ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

  const models = getAvailableModels(baseModels);
  let lastError = null;

  for (const model of models) {
    let retries = 2;
    while (retries > 0) {
      try {
        console.log(`[Gemini API] Dispatching attempt with ${model} (Retries left: ${retries - 1})`);
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: config
        });
        
        if (response && response.text) {
          console.log(`[Gemini API] Successfully generated content using ${model}`);
          return response;
        }
      } catch (err) {
        const errMsg = (err?.message || "").toLowerCase();
        const errStatus = String(err?.status || "").toLowerCase();
        const isQuotaError = errMsg.includes("quota") || errMsg.includes("429") || errStatus.includes("resource_exhausted") || errMsg.includes("limit");
        const isTransientError = errMsg.includes("503") || errMsg.includes("unavailable") || errMsg.includes("high demand") || errMsg.includes("overloaded") || errStatus.includes("unavailable");
        
        if (isQuotaError || isTransientError) {
          console.warn(`[Gemini API] Model ${model} is rate limited, quota exhausted, or unavailable. Demoting for 5 minutes.`);
          recordModelRateLimit(model);
        } else {
          console.warn(`[Gemini API] Model ${model} returned error:`, err?.message || err);
        }
        
        lastError = err;
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }
  
  throw new Error(`All Gemini fallback models were exhausted. Last error: ${lastError?.message || lastError}`);
}

/**
 * Executes a call to Gemini model acting as a specific agent,
 * with optional structured JSON schema output and automated retries.
 * 
 * @param {string} agentName - The name of the agent (e.g. "Orchestrator", "Planner")
 * @param {string} systemPrompt - System context and instructions for the agent
 * @param {string} userMessage - User input
 * @param {object} [responseSchema] - Optional structured JSON schema
 * @returns {Promise<any>} Response text or parsed JSON object
 */
export async function callAgent(agentName, systemPrompt, userMessage, responseSchema = null) {
  const ai = getAiClient();
  const config = {
    systemInstruction: systemPrompt,
  };

  if (responseSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = responseSchema;
  }

  try {
    const response = await generateWithFallback(ai, userMessage, config, agentName === "Executor");
    const responseText = response.text;

    if (responseSchema) {
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[${agentName} Agent] JSON parsing failed:`, responseText, parseError);
        throw new Error("Invalid JSON structure returned by model");
      }
    }

    return responseText;
  } catch (error) {
    console.error(`[${agentName} Agent] Generation failed:`, error);
    throw error;
  }
}
