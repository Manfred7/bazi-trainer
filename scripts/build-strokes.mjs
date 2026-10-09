// Собирает данные черт в src/data/strokes/: hanzi-writer-data + правки порядка черт по прописям.
// Запуск: npm run strokes. Сверка с прописями — docs/stage0-pdf-review.md, раздел 3.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SRC = dirname(require.resolve('hanzi-writer-data/package.json'));
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'strokes');

// Тот же набор, что в src/data/characters.ts
const CHARS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

/**
 * Новый порядок черт: индексы черт Hanzi Writer с 0.
 * Массив внутри — несколько черт Hanzi Writer, слитых в одну (как пишется в прописях).
 */
const OVERRIDES = {
  // 横折 → 横 → 竖 → 横: средняя горизонталь раньше вертикали
  丑: [0, 2, 1, 3],
  // длинная откидная (捺) раньше короткой (撇)
  辰: [0, 1, 2, 3, 4, 6, 5],
  // 横 → 撇 → 斜钩 → 撇 → 短横 → 点
  戌: [0, 1, 3, 4, 2, 5],
  // 8 черт: «く» справа вверху — одна черта 撇点 (у Hanzi Writer это черты 3 и 5)
  癸: [0, 1, [2, 4], 3, 5, 6, 7, 8],
};

const dist = ([x1, y1], [x2, y2]) => Math.hypot(x1 - x2, y1 - y2);

function apply(char, data, order) {
  const used = order.flat().sort((a, b) => a - b);
  if (used.length !== data.strokes.length || used.some((v, i) => v !== i)) {
    throw new Error(`${char}: правка должна использовать каждую черту ровно один раз`);
  }
  const newIndex = new Map();
  const strokes = [];
  const medians = [];
  order.forEach((item, i) => {
    const parts = Array.isArray(item) ? item : [item];
    parts.forEach((p) => newIndex.set(p, i));
    strokes.push(parts.map((p) => data.strokes[p]).join(' '));
    medians.push(
      parts.flatMap((p, k) => {
        const m = data.medians[p];
        // Слитая черта должна идти без разрыва: конец предыдущей части рядом с началом следующей
        const joint = k > 0 ? dist(data.medians[parts[k - 1]].at(-1), m[0]) : 0;
        if (joint > 60) console.warn(`${char}: стык слитых черт далеко (${joint.toFixed(0)})`);
        return m;
      }),
    );
  });
  const result = { strokes, medians };
  if (data.radStrokes) result.radStrokes = [...new Set(data.radStrokes.map((r) => newIndex.get(r)))].sort((a, b) => a - b);
  return result;
}

mkdirSync(OUT, { recursive: true });
for (const char of CHARS) {
  const data = JSON.parse(readFileSync(join(SRC, `${char}.json`), 'utf8'));
  const order = OVERRIDES[char];
  const out = order ? apply(char, data, order) : data;
  writeFileSync(join(OUT, `${char}.json`), JSON.stringify(out) + '\n');
  console.log(`${char}: ${out.strokes.length} черт${order ? ' (правка по прописям)' : ''}`);
}
