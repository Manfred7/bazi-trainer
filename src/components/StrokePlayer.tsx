import { useEffect, useState } from 'react';
import { strokeCount } from '../data/strokes';
import type { Speed } from '../logic/settings';
import { PracticeGrid } from './PracticeGrid';
import { useHanziWriter } from './useHanziWriter';
import { useSquareSize } from './useSquareSize';

type Play = { kind: 'idle' } | { kind: 'playing'; paused: boolean } | { kind: 'step'; shown: number };

/** Пауза между чертами при скорости 1× */
const DELAY_MS = 450;

interface Props {
  hanzi: string;
  speed: Speed;
  /** Проиграть порядок черт сразу при показе знака */
  autoplay?: boolean;
}

/** Знак на клетке с анимацией порядка черт: целиком, с паузой или по одной черте */
export function StrokePlayer({ hanzi, speed, autoplay = true }: Props) {
  const { ref, size } = useSquareSize();
  const { target, writer } = useHanziWriter(hanzi, size, { showOutline: true });
  const [play, setPlay] = useState<Play>({ kind: 'idle' });
  const total = strokeCount(hanzi);

  useEffect(() => {
    if (!writer) return;
    // Скорость читается из опций при каждом запуске анимации
    writer._options.strokeAnimationSpeed = speed;
    writer._options.delayBetweenStrokes = DELAY_MS / speed;
  }, [writer, speed]);

  const animate = () => {
    if (!writer) return;
    setPlay({ kind: 'playing', paused: false });
    writer.animateCharacter({
      onComplete: ({ canceled }) => {
        if (!canceled) setPlay({ kind: 'idle' });
      },
    });
  };

  useEffect(() => {
    setPlay({ kind: 'idle' });
    if (writer && autoplay) animate();
    // animate зависит только от writer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writer, autoplay]);

  const togglePause = () => {
    if (!writer || play.kind !== 'playing') return;
    if (play.paused) writer.resumeAnimation();
    else writer.pauseAnimation();
    setPlay({ kind: 'playing', paused: !play.paused });
  };

  const step = async () => {
    if (!writer) return;
    let shown = play.kind === 'step' && play.shown < total ? play.shown : 0;
    if (shown === 0) await writer.hideCharacter();
    writer.animateStroke(shown);
    shown += 1;
    setPlay({ kind: 'step', shown });
  };

  const status =
    play.kind === 'step'
      ? `Черта ${play.shown} из ${total}`
      : play.kind === 'playing' && play.paused
        ? 'Пауза'
        : `${total} ${plural(total)}`;

  return (
    <div className="player">
      <div ref={ref} className="player__stage">
        <PracticeGrid size={size}>
          <div ref={target} className="writer" />
        </PracticeGrid>
      </div>
      <p className="player__status">{status}</p>
      <div className="player__controls">
        <button className="btn btn--small" onClick={animate} disabled={!writer}>
          ▶ Показать
        </button>
        <button className="btn btn--small" onClick={togglePause} disabled={play.kind !== 'playing'}>
          {play.kind === 'playing' && play.paused ? '▶ Дальше' : '❚❚ Пауза'}
        </button>
        <button className="btn btn--small" onClick={step} disabled={!writer}>
          {play.kind === 'step' && play.shown === total ? '↺ Сначала' : '+1 черта'}
        </button>
      </div>
    </div>
  );
}

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'черта';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'черты';
  return 'черт';
}
