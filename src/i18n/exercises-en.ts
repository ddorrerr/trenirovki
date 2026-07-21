// Английские названия упражнений БИБЛИОТЕКИ — только для показа в en-режиме
// (данные не трогаем: тренер работает с русскими названиями). Незнакомое
// название показывается как есть — новые упражнения переводить не обязательно,
// это осознанное решение (перевод сделан ради демо, 2026-07-18).
//
// Ключ ищется по нормализованной строке (пробелы схлопнуты, регистр не важен),
// поэтому «Присед В НОЖНИЦЫ» из старых данных и «Присед в ножницы» — одна запись.
// Переводы сверены с примечаниями тренера в данных (например, ПСШН расшифрован
// в самих тренировках как «присед со штангой» → barbell back squat).

const NAMES: [ru: string, en: string][] = [
  ['Румынская тяга со штангой', 'Barbell Romanian deadlift'],
  ['Румынская на 1 ноге', 'Single-leg Romanian deadlift'],
  ['Присед в разножку у скамьи', 'Split squat at the bench'],
  ['Присед с разножку у скамьи', 'Split squat at the bench'],
  ['Присед в ножницы', 'Static lunge'],
  ['Присед гоблет', 'Goblet squat'],
  ['Присед 2 ноги', 'Squat, both legs'],
  ['Болгарский присед', 'Bulgarian split squat'],
  ['ПСШН', 'Barbell back squat'],
  ['ПСШН (присед со штангой)', 'Barbell back squat'],
  ['Тяга горизонтальная сидя 2 руки', 'Seated row, two arms'],
  ['Тяга сверху 2 руками', 'Lat pulldown, two arms'],
  ['Тяга гантелей лёжа на скамье', 'Chest-supported dumbbell row'],
  ['Тяга 1 рукой в упоре на скамью', 'One-arm dumbbell row'],
  ['Тяга лежа по диагонали', 'Lying diagonal pull'],
  // её правка: это подводящие подтягивания на штанге в раме (с резинкой), не inverted row
  ['Подтягивания к штанге', 'Pull-ups'],
  ['Жим гантелей лёжа', 'Dumbbell bench press'],
  ['Жим в тренажёре сидя', 'Seated machine chest press'],
  ['Жим 2 руками сидя', 'Seated shoulder press, two arms'],
  ['Жим 1 рукой на колене', 'Half-kneeling one-arm press'],
  ['Жим лэндмайна 2 руки', 'Landmine press, two arms'],
  ['Жим 1 ногой лёжа', 'Lying single-leg press'],
  ['Жим ногами сидя', 'Seated leg press'],
  ['Отжимания', 'Push-ups'],
  ['Ягодичный мост на 1 ноге', 'Single-leg glute bridge'],
  ['Ягодичный мост на 1 ноге с лопатками на скамье', 'Single-leg hip thrust (shoulders on bench)'],
  ['Яг мост на 2 ногах', 'Glute bridge, both legs'],
  ['Ракушка на колене', 'Clamshell'],
  ['Махи бедром', 'Hip swings'],
  ['Махи троса 1 ногой', 'Cable glute kickback'],
  ['Отведение бедра в боковой планке', 'Side plank hip abduction'],
  ['Боковая планка с ДВИЖЕНИЕМ НОГИ', 'Side plank with leg movement'],
  ['Боковая планка на ПРЯМЫХ ногах', 'Side plank, straight legs'],
  ['Боковая планка динамика', 'Dynamic side plank'],
  ['Планка обычная', 'Standard plank'],
  ['Планка с длинным рычагом', 'Long-lever plank'],
  ['Боковой наклон', 'Side bend'],
  ['Турецкий подъём', 'Turkish get-up'],
  ['Ротация в блоке НА колене', 'Half-kneeling cable rotation'],
  ['АНТИротационный жим', 'Anti-rotation press (Pallof)'],
  ['Фермерская проходка однорукая', 'Single-arm farmer’s carry'],
  ['Лодочка статика', 'Superman hold'],
  ['Гиперэкстензия статика', 'Hyperextension hold'],
  ['Сгибание поясницы сидя', 'Seated lumbar flexion'],
  ['Разгибание поясницы в мосте', 'Lumbar extension in bridge'],
  ['Наклоны на коленях', 'Kneeling hip hinge'],
  ['Обратные нордические наклоны', 'Reverse Nordic curl'],
  ['Джефферсон сидя', 'Seated Jefferson curl'],
  ['Разгибание колена в тренажёре', 'Leg extension'],
  ['Разгибание колена. ЭКСЦЕНТРИКА', 'Leg extension, eccentric'],
  ['Разгибание шеи у стены', 'Wall neck extension'],
  ['Сгибание верхнего отдела шеи', 'Upper-neck flexion (chin tuck)'],
  ['Шраги', 'Shrugs'],
  ['Подъёмы на носки', 'Calf raises'],
  ['Эллипс/дорожка', 'Elliptical / treadmill'],
  ['Суставная разминка', 'Joint warm-up'],
];

function norm(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

const MAP = new Map(NAMES.map(([ru, en]) => [norm(ru), en]));

/** Английское название упражнения; незнакомое — как есть */
export function exerciseEn(name: string): string {
  return MAP.get(norm(name)) ?? name;
}
