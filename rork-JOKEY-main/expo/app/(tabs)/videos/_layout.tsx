import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

export default function VideosLayout() {
  const { t } = useLanguage();

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
          title: t('tab.videos'),
          headerTitleStyle: { fontSize: 20, fontWeight: '700' as const, color: Colors.primary },
        }}
      />
    </Stack>
  );
}
