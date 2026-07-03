type DisplayLocale = 'zh-CN' | 'en-US';

const normalizeLocale = (locale?: string): DisplayLocale => (locale === 'zh-CN' ? 'zh-CN' : 'en-US');

type TranslationPair = {
  en: string;
  zh: string;
};

const seededClassNames: TranslationPair[] = [
  { en: 'Agent Teaching Class', zh: '智能体教学班级' },
];

const seededTermNames: TranslationPair[] = [
  { en: 'AI Course', zh: 'AI 课程' },
];

const seededCourseTitles: TranslationPair[] = [
  { en: 'MCP Server Development', zh: 'MCP Server 开发' },
  { en: 'ADE Agent Development', zh: 'ADE 智能体开发' },
  { en: 'Agent Framework Development', zh: '智能体框架与开发' },
  { en: 'AI Safety and Compliance', zh: 'AI 安全与合规' },
];

const translateExact = (value: string | null | undefined, locale: string | undefined, pairs: TranslationPair[]) => {
  if (!value) return value || '';
  const targetLocale = normalizeLocale(locale);
  const normalizedValue = value.trim();
  const matched = pairs.find((item) => item.en === normalizedValue || item.zh === normalizedValue);
  if (!matched) return value;
  return targetLocale === 'zh-CN' ? matched.zh : matched.en;
};

export const localizeSeededClassName = (value: string | null | undefined, locale?: string) =>
  translateExact(value, locale, seededClassNames);

export const localizeSeededTermName = (value: string | null | undefined, locale?: string) =>
  translateExact(value, locale, seededTermNames);

export const localizeSeededCourseTitle = (value: string | null | undefined, locale?: string) =>
  translateExact(value, locale, seededCourseTitles);

export const localizeSeededClassText = (value: string | null | undefined, locale?: string) => {
  if (!value) return value || '';
  const targetLocale = normalizeLocale(locale);
  if (targetLocale === 'zh-CN') {
    return value
      .replace(/\bAgent Teaching Class\b/g, '智能体教学班级')
      .replace(/\bAI Course\b/g, 'AI 课程');
  }
  return value
    .replace(/智能体教学班级/g, 'Agent Teaching Class')
    .replace(/AI 课程/g, 'AI Course');
};

export const localizeSeededAssignmentDescription = (value: string | null | undefined, locale?: string) => {
  if (!value) return value || '';
  const targetLocale = normalizeLocale(locale);
  const englishMatch = value.trim().match(/^Auto-assigned course for class (.+)\.?$/);
  if (targetLocale === 'zh-CN' && englishMatch) {
    return `自动补齐：为 ${englishMatch[1]} 班级分配课程`;
  }
  const chineseMatch = value.trim().match(/^自动补齐：为 (.+) 班级分配课程。?$/);
  if (targetLocale === 'en-US' && chineseMatch) {
    return `Auto-assigned course for class ${chineseMatch[1]}.`;
  }
  return value;
};
