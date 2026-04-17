import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function RankingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
        headerTintColor: Colors.text,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Top 100 Blagues',
          headerTitleStyle: { fontSize: 20, fontWeight: '700' as const, color: Colors.primary },
        }}
      />
    </Stack>
  );
}
