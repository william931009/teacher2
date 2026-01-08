import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExplanationStep, ChatMessage, MessageRole, PracticeQuestion } from "../types";

// Constants for model names based on SDK guidelines
export const MODEL_NAMES = {
  TEACHER: 'gemini-3-flash-preview',       // Fast, supports JSON schema
  TTS: 'gemini-2.5-flash-preview-tts',     // Dedicated TTS model
  CHAT: 'gemini-3-flash-preview',          // Fast model for chat
};

/**
 * Validates the API key by making a lightweight request.
 */
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  if (!apiKey) return false;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    // Use the teacher model for a quick validation check (minimal token usage)
    await ai.models.generateContent({
      model: MODEL_NAMES.TEACHER,
      contents: [{ parts: [{ text: "Test" }] }],
    });
    return true;
  } catch (error) {
    console.warn("API Key Verification Failed:", error);
    return false;
  }
};

/**
 * Generates structured explanation steps for a math/science problem.
 */
export const generateExplanationSteps = async (apiKey: string, text: string, imageBase64: string | null): Promise<ExplanationStep[]> => {
  if (!apiKey) throw new Error("API Key is required for generating explanations");

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const parts: any[] = [];
    
    if (text) {
      parts.push({ text: text });
    }

    if (imageBase64) {
      const base64Data = imageBase64.split(',')[1] || imageBase64;
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }

    if (parts.length === 0) throw new Error("No input provided");

    const response = await ai.models.generateContent({
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
    });

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
 */
export const generatePracticeQuestion = async (apiKey: string, originalQuestion: string): Promise<PracticeQuestion> => {
  if (!apiKey) throw new Error("API Key is required for practice questions");
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
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
    });

    const responseText = response.text || "{}";
    return JSON.parse(responseText) as PracticeQuestion;
  } catch (error) {
    console.error("Gemini API Error (Practice Question):", error);
    throw error;
  }
};

/**
 * Generates audio for a given text using the specialized TTS model.
 */
export const generateTeacherVoice = async (apiKey: string, text: string, voiceName: string = 'Kore'): Promise<string> => {
  if (!apiKey) throw new Error("API Key is required for TTS");

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
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
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated from Gemini TTS");
    return base64Audio;

  } catch (error: any) {
    // Check for quota exhaustion specifically
    if (error.status === 429 || (error.message && error.message.includes("429"))) {
       console.error("Gemini TTS Quota Exceeded");
    }
    console.error("Gemini API Error (TTS):", error);
    throw error;
  }
};

/**
 * Handles conversational follow-up questions based on the current blackboard context.
 */
export const generateChatResponse = async (
  apiKey: string, 
  history: ChatMessage[], 
  currentSteps: ExplanationStep[],
  userQuestion: string
): Promise<string> => {
  if (!apiKey) throw new Error("API Key is required for chat");

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
    const response = await ai.models.generateContent({
      model: MODEL_NAMES.CHAT,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "抱歉，我現在無法回答這個問題。";
  } catch (error) {
    console.error("Gemini API Error (Chat):", error);
    throw error;
  }
};