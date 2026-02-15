import { create } from "zustand";

import { fetchAISuggestions, fetchHistory, fetchNLCategories, fetchQuestionsByIds, fetchQuestionsByNl, login, startExam, submitExam } from "../api/endpoints";
import { setAuthToken } from "../api/client";
import type { ExamAttemptHistory, NLCategory, Question, SubmitResult } from "../types";
import { clearActiveExam, loadActiveExam, loadHistory, loadQuestionBank, saveActiveExam, saveHistory, saveQuestionBank } from "../utils/cache";

type AuthUser = { id: number; email: string; full_name: string } | null;
const PRACTICE_QUESTION_COUNT = 100;
const FULL_EXAM_QUESTION_COUNT = 500;
const INITIAL_QUESTION_BATCH = 5;
const BACKGROUND_QUESTION_CHUNK = 50;
const PRACTICE_DURATION_SECONDS = 120 * 60;
const FULL_EXAM_DURATION_SECONDS = 5 * 60 * 60;
const OFFLINE_BANK_PER_NL_LIMIT = 250;

const offlineCategories: NLCategory[] = [
  { id: 1, code: "NP1", title: "Nursing Practice I (Community Health Nursing)", icon: "heart" },
  { id: 2, code: "NP2", title: "Nursing Practice II (Care of Healthy/At-Risk Mother and Child)", icon: "baby" },
  { id: 3, code: "NP3", title: "Nursing Practice III (Care of Clients with Physiologic and Psychosocial Alterations - Part A)", icon: "hospital" },
  { id: 4, code: "NP4", title: "Nursing Practice IV (Care of Clients with Physiologic and Psychosocial Alterations - Part B)", icon: "brain" },
  { id: 5, code: "NP5", title: "Nursing Practice V (Care of Clients with Physiologic and Psychosocial Alterations - Part C)", icon: "globe" }
];

