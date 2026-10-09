import type { ReactNode } from 'react';

interface Props {
  size: number;
  /** Короткая красная вспышка: черта не засчитана */
  miss?: boolean;
  children: ReactNode;
}

/** Клетка прописи: простой квадрат, как в прописях (без 田/米) */
export function PracticeGrid({ size, miss = false, children }: Props) {
  return (
    <div className={`grid-cell ${miss ? 'grid-cell--miss' : ''}`} style={{ width: size, height: size }}>
      {children}
    </div>
  );
}
