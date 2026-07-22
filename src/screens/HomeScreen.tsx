// Экран «Главная»: дашборд из реальных данных — дни с последней тренировки,
// лента текущей недели, ритм по неделям, объём поднятого, группы мышц за
// неделю, следующая/прошлая тренировки и свежий рекорд. Блоки без данных
// не показываются. В режиме тренера — добавление тренировки и фидбэк Лизы.

import { useMemo } from 'react';
import { useApp } from '../store';
import type { Workout } from '../types';
import { locale, useT, type EquivForms } from '../i18n';
import { daysBetween, fmtDate, fmtDateShort, fmtWeekday, todayISO } from '../lib/dates';
import NewWorkoutForm from '../components/edit/NewWorkoutForm';
import { isPairWeight } from '../components/edit/parse';
import { BarbellIcon, CommentIcon, FlameIcon, SkullIcon } from '../components/train/icons';
/* Свои рисованные иконки гонконгских эквивалентов (нарезаны из одного спрайта) */
import unitLion from '../assets/units/lion.png';
import unitTaxi from '../assets/units/taxi.png';
import unitCablecar from '../assets/units/cablecar.png';
import unitMinibus from '../assets/units/minibus.png';
import unitBus from '../assets/units/bus.png';
import unitTram from '../assets/units/tram.png';
import { muscleIcon } from '../components/catalogIcons';

