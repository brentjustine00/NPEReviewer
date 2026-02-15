import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { NLCard } from "../components/NLCard";
import { BeautifulAlert } from "../components/BeautifulAlert";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/colors";

export function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { categories, history, activeAttemptId, questions, loadDashboard, beginPractice, beginFullExam } = useAppStore();
  const [errorDialog, setErrorDialog] = useState({ visible: false, message: "" });
  const [resetDialog, setResetDialog] = useState<{ visible: boolean; action: null | (() => Promise<void>) }>({
    visible: false,
    action: null
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const getCategoryAverage = (categoryId: number) => {
    const rows = history.filter((h) => h.mode === "practice" && h.nl_category_id === categoryId && h.score != null);
    if (!rows.length) return 0;
    const sum = rows.reduce((acc, x) => acc + (x.score || 0), 0);
    return sum / rows.length;
  };

  const hasSavedExam = Boolean(activeAttemptId && questions.length > 0);

  const runWithResetWarning = async (action: () => Promise<void>) => {
    if (hasSavedExam) {
      setResetDialog({
        visible: true,
        action
      });
      return;
    }
    await action();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 10) }]}
    >
      <Text style={styles.title}>Practice by NP Category</Text>
      <Text style={styles.subtitle}>Choose Nursing Practice I to V and start a focused 100-question drill.</Text>

      {activeAttemptId && questions.length > 0 ? (
        <Pressable style={styles.resumeBtn} onPress={() => navigation.navigate("Exam")}>
          <Text style={styles.resumeTxt}>Resume Saved Exam</Text>
        </Pressable>
      ) : null}

      <Animated.View entering={FadeInDown.duration(240)}>
        {categories.map((cat) => (
          <NLCard
            key={cat.id}
            item={cat}
            avgScore={getCategoryAverage(cat.id)}
            onPress={async () => {
              try {
                await runWithResetWarning(async () => {
                  await beginPractice(cat.id);
                  navigation.navigate("Exam");
                });
              } catch (e) {
                setErrorDialog({
                  visible: true,
                  message: e instanceof Error ? e.message : "Failed to start practice exam."
                });
              }
            }}
          />
        ))}
      </Animated.View>

      <Pressable
        style={styles.fullExamBtn}
        onPress={async () => {
          try {
            await runWithResetWarning(async () => {
              await beginFullExam();
              navigation.navigate("Exam");
            });
          } catch (e) {
            setErrorDialog({
              visible: true,
              message: e instanceof Error ? e.message : "Failed to start full exam."
            });
          }
        }}
      >
        <Text style={styles.fullExamTxt}>Start Full NPE Exam (500 Items)</Text>
      </Pressable>
      <BeautifulAlert
        visible={errorDialog.visible}
        title="Cannot Start Exam"
        message={errorDialog.message}
        onConfirm={() => setErrorDialog({ visible: false, message: "" })}
      />
      <BeautifulAlert
        visible={resetDialog.visible}
        title="Start New Exam?"
        message="You have a saved exam in progress. Starting a new one will reset and replace it."
        confirmText="Start New"
        destructive
        onCancel={() => setResetDialog({ visible: false, action: null })}
        onConfirm={async () => {
          const action = resetDialog.action;
          setResetDialog({ visible: false, action: null });
          if (action) {
            await action();
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 24, color: colors.text, fontWeight: "900" },
  subtitle: { marginTop: 4, color: colors.muted, marginBottom: 12 },
  resumeBtn: {
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#DFF8F4"
  },
  resumeTxt: { color: colors.secondary, fontWeight: "800" },
  fullExamBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
    shadowColor: "#1B4E80",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3
  },
  fullExamTxt: { color: "white", fontWeight: "900" }
});
