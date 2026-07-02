import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_STORAGE_KEY, type Locale } from './types';
import { resources } from './resources';

const storedLocale = typeof window !== 'undefined' ? window.localStorage.getItem(LOCALE_STORAGE_KEY) : null;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: isSupportedLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  if (!isSupportedLocale(lng) || typeof window === 'undefined') return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language;
}

export const getCurrentLocale = (): Locale => {
  const language = i18n.language;
  return isSupportedLocale(language) ? language : DEFAULT_LOCALE;
};

export const setCurrentLocale = (locale: Locale) => i18n.changeLanguage(locale);

export default i18n;