/** Понедельник недели данной даты (UTC), ISO-строкой */
function mondayISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** «Суббота, 19 июля» / "Saturday, 19 July" — день недели с большой буквы, без года */
function fmtDayTitle(iso: string): string {
  const wd = fmtWeekday(iso);
  const date = new Date(iso + 'T00:00:00Z').toLocaleDateString(locale(), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${date}`;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* Гонконгский каталог эквивалентов поднятого: кабаны, панды, танцующие львы,
   дикие коровы, красные такси, кабинки Ngong Ping 360, минибасы, слоны,
   автобусы, трамваи. У льва и транспорта — свои рисованные иконки, у зверей —
   эмодзи. Названия — в обоих языках; «red cab» — согласованный перевод. */
const UNITS: ({ kg: number; emoji: string; img?: string } & EquivForms)[] = [
  {
    kg: 100,
    emoji: '🐗',
    ru: { one: 'кабан', few: 'кабана', many: 'кабанов', gen: 'кабана' },
    en: { one: 'wild boar', many: 'wild boars' },
  },
  {
    kg: 110,
    emoji: '🐼',
    ru: { one: 'панда', few: 'панды', many: 'панд', gen: 'панды' },
    en: { one: 'panda', many: 'pandas' },
  },
  {
    kg: 160,
    emoji: '🦁',
    img: unitLion,
    ru: {
      one: 'танцующий лев',
      few: 'танцующих льва',
      many: 'танцующих львов',
      gen: 'танцующих льва',
    },
    en: { one: 'dancing lion', many: 'dancing lions' },
  },
  {
    kg: 500,
    emoji: '🐂',
    ru: { one: 'дикая корова', few: 'дикие коровы', many: 'диких коров', gen: 'диких коровы' },
    en: { one: 'wild cow', many: 'wild cows' },
  },
  {
    kg: 1500,
    emoji: '🚗',
    img: unitTaxi,
    ru: { one: 'красное такси', few: 'красных такси', many: 'красных такси', gen: 'красных такси' },
    en: { one: 'red cab', many: 'red cabs' },
  },
  {
    kg: 2500,
    emoji: '🚠',
    img: unitCablecar,
    ru: {
      one: 'кабинка Ngong Ping 360',
      few: 'кабинки Ngong Ping 360',
      many: 'кабинок Ngong Ping 360',
      gen: 'кабинки Ngong Ping 360',
    },
    en: { one: 'Ngong Ping 360 cabin', many: 'Ngong Ping 360 cabins' },
  },
  {
    kg: 3600,
    emoji: '🚐',
    img: unitMinibus,
    ru: {
      one: 'гонконгский минибас',
      few: 'гонконгских минибаса',
      many: 'гонконгских минибасов',
      gen: 'гонконгских минибаса',
    },
    en: { one: 'Hong Kong minibus', many: 'Hong Kong minibuses' },
  },
  {
    kg: 4000,
    emoji: '🐘',
    ru: { one: 'слон', few: 'слона', many: 'слонов', gen: 'слона' },
    en: { one: 'elephant', many: 'elephants' },
  },
  {
    kg: 12000,
    emoji: '🚌',
    img: unitBus,
    ru: {
      one: 'двухэтажный автобус',
      few: 'двухэтажных автобуса',
      many: 'двухэтажных автобусов',
      gen: 'двухэтажных автобуса',
    },
    en: { one: 'double-decker bus', many: 'double-decker buses' },
  },
  {
    kg: 12000,
    emoji: '🚋',
    img: unitTram,
    ru: { one: 'трамвай', few: 'трамвая', many: 'трамваев', gen: 'трамвая' },
    en: { one: 'tram', many: 'trams' },
  },
];

export default function HomeScreen() {
  const { workouts, navigate, editMode, exerciseById, showExerciseProgress } = useApp();
  const { t } = useT();
  const today = todayISO();

  /* Только реально выполненные: запланированная (даже на сегодня) не должна
     раздувать счётчики, серию и кольцо недели */
  const past = useMemo(
    () => workouts.filter((w) => w.date <= today && w.status === 'done'),
    [workouts, today],
  );
  const next = useMemo(
    () => workouts.find((w) => w.date >= today && w.status === 'planned') ?? null,
    [workouts, today],
  );
  /* «Прошлая» — не та же, что «следующая»: запланированная на сегодня
     тренировка показывается только карточкой «Сегодня» */
  const last = useMemo(() => {
    for (let i = past.length - 1; i >= 0; i--) {
      if (past[i].id !== next?.id) return past[i];
    }
    return null;
  }, [past, next]);
  const daysSince = last ? Math.max(0, daysBetween(last.date, today)) : null;

  /* Серия: сколько недель подряд была хотя бы одна тренировка.
     Текущая неделя без тренировки серию не рвёт — она ещё идёт. */
  const streak = useMemo(() => {
    const weeks = new Set(past.map((w) => mondayISO(w.date)));
    let cur = mondayISO(today);
    if (!weeks.has(cur)) cur = addDaysISO(cur, -7);
    let n = 0;
    while (weeks.has(cur)) {
      n++;
      cur = addDaysISO(cur, -7);
    }
    return n;
  }, [past, today]);

  /* Свежий рекорд: последний раз, когда вес упражнения стал выше всех
     прошлых (не первые пробы — до того минимум два раза), за 30 дней */
  const record = useMemo(() => {
    const best = new Map<string, number>();
    const seen = new Map<string, number>();
    let latest: { exerciseId: string; weight: number; date: string } | null = null;
    for (const w of past) {
      for (const it of w.items) {
        const kg = it.actual?.weight ?? it.weight?.value;
        if (kg == null || !it.exerciseId) continue;
        const was = best.get(it.exerciseId);
        const n = seen.get(it.exerciseId) ?? 0;
        if (was == null || kg > was) {
          best.set(it.exerciseId, kg);
          if (n >= 2 && daysBetween(w.date, today) <= 30) {
            latest = { exerciseId: it.exerciseId, weight: kg, date: w.date };
          }
        }
        seen.set(it.exerciseId, n + 1);
      }
    }
    return latest;
  }, [past, today]);
  const rawRecordName = record ? (exerciseById(record.exerciseId)?.name ?? null) : null;
  const recordName = rawRecordName ? t.catalog.exercise(rawRecordName) : null;

  const lastComments = last
    ? last.items.filter((i) => i.myComment && i.myComment.trim() !== '').length
    : 0;

  /* --- Дашборд ------------------------------------------------------------ */

  const byDate = useMemo(() => {
    const m = new Map<string, Workout>();
    for (const w of workouts) if (!m.has(w.date)) m.set(w.date, w);
    return m;
  }, [workouts]);

  const weekDays = useMemo(() => {
    const mon = mondayISO(today);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(mon, i));
  }, [today]);

  /* Тренировки по неделям, 8 последних (текущая — последняя) */
  const weekCounts = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const w of past) {
      const k = mondayISO(w.date);
      byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
    }
    const cur = mondayISO(today);
    const out: number[] = [];
    for (let i = 7; i >= 0; i--) out.push(byWeek.get(addDaysISO(cur, -7 * i)) ?? 0);
    return out;
  }, [past, today]);
  const thisWeek = weekCounts[weekCounts.length - 1];
  const usual = Math.max(1, Math.round(median(weekCounts.slice(0, -1))));

  /* Объём прошлой тренировки: вес × подходы × повторы, где всё известно.
     «По одной стороне» (unilateral) — ×2: подходы делаются на каждую сторону.
     Пара гантелей «12+12» — тоже ×2: value хранит вес ОДНОЙ гантели. */
  const lastDone = useMemo(
    () => [...past].reverse().find((w) => w.status === 'done') ?? null,
    [past],
  );
  const tonnage = useMemo(() => {
    if (!lastDone) return 0;
    let kg = 0;
    for (const it of lastDone.items) {
      const sides = exerciseById(it.exerciseId)?.unilateral ? 2 : 1;
      const pair = isPairWeight(it.weight?.raw) ? 2 : 1;
      // записанные «разные подходы» — самый точный источник
      if (it.actual?.perSet?.length) {
        for (const st of it.actual.perSet) {
          if (st.weight != null && st.reps != null) kg += st.weight * st.reps * sides * pair;
        }
        continue;
      }
      const w = it.actual?.weight ?? it.weight?.value;
      const s = it.actual?.sets ?? it.setsReps?.sets;
      const r = it.actual?.reps ?? it.setsReps?.reps;
      if (w != null && s != null && r != null) {
        kg += w * s * r * sides * pair;
        continue;
      }
      // план «разными подходами» (прогрессия) — когда факт не записан
      if (it.perSetPlan?.length) {
        for (const st of it.perSetPlan) {
          const pw = Number(st.weight.trim().replace(',', '.'));
          const pr = Number.parseInt(st.reps.trim(), 10);
          if (Number.isFinite(pw) && st.weight.trim() !== '' && Number.isFinite(pr))
            kg += pw * pr * sides * pair;
        }
      }
    }
    return Math.round(kg);
  }, [lastDone, exerciseById]);

  /* Во что «переводится» поднятый объём — весёлый эквивалент; единица
     выбирается из подходящих по величине и меняется от тренировки к
     тренировке (детерминированно по id, чтобы не мигало). Здесь только
     числа — текст собирается при рендере на текущем языке. */
  const equivalent = useMemo(() => {
    if (tonnage <= 0 || !lastDone) return null;
    /* Красиво читается один знак: берём юниты, где выходит от 1 до ~10 штук;
       если вес огромный — самый крупный юнит, если крошечный — панды с дробью */
    const inRange = UNITS.filter((u) => {
      const c = tonnage / u.kg;
      return c >= 0.95 && c <= 9.95;
    });
    const fitting = inRange.length
      ? inRange
      : UNITS.filter((u) => tonnage / u.kg >= 0.95).slice(-1);
    let seed = 0;
    for (const ch of lastDone.id) seed = (seed + ch.charCodeAt(0)) % 997;
    const unit = fitting.length ? fitting[seed % fitting.length] : UNITS[0];
    const count = tonnage / unit.kg;
    const rounded = Math.round(count);
    const isInt = Math.abs(count - rounded) < 0.05 && rounded >= 1;
    const iconCount = Math.min(5, Math.max(1, rounded));
    return { unit, count, rounded, isInt, iconCount };
  }, [tonnage, lastDone]);
  const equivText = equivalent
    ? equivalent.isInt
      ? t.home.equivInt(equivalent.unit, equivalent.rounded)
      : t.home.equivFrac(equivalent.unit, equivalent.count)
    : null;

  /* Какие группы мышц были в работе за последние 7 дней */
  const groups7 = useMemo(() => {
    const set = new Set<string>();
    for (const w of past) {
      if (daysBetween(w.date, today) > 6) continue;
      for (const it of w.items) {
        for (const m of exerciseById(it.exerciseId)?.muscles ?? []) set.add(m);
      }
    }
    return [...set];
  }, [past, today, exerciseById]);

  /* --- Режим тренера: фидбэк Лизы ----------------------------------------- */

  /* Последняя тренировка, ГДЕ ЕСТЬ комментарии — а не просто последняя:
     тренеру нужен свежий фидбэк, даже если вчера прошло молча */
  const lastWithComments = useMemo(
    () =>
      [...past]
        .reverse()
        .find((w) => w.items.some((i) => (i.myComment ?? '').trim() !== '')) ?? null,
    [past],
  );

  const feedbackItems = useMemo(() => {
    if (!lastWithComments) return [];
    return lastWithComments.items
      .filter((i) => (i.myComment ?? '').trim() !== '')
      .map((i) => ({
        id: i.id,
        name:
          exerciseById(i.exerciseId)?.name ??
          i.nameRaw.replace(/^\s*\d+(?:\.\d+)*\s*[.)]\s*/, ''),
        pvr: i.pvr,
        comment: (i.myComment ?? '').trim(),
      }));
  }, [lastWithComments, exerciseById]);

  /* Упражнения, к которым за месяц было ≥2 комментариев — что даётся тяжело */
  const frequent = useMemo(() => {
    const cutoff = addDaysISO(today, -28);
    const counts = new Map<string, number>();
    for (const w of past) {
      if (w.date < cutoff) continue;
      for (const it of w.items) {
        if ((it.myComment ?? '').trim() === '' || !it.exerciseId) continue;
        counts.set(it.exerciseId, (counts.get(it.exerciseId) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, n]) => ({ id, name: exerciseById(id)?.name ?? id, n }));
  }, [past, today, exerciseById]);

  /* Режим тренера: добавить тренировку + фидбэк, без мотивационных блоков */
  if (editMode) {
    return (
      <div className="space-y-3">
        <NewWorkoutForm />

        {lastWithComments && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted">
              {t.home.feedback(fmtDateShort(lastWithComments.date))}
            </p>
            <ul className="mt-2 space-y-2.5">
              {feedbackItems.map((f) => (
                <li key={f.id} className="text-sm leading-snug">
                  <span className="font-bold">{t.catalog.exercise(f.name)}</span>
                  {f.pvr && (
                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-lg bg-chip px-1.5 py-0.5 align-middle text-xs font-bold tabular-nums">
                      <span className="text-muted">
                        <SkullIcon size={12} />
                      </span>
                      {f.pvr}
                    </span>
                  )}
                  <span className="block text-muted">«{f.comment}»</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-border pt-2.5">
              <button
                type="button"
                onClick={() => navigate('comments')}
                className="text-sm font-semibold text-accent"
              >
                {t.home.allComments}
              </button>
            </div>
          </section>
        )}

        {frequent.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted">
              {t.home.oftenMonth}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {frequent.map((f) => (
                <li key={f.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {t.catalog.exercise(f.name)}
                  </span>
                  <span className="shrink-0 text-muted">{t.counted.entries(f.n)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {last && (
          <LastCard w={last} comments={lastComments} onOpen={() => navigate('train', last.id)} />
        )}
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">
        {t.home.empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Герой: дни с последней тренировки + серия и счётчик */}
      <div className="px-1 pt-1">
        <p className="text-[32px] font-extrabold leading-tight tracking-tight">
          {daysSince == null ? (
            t.home.heroStart
          ) : daysSince === 0 ? (
            <>
              {t.home.heroToday}{' '}
              <span className="text-[15px] font-semibold text-muted">{t.home.heroTodaySub}</span>
            </>
          ) : (
            <>
              {daysSince} {t.home.dayWord(daysSince)}{' '}
              <span className="text-[15px] font-semibold text-muted">{t.home.sinceLast}</span>
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-chip px-2.5 py-1 text-xs font-semibold">
              <span className="text-muted">
                <FlameIcon size={14} />
              </span>
              {t.home.weekStreak(streak)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-chip px-2.5 py-1 text-xs font-semibold tabular-nums">
            <span className="text-muted">
              <BarbellIcon size={14} />
            </span>
            {t.home.total(past.length)}
          </span>
        </div>
      </div>

      {/* Текущая неделя: точки тренировок, тап открывает день.
          На широком экране дни не расползаются — сетка ограничена по ширине */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mx-auto grid max-w-sm grid-cols-7">
          {weekDays.map((iso, i) => {
            const w = byDate.get(iso);
            const isToday = iso === today;
            const day = Number(iso.slice(8));
            return (
              <div key={iso} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold uppercase text-muted">
                  {t.weekdaysShort[i]}
                </span>
                {w ? (
                  <button
                    type="button"
                    onClick={() => navigate('train', w.id)}
                    aria-label={t.home.openWorkoutAria(iso)}
                    className={
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums ' +
                      (w.status === 'done'
                        ? 'bg-ok text-ok-fg'
                        : 'border-2 border-accent text-accent') +
                      (isToday ? ' ring-2 ring-fg/25 ring-offset-1 ring-offset-card' : '')
                    }
                  >
                    {day}
                  </button>
                ) : (
                  <span
                    className={
                      'flex h-8 w-8 items-center justify-center text-sm tabular-nums ' +
                      (isToday ? 'font-bold' : 'text-muted')
                    }
                  >
                    {day}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Плитки: неделя против ритма, объём, ритм, группы мышц.
          На широком экране — в один ряд, чтобы карточки не пустели */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {t.home.thisWeek}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Ring pct={thisWeek / usual} label={String(thisWeek)} />
            <p className="text-xs font-semibold leading-snug text-muted">
              {t.home.ofN(usual)}
              <span className="block font-medium">{t.home.usual}</span>
            </p>
          </div>
        </div>
        {tonnage > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {t.home.lifted}
            </p>
            <p className="mt-2 text-xl font-extrabold tabular-nums">{t.home.kgAmount(tonnage)}</p>
            {equivalent && (
              <p className="mt-1 text-xs font-medium text-muted">
                {equivalent.unit.img ? (
                  <span aria-hidden="true" className="mb-1 flex flex-wrap items-center gap-1">
                    {Array.from({ length: equivalent.iconCount }, (_, i) => (
                      <img key={i} src={equivalent.unit.img} alt="" className="h-6 w-auto" />
                    ))}
                  </span>
                ) : (
                  <span aria-hidden="true" className="mr-1 text-sm leading-none">
                    {equivalent.unit.emoji.repeat(equivalent.iconCount)}
                  </span>
                )}
                {equivText}
              </p>
            )}
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {t.home.byWeeks}
          </p>
          <div className="mt-2.5">
            <WeekBars counts={weekCounts} />
          </div>
          <p className="mt-1.5 text-xs font-medium text-muted">{t.home.perWeek}</p>
        </div>
        {groups7.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {t.home.last7}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {groups7.slice(0, 4).map((m) => {
                const ic = muscleIcon(m, 12);
                return (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded-lg bg-chip px-1.5 py-0.5 text-[11px] font-bold"
                  >
                    {ic && <span className="text-accent">{ic}</span>}
                    {t.catalog.muscle(m)}
                  </span>
                );
              })}
              {groups7.length > 4 && (
                <span className="rounded-lg bg-chip px-1.5 py-0.5 text-[11px] font-bold text-muted">
                  +{groups7.length - 4}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Следующая запланированная — петрольная карточка: «иди делать» */}
      {next && (
        <button
          type="button"
          onClick={() => navigate('train', next.id)}
          className="w-full rounded-2xl bg-accent-soft p-4 text-left"
        >
          <p className="text-[12px] font-bold uppercase tracking-wider text-accent">
            {next.date === today ? t.home.today : t.home.next}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 text-base font-bold">
              {fmtDayTitle(next.date)}
              {next.title
                ? ` · ${next.title}`
                : next.type
                  ? ` · ${t.catalog.workoutType(next.type)}`
                  : ''}
            </span>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-accent"
              aria-hidden="true"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
        </button>
      )}

      {/* Прошлая тренировка и свежий рекорд: на широком экране — рядом */}
      {(last || (record && recordName)) && (
        <div className="space-y-3 md:flex md:gap-3 md:space-y-0">
          {last && (
            <div className="min-w-0 md:flex-1">
              <LastCard w={last} comments={lastComments} onOpen={() => navigate('train', last.id)} />
            </div>
          )}
          {/* Свежий рекорд — тап открывает график этого упражнения */}
          {record && recordName && (
            <div className="min-w-0 md:flex-1">
              <button
                type="button"
                onClick={() => showExerciseProgress(record.exerciseId)}
                className="h-full w-full rounded-2xl bg-ok-soft p-4 text-left"
              >
                <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-ok-text">
                  <TrophyIcon /> {t.home.newPR}
                </p>
                <p className="mt-1 text-base font-bold text-ok-text">
                  {recordName} — {record.weight} {t.kg}{' '}
                  <span className="text-xs font-semibold opacity-80">{fmtDate(record.date)}</span>
                </p>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Кольцо прогресса недели: вольт по мере приближения к привычному ритму */
function Ring({ pct, label }: { pct: number; label: string }) {
  const size = 46;
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth="5" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--ok)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, Math.max(0, pct))} ${c}`}
        />
      </svg>
      <span className="text-lg font-extrabold tabular-nums">{label}</span>
    </span>
  );
}

