import type { ReactNode } from 'react';

/** Клетка прописи: простой квадрат, как в прописях (без 田/米) */
export function PracticeGrid({ size, children }: { size: number; children: ReactNode }) {
  return (
    <div className="grid-cell" style={{ width: size, height: size }}>
      {children}
    </div>
  );
}
