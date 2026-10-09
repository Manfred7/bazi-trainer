import HanziWriter, { type HanziWriterOptions } from 'hanzi-writer';
import { useEffect, useRef, useState } from 'react';
import { strokeData } from '../data/strokes';

const DARK = '(prefers-color-scheme: dark)';

/** Цвета холста из CSS-переменных темы: тушь, контур, киноварь для подсказок */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    strokeColor: v('--ink'),
    outlineColor: v('--outline'),
    drawingColor: v('--ink'),
    highlightColor: v('--accent'),
    radicalColor: null,
  };
}

export const writerPadding = (size: number) => Math.round(size * 0.06);

/**
 * Холст Hanzi Writer в div по ref. Пересоздаётся при смене знака; размер и цвета темы
 * обновляются на месте. options читаются только при создании.
 */
export function useHanziWriter(hanzi: string, size: number, options: Partial<HanziWriterOptions> = {}) {
  const target = useRef<HTMLDivElement>(null);
  const [writer, setWriter] = useState<HanziWriter | null>(null);
  const initial = useRef({ size, options });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const { size: s, options: opts } = initial.current;
    const w = HanziWriter.create(el, hanzi, {
      width: s,
      height: s,
      padding: writerPadding(s),
      charDataLoader: (c) => strokeData(c),
      ...themeColors(),
      ...opts,
    });
    setWriter(w);
    return () => {
      w.pauseAnimation();
      w.cancelQuiz();
      el.innerHTML = '';
      setWriter(null);
    };
  }, [hanzi]);

  useEffect(() => {
    writer?.updateDimensions({ width: size, height: size, padding: writerPadding(size) });
  }, [writer, size]);

  useEffect(() => {
    if (!writer) return;
    const media = window.matchMedia(DARK);
    const onTheme = () => {
      const colors = themeColors();
      (Object.keys(colors) as (keyof typeof colors)[]).forEach((k) => writer.updateColor(k, colors[k]));
    };
    media.addEventListener('change', onTheme);
    return () => media.removeEventListener('change', onTheme);
  }, [writer]);

  return { target, writer };
}
