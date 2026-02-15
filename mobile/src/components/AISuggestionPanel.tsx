import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type Props = {
  data: {
    weakness_summary: string;
    study_recommendations: string[];
    priority_nl_subjects: string[];
    encouraging_feedback: string;
  } | null;
};

export function AISuggestionPanel({ data }: Props) {
  if (!data) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>AI Study Coach</Text>
      <Text style={styles.sub}>{data.weakness_summary}</Text>
      <Text style={styles.label}>Priority NP</Text>
      <Text style={styles.value}>{data.priority_nl_subjects.join(", ") || "No priority yet"}</Text>
      <Text style={styles.label}>Recommendations</Text>
      {data.study_recommendations.map((tip, idx) => (
        <Text key={`${tip}-${idx}`} style={styles.tip}>
          {idx + 1}. {tip}
        </Text>
      ))}
      <Text style={styles.note}>{data.encouraging_feedback}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#1A4A7A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4
  },
  title: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 18
  },
  sub: {
    color: colors.text,
    marginTop: 10,
    lineHeight: 20
  },
  label: {
    marginTop: 12,
    color: colors.secondary,
    fontWeight: "700"
  },
  value: {
    color: colors.text,
    marginTop: 4
  },
  tip: {
    marginTop: 6,
    color: colors.text
  },
  note: {
    marginTop: 14,
    color: colors.primary,
    fontWeight: "700"
  }
});
