import { useEffect, useRef, useState } from 'react';

const MAX = 360;

/** Квадрат по ширине контейнера, не больше MAX: размер холста письма */
export function useSquareSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(MAX);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize(Math.min(MAX, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
