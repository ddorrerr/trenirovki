// GitHub-адаптер: данные лежат одним файлом data.json в приватном репозитории,
// чтение и запись — через GitHub Contents API с ключом доступа (fine-grained
// token на один репозиторий). Правки сначала копятся в pending-оверлее
// (localStorage — переживает офлайн, перезагрузку и делится между вкладками),
// затем «флашатся» одним коммитом: свежие данные + оверлей -> PUT с проверкой
// SHA. Конфликт SHA (кто-то записал раньше) решается перечиткой и повторным
// наложением оверлея — правки разных записей сливаются без потерь, одну и ту
// же запись выигрывает последний пишущий (такие перезаписи считаем и
// показываем в меню).

import type { AppData, Exercise, StorageAdapter, Workout } from '../types';
import type { DataRepoConfig } from '../config';
import {
  applyOverlay,
  emptyOverlay,
  overlaySize,
  readOverlay,
  writeOverlay,
  type Overlay,
} from './overlay';

const TOKEN_KEY = 'trenirovki:gh-token:v1';
const PENDING_KEY = 'trenirovki:gh-pending:v1';

const FLUSH_DEBOUNCE_MS = 2500; // тишина после последней правки
const FLUSH_MAX_WAIT_MS = 10_000; // но не дольше этого от первой несохранённой
const RETRY_MS = 30_000;

export type SyncState = 'saved' | 'saving' | 'pending' | 'offline' | 'auth' | 'error';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  /** Сколько раз наша запись перезаписала чужую параллельную правку той же записи */
  conflictsOverwritten: number;
}

export class AuthError extends Error {}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* приватный режим браузера — поработает до перезагрузки */
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* не критично */
  }
}

/* --- base64 <-> utf8 для Contents API ----------------------------------- */

function b64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function utf8ToB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000; // не разворачиваем большой массив в аргументы разом
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/* --- сам адаптер --------------------------------------------------------- */

interface RemoteFile {
  data: AppData;
  sha: string | null; // null — файла ещё нет, первый PUT его создаст
}

interface GitHubErrorBody {
  message?: string;
  errors?: { code?: string }[];
}

export class GitHubAdapter implements StorageAdapter {
  private cfg: DataRepoConfig;
  private token: string;

  private remote: AppData = { exercises: [], workouts: [] };
  private sha: string | null = null;

  private pending: Overlay;
  private firstPendingAt: number | null = null;
  private flushTimer: number | null = null;
  private retryTimer: number | null = null;
  private flushPromise: Promise<boolean> | null = null;
  private disposed = false;
  private conflictsOverwritten = 0;

  private listeners = new Set<(s: SyncStatus) => void>();
  private lastState: SyncState = 'saved';

  constructor(cfg: DataRepoConfig, token: string) {
    this.cfg = cfg;
    this.token = token;
    this.pending = readOverlay(PENDING_KEY);
  }

  /* --- статус для интерфейса ------------------------------------------- */

  subscribe(cb: (s: SyncStatus) => void): () => void {
    this.listeners.add(cb);
    cb(this.status());
    return () => this.listeners.delete(cb);
  }

  status(): SyncStatus {
    return {
      state: this.lastState,
      pendingCount: overlaySize(this.pending),
      conflictsOverwritten: this.conflictsOverwritten,
    };
  }

  private emit(state: SyncState): void {
    this.lastState = state;
    const s = this.status();
    for (const cb of this.listeners) cb(s);
  }

  /* --- HTTP ------------------------------------------------------------- */

  private api(path: string): string {
    return `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}${path}`;
  }

