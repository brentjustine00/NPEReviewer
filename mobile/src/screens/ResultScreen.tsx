import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BarChart } from "react-native-chart-kit";
import Animated, { FadeInDown } from "react-native-reanimated";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/colors";
import { AISuggestionPanel } from "../components/AISuggestionPanel";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

export function ResultScreen({ navigation }: Props) {
  const { lastResult, aiSuggestion } = useAppStore();

  if (!lastResult) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>No result found.</Text>
        <Pressable style={styles.button} onPress={() => navigation.replace("MainTabs")}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const labels = lastResult.nl_breakdown.map((x) => x.nl_code);
  const data = lastResult.nl_breakdown.map((x) => x.score);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.scoreCard}>
        <Text style={styles.scoreTitle}>Exam Completed</Text>
        <Text style={styles.score}>{lastResult.score.toFixed(2)}%</Text>
        <Text style={[styles.badge, lastResult.passed ? styles.pass : styles.fail]}>
          {lastResult.passed ? "PASS" : "FAIL"}
        </Text>
      </Animated.View>

      {labels.length > 0 && (
        <View style={styles.chartWrap}>
          <Text style={styles.chartTitle}>NP Mastery Breakdown</Text>
          <BarChart
            data={{ labels, datasets: [{ data }] }}
            width={Dimensions.get("window").width - 32}
            height={220}
            fromZero
            yAxisLabel=""
            yAxisSuffix="%"
            chartConfig={{
              backgroundGradientFrom: "#FFFFFF",
              backgroundGradientTo: "#FFFFFF",
              decimalPlaces: 0,
              color: () => colors.primary,
              labelColor: () => colors.text,
              barPercentage: 0.6
            }}
            style={{ borderRadius: 16 }}
          />
        </View>
      )}

      <View style={styles.chartWrap}>
        <Text style={styles.chartTitle}>Most Missed Topics</Text>
        {(lastResult.missed_topics || []).slice(0, 8).map((row) => (
          <Text key={row.topic} style={styles.topicRow}>
            {row.topic} ({row.misses})
          </Text>
        ))}
      </View>

      <AISuggestionPanel data={aiSuggestion} />

      <Pressable style={styles.button} onPress={() => navigation.replace("AttemptDetail", { attemptId: lastResult.attempt_id })}>
        <Text style={styles.buttonText}>Open Full Review (PDF)</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => navigation.replace("MainTabs")}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  info: { color: colors.text, marginBottom: 12 },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    alignItems: "center"
  },
  scoreTitle: { color: colors.text, fontWeight: "800" },
  score: { marginTop: 8, fontSize: 42, fontWeight: "900", color: colors.primary },
  badge: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: "hidden",
    color: "white",
    fontWeight: "800"
  },
  pass: { backgroundColor: colors.success },
  fail: { backgroundColor: colors.danger },
  chartWrap: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 12
  },
  chartTitle: { color: colors.text, fontWeight: "800", marginBottom: 8 },
  topicRow: { color: colors.text, marginBottom: 4 },
  button: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonText: { color: "white", fontWeight: "800" }
});
