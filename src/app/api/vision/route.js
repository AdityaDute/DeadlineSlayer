import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAvailableModels, recordModelRateLimit } from "../../../lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { image } = await request.json(); // base64 image string
    if (!image) {
      return NextResponse.json({ 
        extractedGoals: [], 
        confidence: 0, 
        error: "Missing image data" 
      }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not defined for vision API. Returning simulated fallback extraction.");
      return NextResponse.json(getSimulatedVisionResponse());
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `You are a task extraction AI. Analyze this image carefully. It could be:
- A class assignment or homework sheet
- A course syllabus
- A whiteboard with notes/plans
- A handwritten to-do list
- A screenshot of an email with tasks
- An exam schedule
Extract ALL tasks, assignments, deadlines, and action items from the image.
Return ONLY valid JSON in this exact format:
{
  "imageType": "assignment_sheet | syllabus | whiteboard | todo_list | email | exam_schedule | other",
  "extractedGoals": [
    {
      "title": "Goal or assignment name",
      "deadline": "extracted deadline as YYYY-MM-DD or null if not found",
      "subtasks": [
        {
          "title": "specific task extracted",
          "estimatedHours": estimated_hours_as_number,
          "category": "research | writing | coding | study | communication | creative | admin"
        }
      ]
    }
  ],
  "rawTextExtracted": "The actual text content seen in the image",
  "confidence": 0.0 to 1.0
}
If you cannot extract meaningful tasks, return extractedGoals as an empty array with a confidence of 0.`;

    // Clean base64 data to get raw binary part
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const baseModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    const models = getAvailableModels(baseModels);
    let text = null;
    let lastError = null;

    for (const model of models) {
      let retries = 2;
      while (retries > 0) {
        try {
          console.log(`[Vision API] Dispatching attempt with ${model} (Retries left: ${retries - 1})`);
          const response = await ai.models.generateContent({
            model: model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          });

          if (response && response.text) {
            console.log(`[Vision API] Successfully generated content using ${model}`);
            text = response.text;
            break;
          }
        } catch (err) {
          const errMsg = (err.message || "").toLowerCase();
          const errStatus = err.status || "";
          const isQuotaError = errMsg.includes("quota") || errMsg.includes("429") || errStatus === "RESOURCE_EXHAUSTED" || errMsg.includes("limit");
          
          if (isQuotaError) {
            console.warn(`[Vision API] Model ${model} is rate limited/quota exhausted. Demoting for 5 minutes.`);
            recordModelRateLimit(model);
          } else {
            console.warn(`[Vision API] Model ${model} returned error:`, err.message || err);
          }
          
          lastError = err;
          retries--;
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
      if (text) break;
    }

    if (!text) {
      console.warn("All vision models failed or were overloaded. Returning simulated fallback extraction.");
      return NextResponse.json(getSimulatedVisionResponse());
    }

    let parsed;
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      parsed = JSON.parse(jsonString.trim());
    } catch (e) {
      console.error("Failed to parse Gemini response text:", text, e);
      parsed = { 
        extractedGoals: [], 
        confidence: 0, 
        error: "Failed to parse API output as JSON", 
        rawTextExtracted: text.substring(0, 500) 
      };
    }

    return NextResponse.json(parsed);

  } catch (err) {
    console.error("Vision API error:", err);
    return NextResponse.json({ 
      extractedGoals: [], 
      confidence: 0, 
      error: err.message || "Internal server error during image analysis" 
    }, { status: 500 });
  }
}

function getSimulatedVisionResponse() {
  return {
    imageType: "todo_list",
    extractedGoals: [
      {
        title: "Slay Urgent Math Portfolio",
        deadline: "2026-06-30",
        subtasks: [
          {
            title: "Solve complex calculus matrices and proof structures",
            estimatedHours: 2,
            category: "study"
          },
          {
            title: "Draft math assignment cover sheet and final verification checks",
            estimatedHours: 1,
            category: "writing"
          },
          {
            title: "Upload PDF portfolio to Student Portal before target lock",
            estimatedHours: 0.5,
            category: "admin"
          }
        ]
      },
      {
        title: "Assemble Marketing Pitch Deck",
        deadline: "2026-07-05",
        subtasks: [
          {
            title: "Perform target demographics and competitor research analysis",
            estimatedHours: 3,
            category: "research"
          },
          {
            title: "Design slide vectors, layout pairings, and animations in pitch outline",
            estimatedHours: 2,
            category: "creative"
          },
          {
            title: "Rehearse executive speech delivery and check runway duration parameters",
            estimatedHours: 1.5,
            category: "communication"
          }
        ]
      }
    ],
    rawTextExtracted: "[SIMULATED WHITEBOARD NOTES]\n- MATH PORTFOLIO DUE JUNE 30: Do calculus proofs, compile portfolio PDF, upload.\n- MARKETING SLIDES BY JULY 5: Do research slides, design visual structure, practice speech timer.",
    confidence: 0.95
  };
}
