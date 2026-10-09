// Иконка приложения из данных черт hanzi-writer-data: 天干 (tiangan.ru — «небесные стволы»).
// Пишет public/pwa-icon.svg и public/favicon.svg; PNG дальше делает `npm run icons`.
// Запуск: npm run icon
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const DATA = dirname(require.resolve('hanzi-writer-data/package.json'));
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Ночное небо и бумага; фон maskable-иконки — в pwa-assets.config.ts
const BG = '#2E3A66';
const FG = '#F5F0E6';

const strokes = (ch) =>
  JSON.parse(readFileSync(join(DATA, `${ch}.json`), 'utf8'))
    .strokes.map((d) => `<path d="${d}"/>`)
    .join('');

/** Знак в квадрате size×size: x, y — левый верхний угол, s — масштаб от 1024 */
function glyph(ch, x, y, s) {
  // Данные Hanzi Writer: квадрат 1024, ось Y вверх, базовая линия 900
  const ty = y + 900 * s + 1024 * s * 0.02;
  return `<g fill="${FG}" transform="translate(${x.toFixed(2)},${ty.toFixed(2)}) scale(${s},${-s})">${strokes(ch)}</g>`;
}

// 512×512: 天 над 干, оба в безопасной зоне maskable (центральный круг 80%)
const s = 0.19;
const x = (512 - 1024 * s) / 2;
const top = (512 - 2 * 1024 * s) / 2;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  ${glyph('天', x, top, s)}
  ${glyph('干', x, top + 1024 * s, s)}
</svg>
`;

// Вкладка браузера (16–32 px): два знака слились бы, поэтому только 天
const fs = 0.029;
const fx = (32 - 1024 * fs) / 2;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${BG}"/>
  ${glyph('天', fx, fx, fs)}
</svg>
`;

writeFileSync(join(PUBLIC, 'pwa-icon.svg'), icon);
writeFileSync(join(PUBLIC, 'favicon.svg'), favicon);
console.log('public/pwa-icon.svg, public/favicon.svg — готово');
