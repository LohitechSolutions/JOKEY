import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import translations, { Language, LANGUAGE_OPTIONS } from '@/constants/translations';

const STORAGE_KEY = 'joky_language';

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguage] = useState<Language>('FR');

  const langQuery = useQuery({
    queryKey: ['language'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return (stored as Language) || 'FR';
    },
  });

  useEffect(() => {
    if (langQuery.data) {
      setLanguage(langQuery.data);
    }
  }, [langQuery.data]);

  const changeLangMutation = useMutation({
    mutationFn: async (lang: Language) => {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
      return lang;
    },
    onSuccess: (lang) => {
      setLanguage(lang);
      console.log('[LanguageContext] Language changed to:', lang);
    },
  });

  const { mutate: doChangeLang } = changeLangMutation;
  const changeLanguage = useCallback((lang: Language) => {
    doChangeLang(lang);
  }, [doChangeLang]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = translations[language]?.[key] || translations['FR']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [language]);

  const isRTL = useMemo(() => {
    return LANGUAGE_OPTIONS.find(l => l.id === language)?.rtl ?? false;
  }, [language]);

  return {
    language,
    changeLanguage,
    t,
    isRTL,
  };
});
