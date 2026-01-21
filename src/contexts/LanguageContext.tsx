import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, t as translate } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  office: string | null;
  setOffice: (office: string | null) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('language') as Language;
    return stored || 'en';
  });

  const [office, setOffice] = useState<string | null>(() => {
    const stored = localStorage.getItem('lbh_office');
    return stored ? stored.toLowerCase() : null;
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    if (office) {
      localStorage.setItem('lbh_office', office.toLowerCase());
    } else {
      localStorage.removeItem('lbh_office');
    }
  }, [office]);

  const t = (key: string) => translate(key, language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, office, setOffice }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
