// Экран ключа доступа (GitHub-режим). Показывается, пока на устройстве
// нет рабочего ключа. Ключ можно вставить руками или получить по ссылке
// вида https://…/#key=… — тогда он подхватится автоматически.

import { useState } from 'react';
import { useApp } from '../store';
import { useT } from '../i18n';

export default function KeyScreen() {
  const { submitAccessKey, authError } = useApp();
  const { t } = useT();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await submitAccessKey(key);
    setBusy(false);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M7 8v8M4.5 9.5v5M17 8v8M19.5 9.5v5M7 12h10" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">{t.appTitle}</h1>
            <p className="text-sm text-muted">{t.key.subtitle}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">{t.key.body}</p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t.key.label}
          </span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder="github_pat_…"
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </label>

        {authError && <p className="mt-3 text-sm text-danger">{authError}</p>}

        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
        >
          {busy ? t.key.checking : t.key.submit}
        </button>
      </div>
    </div>
  );
}
