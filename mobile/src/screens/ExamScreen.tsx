import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { BeautifulAlert } from "../components/BeautifulAlert";
import { QuestionCard } from "../components/QuestionCard";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Exam">;
const PRACTICE_DURATION_SECONDS = 120 * 60;
const FULL_EXAM_DURATION_SECONDS = 5 * 60 * 60;

export function ExamScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const {
    questions,
    answers,
    categories,
    activeMode,
    activeNlCategoryId,
    remainingSeconds,
    loading,
    answerQuestion,
    setRemainingSeconds,
    finishExam
  } =
    useAppStore();
  const defaultDuration = activeMode === "full" ? FULL_EXAM_DURATION_SECONDS : PRACTICE_DURATION_SECONDS;
  const initialIndex = useMemo(() => {
    if (!questions.length) return 0;
    const firstUnanswered = questions.findIndex((q) => answers[q.id] == null);
    if (firstUnanswered === -1) return questions.length - 1;
    return firstUnanswered;
  }, [questions, answers]);
  const [index, setIndex] = useState(initialIndex);
  const [remaining, setRemaining] = useState(remainingSeconds ?? defaultDuration);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ visible: false, message: "" });
  const autoSubmittedRef = useRef(false);

  const question = questions[index];
  const progress = useMemo(() => (questions.length ? ((index + 1) / questions.length) * 100 : 0), [index, questions]);
  const nlCode = useMemo(() => {
    if (activeMode === "practice" && activeNlCategoryId) {
      const cat = categories.find((c) => c.id === activeNlCategoryId);
      return cat?.code || "NP";
    }
    const source = `${question?.prompt || ""} ${question?.topic || ""}`.toLowerCase();
    if (source.includes("nursing practice v")) return "NP5";
    if (source.includes("nursing practice iv")) return "NP4";
    if (source.includes("nursing practice iii")) return "NP3";
    if (source.includes("nursing practice ii")) return "NP2";
    if (source.includes("nursing practice i")) return "NP1";
    return "Mixed NP";
  }, [activeMode, activeNlCategoryId, categories, question]);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (remainingSeconds == null) {
      setRemainingSeconds(remaining);
    } else {
      setRemaining(remainingSeconds);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setRemainingSeconds(remaining);
    if (remaining === 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      onSubmit();
    }
  }, [remaining]);

  const onSubmit = async () => {
    try {
      await finishExam(defaultDuration - remaining);
      autoSubmittedRef.current = false;
      navigation.replace("Results");
    } catch (e) {
      autoSubmittedRef.current = false;
      setErrorDialog({
        visible: true,
        message: e instanceof Error ? e.message : "Could not submit exam."
      });
    }
  };

  if (!question) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>No active exam. Start from the Practice tab.</Text>
        <Pressable style={styles.btn} onPress={() => navigation.replace("MainTabs")}>
          <Text style={styles.btnTxt}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 14)
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.progressTxt}>
          Question {index + 1}/{questions.length}
        </Text>
        <Text style={styles.nlCode}>{nlCode}</Text>
        <Text style={styles.timer}>
          {mins}:{secs}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <QuestionCard
        question={question}
        selectedChoiceId={answers[question.id]}
        onSelect={(choiceId) => answerQuestion(question.id, choiceId)}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          style={[styles.btn, index === 0 && styles.btnDisabled]}
          disabled={index === 0}
          onPress={() => setIndex((s) => Math.max(0, s - 1))}
        >
          <Text style={styles.btnTxt}>Prev</Text>
        </Pressable>

        {index < questions.length - 1 ? (
          <Pressable
            style={[styles.btn, !answers[question.id] && styles.btnDisabled]}
            disabled={!answers[question.id]}
            onPress={() => setIndex((s) => Math.min(questions.length - 1, s + 1))}
          >
            <Text style={styles.btnTxt}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, styles.submitBtn]}
            onPress={() => setShowSubmitModal(true)}
          >
            <Text style={styles.btnTxt}>Submit</Text>
          </Pressable>
        )}
      </View>

      <Modal transparent visible={showSubmitModal} animationType="fade" onRequestClose={() => setShowSubmitModal(false)}>
        <View style={styles.modalBackdrop}>
          <Animated.View entering={FadeInUp.duration(220)} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit Exam</Text>
            <Text style={styles.modalText}>
              You answered {Object.keys(answers).length} of {questions.length} questions.
            </Text>
            <Text style={styles.modalText}>Once submitted, answers are locked.</Text>
            <View style={styles.modalRow}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowSubmitModal(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.confirmBtn, loading && styles.btnDisabled]}
                disabled={loading}
                onPress={async () => {
                  setShowSubmitModal(false);
                  await onSubmit();
                }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmTxt}>Submit Now</Text>}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
      <BeautifulAlert
        visible={errorDialog.visible}
        title="Submit Failed"
        message={errorDialog.message}
        onConfirm={() => setErrorDialog({ visible: false, message: "" })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTxt: { fontWeight: "800", color: colors.text },
  nlCode: {
    color: colors.secondary,
    fontWeight: "900",
    backgroundColor: "#E4F6F2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  timer: { fontWeight: "900", color: colors.primary },
  progressBar: { marginVertical: 12, height: 8, backgroundColor: "#DBE8F6", borderRadius: 8 },
  progressFill: { height: 8, borderRadius: 8, backgroundColor: colors.secondary },
  footer: { marginTop: "auto", flexDirection: "row", justifyContent: "space-between", paddingTop: 14 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18
  },
  submitBtn: { backgroundColor: colors.success },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: "white", fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  msg: { color: colors.muted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 26, 45, 0.45)",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18
  },
  modalTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 20
  },
  modalText: {
    color: colors.muted,
    marginTop: 8,
    lineHeight: 20
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 10
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center"
  },
  cancelBtn: {
    backgroundColor: "#E8EDF5"
  },
  confirmBtn: {
    backgroundColor: colors.success
  },
  cancelTxt: { color: colors.text, fontWeight: "700" },
  confirmTxt: { color: "white", fontWeight: "800" },
  card: {},
  row: {},
  choice: {},
  selected: {},
  choiceText: {},
  choiceTextSelected: {}
});
