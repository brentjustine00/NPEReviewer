import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { colors } from "../theme/colors";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  destructive?: boolean;
};

export function BeautifulAlert({
  visible,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  destructive = false
}: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel || onConfirm}>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeInUp.duration(200)} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            {onCancel ? (
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
                <Text style={styles.cancelTxt}>{cancelText}</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, destructive ? styles.dangerBtn : styles.confirmBtn]} onPress={onConfirm}>
              <Text style={styles.confirmTxt}>{confirmText}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 20, 34, 0.45)",
    justifyContent: "center",
    padding: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text
  },
  message: {
    marginTop: 8,
    color: colors.muted,
    lineHeight: 20
  },
  row: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center"
  },
  cancelBtn: {
    backgroundColor: "#E2E8F0"
  },
  confirmBtn: {
    backgroundColor: colors.primary
  },
  dangerBtn: {
    backgroundColor: colors.danger
  },
  cancelTxt: { color: colors.text, fontWeight: "700" },
  confirmTxt: { color: "white", fontWeight: "800" }
});
