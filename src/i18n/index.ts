// Точка входа переводов: словарь текущего языка + подписка для React.
// В компонентах: const { t, lang } = useT(); — компонент сам перерисуется
// при смене языка. Вне компонентов (helpers, store): tr() читает словарь
// на момент вызова — свежесть гарантирует перерисовка вызывающего компонента.

import { useSyncExternalStore } from 'react';
import { getLang, subscribeLang, type Lang } from './lang';
import { ru } from './ru';
import { en } from './en';

export { getLang, setLang, subscribeLang, locale } from './lang';
export type { Lang, EquivForms } from './lang';

export type Dict = typeof ru;

const dicts: Record<Lang, Dict> = { ru, en };

/** Словарь текущего языка (для кода вне React-рендера) */
export function tr(): Dict {
  return dicts[getLang()];
}

/** Словарь + язык с подпиской на смену (для компонентов) */
export function useT(): { t: Dict; lang: Lang } {
  const lang = useSyncExternalStore(subscribeLang, getLang);
  return { t: dicts[lang], lang };
}
