import type { CharacterJson } from 'hanzi-writer';

// Данные черт лежат в бандле (не CDN), чтобы всё работало без сети. Сборка: npm run strokes
const files = import.meta.glob<CharacterJson>('./strokes/*.json', { eager: true, import: 'default' });

const byHanzi = new Map(
  Object.entries(files).map(([path, data]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), data]),
);

export function strokeData(hanzi: string): CharacterJson {
  const data = byHanzi.get(hanzi);
  if (!data) throw new Error(`Нет данных черт для ${hanzi}`);
  return data;
}

export const strokeCount = (hanzi: string) => strokeData(hanzi).strokes.length;
