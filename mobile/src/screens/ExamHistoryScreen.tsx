import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { fetchAttemptDetail } from "../api/endpoints";
import { BeautifulAlert } from "../components/BeautifulAlert";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/colors";
import type { ExamAttemptHistory } from "../types";

export function ExamHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { history, offlineMode, loadDashboard } = useAppStore();
  const [errorDialog, setErrorDialog] = useState({ visible: false, message: "" });

  useEffect(() => {
    loadDashboard();
  }, []);

  const downloadAttemptPdf = async (item: ExamAttemptHistory) => {
    try {
      let reviewRows = item.answer_review || [];
      if (!offlineMode) {
        const detail = await fetchAttemptDetail(item.id);
        reviewRows = detail.answer_review || [];
      }
      const rows = reviewRows
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
            <h2>NPE Reviewer - Attempt #${item.id}</h2>
            <p>Mode: ${item.mode === "full" ? "Full Exam" : "NP Practice"} | Score: ${item.score ?? 0}%</p>
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
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: `Attempt #${item.id} PDF` });
    } catch (e) {
      setErrorDialog({
        visible: true,
        message: e instanceof Error ? e.message : "Could not export attempt PDF."
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Exam History</Text>
        <Text style={styles.link}>Recent Attempts</Text>
      </View>
      <FlatList
        data={history}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown.duration(220)}>
            <View style={styles.card}>
              <Pressable onPress={() => navigation.navigate("AttemptDetail", { attemptId: item.id })}>
                <Text style={styles.row}>{new Date(item.started_at).toLocaleDateString()}</Text>
                <Text style={styles.row}>Mode: {item.mode === "full" ? "Full Exam" : "NP Practice"}</Text>
                <Text style={styles.row}>Score: {item.score ?? 0}%</Text>
                <Text style={[styles.badge, item.passed ? styles.pass : styles.fail]}>
                  {item.passed ? "PASS" : "FAIL"}
                </Text>
                <Text style={styles.tapHint}>
                  {offlineMode ? "Tap to review all answers and score details" : "Tap to view AI suggestions and full answer review"}
                </Text>
              </Pressable>
              <Pressable style={styles.downloadBtn} onPress={() => downloadAttemptPdf(item)}>
                <Text style={styles.downloadTxt}>Download PDF</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No attempts yet.</Text>}
      />
      <BeautifulAlert
        visible={errorDialog.visible}
        title="PDF Export"
        message={errorDialog.message}
        onConfirm={() => setErrorDialog({ visible: false, message: "" })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  title: { fontSize: 24, color: colors.text, fontWeight: "900" },
  link: { color: colors.primary, fontWeight: "800" },
  card: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#1A4A7A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  row: { color: colors.text, marginBottom: 2 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 6,
    color: "white",
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden"
  },
  pass: { backgroundColor: colors.success },
  fail: { backgroundColor: colors.danger },
  tapHint: { marginTop: 8, color: colors.primary, fontWeight: "700" },
  downloadBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 9
  },
  downloadTxt: { color: "white", fontWeight: "800" },
  empty: { marginTop: 30, color: colors.muted, textAlign: "center" }
});
