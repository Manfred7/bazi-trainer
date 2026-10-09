import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PracticeGrid } from './PracticeGrid';
import { useHanziWriter } from './useHanziWriter';
import { useSquareSize } from './useSquareSize';

export interface BoardCallbacks {
  /** Засчитана черта: сколько уже написано */
  onStroke?: (written: number) => void;
  onMistake?: (totalMistakes: number) => void;
  onComplete: (totalMistakes: number) => void;
}

/** Команды доске от экрана */
export interface BoardHandle {
  /** Показать киноварью черту, которую надо писать сейчас */
  hint: () => void;
  /** Проиграть порядок черт всего знака (после того как он написан) */
  animate: () => void;
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
export const WritingBoard = forwardRef<BoardHandle, Props>(function WritingBoard(
  { hanzi, outline, hintAfterMisses, attempt, ...callbacks },
  handle,
) {
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
  const written = useRef(0);

  useEffect(() => {
    if (!writer) return;
    written.current = 0;
    writer.quiz({
      showHintAfterMisses: hintAfterMisses,
      acceptBackwardsStrokes: false,
      highlightOnComplete: true,
      onCorrectStroke: (s) => {
        written.current = s.strokeNum + 1;
        cb.current.onStroke?.(written.current);
      },
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

  useImperativeHandle(
    handle,
    () => ({
      hint: () => writer?.highlightStroke(written.current),
      animate: () => writer?.animateCharacter(),
    }),
    [writer],
  );

  return (
    <div ref={ref} className="player__stage">
      <PracticeGrid size={size} miss={flash > 0}>
        <div ref={target} className="writer" />
      </PracticeGrid>
    </div>
  );
});
