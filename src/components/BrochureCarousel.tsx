"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface BrochureCarouselProps {
  pages: string[];
  className?: string;
}

export function BrochureCarousel({ pages, className = "" }: BrochureCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);
  const hasPages = pages.length > 0;

  const currentPage = useMemo(() => {
    if (!hasPages) return "";
    return pages[Math.min(activeIndex, pages.length - 1)];
  }, [activeIndex, hasPages, pages]);

  const goPrev = () => {
    setDirection(-1);
    setActiveIndex((prev) => (prev === 0 ? pages.length - 1 : prev - 1));
  };

  const goNext = () => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % pages.length);
  };

  useEffect(() => {
    if (!hasPages || pages.length <= 1 || isPaused) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const intervalId = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % pages.length);
    }, 3500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasPages, isPaused, pages.length]);

  if (!hasPages) {
    return (
      <div className={`min-h-[26rem] flex items-center justify-center text-center ${className}`}>
        <p className="text-sm text-neutral-500">
          Add brochure images to <span className="font-semibold text-neutral-800">/public/brochure</span> to show the preview.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="relative">
        <div className="relative w-full overflow-hidden rounded-3xl bg-white/70 shadow-2xl">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentPage}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 32 : -32, scale: 0.99 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: direction > 0 ? -20 : 20, scale: 0.995 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <Image
                src={currentPage}
                alt={`Brochure page ${activeIndex + 1}`}
                width={1200}
                height={1600}
                priority={activeIndex === 0}
                className="h-auto w-full object-cover"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white transition hover:bg-black/85"
          aria-label="Previous brochure page"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white transition hover:bg-black/85"
          aria-label="Next brochure page"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {pages.map((_, index) => (
          <button
            key={`dot-${index}`}
            onClick={() => setActiveIndex(index)}
            aria-label={`Go to brochure page ${index + 1}`}
            className={`h-2.5 rounded-full transition-all ${
              activeIndex === index ? "w-8 bg-neutral-900" : "w-2.5 bg-neutral-300 hover:bg-neutral-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
