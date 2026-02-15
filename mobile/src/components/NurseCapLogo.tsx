import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/colors";

type Props = {
  size?: number;
};

export function NurseCapLogo({ size = 72 }: Props) {
  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} viewBox="0 0 128 128">
        <Path d="M18 54c13-16 33-26 46-30 13 4 33 14 46 30l-11 14H29z" fill={colors.primary} />
        <Path d="M35 68h58l-4 26H39z" fill={colors.secondary} />
        <Path d="M59 44h10v12h12v10H69v12H59V66H47V56h12z" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  }
});
