import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { colors } from "../theme/colors";
import type { NLCategory } from "../types";

type Props = {
  item: NLCategory;
  avgScore?: number;
  onPress: () => void;
};

export function NLCard({ item, avgScore = 0, onPress }: Props) {
  const pressScale = useSharedValue(1);
  const floatY = useSharedValue(0);

  const startFloating = useCallback(() => {
    cancelAnimation(floatY);
    floatY.value = withRepeat(withTiming(-2, { duration: 1200 }), -1, true);
  }, [floatY]);

  useEffect(() => {
    startFloating();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }, { translateY: floatY.value }]
  }));

  return (
    <Pressable
      onPressIn={() => {
        pressScale.value = withSpring(0.97);
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1);
        startFloating();
      }}
      onPress={onPress}
    >
      <Animated.View style={animatedStyle}>
        <LinearGradient colors={[colors.accentA, colors.accentB]} style={styles.card}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Avg Score: {avgScore.toFixed(0)}%</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0E4D5A",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5
  },
  code: {
    fontSize: 14,
    color: "#E9F3FF",
    fontWeight: "700"
  },
  title: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  metaRow: { marginTop: 10 },
  metaText: { color: "#EBF5FF", fontSize: 13, fontWeight: "600" }
});
