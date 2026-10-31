import { useEffect, useRef, useState } from 'react';

const MAX = 360;
/** Меньше клетки уже неудобно писать пальцем */
const MIN = 200;

/**
 * Квадрат по ширине контейнера, не больше MAX: размер холста письма.
 * fit — ещё и по высоте: клетка ужимается, пока экран (<main>) не помещается в окно целиком,
 * чтобы кнопки под клеткой («Дальше») были видны без прокрутки. Растёт обратно, когда место появляется.
 */
export function useSquareSize(fit = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(MAX);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest('main');
    const update = () => {
      const width = Math.min(MAX, Math.floor(el.clientWidth));
      if (!fit || !main) return setSize(width);
      // Высота экрана линейна по размеру клетки: остальное + size. Подгоняем за один шаг
      setSize((s) => Math.max(MIN, Math.min(width, Math.floor(s - (main.offsetHeight - window.innerHeight)))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (fit && main) ro.observe(main);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [fit]);

  return { ref, size };
}
