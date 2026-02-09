
export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER'
}

export type AgeGroup = 'Junior' | 'Senior' | 'Uni' | 'Adult';
export type CurrentLevel = '4.0-4.5' | '5.0-5.5' | '6.0-6.5' | '7.0+';

export type SpiritType = 'Flow' | 'Lexi' | 'Grammy' | 'Phoeny';

export interface AvatarColors {
  aura: string;
  energy: string;
  tint: string;
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  date: string;
}

export interface UserProfile {
  name: string;
  ageGroup: AgeGroup;
  currentLevel: CurrentLevel;
  targetScore: number;
  avatarId: string;
  avatarColors: AvatarColors;
  xp: number;
  level: number;
  errors: SpeakingError[];
  customAnswers: Record<string, { en: string; cn: string; topic?: string; question?: string }>;
  achievements: Achievement[];
  partner?: SpiritType; 
}

export type ErrorType = 'pronunciation' | 'lexical' | 'grammar' | 'fluency';

export interface SpeakingError {
  id: string;
  type: ErrorType;
  original: string;
  correction: string;
  explanation: string;
  date: string;
  practiced: boolean;
  recallCount: number;
  questionId?: string;
  monsterName?: string;
}

export interface GoldenPhrase {
  phrase: string;
  translation: string;
  emoji: string;
}

export interface MaterialArchetype {
  id: string;
  title: string;
  icon: string;
  description: string;
  prompts: string[];
  corpusThemes: string[];
}

export type P1Type = 'short' | 'likes' | 'preferences' | 'reasons' | 'experiences' | 'descriptions' | 'analysis';

export interface PracticeQuestion {
  id: string;
  part: 'P1' | 'P2' | 'P3';
  topic: string;
  question: string;
  questionEn: string;
  answerEn: string;
  answerCn: string;
  customized?: boolean;
  xpValue: number;
  phrases?: GoldenPhrase[];
  p1Type?: P1Type;
  estimatedDuration?: number; // in seconds
  visualUrl?: string; // Base64 or URL of generated pixel art
}

export interface TestScore {
  fluency: number;
  lexical: number;
  grammar: number;
  pronunciation: number;
  overall: number;
  feedback: string;
  date: string;
  xpEarned: number;
  detectedErrors?: SpeakingError[];
}

export interface StudentRecord {
  id: string;
  name: string;
  latestScore: TestScore;
  history: TestScore[];
}
