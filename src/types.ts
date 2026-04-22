export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageData?: string;       // base64 data URL for images
  fileName?: string;        // original file name
  fileType?: 'image' | 'audio' | 'text' | 'document';
  isDailyReport?: boolean;  // marks daily progress reports
}

export interface Reminder {
  id: string;
  text: string;
  time: number;
  completed: boolean;
  createdAt: number;
  notified: boolean;
}

export type Mood = 'happy' | 'thinking' | 'concerned' | 'excited' | 'neutral' | 'speaking' | 'listening' | 'strict';

export interface DailyProgress {
  date: string;          // YYYY-MM-DD
  topics: string[];      // topics discussed today
  messageCount: number;  // total messages today
  questionsAsked: number;
  lastReportDate: string; // last date a report was generated
  streak: number;        // consecutive days
}

export type StudyMode = 'strict' | 'casual' | 'exam';

// ── Quiz Types ──
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizSession {
  id: string;
  title: string;
  type: 'jee-mains' | 'jee-advanced' | 'topic' | 'quick';
  questions: QuizQuestion[];
  answers: (number | null)[];
  currentQuestion: number;
  startedAt: number;
  completedAt?: number;
  timePerQuestion: number; // seconds
}

export interface QuizResult {
  id: string;
  title: string;
  type: string;
  totalQuestions: number;
  correctAnswers: number;
  timeTaken: number; // seconds
  date: number;
  topics: string[];
}

// ── Notes Types ──
export interface StudyNote {
  id: string;
  title: string;
  topic: string;
  content: string; // markdown
  createdAt: number;
  tags: string[];
}
