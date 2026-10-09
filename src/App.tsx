import { useCallback, useState } from 'react';
import type { BaziChar } from './data/characters';
import { type Deck, deckById } from './logic/decks';
import { type Settings, loadSettings, saveSettings } from './logic/settings';
import { ResultScreen } from './screens/ResultScreen';
import { StartScreen } from './screens/StartScreen';
import { StudyScreen } from './screens/StudyScreen';
import { TraceScreen, type WriteResult } from './screens/TraceScreen';

/** Сессия письма: колода (для заголовка итогов) и знаки, которые пишем */
interface WriteSession {
  deck: Deck;
  chars: BaziChar[];
}

type Screen =
  | { name: 'start' }
  | { name: 'study'; deck: Deck }
  | { name: 'trace'; session: WriteSession; run: number }
  | { name: 'result'; session: WriteSession; results: WriteResult[] };

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const toStart = useCallback(() => setScreen({ name: 'start' }), []);
  const trace = (session: WriteSession) => setScreen({ name: 'trace', session, run: Date.now() });

  const start = () => {
    const deck = deckById(settings.deckId);
    if (settings.mode === 'trace') trace({ deck, chars: deck.chars });
    else setScreen({ name: 'study', deck });
  };

  switch (screen.name) {
    case 'start':
      return <StartScreen settings={settings} onChange={updateSettings} onStart={start} />;
    case 'study':
      return (
        <StudyScreen
          deck={screen.deck}
          speed={settings.speed}
          onSpeed={(speed) => updateSettings({ ...settings, speed })}
          onExit={toStart}
        />
      );
    case 'trace': {
      const { session } = screen;
      return (
        <TraceScreen
          key={screen.run}
          chars={session.chars}
          onFinish={(results) => setScreen({ name: 'result', session, results })}
          onExit={toStart}
        />
      );
    }
    case 'result': {
      const { session } = screen;
      return (
        <ResultScreen
          title={session.deck.title}
          results={screen.results}
          onRetryMistakes={(chars) => trace({ ...session, chars })}
          onRestart={() => trace(session)}
          onMenu={toStart}
        />
      );
    }
  }
}
