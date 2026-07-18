// Иконки справочника: группы мышц и инвентарь для фильтров/чипов.
// Рисованы вручную в общем Tabler-стиле приложения (штрих 2, скругления):
// готового тематического набора в базе ui-ux-pro-max нет, а тянуть внешнюю
// библиотеку ради полутора десятков значков не стоит.
// Неизвестное значение (своя группа, например «Шея») — просто без иконки.

import type { ReactNode } from 'react';

function Glyph({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const MUSCLES: Record<string, ReactNode> = {
  Ноги: (
    <>
      <path d="M9 4h6" />
      <path d="M9.5 4v7L7 20" />
      <path d="M14.5 4v7l2.5 9" />
    </>
  ),
  Ягодицы: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 9v8" />
    </>
  ),
  Спина: (
    <>
      <path d="M5 6c2.5 1.7 4.5 2.3 7 2.3s4.5-.6 7-2.3" />
      <path d="M12 8.3V20" />
    </>
  ),
  Грудь: (
    <>
      <path d="M9 4.5h6" />
      <path d="M4.5 7.5c0 4.8 3 7.5 7.5 7.5" />
      <path d="M19.5 7.5c0 4.8-3 7.5-7.5 7.5" />
    </>
  ),
  Плечи: (
    <>
      <circle cx="12" cy="6.5" r="2.5" />
      <path d="M3.5 19c1.4-5.6 4.3-8.2 8.5-8.2s7.1 2.6 8.5 8.2" />
    </>
  ),
  Руки: (
    <>
      <path d="M6.5 18.5c0-4.6 1.4-7.3 3.8-8.6L8.7 5.2 12 3.8l1.5 4.7c3.6.3 5.8 2.5 5.8 5.7v4.3" />
      <path d="M6.5 18.5h12.6" />
    </>
  ),
  Пресс: (
    <>
      <rect x="8" y="4.5" width="8" height="15" rx="3.5" />
      <path d="M12 4.5v15" />
      <path d="M8 9.5h8" />
      <path d="M8 14.5h8" />
    </>
  ),
};

const EQUIP: Record<string, ReactNode> = {
  Штанга: (
    <>
      <path d="M2.5 12h19" />
      <path d="M6 8v8" />
      <path d="M9 5.5v13" />
      <path d="M15 5.5v13" />
      <path d="M18 8v8" />
    </>
  ),
  Гантели: (
    <path d="M6.5 6.5v11M3.5 8.5v7M17.5 6.5v11M20.5 8.5v7M6.5 12h11M2 12h1.5M20.5 12H22" />
  ),
  Гиря: (
    <>
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="M9.2 10V8a2.8 2.8 0 0 1 5.6 0v2" />
    </>
  ),
  Блин: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  Тренажёр: (
    <>
      <path d="M9 3.5h6" />
      <path d="M12 3.5V9" />
      <rect x="6" y="9" width="12" height="11" rx="2" />
      <path d="M6 13h12" />
      <path d="M6 16.5h12" />
    </>
  ),
  Трос: (
    <>
      <circle cx="12" cy="5.5" r="2.5" />
      <path d="M12 8v9.5" />
      <path d="M9 17.5h6" />
    </>
  ),
  Резинка: (
    <>
      <rect x="4.5" y="8" width="15" height="8.5" rx="4.25" />
      <rect x="8.5" y="11" width="7" height="2.5" rx="1.25" />
    </>
  ),
  'Свой вес': (
    <>
      <circle cx="12" cy="5" r="2.3" />
      <path d="M12 7.5V14" />
      <path d="M7.5 10.7 12 9.2l4.5 1.5" />
      <path d="M12 14l-2.8 6" />
      <path d="M12 14l2.8 6" />
    </>
  ),
};

export function muscleIcon(name: string, size = 14): ReactNode | null {
  const p = MUSCLES[name];
  return p ? <Glyph size={size}>{p}</Glyph> : null;
}

export function equipIcon(name: string, size = 14): ReactNode | null {
  const p = EQUIP[name];
  return p ? <Glyph size={size}>{p}</Glyph> : null;
}
