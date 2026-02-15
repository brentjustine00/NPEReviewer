import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchAttemptDetail } from "../api/endpoints";
import { AISuggestionPanel } from "../components/AISuggestionPanel";
import { BeautifulAlert } from "../components/BeautifulAlert";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/colors";
import type { AttemptDetail } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "AttemptDetail">;

export function AttemptDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { attemptId } = route.params;
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [errorDialog, setErrorDialog] = useState({ visible: false, message: "" });
  const { offlineMode, history, categories, loadDashboard, beginPractice } = useAppStore();
  const buildFallbackFromReview = (rows: AttemptDetail["answer_review"]) => {
    const byNl: Record<string, { correct: number; total: number }> = {};
    const topicMisses: Record<string, number> = {};
    const detectNl = (src: string) => {
      const t = src.toLowerCase();
      if (t.includes("nursing practice v")) return "NP5";
      if (t.includes("nursing practice iv")) return "NP4";
      if (t.includes("nursing practice iii")) return "NP3";
      if (t.includes("nursing practice ii")) return "NP2";
      if (t.includes("nursing practice i")) return "NP1";
      return "NP";
    };
    for (const row of rows || []) {
      const nl = detectNl(`${row.prompt} ${row.topic}`);
      if (!byNl[nl]) byNl[nl] = { correct: 0, total: 0 };
      byNl[nl].total += 1;
      if (row.is_correct) byNl[nl].correct += 1;
      else topicMisses[row.topic || "General Nursing"] = (topicMisses[row.topic || "General Nursing"] || 0) + 1;
    }
    return {
      nl_breakdown: Object.keys(byNl)
        .sort()
        .map((nl_code) => {
          const rec = byNl[nl_code];
          return {
            nl_code,
            correct: rec.correct,
            total: rec.total,
            score: rec.total ? Number(((rec.correct / rec.total) * 100).toFixed(2)) : 0
          };
        }),
      missed_topics: Object.entries(topicMisses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic, misses]) => ({ topic, misses }))
    };
  };

  useEffect(() => {
    loadDashboard();
    if (offlineMode) {
      const local = history.find((x) => x.id === attemptId);
      if (!local) {
        setErrorDialog({ visible: true, message: "Could not load local attempt detail." });
        return;
      }
      const fallback = buildFallbackFromReview(local.answer_review || []);
      setDetail({
        attempt: local,
        nl_breakdown: (local.nl_breakdown && local.nl_breakdown.length ? local.nl_breakdown : fallback.nl_breakdown) || [],
        missed_topics: (local.missed_topics && local.missed_topics.length ? local.missed_topics : fallback.missed_topics) || [],
        ai_suggestion: null,
        answer_review: local.answer_review || []
      });
      return;
    }
    fetchAttemptDetail(attemptId)
      .then(setDetail)
      .catch(() => {
        setErrorDialog({ visible: true, message: "Could not load detailed analytics for this attempt." });
      });
  }, [attemptId, offlineMode, history]);

  const weakestNlCode = useMemo(() => {
    if (!detail?.nl_breakdown?.length) return null;
    const sorted = [...detail.nl_breakdown].sort((a, b) => a.score - b.score);
    return sorted[0]?.nl_code || null;
  }, [detail]);

  const weakestCategory = categories.find((x) => x.code === weakestNlCode);
  const aiData = !offlineMode && detail?.ai_suggestion
    ? {
        weakness_summary: detail.ai_suggestion.weakness_summary || "No summary available.",
        study_recommendations: detail.ai_suggestion.study_recommendations || [],
        priority_nl_subjects: detail.ai_suggestion.priority_nl_subjects || [],
        encouraging_feedback: detail.ai_suggestion.encouraging_feedback || "Keep practicing."
      }
    : null;

  const exportPdf = async () => {
    if (!detail) return;
    try {
      const rows = (detail.answer_review || [])
        .map((x, i) => {
          const status = x.is_correct ? "Correct" : "Wrong";
          const color = x.is_correct ? "#1D8F5A" : "#C13445";
          return `<tr>
              <td>${i + 1}</td>
              <td>${(x.topic || "").replaceAll("<", "&lt;")}</td>
              <td>${(x.prompt || "").replaceAll("<", "&lt;")}</td>
              <td>${(x.selected_choice || "No answer").replaceAll("<", "&lt;")}</td>
              <td>${(x.correct_choice || "").replaceAll("<", "&lt;")}</td>
              <td>${(x.rationale || "").replaceAll("<", "&lt;")}</td>
              <td style="color:${color};font-weight:700;">${status}</td>
            </tr>`;
        })
        .join("");
      const html = `<!doctype html>
        <html>
          <body style="font-family:Arial;padding:16px;">
            <h2>NPE Reviewer - Attempt #${detail.attempt.id}</h2>
            <p>Mode: ${detail.attempt.mode === "full" ? "Full Exam" : "NP Practice"} | Score: ${detail.attempt.score ?? 0}%</p>
            <table style="width:100%;border-collapse:collapse;font-size:12px;" border="1" cellpadding="6">
              <thead>
                <tr>
                  <th>#</th><th>Topic</th><th>Question</th><th>Your Answer</th><th>Correct Answer</th><th>Rationale</th><th>Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>`;
      const file = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setErrorDialog({ visible: true, message: `PDF saved at: ${file.uri}` });
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Share exam review PDF" });
    } catch (e) {
      setErrorDialog({
        visible: true,
        message: e instanceof Error ? e.message : "Could not export review PDF."
      });
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) }]}
    >
      <Text style={styles.title}>Attempt #{attemptId}</Text>
      <Text style={styles.sub}>
        {detail?.attempt.mode === "full" ? "Full Exam" : "NP Practice"} | Score: {detail?.attempt.score ?? 0}%
      </Text>

      {detail?.answer_review?.length ? (
        <Pressable style={[styles.button, styles.topDownloadBtn]} onPress={exportPdf}>
          <Text style={styles.buttonText}>Download Review PDF</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.section}>NP Breakdown</Text>
        {(detail?.nl_breakdown || []).map((x) => (
          <Text key={x.nl_code} style={styles.row}>
            {x.nl_code}: {x.correct}/{x.total} ({x.score}%)
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Most Missed Topics</Text>
        {(detail?.missed_topics || []).slice(0, 5).map((x) => (
          <Text key={x.topic} style={styles.row}>
            {x.topic} ({x.misses})
          </Text>
        ))}
      </View>

      {!offlineMode ? <AISuggestionPanel data={aiData} /> : null}

      <View style={styles.card}>
        <Text style={styles.section}>Answer Review</Text>
        {detail?.answer_review?.length ? (
          <Pressable style={[styles.button, styles.pdfBtnTopInside]} onPress={exportPdf}>
            <Text style={styles.buttonText}>Download PDF</Text>
          </Pressable>
        ) : null}
        {(detail?.answer_review || []).map((x, idx) => (
          <View key={`${x.question_id}-${idx}`} style={styles.answerRow}>
            <Text style={styles.questionNo}>Q{idx + 1}</Text>
            <Text style={styles.row}>{x.prompt}</Text>
            <Text style={styles.row}>Your answer: {x.selected_choice || "No answer"}</Text>
            <Text style={styles.row}>Correct answer: {x.correct_choice || "-"}</Text>
            {x.rationale ? <Text style={styles.rationale}>Rationale: {x.rationale}</Text> : null}
            <Text style={[styles.status, x.is_correct ? styles.ok : styles.bad]}>{x.is_correct ? "Correct" : "Wrong"}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.button, !weakestCategory && styles.buttonDisabled]}
        disabled={!weakestCategory}
        onPress={async () => {
          if (!weakestCategory) return;
          await beginPractice(weakestCategory.id);
          navigation.replace("Exam");
        }}
      >
        <Text style={styles.buttonText}>
          {weakestCategory ? `Review Practice: ${weakestCategory.code}` : "Review Practice Unavailable"}
        </Text>
      </Pressable>
      <BeautifulAlert
        visible={errorDialog.visible}
        title="Detail Notice"
        message={errorDialog.message}
        onConfirm={() => setErrorDialog({ visible: false, message: "" })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  sub: { marginTop: 6, color: colors.muted },
  card: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 14
  },
  section: { color: colors.primary, fontWeight: "800", marginBottom: 6 },
  row: { color: colors.text, marginBottom: 4 },
  rationale: { color: colors.muted, marginBottom: 4, fontStyle: "italic" },
  answerRow: {
    borderTopWidth: 1,
    borderTopColor: "#E4EBF6",
    paddingTop: 10,
    marginTop: 10
  },
  questionNo: { color: colors.secondary, fontWeight: "800", marginBottom: 4 },
  status: { marginTop: 2, fontWeight: "800" },
  ok: { color: colors.success },
  bad: { color: colors.danger },
  button: {
    marginTop: 16,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonDisabled: { opacity: 0.5 },
  topDownloadBtn: { backgroundColor: colors.primary },
  pdfBtnTopInside: {
    backgroundColor: colors.primary,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    marginTop: 2,
    marginBottom: 8
  },
  buttonText: { color: "white", fontWeight: "900" }
});