/* Мини-столбики: тренировок в неделю, текущая неделя — ярким вольтом.
   Ширина столбиков фиксированная, чтобы на широких экранах не расползались */
function WeekBars({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex h-10 items-end gap-1.5">
      {counts.map((n, i) => (
        <span
          key={i}
          className={'w-3 rounded-[3px] ' + (i === counts.length - 1 ? 'bg-ok' : 'bg-ok-soft')}
          style={{ height: `${n === 0 ? 6 : Math.max(14, (n / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/* Карточка «Прошлая» — общая для обычного режима и режима тренера */
function LastCard({ w, comments, onOpen }: { w: Workout; comments: number; onOpen: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="h-full w-full rounded-2xl border border-border bg-card p-4 text-left"
    >
      <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{t.home.last}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-base font-bold">{fmtDayTitle(w.date)}</span>
        {w.status === 'done' && (
          <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok-text">
            {t.status.done}
          </span>
        )}
      </div>
      {(w.fatigue != null || comments > 0) && (
        <p className="mt-1.5 flex items-center gap-2.5 text-xs text-muted">
          {w.fatigue != null && <span>{t.fatigueN10(w.fatigue)}</span>}
          {comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <CommentIcon size={13} /> {comments}
            </span>
          )}
        </p>
      )}
    </button>
  );
}

function TrophyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0z" />
      <path d="M8 5.5H5.5V7a2.5 2.5 0 0 0 2.5 2.5" />
      <path d="M16 5.5h2.5V7a2.5 2.5 0 0 1-2.5 2.5" />
      <path d="M12 12.5V16" />
      <path d="M8.5 20h7l-1-4h-5z" />
    </svg>
  );
}
