import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVE_EXAM_KEY_PREFIX = "nle_active_exam_v3";
const HISTORY_KEY_PREFIX = "nle_history_v3";
const LAST_ACCOUNT_KEY = "nle_last_account";
const QUESTION_BANK_KEY = "nle_question_bank_v3";

function resolveKey(scope = "default") {
  return `${ACTIVE_EXAM_KEY_PREFIX}:${scope}`;
}

function resolveHistoryKey(scope = "default") {
  return `${HISTORY_KEY_PREFIX}:${scope}`;
}

export async function saveActiveExam(payload: unknown, scope?: string) {
  await AsyncStorage.setItem(resolveKey(scope), JSON.stringify(payload));
}

export async function loadActiveExam<T>(scope?: string) {
  const raw = await AsyncStorage.getItem(resolveKey(scope));
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function clearActiveExam(scope?: string) {
  await AsyncStorage.removeItem(resolveKey(scope));
}

export async function saveHistory(payload: unknown, scope?: string) {
  await AsyncStorage.setItem(resolveHistoryKey(scope), JSON.stringify(payload));
}

export async function loadHistory<T>(scope?: string) {
  const raw = await AsyncStorage.getItem(resolveHistoryKey(scope));
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function saveQuestionBank(payload: unknown) {
  await AsyncStorage.setItem(QUESTION_BANK_KEY, JSON.stringify(payload));
}

export async function loadQuestionBank<T>() {
  const raw = await AsyncStorage.getItem(QUESTION_BANK_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

type LastAccount = {
  email: string;
  fullName?: string;
  password?: string;
};

export async function saveLastAccount(payload: LastAccount) {
  await AsyncStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify(payload));
}

export async function loadLastAccount() {
  const raw = await AsyncStorage.getItem(LAST_ACCOUNT_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as LastAccount;
}
