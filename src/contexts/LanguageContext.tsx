import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Language, t as translate } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  office: string | null;
  setOffice: (office: string | null) => void;
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

  // Load preferences from profile when user is authenticated (non-blocking)
  useEffect(() => {
    async function loadUserPreferences() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
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
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    }

    loadUserPreferences();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
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
        } catch (error) {
          console.error('Error loading user preferences on sign in:', error);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update language and save to localStorage
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  // Update office and save to localStorage
  const setOffice = useCallback((newOffice: string | null) => {
    const normalizedOffice = newOffice?.toLowerCase() || null;
    setOfficeState(normalizedOffice);
    if (normalizedOffice) {
      localStorage.setItem('lbh_office', normalizedOffice);
    } else {
      localStorage.removeItem('lbh_office');
    }
  }, []);

  const t = useCallback((key: string) => translate(key, language), [language]);

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
