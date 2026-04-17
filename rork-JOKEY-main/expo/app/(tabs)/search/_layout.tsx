import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function SearchLayout() {
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
          title: 'Recherche',
          headerTitleStyle: { fontSize: 20, fontWeight: '700' as const },
        }}
      />
    </Stack>
  );
}
