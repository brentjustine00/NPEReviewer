export type NLCategory = {
  id: number;
  code: string;
  title: string;
  icon: string;
};

export type Choice = {
  id: number;
  body: string;
};

export type Question = {
  id: number;
  prompt: string;
  topic: string;
  choices: Choice[];
};

export type ExamAttemptHistory = {
  id: number;
  mode: "practice" | "full";
  nl_category_id?: number | null;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  passed: boolean | null;
  total_questions: number;
  elapsed_seconds: number | null;
  nl_breakdown?: Array<{
    nl_code: string;
    correct: number;
    total: number;
    score: number;
  }>;
  missed_topics?: Array<{ topic: string; misses: number }>;
  answer_review?: Array<{
    question_id: number;
    prompt: string;
    topic: string;
    rationale?: string;
    selected_choice: string | null;
    correct_choice: string | null;
    is_correct: boolean;
  }>;
};

export type SubmitResult = {
  attempt_id: number;
  score: number;
  passed: boolean;
  correct_count: number;
  total_answered: number;
  nl_breakdown: Array<{
    nl_code: string;
    correct: number;
    total: number;
    score: number;
  }>;
  missed_topics: Array<{ topic: string; misses: number }>;
  elapsed_seconds?: number | null;
};

export type AISuggestion = {
  weakness_summary: string;
  study_recommendations?: string[];
  priority_nl_subjects?: string[];
  encouraging_feedback?: string;
};

export type AttemptDetail = {
  attempt: ExamAttemptHistory;
  nl_breakdown: Array<{
    nl_code: string;
    correct: number;
    total: number;
    score: number;
  }>;
  missed_topics: Array<{ topic: string; misses: number }>;
  ai_suggestion: AISuggestion | null;
  answer_review: Array<{
    question_id: number;
    prompt: string;
    topic: string;
    rationale?: string;
    selected_choice: string | null;
    correct_choice: string | null;
    is_correct: boolean;
  }>;
};
