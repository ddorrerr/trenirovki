// Общие мелкие кирпичики для «Истории» и редактора: подписанные поля
// с сохранением по blur, чипы, кнопки-иконки, инлайновые SVG-иконки.
// Только представление — доступа к стору здесь нет.

import { useEffect, useState, type ReactNode } from 'react';

/** Единый вид текстовых полей редактора */
export const inputCls = 'w-full rounded-xl border border-border bg-bg px-3 py-2';

export function Labelled({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

interface TextFieldProps {
  label: ReactNode;
  value: string;
  onCommit: (v: string) => void;
  type?: 'text' | 'url' | 'date';
  placeholder?: string;
  list?: string;
}

/** Однострочное поле: сохраняет по blur/Enter (дата — сразу при выборе) */
export function TextField({ label, value, onCommit, type = 'text', placeholder, list }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = (v: string) => {
    if (v !== value) onCommit(v);
  };

  return (
    <Labelled label={label}>
      <input
        type={type}
        className={inputCls}
        value={draft}
        placeholder={placeholder}
        list={list}
        onChange={(e) => {
          setDraft(e.target.value);
          // Дату сохраняем сразу при выборе, но не на промежуточных значениях
          // ввода года с клавиатуры (браузер отдаёт «0002-…» после первой цифры)
          if (type === 'date' && e.target.value) {
            const year = Number(e.target.value.slice(0, 4));
            if (year >= 2000 && year <= 2100) commit(e.target.value);
          }
        }}
        onBlur={() => {
          if (type === 'date' && !draft) {
            setDraft(value); // пустую дату не сохраняем
            return;
          }
          commit(draft);
          // Если родитель отверг правку (value не изменился), возвращаем поле
          // к сохранённому значению, а не оставляем «повисший» черновик.
          setDraft(value);
        }}
        onKeyDown={(e) => {
          // keyCode 13 — запасной вариант для экзотических клавиатур/IME
          if (e.key === 'Enter' || e.keyCode === 13) (e.target as HTMLInputElement).blur();
        }}
      />
    </Labelled>
  );
}

interface TextAreaFieldProps {
  label: ReactNode;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}

/** Многострочное поле: высота подстраивается под текст, сохраняет по blur */
export function TextAreaField({ label, value, onCommit, placeholder }: TextAreaFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const rows = Math.min(10, Math.max(2, draft.split('\n').length));

  return (
    <Labelled label={label}>
      <textarea
        className={inputCls + ' resize-y leading-relaxed'}
        rows={rows}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
      />
    </Labelled>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onCommit: (v: string) => void;
}

export function SelectField({ label, value, options, onCommit }: SelectFieldProps) {
  return (
    <Labelled label={label}>
      <select className={inputCls} value={value} onChange={(e) => onCommit(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

/** Чип параметра; muted — нейтральный вариант для второстепенного */
export function Chip({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={
        'rounded-lg px-2 py-1 text-sm font-medium ' +
        (muted ? 'border border-border bg-bg text-muted' : 'bg-accent-soft')
      }
    >
      {children}
    </span>
  );
}

interface IconBtnProps {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}

/** Квадратная кнопка-иконка 44×44 */
export function IconBtn({ onClick, label, disabled = false, danger = false, children }: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card ' +
        (danger ? 'text-danger' : 'text-muted') +
        (disabled ? ' opacity-35' : '')
      }
    >
      {children}
    </button>
  );
}

/** «5 упражнений», «2 раза», … */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word =
    m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}

/* --- Иконки: инлайновые SVG, наследуют currentColor -------------------- */

interface IconProps {
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
}

export function IconPlus({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconX({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconCheck({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.5 12.5l5 5L19.5 7" />
    </svg>
  );
}

export function IconUp({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function IconDown({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

export function IconComment({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z" />
    </svg>
  );
}

export function IconPlay({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8.5 5.5v13l10-6.5z" />
    </svg>
  );
}
