import type { StrokeData } from 'hanzi-writer';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { registerBoard } from '../logic/e2e';
import { PracticeGrid } from './PracticeGrid';
import { type Guide, GuideOver, GuidePeek, GuideUnder } from './StrokeGuide';
import { useHanziWriter } from './useHanziWriter';
import { useSquareSize } from './useSquareSize';

export interface BoardCallbacks {
  /** Засчитана черта: сколько уже написано */
  onStroke?: (written: number) => void;
  /** Черта не засчитана: всё, что сообщил Hanzi Writer, включая сам штрих (его не хранить) */
  onMistake?: (s: StrokeData) => void;
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
  /** Неполная подсказка без контура: первые черты контуром или точки начала черт */
  guide?: Guide;
  /** Подсказки поверх клетки при guide: номера точек, мигание при ошибке, «откуда и куда» */
  cues?: {
    written: number;
    numbered: boolean;
    pulse: { stroke: number; key: number } | null;
    cue: number | null;
  };
  /** После скольких ошибок на одной черте показать её анимацией; false — только по кнопке */
  hintAfterMisses: number | false;
  /** Смена значения перезапускает письмо знака с нуля */
  attempt: number;
  /** Клетка ужимается по высоте экрана, чтобы кнопки под ней были видны */
  fit?: boolean;
  /** «Взгляни и напиши»: показать знак целиком на ms; key — чтобы показ перезапускался */
  peek?: { ms: number; key: number } | null;
}

const FLASH_MS = 350;

/** Клетка для письма пальцем: Hanzi Writer проверяет каждую черту по порядку и направлению */
export const WritingBoard = forwardRef<BoardHandle, Props>(function WritingBoard(
  { hanzi, outline, guide, cues, hintAfterMisses, attempt, fit = false, peek = null, ...callbacks },
  handle,
) {
  const { ref, size } = useSquareSize(fit);
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
        cb.current.onMistake?.(s);
      },
      onComplete: ({ totalMistakes }) => cb.current.onComplete(totalMistakes),
    });
    return () => writer.cancelQuiz();
  }, [writer, attempt, hintAfterMisses]);

  // Тестовый мост (e2e/): координаты черт этой клетки
  useEffect(
    () => registerBoard({ kind: 'write', hanzi, group: () => target.current?.querySelector<SVGGElement>('svg g[transform]') ?? null }),
    [hanzi, target],
  );

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
    <div ref={ref} className="player__stage" data-testid="board" data-hanzi={hanzi}>
      <PracticeGrid size={size} miss={flash > 0}>
        {guide === 'half' && !outline && <GuideUnder hanzi={hanzi} size={size} />}
        <div ref={target} className="writer" />
        {guide && !outline && (
          <GuideOver
            hanzi={hanzi}
            size={size}
            guide={guide}
            {...(cues ?? { written: 0, numbered: false, pulse: null, cue: null })}
          />
        )}
        {peek && <GuidePeek key={peek.key} hanzi={hanzi} size={size} ms={peek.ms} />}
      </PracticeGrid>
    </div>
  );
});
