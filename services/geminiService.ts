import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { ExplanationStep, ChatMessage, MessageRole, PracticeQuestion } from "../types";

// Constants for model names based on SDK guidelines
export const MODEL_NAMES = {
  TEACHER: 'gemini-3-pro-preview',       // Complex Text Tasks (Math/STEM)
  TTS: 'gemini-2.5-flash-preview-tts',     // Dedicated TTS model
  CHAT: 'gemini-3-flash-preview',          // Fast model for chat
};

/**
 * Helper function to retry operations with exponential backoff
 */
async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for 429 or specific Quota error messages
    const isQuotaError = 
      error.status === 429 || 
      (error.message && error.message.includes("429")) || 
      (error.message && error.message.includes("Quota"));

    if (isQuotaError && retries > 0) {
      console.warn(`API Quota hit. Retrying in ${delay}ms... (Attempts left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Generates structured explanation steps for a math/science problem.
 * 
 * @param apiKey - The user's API Key
 * @param prompt - The question text
 * @param imageBase64 - Optional base64 image string
 */
export const generateExplanationSteps = async (apiKey: string, prompt: string, imageBase64?: string): Promise<ExplanationStep[]> => {
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const parts: any[] = [];
    
    if (prompt) {
      parts.push({ text: prompt });
    }

    if (imageBase64) {
      // Handle both raw base64 and data URI
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }

    if (parts.length === 0) throw new Error("No input provided");

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_NAMES.TEACHER,
      contents: [{ parts }],
      config: {
        systemInstruction: `You are a strict backend API for an AI Blackboard Teacher. 
Your goal is to break down the explanation of the user's math or science question into clear, distinct steps.

Output explicitly as a JSON array of objects.
Do not output markdown code blocks. Just the raw JSON.

Each object in the array must have exactly these fields:
1. "title": A short title for the step. MUST be in Traditional Chinese.
2. "blackboardText": Purely LaTeX formulas enclosed in '$' or '$$'.
3. "spokenText": The teacher's spoken explanation for this step. MUST be in Traditional Chinese.`,
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
    }));

    const responseText = response.text || "[]";
    const steps = JSON.parse(responseText) as ExplanationStep[];
    return steps;
  } catch (error) {
    console.error("Gemini API Error (Explanation):", error);
    throw error;
  }
};

/**
 * Generates a practice question similar to the original one.
 * @param apiKey - The user's API Key
 */
export const generatePracticeQuestion = async (apiKey: string, originalQuestion: string): Promise<PracticeQuestion> => {
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_NAMES.TEACHER,
      contents: [{ parts: [{ text: `Original Question: ${originalQuestion}` }] }],
      config: {
        systemInstruction: `You are a math/science teacher.
Based on the "Original Question" provided by the user, design a **new** practice question.
The new question must test the **same logic and concepts** but use **different numbers**.
The difficulty level should be consistent with the original question.

Output strictly as a JSON object with the following fields:
1. "question": The question text. Use LaTeX enclosed in '$' for math. (Traditional Chinese)
2. "answer": The step-by-step solution and final answer. Use LaTeX enclosed in '$'. (Traditional Chinese)
3. "hint": A short hint to help the student start. (Optional, Traditional Chinese)`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING },
            hint: { type: Type.STRING },
          },
          required: ["question", "answer"],
        },
      },
    }));

    const responseText = response.text || "{}";
    return JSON.parse(responseText) as PracticeQuestion;
  } catch (error) {
    console.error("Gemini API Error (Practice Question):", error);
    throw error;
  }
};

/**
 * Generates audio for a given text using the specialized TTS model.
 * 
 * @param apiKey - The user's API Key
 * @param text - The text to speak
 * @param voiceName - The voice to use (default: Kore)
 */
export const generateTeacherVoice = async (apiKey: string, text: string, voiceName: string = 'Kore'): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_NAMES.TTS,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    }));

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
       console.warn("No audio content returned from Gemini");
       return undefined;
    }
    return base64Audio;

  } catch (error: any) {
    // If retry failed and we still have a 429, we throw a specific error for the UI to handle cleanly
    if (error.status === 429 || (error.message && error.message.includes("429"))) {
       console.warn("Gemini TTS Quota Exceeded despite retries.");
       throw new Error("QUOTA_EXCEEDED");
    }
    console.error("Gemini API Error (TTS):", error);
    throw error;
  }
};

/**
 * Handles conversational follow-up questions based on the current blackboard context.
 * @param apiKey - The user's API Key
 */
export const generateChatResponse = async (
  apiKey: string,
  history: ChatMessage[], 
  currentSteps: ExplanationStep[],
  userQuestion: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  // Construct context from current steps
  const contextDescription = currentSteps.map((step, i) => 
    `Step ${i+1}: ${step.title}\nBoard Content: ${step.blackboardText}\nExplanation: ${step.spokenText}`
  ).join('\n\n');

  const systemInstruction = `You are an AI Tutor answering a student's follow-up question about the lesson currently on the blackboard.
Current Lesson Context (Visible on Blackboard):
${contextDescription}

Rules:
1. Answer clearly and concisely in Traditional Chinese.
2. Direct the student's attention to specific steps if relevant (e.g., "Look at Step 2...").
3. Use LaTeX formatting enclosed in '$' for any math symbols.
4. Be encouraging and helpful.`;

  // Convert app history to Gemini format
  const contents = history.map(msg => ({
    role: msg.role === MessageRole.USER ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Add the new user question
  contents.push({
    role: 'user',
    parts: [{ text: userQuestion }]
  });

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_NAMES.CHAT,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    }));

    return response.text || "抱歉，我現在無法回答這個問題。";
  } catch (error) {
    console.error("Gemini API Error (Chat):", error);
    throw error;
  }
};

/**
 * Validates the provided API key by making a lightweight API call.
 */
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    await ai.models.generateContent({
      model: MODEL_NAMES.CHAT,
      contents: "test",
      config: { maxOutputTokens: 1 },
    });
    return true;
  } catch (error) {
    console.warn("API Key validation failed", error);
    return false;
  }
};