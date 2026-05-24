import { Redirect, Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

export default function RecordLayout() {
  const { currentUser } = useApp();

  if (currentUser?.role !== 'creator') {
    return <Redirect href="/" />;
  }

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
          title: 'Enregistrer',
          headerTitleStyle: { fontSize: 20, fontWeight: '700' as const },
        }}
      />
    </Stack>
  );
}
