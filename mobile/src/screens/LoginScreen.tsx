import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../theme/colors";
import { login, register } from "../api/endpoints";
import { setAuthToken } from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { NurseCapLogo } from "../components/NurseCapLogo";
import { BeautifulAlert } from "../components/BeautifulAlert";
import { loadLastAccount, saveLastAccount } from "../utils/cache";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [alertState, setAlertState] = useState({ visible: false, title: "", message: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [authLoadingText, setAuthLoadingText] = useState("Signing in...");
  const setState = useAppStore.setState;

  useEffect(() => {
    const hydrateRecentAccount = async () => {
      const recent = await loadLastAccount();
      if (!recent) return;
      const normalized = (recent.email || "").trim().toLowerCase();
      if (!normalized || normalized.endsWith("@demo.local") || normalized.startsWith("offline@")) return;
      setEmail(recent.email ?? "");
      setFullName(recent.fullName ?? "");
      setPassword(recent.password ?? "");
    };
    hydrateRecentAccount();
  }, []);

  const onLogin = async () => {
    try {
      if (!email.trim() || !password) {
        setAlertState({ visible: true, title: "Missing Fields", message: "Enter your email and password to login." });
        return;
      }
      setAuthLoadingText("Signing in...");
      setAuthLoading(true);
      const res = await login(email, password);
      setAuthToken(res.access_token);
      await saveLastAccount({
        email: email.trim().toLowerCase(),
        fullName: res.user.full_name,
        password
      });
      setState({
        token: res.access_token,
        user: res.user,
        offlineMode: false,
        categories: [],
        history: [],
        activeAttemptId: null,
        activeNlCategoryId: null,
        activeMode: null,
        questions: [],
        expectedQuestionCount: 0,
        questionLoadPending: false,
        answers: {},
        startedAt: null,
        remainingSeconds: null
      });
    } catch (e) {
      setAlertState({
        visible: true,
        title: "Login Failed",
        message: e instanceof Error ? e.message : "Could not login. Check backend/API URL or credentials."
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const onRegister = async () => {
    try {
      if (!fullName.trim() || !email.trim() || !password) {
        setAlertState({
          visible: true,
          title: "Missing Fields",
          message: "Enter full name, email, and password to register."
        });
        return;
      }
      setAuthLoadingText("Creating account...");
      setAuthLoading(true);
      await register(email, password, fullName);
      const res = await login(email, password);
      setAuthToken(res.access_token);
      await saveLastAccount({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        password
      });
      setState({
        token: res.access_token,
        user: res.user,
        offlineMode: false,
        categories: [],
        history: [],
        activeAttemptId: null,
        activeNlCategoryId: null,
        activeMode: null,
        questions: [],
        expectedQuestionCount: 0,
        questionLoadPending: false,
        answers: {},
        startedAt: null,
        remainingSeconds: null
      });
    } catch (e) {
      setAlertState({
        visible: true,
        title: "Register Failed",
        message: e instanceof Error ? e.message : "Could not register. Email may already exist or backend is unreachable."
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const onOfflineDemo = () => {
    const offlineEmail = (email || "offline@demo.local").trim().toLowerCase();
    const offlineName = (fullName || "Offline Demo Student").trim();
    setAuthToken(undefined);
    setState({
      token: "offline-demo-token",
      user: { id: 0, email: offlineEmail, full_name: offlineName },
      offlineMode: true,
      history: [],
      activeAttemptId: null,
      activeNlCategoryId: null,
      activeMode: null,
      questions: [],
      expectedQuestionCount: 0,
      questionLoadPending: false,
      answers: {},
      startedAt: null,
      remainingSeconds: null,
      categories: [
        { id: 1, code: "NP1", title: "Nursing Practice I (Community Health Nursing)", icon: "heart" },
        { id: 2, code: "NP2", title: "Nursing Practice II (Care of Healthy/At-Risk Mother and Child)", icon: "baby" },
        { id: 3, code: "NP3", title: "Nursing Practice III (Care of Clients with Physiologic and Psychosocial Alterations - Part A)", icon: "hospital" },
        { id: 4, code: "NP4", title: "Nursing Practice IV (Care of Clients with Physiologic and Psychosocial Alterations - Part B)", icon: "brain" },
        { id: 5, code: "NP5", title: "Nursing Practice V (Care of Clients with Physiologic and Psychosocial Alterations - Part C)", icon: "globe" }
      ]
    });
  };

  return (
    <LinearGradient colors={["#E3F7F4", "#F8FBFC"]} style={styles.container}>
      <View style={styles.card}>
        <NurseCapLogo size={78} />
        <Text style={styles.title}>NPE Reviewer</Text>
        <Text style={styles.sub}>Practice smarter. Track performance. Pass with confidence.</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full Name (for register)"
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          secureTextEntry
        />
        <Pressable style={[styles.button, authLoading && styles.buttonDisabled]} disabled={authLoading} onPress={onLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton, authLoading && styles.buttonDisabled]}
          disabled={authLoading}
          onPress={onRegister}
        >
          <Text style={styles.buttonText}>Register</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.outlineButton, authLoading && styles.buttonDisabled]}
          disabled={authLoading}
          onPress={onOfflineDemo}
        >
          <Text style={[styles.buttonText, styles.outlineText]}>Continue Offline Demo</Text>
        </Pressable>
      </View>
      <BeautifulAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        onConfirm={() => setAlertState({ visible: false, title: "", message: "" })}
      />
      <Modal transparent visible={authLoading} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={styles.modalTitle}>{authLoadingText}</Text>
            <Text style={styles.modalText}>Please wait...</Text>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 20,
    shadowColor: "#204B75",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.primary },
  sub: { marginTop: 8, color: colors.muted, lineHeight: 20 },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#D9E6F4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: "#FFFFFF"
  },
  button: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center"
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
    marginTop: 10
  },
  buttonDisabled: { opacity: 0.6 },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: 10
  },
  buttonText: { color: "white", fontWeight: "800" },
  outlineText: { color: colors.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 20, 33, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  modalTitle: { marginTop: 12, fontWeight: "900", fontSize: 18, color: colors.text },
  modalText: { marginTop: 6, color: colors.muted, textAlign: "center" }
});
