export type DashboardViewMode =
  | 'dashboard'
  | 'analytics'
  | 'browse'
  | 'builder'
  | 'exam'
  | 'formulas'
  | 'saved'
  | 'history'
  | 'syllabus'
  | 'settings'
  | 'dev-questions'
  | 'logs'
  | 'papers'
  | 'paper';

export type HeatmapCell = {
  dateKey: string;
  label: string;
  count: number;
  inMonth: boolean;
};

export type TopicStat = {
  topic: string;
  attempts: number;
  scoredAttempts: number;
  earnedMarks: number;
  totalMarks: number;
  accuracy: number | null;
};

export type ExamBuilderParams = {
  subject: string;
  grade: 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12';
  intensity: number;
  topics: string[];
  /** If true, include every available question for the selected topic filter instead of using intensity. */
  allQuestionsFromTopic?: boolean;
  cognitive: boolean;
  /** Subtopic names to restrict questions to (empty = no restriction). */
  subtopics?: string[];
  /** Specific syllabus dot-point texts to restrict questions to (empty = no restriction). */
  dotPoints?: string[];
};

export type PaperSummary = {
  year: string;
  subject: string;
  grade: string;
  school: string;
  count: number;
};
