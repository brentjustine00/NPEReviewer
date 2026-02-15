import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import type { Question } from "../types";
import { colors } from "../theme/colors";

type Props = {
  question: Question;
  selectedChoiceId?: number;
  onSelect: (choiceId: number) => void;
};

export function QuestionCard({ question, selectedChoiceId, onSelect }: Props) {
  const cleanPrompt = (() => {
    const raw = (question.prompt || "").trim();
    const marker = " - Case ";
    const markerIdx = raw.indexOf(marker);
    if (markerIdx >= 0) {
      const body = `Case ${raw.slice(markerIdx + marker.length).trim()}`;
      return body.replace(/^Nursing Practice\s+[IVXLC]+\s*\([^)]*\)\s*[-:]?\s*/i, "").trim();
    }
    const idx = raw.indexOf(":");
    if (idx >= 0 && idx < raw.length - 1) {
      const body = raw.slice(idx + 1).trim();
      return body.replace(/^Nursing Practice\s+[IVXLC]+\s*\([^)]*\)\s*[-:]?\s*/i, "").trim();
    }
    return raw.replace(/^Nursing Practice\s+[IVXLC]+\s*\([^)]*\)\s*[-:]?\s*/i, "").trim();
  })();

  return (
    <Animated.View entering={FadeInRight.duration(250)} style={styles.card}>
      <Text style={styles.prompt}>{cleanPrompt}</Text>

      <View style={styles.choicesWrap}>
        {question.choices.map((choice) => {
          const selected = selectedChoiceId === choice.id;
          return (
            <Pressable
              key={choice.id}
              style={[styles.choice, selected && styles.choiceSelected]}
              onPress={() => onSelect(choice.id)}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{choice.body}</Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 18,
    shadowColor: "#194B7A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4
  },
  prompt: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25
  },
  choicesWrap: { marginTop: 16, gap: 10 },
  choice: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9E6F4",
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: "#E8F2FF"
  },
  choiceText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  choiceTextSelected: {
    color: colors.primary
  }
});
