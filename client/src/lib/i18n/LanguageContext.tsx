'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_LANGUAGE, LanguageCode, SUPPORTED_LANGUAGES } from './languages';
import { TranslationKey, translations } from './translations';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  openLanguageSelector: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => key,
  showModal: false,
  setShowModal: () => {},
  openLanguageSelector: () => {},
});

const STORAGE_KEY = 'sih_language_preference';
const PROMPTED_KEY = 'sih_language_prompted';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      const alreadyPrompted = window.localStorage.getItem(PROMPTED_KEY);

      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        setLanguageState(saved);
      }

      // If this is the farmer's first visit, display the language selection modal
      if (!alreadyPrompted) {
        setShowModal(true);
      }
    } catch {
      // localStorage may fail in restricted/private modes
    }
  }, []);

  const setLanguage = (code: LanguageCode) => {
    setLanguageState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
      window.localStorage.setItem(PROMPTED_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const openLanguageSelector = () => {
    setShowModal(true);
  };

  const t = (key: TranslationKey): string => {
    const langDict = translations[language];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    // Fallback to English
    return translations[DEFAULT_LANGUAGE][key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        showModal,
        setShowModal,
        openLanguageSelector,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
