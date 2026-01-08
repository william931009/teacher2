
// Message roles for the chat
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

// Structure for a chat message
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

// Structure for app state or settings if needed
export interface AppState {
  isThinking: boolean;
  currentTopic: string | null;
}

// The structure of a single teaching step returned by the AI
export interface ExplanationStep {
  title: string;
  blackboardText: string; // LaTeX formatted string enclosed in $ or $$
  spokenText: string;     // Traditional Chinese spoken explanation
}

export interface PracticeQuestion {
  question: string;
  hint?: string;
  answer: string;
}
