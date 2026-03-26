import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { en, vi } from "./locales.js";

const locales = { en, vi };
const STORAGE_KEY = "node-trans-lang";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem(STORAGE_KEY) || "en");

  const setLang = useCallback((l) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key, params) => {
    let str = locales[lang]?.[key] || locales.en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
      }
    }
    return str;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
