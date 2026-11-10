'use client';
import { useState, useRef, useEffect, ReactNode } from 'react';

type Props = {
  leftPane: ReactNode;
  rightPane: ReactNode;
  minLeftWidth?: number;
  minRightWidth?: number;
  defaultLeftWidth?: number;
};

export default function ResizablePanes({
  leftPane,
  rightPane,
  minLeftWidth = 40,
  minRightWidth = 15,
  defaultLeftWidth = 70,
}: Props) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth); // default 70%
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp the width between min and max
      const maxLeftWidth = 100 - minRightWidth;
      const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));

      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minLeftWidth, minRightWidth]);

  return (
    // Hauteur BORNÉE, et non `h-full` : aucun ancêtre ne borne la sienne — ils
    // posent tous `min-h` — donc `overflow-auto` ne s'engageait jamais et la
    // page entière défilait d'un bloc. Le volet de détail disparaissait alors
    // dès qu'on descendait dans la liste. 64 px est la hauteur de l'en-tête,
    // comme dans les layouts.
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-64px)]"
      style={{ userSelect: isDragging ? 'none' : 'auto' }}
    >
      <div
        className="border-r-1 dark:border-neutral-700 overflow-auto"
        style={{ width: `${leftWidth}%`, minWidth: `${minLeftWidth}%` }}
      >
        {leftPane}
      </div>

      <div
        className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors"
        role="separator"
        onMouseDown={handleMouseDown}
        style={{ flexShrink: 0 }}
      />

      <div className="flex-1 overflow-auto" style={{ minWidth: `${minRightWidth}%` }}>
        {rightPane}
      </div>
    </div>
  );
}
