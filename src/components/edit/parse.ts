// Парсеры «сырых» значений параметров упражнения.
// Правило: raw сохраняем ровно как введено, числа заполняем только
// когда строка однозначна. Ошибиться в null безопаснее, чем в число.

import type { SetsReps, SubNote, Weight } from '../../types';

/**
 * «3х12» / «3 x 8» / «3х12. См примечания» -> sets/reps.
 * Берём префикс до первого разделителя (точка, запятая, «;», перенос)
 * и требуем полного совпадения с «N х M» (латинская или кириллическая х).
 * «3х12-10», «3х35 сек» и прочее неоднозначное -> нули.
 */
export function parseSetsReps(raw: string): SetsReps | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const prefix = trimmed.split(/[.,;\n]/, 1)[0].trim();
  const m = /^(\d+)\s*[xхXХ]\s*(\d+)$/.exec(prefix);
  return { raw, sets: m ? Number(m[1]) : null, reps: m ? Number(m[2]) : null };
}

/**
 * Вес: одно число, допустимы запятая-десятичная и суффикс «кг».
 * «27.5» -> 27.5, «2,5 кг» -> 2.5, «45 кг» -> 45; «4+4 кг», «5?» -> null.
 */
export function parseWeight(raw: string): Weight | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*(?:кг\.?)?$/i.exec(trimmed);
  return { raw, value: m ? Number(m[1].replace(',', '.')) : null };
}

/**
 * Текст «по строке на подпункт» -> SubNote[].
 * Пустые строки выбрасываем. Ссылки на видео сохраняем в первую очередь по
 * точному совпадению текста строки (правка соседней строки не срывает ссылки),
 * а при равном числе строк — дополнительно по индексу.
 */
export function linesToSubNotes(text: string, prev: SubNote[]): SubNote[] {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const byText = new Map<string, string>();
  for (const sn of prev) {
    if (sn.videoUrl && !byText.has(sn.text.trim())) byText.set(sn.text.trim(), sn.videoUrl);
  }
  const keepByIndex = lines.length === prev.length;
  return lines.map((t, i) => ({
    text: t,
    videoUrl: byText.get(t.trim()) ?? (keepByIndex ? (prev[i]?.videoUrl ?? null) : null),
  }));
}

/** «силовая, ноги» -> ["силовая", "ноги"] */
export function splitTags(s: string): string[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
