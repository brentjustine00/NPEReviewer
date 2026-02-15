import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AttemptDetailScreen } from "../screens/AttemptDetailScreen";
import { ExamScreen } from "../screens/ExamScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { useAppStore } from "../store/useAppStore";
import { MainTabs } from "./MainTabs";

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Exam: undefined;
  Results: undefined;
  AttemptDetail: { attemptId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const token = useAppStore((s) => s.token);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Exam" component={ExamScreen} />
          <Stack.Screen name="Results" component={ResultScreen} />
          <Stack.Screen name="AttemptDetail" component={AttemptDetailScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
