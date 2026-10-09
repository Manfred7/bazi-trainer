import { useCallback, useState } from 'react';
import type { BaziChar } from './data/characters';
import { DECKS, type Deck, deckById, isAvailable, withUnlocks } from './logic/decks';
import {
  EMPTY_PROGRESS,
  type Progress,
  type Track,
  levelOf,
  loadProgress,
  mastery,
  recordResult,
  saveProgress,
} from './logic/progress';
import type { WriteResult } from './logic/session';
import { type Settings, loadSettings, saveSettings } from './logic/settings';
import { RecallScreen } from './screens/RecallScreen';
import { ResultScreen, type SessionSummary } from './screens/ResultScreen';
import { StartScreen } from './screens/StartScreen';
import { StudyScreen } from './screens/StudyScreen';
import { TraceScreen } from './screens/TraceScreen';

/** Сессия письма: режим, колода (для освоения и итогов) и знаки, которые пишем */
interface WriteSession {
  track: Track;
  deck: Deck;
  chars: BaziChar[];
  /** Сколько знаков спросить по памяти */
  length: number;
  masteryBefore: number;
  unlockedBefore: string[];
}

type Screen =
  | { name: 'start' }
  | { name: 'study'; deck: Deck }
  | { name: 'write'; session: WriteSession; run: number }
  | { name: 'result'; session: WriteSession; results: WriteResult[]; summary: SessionSummary };

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });

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

  const onResult = useCallback(
    (track: Track, r: WriteResult) =>
      setProgress((p) => {
        const next = withUnlocks(recordResult(p, r.char.id, track, r.ok));
        saveProgress(next);
        return next;
      }),
    [],
  );

  const toStart = useCallback(() => setScreen({ name: 'start' }), []);

  const write = (track: Track, d: Deck, chars: BaziChar[], length: number) =>
    setScreen({
      name: 'write',
      run: Date.now(),
      session: {
        track,
        deck: d,
        chars,
        length,
        masteryBefore: mastery(progress, d.chars, track),
        unlockedBefore: progress.unlocked,
      },
    });

  /** Вся колода: обводка — каждый знак по порядку, по памяти — settings.length знаков */
  const writeDeck = (track: Track, d: Deck) =>
    write(track, d, d.chars, track === 'trace' ? d.chars.length : settings.length);

  const start = () => {
    if (settings.mode === 'trace' || settings.mode === 'recall') writeDeck(settings.mode, deck);
    else setScreen({ name: 'study', deck });
  };

  const finish = (session: WriteSession, results: WriteResult[]) =>
    setScreen({
      name: 'result',
      session,
      results,
      summary: {
        deckTitle: session.deck.title,
        masteryBefore: session.masteryBefore,
        masteryAfter: mastery(progress, session.deck.chars, session.track),
        newlyUnlocked: DECKS.filter(
          (d) => progress.unlocked.includes(d.id) && !session.unlockedBefore.includes(d.id),
        ).map((d) => d.title),
      },
    });

  const retry = (session: WriteSession, chars: BaziChar[]) =>
    session.track === 'trace'
      ? write('trace', session.deck, chars, chars.length)
      : write('recall', session.deck, chars, Math.min(settings.length, Math.max(3, chars.length * 2)));

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
    case 'write': {
      const { session } = screen;
      const props = {
        onResult: (r: WriteResult) => onResult(session.track, r),
        onFinish: (results: WriteResult[]) => finish(session, results),
        onExit: toStart,
      };
      return session.track === 'trace' ? (
        <TraceScreen key={screen.run} chars={session.chars} {...props} />
      ) : (
        <RecallScreen
          key={screen.run}
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
          results={screen.results}
          summary={screen.summary}
          onRetryMistakes={(chars) => retry(session, chars)}
          onRestart={() => writeDeck(session.track, session.deck)}
          onMenu={toStart}
        />
      );
    }
  }
}
