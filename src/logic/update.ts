import { useEffect, useState } from 'react';

/** Версия сборки для подвала: «25.10.2026, 19:05 · d4e5f6a» (время — местное) */
export const APP_VERSION = `${new Date(__BUILD_TIME__).toLocaleString('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})} · ${__COMMIT__}`;

/**
 * Новая версия приложения скачана и уже управляет страницей, а на экране ещё старая —
 * пора предложить «Обновить». Service worker ставится с skipWaiting/clientsClaim (vite-plugin-pwa, autoUpdate),
 * поэтому сигнал — смена контроллера. При первой установке контроллера не было — это не обновление.
 * Пока приложение висит в фоне, проверяем обновление при каждом возвращении на экран.
 * Взято из «Пары вкуса» (food-combo).
 */
export function useAppUpdate(): { ready: boolean; reload: () => void } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    const hadController = !!sw.controller;
    const onChange = () => {
      if (hadController) setReady(true);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') sw.getRegistration().then((r) => r?.update()).catch(() => {});
    };
    sw.addEventListener('controllerchange', onChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sw.removeEventListener('controllerchange', onChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { ready, reload: () => window.location.reload() };
}