  private headers(accept: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private contentsUrl(): string {
    return this.api(`/contents/${this.cfg.file}?ref=${encodeURIComponent(this.cfg.branch)}`);
  }

  /**
   * Чтение data.json. Медиа-тип object отдаёт метаданные (sha) всегда,
   * а содержимое инлайном — только до ~1 МБ; крупнее — добираем raw-запросом.
   * 403 бывает трёх видов: too_large (файл крупный), rate limit (временная
   * ошибка) и настоящий запрет доступа — различаем по телу ответа.
   */
  private async fetchRemote(): Promise<RemoteFile> {
    const res = await fetch(this.contentsUrl(), {
      headers: this.headers('application/vnd.github.object+json'),
      cache: 'no-store',
    });

    if (res.status === 401) throw new AuthError('GitHub: 401');
    if (res.status === 429) throw new Error('GitHub: 429 (rate limit)');
    if (res.status === 403) {
      const body = (await res.json().catch(() => null)) as GitHubErrorBody | null;
      const tooLarge = body?.errors?.some((e) => e.code === 'too_large') ?? false;
      if (tooLarge) return this.fetchRemoteLarge(null);
      const rateLimited = /rate limit/i.test(body?.message ?? '');
      if (rateLimited) throw new Error('GitHub: 403 (rate limit)');
      throw new AuthError('GitHub: 403');
    }
    if (res.status === 404) {
      // Репозиторий доступен, но файла нет — стартуем с пустых данных.
      // (Если нет самого репозитория, это тоже 404 — проверяем отдельно.)
      const repo = await fetch(this.api(''), {
        headers: this.headers('application/vnd.github+json'),
        cache: 'no-store',
      });
      if (!repo.ok) throw new AuthError(`GitHub repo: ${repo.status}`);
      return { data: { exercises: [], workouts: [] }, sha: null };
    }
    if (!res.ok) throw new Error(`GitHub GET ${res.status}`);

    const body = (await res.json()) as { content?: string; encoding?: string; sha: string };
    if (typeof body.content === 'string' && body.content !== '' && body.encoding === 'base64') {
      return { data: JSON.parse(b64ToUtf8(body.content)) as AppData, sha: body.sha };
    }
    // Крупный файл: object-ответ даёт sha, но content пуст (encoding "none")
    return this.fetchRemoteLarge(body.sha);
  }

  /** Содержимое raw-запросом; sha, если не знаем, берём из листинга каталога */
  private async fetchRemoteLarge(knownSha: string | null): Promise<RemoteFile> {
    let sha = knownSha;
    if (!sha) {
      const dir = await fetch(
        this.api(`/contents/?ref=${encodeURIComponent(this.cfg.branch)}`),
        { headers: this.headers('application/vnd.github+json'), cache: 'no-store' },
      );
      if (!dir.ok) throw new Error(`GitHub GET dir ${dir.status}`);
      const entries = (await dir.json()) as { name: string; sha: string }[];
      sha = entries.find((e) => e.name === this.cfg.file)?.sha ?? null;
      if (!sha) throw new Error('GitHub: не нашли data.json в листинге');
    }
    const raw = await fetch(this.contentsUrl(), {
      headers: this.headers('application/vnd.github.raw+json'),
      cache: 'no-store',
    });
    if (!raw.ok) throw new Error(`GitHub GET raw ${raw.status}`);
    return { data: JSON.parse(await raw.text()) as AppData, sha };
  }

  /* --- интерфейс StorageAdapter ----------------------------------------- */

  async load(): Promise<AppData> {
    const file = await this.fetchRemote();
    this.remote = file.data;
    this.sha = file.sha;
    // незаконченные правки прошлой сессии — досохраним в фоне
    if (overlaySize(this.pending) > 0) this.scheduleFlush(0);
    this.emit(overlaySize(this.pending) > 0 ? 'pending' : 'saved');
    return applyOverlay(this.remote, this.pending);
  }

  async saveWorkout(w: Workout): Promise<void> {
    this.addPending((o) => {
      o.workouts[w.id] = w;
    });
  }

  async deleteWorkout(id: string): Promise<void> {
    this.addPending((o) => {
      o.workouts[id] = null;
    });
  }

  async saveExercise(e: Exercise): Promise<void> {
    this.addPending((o) => {
      o.exercises[e.id] = e;
    });
  }

  async deleteExercise(id: string): Promise<void> {
    this.addPending((o) => {
      o.exercises[id] = null;
    });
  }

  /* --- очередь и синхронизация ------------------------------------------ */

  /**
   * Слить очередь с диском (другая вкладка могла дописать свои правки),
   * применить мутацию, записать обратно. Память этой вкладки выигрывает
   * только по тем id, которые есть у неё.
   */
  private addPending(fn: (o: Overlay) => void): void {
    const merged = readOverlay(PENDING_KEY);
    for (const key of ['workouts', 'exercises'] as const) {
      for (const [id, value] of Object.entries(this.pending[key])) {
        merged[key][id] = value as never;
      }
    }
    fn(merged);
    this.pending = merged;
    writeOverlay(PENDING_KEY, this.pending);
    if (this.firstPendingAt === null) this.firstPendingAt = Date.now();
    this.emit('pending');
    const overdue = Date.now() - this.firstPendingAt >= FLUSH_MAX_WAIT_MS;
    this.scheduleFlush(overdue ? 0 : FLUSH_DEBOUNCE_MS);
  }

  private scheduleFlush(delay: number): void {
    if (this.disposed) return;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delay);
  }

