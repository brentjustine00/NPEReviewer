import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { DashboardScreen } from "../screens/DashboardScreen";
import { ExamHistoryScreen } from "../screens/ExamHistoryScreen";
import { PracticeScreen } from "../screens/PracticeScreen";
import { colors } from "../theme/colors";

export type MainTabParamList = {
  Home: undefined;
  Practice: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home-outline";
          if (route.name === "Home") iconName = "home-outline";
          if (route.name === "Practice") iconName = "book-outline";
          if (route.name === "History") iconName = "time-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Practice" component={PracticeScreen} />
      <Tab.Screen name="History" component={ExamHistoryScreen} />
    </Tab.Navigator>
  );
}
