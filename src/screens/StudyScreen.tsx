import { useEffect, useRef, useState } from 'react';
import { CharacterInfo } from '../components/CharacterCard';
import { SessionTop } from '../components/SessionTop';
import { StrokePlayer } from '../components/StrokePlayer';
import type { Deck } from '../logic/decks';
import { SPEEDS, type Speed } from '../logic/settings';

interface Props {
  deck: Deck;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  onExit: () => void;
}

const SWIPE_PX = 50;

/** Режим «Знакомство»: листаем знаки колоды с анимацией порядка черт, без проверки */
export function StudyScreen({ deck, speed, onSpeed, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const n = deck.chars.length;
  const char = deck.chars[index];
  const swipeFrom = useRef<number | null>(null);

  const go = (delta: number) => setIndex((i) => (i + delta + n) % n);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % n);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + n) % n);
      else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, onExit]);

  return (
    <main className="screen study">
      <SessionTop done={index + 1} total={n} onExit={onExit} />

      <section
        key={char.id}
        className="card card--study"
        onPointerDown={(e) => (swipeFrom.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipeFrom.current === null) return;
          const dx = e.clientX - swipeFrom.current;
          swipeFrom.current = null;
          if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
        }}
      >
        <StrokePlayer hanzi={char.hanzi} speed={speed} />
        <CharacterInfo char={char} />
      </section>

      <div className="segmented" role="radiogroup" aria-label="Скорость анимации">
        {SPEEDS.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={speed === s.id}
            className={speed === s.id ? 'is-on' : ''}
            onClick={() => onSpeed(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="study__nav">
        <button className="btn" onClick={() => go(-1)} aria-label="Предыдущий знак">
          ← Назад
        </button>
        <button className="btn btn--primary" onClick={() => go(1)} aria-label="Следующий знак">
          Дальше →
        </button>
      </div>
      <p className="hint">Листайте свайпом или стрелками ← →</p>
    </main>
  );
}
