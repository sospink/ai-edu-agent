export type Locale = 'zh-CN' | 'en-US';

export const DEFAULT_LOCALE: Locale = 'en-US';
export const LOCALE_STORAGE_KEY = 'agent-edu-locale';

export const isSupportedLocale = (value: string | null | undefined): value is Locale =>
  value === 'zh-CN' || value === 'en-US';
