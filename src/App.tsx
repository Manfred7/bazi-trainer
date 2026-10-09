import { useCallback, useEffect, useState } from 'react';
import type { BaziChar } from './data/characters';
import { DECKS, type Deck, deckById, isAvailable, withUnlocks } from './logic/decks';
import {
  EMPTY_PROGRESS,
  type Progress,
  levelOf,
  loadProgress,
  mastery,
  recordResult,
  saveProgress,
} from './logic/progress';
import { DIRECTIONS, type Direction, type QuizAnswer, isCorrect, quizMastery, quizTrack } from './logic/quiz';
import type { WriteResult } from './logic/session';
import { type Settings, loadSettings, saveSettings } from './logic/settings';
import { watchTheme } from './logic/theme';
import { QuizScreen } from './screens/QuizScreen';
import { RecallScreen } from './screens/RecallScreen';
import { ResultScreen, type SessionSummary } from './screens/ResultScreen';
import { StartScreen } from './screens/StartScreen';
import { StudyScreen } from './screens/StudyScreen';
import { TraceScreen } from './screens/TraceScreen';

type SessionMode = 'trace' | 'recall' | 'quiz';

/** Сессия с проверкой: режим, колода (для освоения и итогов) и знаки, по которым спрашиваем */
interface Session {
  mode: SessionMode;
  deck: Deck;
  chars: BaziChar[];
  /** Сколько знаков (по памяти) или вопросов (узнавание) */
  length: number;
  /** Направления узнавания */
  directions: Direction[];
  masteryBefore: number;
  unlockedBefore: string[];
}

type Screen =
  | { name: 'start' }
  | { name: 'study'; deck: Deck }
  | { name: 'session'; session: Session; run: number }
  | { name: 'result'; session: Session; results: WriteResult[]; summary: SessionSummary };

function deckMastery(p: Progress, mode: SessionMode, deck: Deck, directions: Direction[]) {
  return mode === 'quiz' ? quizMastery(p, deck.chars, directions) : mastery(p, deck.chars, mode);
}

/** Ответы узнавания в общем виде итогов: одна ошибка на неверный ответ */
const quizResults = (answers: QuizAnswer[]): WriteResult[] =>
  answers.map((a) => ({ char: a.question.char, ok: isCorrect(a), mistakes: isCorrect(a) ? 0 : 1 }));

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });

  useEffect(() => watchTheme(settings.theme), [settings.theme]);

  const directions = DIRECTIONS.filter((d) => settings.directionIds.includes(d.id));
  const available = (d: Deck) => isAvailable(d, settings.mode, progress, settings.unlockAll);
  const selected = deckById(settings.deckId);
  // Если выбранная колода недоступна в текущем режиме — берём первую доступную
  const deck = available(selected) ? selected : DECKS.find(available)!;

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const resetProgress = () => {
    setProgress(EMPTY_PROGRESS);
    saveProgress(EMPTY_PROGRESS);
  };

  const record = useCallback(
    (charId: string, track: Parameters<typeof recordResult>[2], ok: boolean) =>
      setProgress((p) => {
        const next = withUnlocks(recordResult(p, charId, track, ok));
        saveProgress(next);
        return next;
      }),
    [],
  );

  const toStart = useCallback(() => setScreen({ name: 'start' }), []);

  const begin = (mode: SessionMode, d: Deck, chars: BaziChar[], length: number, dirs = directions) =>
    setScreen({
      name: 'session',
      run: Date.now(),
      session: {
        mode,
        deck: d,
        chars,
        length,
        directions: dirs,
        masteryBefore: deckMastery(progress, mode, d, dirs),
        unlockedBefore: progress.unlocked,
      },
    });

  /** Вся колода: обводка — каждый знак по порядку, по памяти и узнавание — по длине сессии */
  const beginDeck = (mode: SessionMode, d: Deck, dirs = directions) =>
    begin(
      mode,
      d,
      d.chars,
      mode === 'trace' ? d.chars.length : mode === 'recall' ? settings.length : settings.quizLength,
      dirs,
    );

  const start = () => {
    if (settings.mode === 'study') setScreen({ name: 'study', deck });
    else beginDeck(settings.mode, deck);
  };

  const finish = (session: Session, results: WriteResult[]) =>
    setScreen({
      name: 'result',
      session,
      results,
      summary: {
        deckTitle: session.deck.title,
        masteryBefore: session.masteryBefore,
        masteryAfter: deckMastery(progress, session.mode, session.deck, session.directions),
        newlyUnlocked: DECKS.filter(
          (d) => progress.unlocked.includes(d.id) && !session.unlockedBefore.includes(d.id),
        ).map((d) => d.title),
      },
    });

  const retry = (s: Session, chars: BaziChar[]) => {
    if (s.mode === 'trace') begin('trace', s.deck, chars, chars.length, s.directions);
    else if (s.mode === 'recall') begin('recall', s.deck, chars, Math.min(settings.length, Math.max(3, chars.length * 2)), s.directions);
    else begin('quiz', s.deck, chars, Math.min(settings.quizLength, Math.max(5, chars.length * 3)), s.directions);
  };

  switch (screen.name) {
    case 'start':
      return (
        <StartScreen
          settings={settings}
          progress={progress}
          deck={deck}
          onChange={updateSettings}
          onResetProgress={resetProgress}
          onStart={start}
        />
      );
    case 'study':
      return (
        <StudyScreen
          deck={screen.deck}
          speed={settings.speed}
          onSpeed={(speed) => updateSettings({ ...settings, speed })}
          onExit={toStart}
        />
      );
    case 'session': {
      const { session, run } = screen;
      if (session.mode === 'quiz') {
        return (
          <QuizScreen
            key={run}
            config={{ pool: session.chars, deck: session.deck.chars, directions: session.directions, length: session.length }}
            progress={progress}
            onAnswer={(a) => record(a.question.char.id, quizTrack(a.question.direction.id), isCorrect(a))}
            onFinish={(answers) => finish(session, quizResults(answers))}
            onExit={toStart}
          />
        );
      }
      const track = session.mode;
      const props = {
        onResult: (r: WriteResult) => record(r.char.id, track, r.ok),
        onFinish: (results: WriteResult[]) => finish(session, results),
        onExit: toStart,
      };
      return track === 'trace' ? (
        <TraceScreen key={run} chars={session.chars} {...props} />
      ) : (
        <RecallScreen
          key={run}
          pool={session.chars}
          length={session.length}
          levelOf={(id) => levelOf(progress, id, 'recall')}
          {...props}
        />
      );
    }
    case 'result': {
      const { session } = screen;
      return (
        <ResultScreen
          kind={session.mode === 'quiz' ? 'quiz' : 'write'}
          results={screen.results}
          summary={screen.summary}
          onRetryMistakes={(chars) => retry(session, chars)}
          onRestart={() => beginDeck(session.mode, session.deck, session.directions)}
          onMenu={toStart}
        />
      );
    }
  }
}
