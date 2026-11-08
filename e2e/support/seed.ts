/**
 * Выполняется в странице до её скриптов (addInitScript): включает тестовый мост приложения
 * (src/logic/e2e.ts) и подменяет Math.random генератором с зерном — порядок знаков,
 * вопросы и варианты ответа в тесте воспроизводимы.
 */
export function initPage(seed: number) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__BAZI_E2E__ = true;
}
