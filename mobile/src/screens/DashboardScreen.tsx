import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { setAuthToken } from "../api/client";
import { NurseCapLogo } from "../components/NurseCapLogo";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/colors";
import { BeautifulAlert } from "../components/BeautifulAlert";

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, offlineMode, history, activeAttemptId, questions, loadDashboard, hydrateActiveExam, beginFullExam } =
    useAppStore();
  const pulse = useSharedValue(1);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ visible: false, message: "" });
  const [resetDialog, setResetDialog] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    hydrateActiveExam();
    loadDashboard();
    pulse.value = withRepeat(withTiming(1.04, { duration: 900 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }]
  }));

  const latest = history[0];
  const resetToLoginState = () => {
    setAuthToken(undefined);
    useAppStore.setState({
      token: null,
      offlineMode: false,
      user: null,
      activeAttemptId: null,
      activeNlCategoryId: null,
      activeMode: null,
      questions: [],
      expectedQuestionCount: 0,
      questionLoadPending: false,
      answers: {},
      startedAt: null,
      remainingSeconds: null,
      lastResult: null,
      aiSuggestion: null
    });
  };

  const onLogout = () => {
    if (offlineMode) {
      resetToLoginState();
      return;
    }
    setShowLogoutDialog(true);
  };

  const hasSavedExam = Boolean(activeAttemptId && questions.length > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={["#DFF8F4", "#F5F7FB"]} style={styles.header}>
        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutTxt}>{offlineMode ? "Login" : "Logout"}</Text>
        </Pressable>
        <NurseCapLogo size={52} />
        <Text style={styles.title}>Hello, {user?.full_name || "Student"}</Text>
        <Text style={styles.subtitle}>Stay steady today. One focused session at a time.</Text>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Today</Text>
      {activeAttemptId && questions.length > 0 ? (
        <Pressable style={styles.resumeBtn} onPress={() => navigation.navigate("Exam")}>
          <Text style={styles.resumeTxt}>Resume Saved Exam</Text>
        </Pressable>
      ) : null}
      <Animated.View entering={FadeInDown.delay(60).duration(260)} style={styles.summary}>
        <Text style={styles.summaryText}>Use the Practice tab to select Nursing Practice I to V drills.</Text>
      </Animated.View>

      <Text style={styles.sectionTitle}>Full Exam Simulation</Text>
      <Animated.View style={pulseStyle}>
        <Pressable
          onPress={async () => {
            try {
              if (hasSavedExam) {
                setResetDialog(true);
                return;
              }
              setStarting(true);
              await beginFullExam();
              navigation.navigate("Exam");
            } catch (e) {
              setErrorDialog({
                visible: true,
                message: e instanceof Error ? e.message : "Failed to start full exam."
              });
            } finally {
              setStarting(false);
            }
          }}
        >
          <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.heroBtn}>
            <Text style={styles.heroTitle}>Start Full NPE Exam</Text>
            <Text style={styles.heroSub}>500 randomized questions. Timed and realistic.</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(260)} style={styles.summary}>
        <Text style={styles.sectionTitle}>Quick History</Text>
        <Text style={styles.summaryText}>
          {latest
            ? `${latest.mode.toUpperCase()} | ${latest.score ?? 0}% | ${latest.passed ? "PASS" : "FAIL"}`
            : "No attempts yet"}
        </Text>
      </Animated.View>

      <BeautifulAlert
        visible={showLogoutDialog}
        title="Logout"
        message="Do you want to logout?"
        confirmText="Logout"
        destructive
        onCancel={() => setShowLogoutDialog(false)}
        onConfirm={() => {
          setShowLogoutDialog(false);
          resetToLoginState();
        }}
      />
      <BeautifulAlert
        visible={resetDialog}
        title="Start New Exam?"
        message="You have a saved exam in progress. Starting a new full exam will reset and replace it."
        confirmText="Start New"
        destructive
        onCancel={() => setResetDialog(false)}
        onConfirm={async () => {
          setResetDialog(false);
          try {
            setStarting(true);
            await beginFullExam();
            navigation.navigate("Exam");
          } catch (e) {
            setErrorDialog({
              visible: true,
              message: e instanceof Error ? e.message : "Failed to start full exam."
            });
          } finally {
            setStarting(false);
          }
        }}
      />
      <BeautifulAlert
        visible={errorDialog.visible}
        title="Cannot Start Exam"
        message={errorDialog.message}
        onConfirm={() => setErrorDialog({ visible: false, message: "" })}
      />
      <Modal transparent visible={starting} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={styles.modalTitle}>Preparing Full Exam</Text>
            <Text style={styles.modalText}>Loading first 5 questions and buffering the rest...</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 30 },
  header: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#164A7F",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  logoutBtn: {
    alignSelf: "flex-end",
    backgroundColor: "white",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  logoutTxt: { color: colors.primary, fontWeight: "800" },
  title: { fontSize: 24, color: colors.text, fontWeight: "900" },
  subtitle: { marginTop: 6, color: colors.muted, lineHeight: 20 },
  sectionTitle: { marginVertical: 12, fontSize: 17, color: colors.text, fontWeight: "800" },
  heroBtn: { borderRadius: 22, padding: 20 },
  heroTitle: { color: "white", fontSize: 21, fontWeight: "900" },
  heroSub: { marginTop: 8, color: "#E5FFFC" },
  summary: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 16,
    shadowColor: "#1A4A7A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  resumeBtn: {
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#DFF8F4"
  },
  resumeTxt: { color: colors.secondary, fontWeight: "800" },
  summaryText: { color: colors.text, fontWeight: "700" },
  link: { marginTop: 8, color: colors.primary, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 20, 33, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    width: "100%",
    maxWidth: 330,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  modalTitle: { marginTop: 12, fontWeight: "900", fontSize: 18, color: colors.text },
  modalText: { marginTop: 6, color: colors.muted, textAlign: "center" }
});
