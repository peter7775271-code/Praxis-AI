"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface FeatureHighlight {
  label: string;
  value: string;
}

export interface FeatureSlide {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  tagline: string;
  bullets: string[];
  highlights?: FeatureHighlight[];
  pills?: { label: string; muted?: boolean }[];
  image?: string;
  imageAlt?: string;
}

interface FeatureCarouselProps {
  slides: FeatureSlide[];
  className?: string;
}

export function FeatureCarousel({ slides, className = "" }: FeatureCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);

  const slide = slides[activeIndex];

  const goPrev = () => {
    setDirection(-1);
    setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goNext = () => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const intervalId = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [isPaused, slides.length]);

  return (
    <div
      className={`w-full ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="relative">
        <div className="relative overflow-hidden rounded-[3rem] glass shadow-2xl border border-neutral-100 min-h-[34rem] md:min-h-[40rem]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={activeIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]"
            >
              {/* Image side */}
              <div className="relative bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 overflow-hidden">
                <div className="absolute inset-0 grid-pattern opacity-[0.08]" />
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#b5a45d]/20 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#b5a45d]/10 blur-3xl" />

                {slide.image ? (
                  <div className="absolute inset-0 p-8 sm:p-10 lg:p-12">
                    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20 bg-neutral-950/40 shadow-2xl">
                      <Image
                        src={slide.image}
                        alt={slide.imageAlt ?? slide.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 55vw"
                        className="object-contain scale-[1]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 h-full min-h-[20rem] flex flex-col items-center justify-center text-center px-8 py-12 text-white/70">
                    <div className="w-16 h-16 rounded-2xl border border-white/20 flex items-center justify-center mb-4 text-white/60">
                      <ImageIcon size={26} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#d6c585]">
                      Drop image here
                    </p>
                    <p className="mt-3 text-sm text-white/50 max-w-xs leading-relaxed">
                      Add a screenshot to <span className="font-semibold text-white/80">/public/features/</span> and set it on the slide.
                    </p>
                  </div>
                )}

                <div className="absolute bottom-6 left-6 z-10 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/95 text-neutral-900 flex items-center justify-center shadow-xl">
                    {slide.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/80 bg-black/30 backdrop-blur px-3 py-1.5 rounded-full">
                    {slide.eyebrow}
                  </span>
                </div>
              </div>

              {/* Content side */}
              <div className="p-8 md:p-12 flex flex-col justify-center gap-7 bg-white">
                <div className="space-y-3">
                  <h4 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 leading-[1.15]">
                    {slide.title}
                  </h4>
                  <p className="text-lg text-neutral-500 leading-relaxed font-light">
                    {slide.tagline}
                  </p>
                </div>

                {slide.highlights && slide.highlights.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {slide.highlights.map((h) => (
                      <div
                        key={h.label}
                        className="rounded-2xl border border-neutral-100 bg-neutral-50/50 px-4 py-3"
                      >
                        <div className="text-xl font-bold text-neutral-900 leading-none">
                          {h.value}
                        </div>
                        <div className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                          {h.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <ul className="space-y-2.5">
                  {slide.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-[15px] text-neutral-700 leading-snug"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#b5a45d] shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {slide.pills && slide.pills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {slide.pills.map((p) => (
                      <span
                        key={p.label}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          p.muted
                            ? "bg-white text-neutral-400 border border-dashed border-neutral-300"
                            : "bg-neutral-900 text-white"
                        }`}
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-3 text-neutral-900 shadow-xl transition hover:bg-white"
              aria-label="Previous feature"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-3 text-neutral-900 shadow-xl transition hover:bg-white"
              aria-label="Next feature"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((s, index) => (
            <button
              key={`feature-dot-${index}`}
              onClick={() => {
                setDirection(index > activeIndex ? 1 : -1);
                setActiveIndex(index);
              }}
              aria-label={`Go to ${s.title}`}
              className={`h-2.5 rounded-full transition-all ${
                activeIndex === index
                  ? "w-10 bg-neutral-900"
                  : "w-2.5 bg-neutral-300 hover:bg-neutral-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
