import { Stack } from "expo-router";
import { COLORS } from "../../../lib/theme";

export default function ProjectIdLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="board" />
    </Stack>
  );
}
