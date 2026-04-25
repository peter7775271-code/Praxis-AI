'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ResizeHandleProps {
  /** Current width in rem units */
  width: number;
  /** Whether column is currently visible */
  isVisible: boolean;
  /** Callback to update width (receives new width in rem) */
  onWidthChange: (newWidth: number) => void;
  /** Callback to toggle visibility */
  onToggleVisibility: () => void;
  /** Position: 'left' or 'right' */
  position: 'left' | 'right';
  /** Minimum width allowed (in rem) */
  minWidth?: number;
  /** Maximum width allowed (in rem) */
  maxWidth?: number;
}

export const ResizeHandle = React.memo(({
  width,
  isVisible,
  onWidthChange,
  onToggleVisibility,
  position,
  minWidth = 10,
  maxWidth = 40,
}: ResizeHandleProps) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [startWidth, setStartWidth] = React.useState(0);
  const handleRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
    setStartWidth(width);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      // Convert pixels to rem (16px = 1rem)
      const remDelta = delta / 16;

      let newWidth = position === 'left' 
        ? startWidth + remDelta 
        : startWidth - remDelta;

      // Clamp to min/max
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startX, startWidth, position, minWidth, maxWidth, onWidthChange]);

  return (
    <div
      ref={handleRef}
      className={`
        relative w-1 bg-neutral-300 transition-all cursor-col-resize
        hover:bg-blue-500 hover:w-1.5
        ${isDragging ? 'bg-blue-500 w-1.5' : ''}
        group
      `}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-label={`${position} panel resize handle`}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={onToggleVisibility}
        className={`
          absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
          p-1 rounded-full bg-white border border-neutral-200
          hover:bg-neutral-50 hover:border-neutral-300
          shadow-md opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          z-10
        `}
        title={isVisible ? `Hide ${position} panel` : `Show ${position} panel`}
        aria-label={isVisible ? `Hide ${position} panel` : `Show ${position} panel`}
      >
        {position === 'left' ? (
          isVisible ? (
            <ChevronLeft className="w-4 h-4 text-neutral-700" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-700" />
          )
        ) : (
          isVisible ? (
            <ChevronRight className="w-4 h-4 text-neutral-700" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-neutral-700" />
          )
        )}
      </button>

      {/* Expanded hover zone for easier grabbing */}
      <div className="absolute -inset-1.5 cursor-col-resize" />
    </div>
  );
});

ResizeHandle.displayName = 'ResizeHandle';
