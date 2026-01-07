import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExplanationStep } from "../types";

// Initialize the client
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Constants for model names based on SDK guidelines
export const MODEL_NAMES = {
  TEACHER: 'gemini-3-flash-preview',       // Fast, supports JSON schema
  TTS: 'gemini-2.5-flash-preview-tts',     // Dedicated TTS model
};

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates structured explanation steps for a math/science problem.
 * Supports both text and image input.
 * 
 * @param text The user's question.
 * @param imageBase64 Optional base64 image string.
 * @returns An array of ExplanationStep objects.
 */
export const generateExplanationSteps = async (text: string, imageBase64: string | null): Promise<ExplanationStep[]> => {
  try {
    const parts: any[] = [];
    
    // Add text part
    if (text) {
      parts.push({ text: text });
    }

    // Add image part if exists
    if (imageBase64) {
      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      const base64Data = imageBase64.split(',')[1] || imageBase64;
      parts.push({
        inlineData: {
          mimeType: "image/jpeg", // Assuming JPEG for simplicity, or detect from string
          data: base64Data
        }
      });
    }

    if (parts.length === 0) throw new Error("No input provided");

    const response = await ai.models.generateContent({
      model: MODEL_NAMES.TEACHER,
      contents: [{ parts }],
      config: {
        systemInstruction: `
You are a strict backend API for an AI Blackboard Teacher. 
Your goal is to break down the explanation of the user's math or science question into clear, distinct steps.

Output explicitly as a JSON array of objects.
Do not output markdown code blocks. Just the raw JSON.

Each object in the array must have exactly these fields:
1. "title": A short title for the step.
   - MUST be in Traditional Chinese (繁體中文).
2. "blackboardText": The mathematical content to be written on the board. 
   - MUST be purely LaTeX formulas enclosed in single '$' or double '$$' signs.
   - Do NOT include conversational text in this field. 
   - Example: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$"
3. "spokenText": The teacher's spoken explanation for this step.
   - MUST be in Traditional Chinese (繁體中文).
   - Tone: Encouraging, clear, and professional.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              blackboardText: { type: Type.STRING },
              spokenText: { type: Type.STRING },
            },
            required: ["title", "blackboardText", "spokenText"],
          },
        },
      },
    });

    const responseText = response.text || "[]";
    const steps = JSON.parse(responseText) as ExplanationStep[];
    return steps;

  } catch (error) {
    console.error("Gemini API (Explanation) Error:", error);
    throw error;
  }
};

/**
 * Generates audio for the teacher's voice.
 * Includes retry logic for transient 500 errors.
 * 
 * @param text The text to be spoken.
 * @param voiceName The specific voice character to use.
 * @returns The base64 encoded audio string.
 */
export const generateTeacherVoice = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAMES.TTS,
        contents: [{
          parts: [{ text: text }],
        }],
        config: {
          responseModalities: [Modality.AUDIO],
          // System instruction is crucial here to prevent the model from generating text output
          // which causes a 400 error when responseModalities is set to only AUDIO.
          systemInstruction: "You are a text-to-speech engine. Your sole task is to convert the provided text to audio. Do not generate any text or written response.",
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { 
                voiceName: voiceName 
              },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        throw new Error("No audio data received from Gemini TTS");
      }

      return base64Audio;
    } catch (error: any) {
      console.warn(`Gemini TTS Attempt ${attempt} failed:`, error);
      lastError = error;
      
      // Retry on 500 (Internal) or 503 (Unavailable) errors
      // The error object structure might vary, checking message or status if available
      const isRetryable = error.status === 'INTERNAL' || 
                          error.status === 'UNAVAILABLE' || 
                          (error.message && (error.message.includes('500') || error.message.includes('503')));
      
      if (attempt < maxRetries && isRetryable) {
        // Exponential backoff: 1000ms, 2000ms, 4000ms...
        await delay(1000 * Math.pow(2, attempt - 1));
        continue;
      }
      
      // If it's not retryable (e.g. 400 Bad Request), throw immediately
      if (!isRetryable) {
         throw error;
      }
    }
  }

  console.error("Gemini API (TTS) Error after retries:", lastError);
  throw lastError;
};