  /**
   * Досохранить всё несохранённое. Возвращает true, если очередь пуста.
   * Повторный вызов во время идущего сохранения ждёт его завершения.
   */
  flush(): Promise<boolean> {
    if (this.flushPromise) return this.flushPromise;
    if (overlaySize(this.pending) === 0) {
      this.emit('saved');
      return Promise.resolve(true);
    }
    this.flushPromise = this.doFlush().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async doFlush(): Promise<boolean> {
    this.emit('saving');

    // Снимок: правки, пришедшие во время сохранения, не потеряются
    const snapshot: Overlay = structuredClone(this.pending);

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const fresh = await this.fetchRemote();
        this.countConflicts(fresh.data, snapshot);
        const merged = applyOverlay(fresh.data, snapshot);
        const body: Record<string, unknown> = {
          message: `тренировки: обновление данных (${new Date().toISOString()})`,
          content: utf8ToB64(JSON.stringify(merged) + '\n'),
          branch: this.cfg.branch,
        };
        if (fresh.sha) body.sha = fresh.sha;

        const res = await fetch(this.api(`/contents/${this.cfg.file}`), {
          method: 'PUT',
          headers: {
            ...this.headers('application/vnd.github+json'),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (res.status === 401 || res.status === 403) throw new AuthError(`GitHub: ${res.status}`);
        if (res.status === 409 || res.status === 422) continue; // SHA устарел — перечитать и повторить
        if (!res.ok) throw new Error(`GitHub PUT ${res.status}`);

        const out = (await res.json()) as { content?: { sha?: string } };
        this.remote = merged;
        this.sha = out.content?.sha ?? null;
        this.dropFlushed(snapshot);

        if (overlaySize(this.pending) > 0) {
          // Остаток пришёл во время сохранения — его ожидание начинается сейчас
          this.firstPendingAt = Date.now();
          this.emit('pending');
          this.scheduleFlush(FLUSH_DEBOUNCE_MS);
          return false;
        }
        this.firstPendingAt = null;
        this.emit('saved');
        return true;
      }
      throw new Error('GitHub: не удалось записать после 3 попыток');
    } catch (e) {
      if (e instanceof AuthError) {
        this.emit('auth');
      } else {
        // офлайн или временная ошибка: правки целы, попробуем позже
        this.emit(navigator.onLine === false ? 'offline' : 'error');
        if (!this.disposed) {
          if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
          this.retryTimer = window.setTimeout(() => {
            this.retryTimer = null;
            void this.flush();
          }, RETRY_MS);
        }
      }
      return false;
    }
  }

  /** Чужая параллельная правка той же записи, которую мы сейчас перезапишем */
  private countConflicts(fresh: AppData, snapshot: Overlay): void {
    const freshMaps = {
      workouts: new Map(fresh.workouts.map((w) => [w.id, w])),
      exercises: new Map(fresh.exercises.map((e) => [e.id, e])),
    };
    const knownMaps = {
      workouts: new Map(this.remote.workouts.map((w) => [w.id, w])),
      exercises: new Map(this.remote.exercises.map((e) => [e.id, e])),
    };
    let found = 0;
    for (const key of ['workouts', 'exercises'] as const) {
      for (const id of Object.keys(snapshot[key])) {
        const theirs = freshMaps[key].get(id);
        const known = knownMaps[key].get(id);
        if (JSON.stringify(theirs) !== JSON.stringify(known)) found++;
      }
    }
    if (found > 0) {
      this.conflictsOverwritten += found;
      console.warn(
        `Синхронизация: перезаписали ${found} запись(и), изменённые параллельно с другого устройства`,
      );
    }
  }

  /**
   * Убрать из очереди то, что ушло в коммит (если не поменялось с тех пор).
   * Работаем через диск, чтобы не затереть правки другой вкладки.
   */
  private dropFlushed(snapshot: Overlay): void {
    const disk = readOverlay(PENDING_KEY);
    for (const key of ['workouts', 'exercises'] as const) {
      // наша память поверх диска (по нашим id), затем вычёркиваем отправленное
      for (const [id, value] of Object.entries(this.pending[key])) {
        disk[key][id] = value as never;
      }
      for (const [id, sent] of Object.entries(snapshot[key])) {
        const cur = disk[key][id];
        if (cur !== undefined && JSON.stringify(cur) === JSON.stringify(sent)) {
          delete disk[key][id];
        }
      }
    }
    this.pending = disk;
    writeOverlay(PENDING_KEY, this.pending);
  }

  /**
   * Свежая загрузка с сервера (для «обновить» и возврата в открытую вкладку).
   * Дожидается идущего сохранения; ошибку показывает в статусе и пробрасывает.
   */
  async reload(): Promise<AppData> {
    try {
      await this.flush();
      const file = await this.fetchRemote();
      this.remote = file.data;
      this.sha = file.sha;
      return applyOverlay(this.remote, this.pending);
    } catch (e) {
      if (e instanceof AuthError) this.emit('auth');
      else this.emit(navigator.onLine === false ? 'offline' : 'error');
      throw e;
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.listeners.clear();
  }
}
