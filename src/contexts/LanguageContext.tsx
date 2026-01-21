import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, t as translate } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  office: string | null;
  setOffice: (office: string | null) => void;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language') as Language;
    return stored || 'en';
  });

  const [office, setOfficeState] = useState<string | null>(() => {
    const stored = localStorage.getItem('lbh_office');
    return stored ? stored.toLowerCase() : null;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load preferences from profile when user is authenticated
  useEffect(() => {
    async function loadUserPreferences() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('language, office')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          if (profile.language) {
            setLanguageState(profile.language as Language);
            localStorage.setItem('language', profile.language);
          }
          if (profile.office) {
            setOfficeState(profile.office.toLowerCase());
            localStorage.setItem('lbh_office', profile.office.toLowerCase());
          }
        }
      }
      setIsLoading(false);
    }

    loadUserPreferences();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('language, office')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          if (profile.language) {
            setLanguageState(profile.language as Language);
            localStorage.setItem('language', profile.language);
          }
          if (profile.office) {
            setOfficeState(profile.office.toLowerCase());
            localStorage.setItem('lbh_office', profile.office.toLowerCase());
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update language and save to localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  // Update office and save to localStorage
  const setOffice = (newOffice: string | null) => {
    const normalizedOffice = newOffice?.toLowerCase() || null;
    setOfficeState(normalizedOffice);
    if (normalizedOffice) {
      localStorage.setItem('lbh_office', normalizedOffice);
    } else {
      localStorage.removeItem('lbh_office');
    }
  };

  const t = (key: string) => translate(key, language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, office, setOffice, isLoading }}>
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
