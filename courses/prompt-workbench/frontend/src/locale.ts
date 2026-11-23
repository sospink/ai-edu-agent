export type WorkbenchLocale = "zh" | "en";

const storageKey = "workbench-language";

function readLocale(): WorkbenchLocale {
  try {
    return localStorage.getItem(storageKey) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

// 仅使用课程工作台自己的语言；存储受限时仍保留本页的选择。
let currentLocale = readLocale();

export function getCurrentLocale(): WorkbenchLocale {
  return currentLocale;
}

export function setCurrentLocale(locale: WorkbenchLocale) {
  currentLocale = locale;
  try {
    localStorage.setItem(storageKey, locale);
  } catch {
    /* 存储受限不影响本页 API 的语言。 */
  }
}
