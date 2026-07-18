// Текущий язык интерфейса: крошечное хранилище с подпиской.
// Ни от чего не зависит — его можно импортировать из любого слоя
// (dates.ts, chart.ts) без циклических импортов.

export type Lang = 'ru' | 'en';

let current: Lang = 'ru';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  listeners.forEach((fn) => fn());
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Локаль для Intl-форматирования: ru — «13 июня», «1,8»; en — "13 June", "1.8" */
export function locale(): string {
  return current === 'ru' ? 'ru-RU' : 'en-GB';
}

/** Формы названия юнита-эквивалента: русские падежи + английское число.
    Правило для ru (см. память проекта): дробное количество («1,8») берёт
    форму gen — прилагательное в род. мн. + существительное в род. ед. */
export interface EquivForms {
  ru: { one: string; few: string; many: string; gen: string };
  en: { one: string; many: string };
}
