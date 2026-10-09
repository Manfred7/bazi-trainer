import { useEffect, useRef, useState } from 'react';
import { PracticeGrid } from './PracticeGrid';
import { useHanziWriter } from './useHanziWriter';
import { useSquareSize } from './useSquareSize';

export interface BoardCallbacks {
  /** Засчитана черта: сколько уже написано */
  onStroke?: (written: number) => void;
  onMistake?: (totalMistakes: number) => void;
  onComplete: (totalMistakes: number) => void;
}

interface Props extends BoardCallbacks {
  hanzi: string;
  /** Бледный контур знака под рукой (обводка) или пустая клетка (по памяти) */
  outline: boolean;
  /** После скольких ошибок на одной черте показать её анимацией; false — только по кнопке */
  hintAfterMisses: number | false;
  /** Смена значения перезапускает письмо знака с нуля */
  attempt: number;
}

const FLASH_MS = 350;

/** Клетка для письма пальцем: Hanzi Writer проверяет каждую черту по порядку и направлению */
export function WritingBoard({ hanzi, outline, hintAfterMisses, attempt, ...callbacks }: Props) {
  const { ref, size } = useSquareSize();
  const { target, writer } = useHanziWriter(hanzi, size, {
    showOutline: outline,
    showCharacter: false,
    drawingWidth: 6,
  });
  const [flash, setFlash] = useState(0);
  // Колбэки читаются из ref, чтобы новый рендер родителя не перезапускал проверку
  const cb = useRef(callbacks);
  cb.current = callbacks;

  useEffect(() => {
    if (!writer) return;
    writer.quiz({
      showHintAfterMisses: hintAfterMisses,
      acceptBackwardsStrokes: false,
      highlightOnComplete: true,
      onCorrectStroke: (s) => cb.current.onStroke?.(s.strokeNum + 1),
      onMistake: (s) => {
        setFlash((f) => f + 1);
        cb.current.onMistake?.(s.totalMistakes);
      },
      onComplete: ({ totalMistakes }) => cb.current.onComplete(totalMistakes),
    });
    return () => writer.cancelQuiz();
  }, [writer, attempt, hintAfterMisses]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <div ref={ref} className="player__stage">
      <PracticeGrid size={size} miss={flash > 0}>
        <div ref={target} className="writer" />
      </PracticeGrid>
    </div>
  );
}