function buildOfflineQuestions(nlId?: number, count = PRACTICE_QUESTION_COUNT): Question[] {
  const nlLabelById = Object.fromEntries(offlineCategories.map((c) => [c.id, c.title])) as Record<number, string>;
  const topicPoolByNl: Record<number, string[]> = {
    1: [
      "Community Assessment",
      "Disease Prevention",
      "Environmental Health",
      "Health Promotion",
      "Outbreak Control",
      "Public Health Education"
    ],
    2: [
      "Prenatal Care",
      "Labor Monitoring",
      "Postpartum Care",
      "Newborn Assessment",
      "Pediatric Nutrition",
      "Immunization Safety"
    ],
    3: [
      "Cardiovascular Stability",
      "Respiratory Care",
      "Fluid and Electrolyte Balance",
      "Endocrine Monitoring",
      "Perioperative Nursing",
      "Renal Support"
    ],
    4: [
      "Acute Medical-Surgical Prioritization",
      "Emergency Triage",
      "Neurologic Monitoring",
      "Infection Management",
      "Pain and Comfort Management",
      "Complex Care Coordination"
    ],
    5: [
      "Therapeutic Communication",
      "Psychiatric Safety",
      "Suicide Risk Screening",
      "Crisis Intervention",
      "Psychopharmacology Monitoring",
      "Rehabilitation Support"
    ]
  };
  const scenarioPoolByNl: Record<number, string[]> = {
    1: [
      "A barangay family reports multiple members with recent fever and cough.",
      "A home visit reveals unsafe water storage and poor sanitation practices.",
      "Community leaders request a rapid response plan for increasing dengue cases."
    ],
    2: [
      "A postpartum mother reports heavy bleeding and dizziness in the ward.",
      "A newborn has difficulty latching and poor feeding in the first 24 hours.",
      "A pregnant client at 34 weeks reports headache and visual changes."
    ],
    3: [
      "A patient with heart failure reports sudden shortness of breath at rest.",
      "A post-op client develops declining urine output and increasing edema.",
      "A diabetic patient becomes diaphoretic and confused before meals."
    ],
    4: [
      "An unstable client arrives with chest pain and altered vital signs.",
      "A patient with sepsis shows worsening perfusion despite ongoing care.",
      "A neurologic patient demonstrates sudden change in level of consciousness."
    ],
    5: [
      "A client verbalizes hopelessness and withdraws from interactions.",
      "A patient in withdrawal becomes increasingly restless and agitated.",
      "A family seeks guidance for long-term rehabilitation and coping support."
    ]
  };
  const stemPool = [
    "Which nursing action should be performed first?",
    "What is the highest priority intervention?",
    "Which finding requires immediate follow-up?",
    "Which instruction is most appropriate to reinforce?",
    "Which task can be safely delegated?",
    "Which response best reflects therapeutic communication?"
  ];
  const correctPool = [
    "Perform focused assessment and prioritize airway, breathing, and circulation.",
    "Reassess the patient and address the most unstable cue first.",
    "Implement the safest intervention before notifying other team members.",
    "Use evidence-based nursing process and verify patient response."
  ];
  const distractorPoolA = [
    "Document all findings and wait for the next scheduled round.",
    "Delay action until all diagnostic results are available.",
    "Proceed directly to discharge teaching before reassessment."
  ];
  const distractorPoolB = [
    "Delegate the task to unlicensed assistive personnel without reassessment.",
    "Prioritize convenience and complete lower-risk tasks first.",
    "Rely on the previous shift report without validating current status."
  ];
  const distractorPoolC = [
    "Notify the provider first without initial nursing assessment.",
    "Request family to decide urgent interventions immediately.",
    "Repeat non-urgent comfort measures and reassess later."
  ];
  const pick = (pool: string[], seed: number, stride: number, offset: number) => {
    if (!pool.length) return "";
    return pool[(seed * stride + offset) % pool.length];
  };

  const questions: Question[] = [];
  for (let i = 1; i <= count; i++) {
    const effectiveNlId = nlId || ((i - 1) % 5) + 1;
    const nlLabel = nlLabelById[effectiveNlId] || "General Nursing";
    const topics = topicPoolByNl[effectiveNlId] || ["General Nursing"];
    const scenarios = scenarioPoolByNl[effectiveNlId] || ["A client condition changes during rounds."];
    const seed = i + effectiveNlId * 17;
    const topic = pick(topics, seed, 5, 1);
    const scenario = pick(scenarios, seed, 7, 2);
    const stem = pick(stemPool, seed, 11, 3);
    const correct = pick(correctPool, seed, 13, 4);
    const d1 = pick(distractorPoolA, seed, 17, 5);
    const d2 = pick(distractorPoolB, seed, 19, 6);
    const d3 = pick(distractorPoolC, seed, 23, 7);
    const qId = (nlId || 9) * 1000 + i;
    questions.push({
      id: qId,
      prompt: `${nlLabel} - Case ${i.toString().padStart(3, "0")} - ${topic}: ${scenario} ${stem}`,
      topic: `${nlLabel} - ${topic}`,
      choices: [
        { id: qId * 10 + 1, body: d1 },
        { id: qId * 10 + 2, body: d2 },
        { id: qId * 10 + 3, body: correct },
        { id: qId * 10 + 4, body: d3 }
      ]
    });
  }
  return questions;
}

function getNlCodeFromQuestion(question: Question): string {
  const src = `${question.prompt || ""} ${question.topic || ""}`.toLowerCase();
  if (src.includes("nursing practice v")) return "NP5";
  if (src.includes("nursing practice iv")) return "NP4";
  if (src.includes("nursing practice iii")) return "NP3";
  if (src.includes("nursing practice ii")) return "NP2";
  if (src.includes("nursing practice i")) return "NP1";
  return "NP";
}

function simplifyTopic(topic: string): string {
  const parts = topic.split(" - ").map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : topic;
}

type QuestionBank = Record<number, Question[]>;

