import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./en.json";
import es from "./es.json";

export type Language = "en" | "es";

type TranslationValue = string | { [key: string]: TranslationValue };

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
};

const translations: Record<Language, TranslationValue> = {
  en,
  es,
};

const getTranslationValue = (
  source: TranslationValue,
  key: string
): string | undefined => {
  const segments = key.split(".");
  let current: TranslationValue | undefined = source;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = current[segment] as TranslationValue | undefined;
  }

  return typeof current === "string" ? current : undefined;
};

const interpolate = (
  template: string,
  variables?: Record<string, string | number>
) => {
  if (!variables) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value === undefined ? match : String(value);
  });
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "es";
  }

  const stored = window.localStorage.getItem("system-monitor-language");
  if (stored === "en" || stored === "es") {
    return stored;
  }

  return window.navigator.language?.startsWith("es") ? "es" : "en";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem("system-monitor-language", language);
  }, [language]);

  const t = useCallback(
    (key: string, variables?: Record<string, string | number>) => {
      const template = getTranslationValue(translations[language], key) ?? key;
      return interpolate(template, variables);
    },
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
