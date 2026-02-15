import { apiRequest } from "./client";
import type { AttemptDetail, ExamAttemptHistory, NLCategory, Question, SubmitResult } from "../types";

export async function register(email: string, password: string, fullName: string) {
  return apiRequest<{ id: number; email: string; full_name: string }>("/auth/register", "POST", {
    email,
    password,
    full_name: fullName
  });
}

export async function login(email: string, password: string) {
  return apiRequest<{ access_token: string; user: { id: number; email: string; full_name: string } }>(
    "/auth/login",
    "POST",
    { email, password }
  );
}

export async function fetchNLCategories() {
  return apiRequest<NLCategory[]>("/nl-categories");
}

export async function fetchQuestionsByNl(nlId: number, limit = 250) {
  return apiRequest<{ questions: Question[] }>(`/exam/questions/${nlId}?limit=${limit}`);
}

export async function fetchQuestionsByIds(ids: number[]) {
  return apiRequest<{ questions: Question[] }>("/exam/questions/by-ids", "POST", { ids });
}

export async function startExam(mode: "practice" | "full", nlCategoryId?: number, initialLimit = 0) {
  return apiRequest<{ attempt_id: number; mode: string; total_questions: number; question_ids: number[]; questions: Question[] }>(
    "/exam/start",
    "POST",
    { mode, nl_category_id: nlCategoryId, initial_limit: initialLimit }
  );
}

export async function submitExam(
  attemptId: number,
  answers: Array<{ question_id: number; selected_choice_id: number | null }>,
  elapsedSeconds: number
) {
  return apiRequest<SubmitResult>("/exam/submit", "POST", {
    attempt_id: attemptId,
    answers,
    elapsed_seconds: elapsedSeconds
  });
}

export async function fetchHistory() {
  return apiRequest<ExamAttemptHistory[]>("/exam/history");
}

export async function fetchAttemptDetail(attemptId: number) {
  return apiRequest<AttemptDetail>(`/exam/history/${attemptId}`);
}

export async function fetchAISuggestions(attemptId: number, payload: Record<string, unknown>) {
  return apiRequest<{
    weakness_summary: string;
    study_recommendations: string[];
    priority_nl_subjects: string[];
    encouraging_feedback: string;
  }>(`/ai/suggestions?attempt_id=${attemptId}`, "POST", payload);
}
