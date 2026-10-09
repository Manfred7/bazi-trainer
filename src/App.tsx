import { useCallback, useState } from 'react';
import { type Deck, deckById } from './logic/decks';
import { type Settings, loadSettings, saveSettings } from './logic/settings';
import { StartScreen } from './screens/StartScreen';
import { StudyScreen } from './screens/StudyScreen';

type Screen = { name: 'start' } | { name: 'study'; deck: Deck };

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const toStart = useCallback(() => setScreen({ name: 'start' }), []);

  switch (screen.name) {
    case 'start':
      return (
        <StartScreen
          settings={settings}
          onChange={updateSettings}
          onStart={() => setScreen({ name: 'study', deck: deckById(settings.deckId) })}
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
  }
}