function dedupeQuestionsByPrompt(questions: Question[]) {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const q of questions) {
    const key = (q.prompt || "").trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function shuffle<T>(arr: T[]) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function pickOfflineBankQuestions(bank: QuestionBank, nlId: number | undefined, count: number) {
  if (nlId) {
    const rows = dedupeQuestionsByPrompt(bank[nlId] || []);
    if (!rows.length) return [];
    return shuffle(rows).slice(0, Math.min(count, rows.length));
  }
  const merged = dedupeQuestionsByPrompt(
    Object.keys(bank)
      .map((x) => Number(x))
      .flatMap((id) => bank[id] || [])
  );
  if (!merged.length) return [];
  return shuffle(merged).slice(0, Math.min(count, merged.length));
}

function getCacheScope(state: { offlineMode: boolean; user: AuthUser }): string | null {
  if (state.offlineMode) {
    const offlineEmail = state.user?.email?.trim().toLowerCase();
    if (!offlineEmail) return null;
    return `offline-${offlineEmail}`;
  }
  if (state.user?.id != null && state.user?.email) {
    return `online-${state.user.id}-${state.user.email.trim().toLowerCase()}`;
  }
  return null;
}

type AppState = {
  token: string | null;
  offlineMode: boolean;
  user: AuthUser;
  categories: NLCategory[];
  history: ExamAttemptHistory[];
  activeAttemptId: number | null;
  activeNlCategoryId: number | null;
  activeMode: "practice" | "full" | null;
  questions: Question[];
  answers: Record<number, number>;
  startedAt: number | null;
  remainingSeconds: number | null;
  lastResult: SubmitResult | null;
  aiSuggestion: {
    weakness_summary: string;
    study_recommendations: string[];
    priority_nl_subjects: string[];
    encouraging_feedback: string;
  } | null;
  loading: boolean;
  questionLoadPending: boolean;
  expectedQuestionCount: number;
  pendingQuestionIds: number[];
  hydrateActiveExam: () => Promise<void>;
  loginDemo: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  beginPractice: (nlCategoryId: number) => Promise<void>;
  beginFullExam: () => Promise<void>;
  answerQuestion: (questionId: number, choiceId: number) => void;
  setRemainingSeconds: (seconds: number) => void;
  finishExam: (elapsedSecondsOverride?: number) => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  token: null,
  offlineMode: false,
  user: null,
  categories: [],
  history: [],
  activeAttemptId: null,
  activeNlCategoryId: null,
  activeMode: null,
  questions: [],
  answers: {},
  startedAt: null,
  remainingSeconds: null,
  lastResult: null,
  aiSuggestion: null,
  loading: false,
  questionLoadPending: false,
  expectedQuestionCount: 0,
  pendingQuestionIds: [],

  hydrateActiveExam: async () => {
    const scope = getCacheScope(get());
    if (!scope) return;
    const cached = await loadActiveExam<{
      activeAttemptId: number;
      activeNlCategoryId: number | null;
      activeMode: "practice" | "full";
      questions: Question[];
      answers: Record<number, number>;
      startedAt: number;
      remainingSeconds: number | null;
    }>(scope);
    if (!cached) return;
    const normalizedQuestions =
      get().offlineMode && cached.activeMode
        ? buildOfflineQuestions(
            cached.activeMode === "practice" ? (cached.activeNlCategoryId ?? undefined) : undefined,
            cached.questions?.length || (cached.activeMode === "full" ? FULL_EXAM_QUESTION_COUNT : PRACTICE_QUESTION_COUNT)
          )
        : cached.questions;
    set({
      activeAttemptId: cached.activeAttemptId,
      activeNlCategoryId: cached.activeNlCategoryId,
      activeMode: cached.activeMode,
      questions: normalizedQuestions,
      expectedQuestionCount: normalizedQuestions?.length || 0,
      questionLoadPending: false,
      pendingQuestionIds: [],
      answers: cached.answers,
      startedAt: cached.startedAt,
      remainingSeconds: cached.remainingSeconds
    });
  },

  loginDemo: async () => {
    set({ loading: true });
    try {
      const res = await login("demo@nle.com", "password123");
      setAuthToken(res.access_token);
      set({ token: res.access_token, user: res.user });
    } finally {
      set({ loading: false });
    }
  },

  loadDashboard: async () => {
    if (get().offlineMode) {
      const scope = getCacheScope(get());
      const cachedHistory = scope ? await loadHistory<ExamAttemptHistory[]>(scope) : null;
      set({
        categories: offlineCategories,
        history: cachedHistory || []
      });
      return;
    }
    const [categories, history] = await Promise.all([fetchNLCategories(), fetchHistory()]);
    set({ categories, history });
    Promise.all(
      categories.map(async (cat) => {
        const rows = await fetchQuestionsByNl(cat.id, OFFLINE_BANK_PER_NL_LIMIT);
        return { id: cat.id, questions: rows.questions || [] };
      })
    )
      .then((entries) => {
        const bank: QuestionBank = {};
        for (const item of entries) {
          bank[item.id] = dedupeQuestionsByPrompt(item.questions || []);
        }
        return saveQuestionBank(bank);
      })
      .catch(() => undefined);
  },

  beginPractice: async (nlCategoryId: number) => {
    if (get().offlineMode) {
      const bank = (await loadQuestionBank<QuestionBank>()) || {};
      const bankQuestions = pickOfflineBankQuestions(bank, nlCategoryId, PRACTICE_QUESTION_COUNT);
      const nextState = {
        activeAttemptId: Date.now(),
        activeNlCategoryId: nlCategoryId,
        activeMode: "practice" as const,
        questions: bankQuestions.length ? bankQuestions : buildOfflineQuestions(nlCategoryId, PRACTICE_QUESTION_COUNT),
        expectedQuestionCount: PRACTICE_QUESTION_COUNT,
        questionLoadPending: false,
        pendingQuestionIds: [] as number[],
        answers: {},
        startedAt: Date.now(),
        remainingSeconds: PRACTICE_DURATION_SECONDS,
        lastResult: null,
        aiSuggestion: null
      };
      set(nextState);
      const scope = getCacheScope(get());
      if (scope) await saveActiveExam(nextState, scope);
      return;
    }

    const started = await startExam("practice", nlCategoryId, INITIAL_QUESTION_BATCH);
    if (!started.questions || started.questions.length === 0) {
      throw new Error("No questions available for this NP category. Seed backend questions first.");
    }
    const initialQuestions = started.questions || [];
    const questionIds = started.question_ids || [];
    const initialIds = new Set(initialQuestions.map((q) => q.id));
    const pendingIds = questionIds.filter((id) => !initialIds.has(id));
    const nextState = {
      activeAttemptId: started.attempt_id,
      activeNlCategoryId: nlCategoryId,
      activeMode: "practice" as const,
      questions: initialQuestions,
      expectedQuestionCount: started.total_questions || questionIds.length || initialQuestions.length,
      questionLoadPending: pendingIds.length > 0,
      pendingQuestionIds: pendingIds,
      answers: {},
      startedAt: Date.now(),
      remainingSeconds: PRACTICE_DURATION_SECONDS,
      lastResult: null,
      aiSuggestion: null
    };
    set(nextState);
    const scope = getCacheScope(get());
    if (scope) await saveActiveExam(nextState, scope);

    if (pendingIds.length > 0) {
      void (async () => {
        const chunkSize = BACKGROUND_QUESTION_CHUNK;
        for (let i = 0; i < pendingIds.length; i += chunkSize) {
          const idChunk = pendingIds.slice(i, i + chunkSize);
          const chunkRes = await fetchQuestionsByIds(idChunk);
          const chunk = chunkRes.questions || [];
          set((s) => {
            if (s.activeAttemptId !== started.attempt_id) return s;
            const questions = [...s.questions, ...chunk];
            const stillPending = s.pendingQuestionIds.filter((id) => !idChunk.includes(id));
            const isLast = stillPending.length === 0;
            const next = {
              ...s,
              questions,
              pendingQuestionIds: stillPending,
              questionLoadPending: !isLast
            };
            const nextScope = getCacheScope(s);
            if (nextScope) {
              saveActiveExam(
                {
                  activeAttemptId: next.activeAttemptId,
                  activeNlCategoryId: next.activeNlCategoryId,
                  activeMode: next.activeMode,
                  questions: next.questions,
                  answers: next.answers,
                  startedAt: next.startedAt,
                  remainingSeconds: next.remainingSeconds
                },
                nextScope
              );
            }
            return next;
          });
        }
      })();
    }
  },

  beginFullExam: async () => {
    if (get().offlineMode) {
      const bank = (await loadQuestionBank<QuestionBank>()) || {};
      const bankQuestions = pickOfflineBankQuestions(bank, undefined, FULL_EXAM_QUESTION_COUNT);
      const nextState = {
        activeAttemptId: Date.now(),
        activeNlCategoryId: null,
        activeMode: "full" as const,
        questions: bankQuestions.length ? bankQuestions : buildOfflineQuestions(undefined, FULL_EXAM_QUESTION_COUNT),
        expectedQuestionCount: FULL_EXAM_QUESTION_COUNT,
        questionLoadPending: false,
        pendingQuestionIds: [] as number[],
        answers: {},
        startedAt: Date.now(),
        remainingSeconds: FULL_EXAM_DURATION_SECONDS,
        lastResult: null,
        aiSuggestion: null
      };
      set(nextState);
      const scope = getCacheScope(get());
      if (scope) await saveActiveExam(nextState, scope);
      return;
    }

    const started = await startExam("full", undefined, INITIAL_QUESTION_BATCH);
    if (!started.questions || started.questions.length === 0) {
      throw new Error("No questions available for full exam. Seed backend questions first.");
    }
    const initialQuestions = started.questions || [];
    const questionIds = started.question_ids || [];
    const initialIds = new Set(initialQuestions.map((q) => q.id));
    const pendingIds = questionIds.filter((id) => !initialIds.has(id));
    const nextState = {
      activeAttemptId: started.attempt_id,
      activeNlCategoryId: null,
      activeMode: "full" as const,
      questions: initialQuestions,
      expectedQuestionCount: started.total_questions || questionIds.length || initialQuestions.length,
      questionLoadPending: pendingIds.length > 0,
      pendingQuestionIds: pendingIds,
      answers: {},
      startedAt: Date.now(),
      remainingSeconds: FULL_EXAM_DURATION_SECONDS,
      lastResult: null,
      aiSuggestion: null
    };
    set(nextState);
    const scope = getCacheScope(get());
    if (scope) await saveActiveExam(nextState, scope);

    if (pendingIds.length > 0) {
      void (async () => {
        const chunkSize = BACKGROUND_QUESTION_CHUNK;
        for (let i = 0; i < pendingIds.length; i += chunkSize) {
          const idChunk = pendingIds.slice(i, i + chunkSize);
          const chunkRes = await fetchQuestionsByIds(idChunk);
          const chunk = chunkRes.questions || [];
          set((s) => {
            if (s.activeAttemptId !== started.attempt_id) return s;
            const questions = [...s.questions, ...chunk];
            const stillPending = s.pendingQuestionIds.filter((id) => !idChunk.includes(id));
            const isLast = stillPending.length === 0;
            const next = {
              ...s,
              questions,
              pendingQuestionIds: stillPending,
              questionLoadPending: !isLast
            };
            const nextScope = getCacheScope(s);
            if (nextScope) {
              saveActiveExam(
                {
                  activeAttemptId: next.activeAttemptId,
                  activeNlCategoryId: next.activeNlCategoryId,
                  activeMode: next.activeMode,
                  questions: next.questions,
                  answers: next.answers,
                  startedAt: next.startedAt,
                  remainingSeconds: next.remainingSeconds
                },
                nextScope
              );
            }
            return next;
          });
        }
      })();
    }
  },

  answerQuestion: (questionId, choiceId) => {
    set((s) => {
      const next = { ...s.answers, [questionId]: choiceId };
      const scope = getCacheScope(s);
      if (scope) {
        saveActiveExam(
          {
            activeAttemptId: s.activeAttemptId,
            activeNlCategoryId: s.activeNlCategoryId,
            activeMode: s.activeMode,
            questions: s.questions,
            answers: next,
            startedAt: s.startedAt,
            remainingSeconds: s.remainingSeconds
          },
          scope
        );
      }
      return { answers: next };
    });
  },

  setRemainingSeconds: (seconds: number) => {
    set({ remainingSeconds: seconds });
  },

  finishExam: async (elapsedSecondsOverride?: number) => {
    const { activeAttemptId, activeNlCategoryId, answers, questions, startedAt } = get();
    if (!activeAttemptId) return;
    set({ loading: true });
    try {
      const payload = questions.map((q) => ({
        question_id: q.id,
        selected_choice_id: answers[q.id] ?? null
      }));
      const elapsedSeconds =
        elapsedSecondsOverride != null ? elapsedSecondsOverride : startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

      if (get().offlineMode) {
        const totalItems = payload.length || 1;
        const answeredCount = payload.filter((x) => x.selected_choice_id != null).length;
        const answersMap = get().answers;
        const questionsNow = get().questions;
        let correctCount = 0;
        const topicMisses: Record<string, number> = {};
        const byNl: Record<string, { correct: number; total: number }> = {};
        for (const q of questionsNow) {
          const selectedId = answersMap[q.id] ?? null;
          const correctChoice = q.choices[2] || null;
          const isCorrect = selectedId != null && correctChoice != null && selectedId === correctChoice.id;
          const nlCode = get().activeMode === "practice" && get().activeNlCategoryId ? get().categories.find((c) => c.id === get().activeNlCategoryId)?.code || getNlCodeFromQuestion(q) : getNlCodeFromQuestion(q);
          if (!byNl[nlCode]) byNl[nlCode] = { correct: 0, total: 0 };
          byNl[nlCode].total += 1;
          if (isCorrect) {
            correctCount += 1;
            byNl[nlCode].correct += 1;
          } else {
            const key = simplifyTopic(q.topic || "General Nursing");
            topicMisses[key] = (topicMisses[key] || 0) + 1;
          }
        }
        const score = Number(((correctCount / totalItems) * 100).toFixed(2));
        const missedTopics = Object.entries(topicMisses)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([topic, misses]) => ({ topic, misses }));
        const nlCodes =
          get().activeMode === "practice" && get().activeNlCategoryId
            ? [get().categories.find((c) => c.id === get().activeNlCategoryId)?.code || "NP1"]
            : Object.keys(byNl).sort();
        const result: SubmitResult = {
          attempt_id: activeAttemptId,
          score,
          passed: score >= 75,
          correct_count: correctCount,
          total_answered: answeredCount,
          elapsed_seconds: elapsedSeconds,
          nl_breakdown: nlCodes.map((code) => {
            const row = byNl[code] || { correct: 0, total: 0 };
            return {
              nl_code: code,
              correct: row.correct,
              total: row.total,
              score: row.total ? Number(((row.correct / row.total) * 100).toFixed(2)) : 0
            };
          }),
          missed_topics: missedTopics
        };
        const answerReview = get().questions.map((q) => {
          const selectedId = answers[q.id];
          const selected = q.choices.find((c) => c.id === selectedId) || null;
          const correct = q.choices[2] || null;
          return {
            question_id: q.id,
            prompt: q.prompt,
            topic: q.topic,
            rationale: `Rationale: Prioritize patient safety and the most unstable cue in ${simplifyTopic(q.topic)}.`,
            selected_choice: selected?.body || null,
            correct_choice: correct?.body || null,
            is_correct: selected?.id === correct?.id
          };
        });
        const historyItem: ExamAttemptHistory = {
          id: activeAttemptId,
          mode: get().activeMode || "practice",
          nl_category_id: activeNlCategoryId,
          started_at: new Date(startedAt || Date.now()).toISOString(),
          submitted_at: new Date().toISOString(),
          score: result.score,
          passed: result.passed,
          total_questions: get().questions.length,
          elapsed_seconds: elapsedSeconds,
          nl_breakdown: result.nl_breakdown,
          missed_topics: result.missed_topics,
          answer_review: answerReview
        };
        const nextHistory = [historyItem, ...get().history];
        set({ history: nextHistory, lastResult: result, aiSuggestion: null });
        const scope = getCacheScope(get());
        if (scope) {
          await saveHistory(nextHistory, scope);
          await clearActiveExam(scope);
        }
        set({
          activeAttemptId: null,
          activeNlCategoryId: null,
          activeMode: null,
          questions: [],
          expectedQuestionCount: 0,
          questionLoadPending: false,
          pendingQuestionIds: [],
          answers: {},
          startedAt: null,
          remainingSeconds: null
        });
        return;
      }

      const result = await submitExam(activeAttemptId, payload, elapsedSeconds);
      let ai = null;
      try {
        ai = await fetchAISuggestions(activeAttemptId, {
          nl_breakdown: result.nl_breakdown,
          missed_topics: result.missed_topics,
          elapsed_seconds: result.elapsed_seconds
        });
      } catch {
        ai = null;
      }
      let history = get().history;
      try {
        history = await fetchHistory();
      } catch {
        history = get().history;
      }
      set({ lastResult: result, aiSuggestion: ai, history });
      const scope = getCacheScope(get());
      if (scope) await clearActiveExam(scope);
      set({
        activeAttemptId: null,
        activeNlCategoryId: null,
        activeMode: null,
        questions: [],
        expectedQuestionCount: 0,
        questionLoadPending: false,
        pendingQuestionIds: [],
        answers: {},
        startedAt: null,
        remainingSeconds: null
      });
    } finally {
      set({ loading: false });
    }
  }
}));
