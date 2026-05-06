"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BrochureCarousel } from "@/components/BrochureCarousel";
import { FeatureCarousel, type FeatureSlide } from "@/components/FeatureCarousel";
import {
  ArrowRight,
  Zap,
  Sparkles,
  BookOpen,
  Menu,
  X,
  SlidersHorizontal,
} from "lucide-react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

  :root {
    --clr-primary: #b5a45d;
    --clr-primary-light: #fdf8e6;
    --clr-surface: #ffffff;
    --foreground: #1a1a1a;
  }

  body {
    background-color: var(--clr-surface);
    color: var(--foreground);
    font-family: 'Inter', sans-serif;
    overflow-x: hidden;
  }

  .font-serif {
    font-family: 'Playfair Display', serif;
  }

  .text-primary {
    color: var(--clr-primary);
  }

  .bg-primary {
    background-color: var(--clr-primary);
  }

  .hover\\:bg-primary:hover {
    background-color: var(--clr-primary);
  }

  .hover\\:text-primary:hover {
    color: var(--clr-primary);
  }

  .gold-shimmer-text {
    background: linear-gradient(90deg, #8a7a3a 0%, #b5a45d 50%, #8a7a3a 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  .glass {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  .hero-gradient {
    background: radial-gradient(circle at 50% 50%, var(--clr-primary-light) 0%, #ffffff 100%);
  }

  .reveal {
    opacity: 0;
    transform: translateY(30px);
    transition: all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .reveal.active {
    opacity: 1;
    transform: translateY(0);
  }

  .grid-pattern {
    background-image: radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px);
    background-size: 30px 30px;
  }
`;

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showNavLinks, setShowNavLinks] = useState(false);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [displayedQuestionCount, setDisplayedQuestionCount] = useState<number | null>(null);

  const formattedQuestionCount = displayedQuestionCount !== null
    ? new Intl.NumberFormat("en-AU").format(displayedQuestionCount)
    : null;

  const questionCountLabel = displayedQuestionCount === 1 ? "exam style question" : "exam style questions";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      setShowNavLinks(window.scrollY > window.innerHeight * 0.7);

      const reveals = document.querySelectorAll(".reveal");
      reveals.forEach((reveal) => {
        const windowHeight = window.innerHeight;
        const revealTop = reveal.getBoundingClientRect().top;
        const revealPoint = 150;
        if (revealTop < windowHeight - revealPoint) {
          reveal.classList.add("active");
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadQuestionCount = async () => {
      try {
        const response = await fetch("/api/hsc/question-count", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        const parsedCount = typeof data?.count === "number" ? data.count : Number(data?.count);

        if (isMounted && Number.isFinite(parsedCount) && parsedCount >= 0) {
          setQuestionCount(parsedCount);
        }
      } catch {
      }
    };

    loadQuestionCount();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (questionCount === null) return;

    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setDisplayedQuestionCount(questionCount);
      return;
    }

    const durationMs = 1200;
    const startTime = performance.now();
    let animationFrameId = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const nextValue = Math.floor(progress * questionCount);
      setDisplayedQuestionCount(nextValue);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    };

    setDisplayedQuestionCount(0);
    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [questionCount]);

  const navItems = [
    { label: "Features", href: "#features" },
    { label: "Analytics", href: "#analytics" },
    { label: "Question Bank", href: "#question-bank" },
    { label: "Pricing", href: "#pricing" },
  ];
  const featureSlides: FeatureSlide[] = [
    {
      eyebrow: "Feature 01",
      title: "A library that actually covers the syllabus.",
      icon: <BookOpen size={22} />,
      tagline: "Every question tagged, sourced and filterable - no scrolling through a feed.",
      highlights: [
        { value: formattedQuestionCount ?? "4k+", label: "Questions" },
        { value: "4", label: "Maths courses" },
        { value: "100%", label: "Exam style" },
      ],
      bullets: [
        "Tagged by topic, subtopic and dot point",
        "Worked solutions on every single question",
        "Images and diagrams included where they matter",
      ],
      pills: [
        { label: "Maths Ext 2" },
        { label: "Maths Ext 1" },
        { label: "Maths Advanced" },
        { label: "Maths Standard" },
        { label: "Chem - soon", muted: true },
        { label: "Bio - soon", muted: true },
        { label: "Physics - soon", muted: true },
      ],
      image: "/features/library.png",
      imageAlt: "Question library preview",
    },
    {
      eyebrow: "Feature 02",
      title: "Custom topic tests in minutes, not hours.",
      icon: <SlidersHorizontal size={22} />,
      tagline: "Tune a paper for your class, export it, and keep it forever.",
      highlights: [
        { value: "5", label: "Filters" },
        { value: "4", label: "Export modes" },
        { value: "100%", label: "Yours to keep" },
      ],
      bullets: [
        "Filter by topic, subtopic, difficulty, grade and subject",
        "Hand-pick the exact questions you want included",
        "Style the PDF: title, font, size, watermark, blank lines",
        "Export questions, with solutions, solutions only, or raw LaTeX",
      ],
      pills: [
        { label: "PDF" },
        { label: "LaTeX" },
        { label: "No strings attached" },
      ],
      image: "/features/exam-builder.png",
      imageAlt: "Custom exam builder preview",
    },
  ];

  const brochurePages = [
    "/brochure/page-1.jpg",
    "/brochure/page-2.jpg",
    "/brochure/page-3.jpg",
    "/brochure/page-4.jpg",
    "/brochure/page-5.jpg",
  ];

  return (
    <div className="relative bg-white text-neutral-900">
      <style>{styles}</style>

      <nav className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 ${scrolled ? "py-4 glass border-b" : "py-8"}`}>
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <a href="#question-bank" className="flex items-center space-x-3 group cursor-pointer">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white font-serif text-2xl leading-none hover:bg-primary transition-colors">
              <span className="leading-none -translate-y-[1px]">∑</span>
            </div>
            <span className="font-bold text-xl tracking-tight">
              PRAXIS<span className="text-neutral-400 font-light">AI</span>
            </span>
          </a>

          <div
            className={`hidden md:flex items-center space-x-12 transition-all duration-500 ${
              showNavLinks ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
            aria-hidden={!showNavLinks}
          >
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 hover:text-primary transition-colors">
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/login" className="text-xs font-bold uppercase tracking-widest px-6 py-2 hover:text-primary transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="bg-neutral-900 text-white text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-full hover:bg-primary transition-all shadow-xl shadow-neutral-900/10">
              Start Free
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setIsMenuOpen((prev) => !prev)} aria-label="Toggle menu">
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden px-8 pt-4 pb-6 glass border-t mt-4 space-y-4">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 hover:text-primary" onClick={() => setIsMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link href="/login" className="text-xs font-bold uppercase tracking-widest px-4 py-2 border border-neutral-200 rounded-full">
                Sign In
              </Link>
              <Link href="/signup" className="bg-neutral-900 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full">
                Start Free
              </Link>
            </div>
          </div>
        )}
      </nav>

      <section id="question-bank" className="relative min-h-screen flex items-center pt-20 overflow-hidden hero-gradient">
        <div className="absolute inset-0 grid-pattern opacity-40"></div>

        <div className="max-w-7xl mx-auto px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 reveal">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-neutral-100 rounded-full shadow-sm">
              <Sparkles size={14} className="text-[#b5a45d]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{formattedQuestionCount ? `${formattedQuestionCount} ${questionCountLabel}` : "Exam style questions"}</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-light leading-[1.1] tracking-tight">
              A question bank <br />
              built like a <br />
              <span className="font-serif italic font-normal">filing cabinet,</span> <br />
              <span className="font-bold gold-shimmer-text">not a feed.</span>
            </h1>

            <p className="text-lg text-neutral-500 max-w-lg leading-relaxed font-light">
              12,760 vetted HSC, VCE and QCE exam-style questions across Maths, Physics, Chemistry and Biology - every item tagged, sourced, and filterable. Build a topic test in under ten minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 pt-4">
              <Link href="/dashboard" className="w-full sm:w-auto bg-neutral-900 text-white px-10 py-5 rounded-full font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-3 hover:bg-primary transition-all shadow-2xl hover:-translate-y-1">
                <span>Explore the Bank</span>
                <ArrowRight size={16} />
              </Link>
              <a href="#features" className="flex items-center space-x-3 text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors">
                <div className="w-12 h-12 rounded-full border border-neutral-200 flex items-center justify-center">
                  <Zap size={18} />
                </div>
                <span>How it Works</span>
              </a>
            </div>
          </div>

          <div className="relative reveal lg:justify-self-end w-full max-w-[52rem]">
            <div className="absolute -inset-6 rounded-[3rem] bg-[radial-gradient(circle_at_top_right,rgba(181,164,93,0.18),transparent_55%)] blur-2xl"></div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] gap-8 items-center">
              <BrochureCarousel pages={brochurePages} className="max-w-[28rem] sm:max-w-[30rem] lg:justify-self-start" />

              <div className="lg:pl-2">
                <p className="text-xl sm:text-xl font-medium tracking-tight text-neutral-800 leading-snug">
                  
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-32 bg-white relative">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4 reveal">
            <h2 className="text-[10px] font-bold text-[#b5a45d] uppercase tracking-[0.4em]">Optimized for Results</h2>
            <h3 className="text-5xl font-light">
              The Ultimate <span className="font-serif italic text-neutral-400">Practice Suite</span>
            </h3>
          </div>

          <div id="analytics" className="reveal">
            <FeatureCarousel slides={featureSlides} />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-32 bg-neutral-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 space-y-14 reveal">
          <div className="text-center space-y-4">
            <h2 className="text-[10px] font-bold text-[#b5a45d] uppercase tracking-[0.35em]">Pricing</h2>
            <h3 className="text-5xl md:text-6xl font-light tracking-tight leading-tight">
              Pick the plan that <span className="font-serif italic text-neutral-500">fits your year</span>
            </h3>
            <p className="text-neutral-500 max-w-2xl mx-auto">
              Transparent pricing, fast setup, and unlimited exports after generation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 sm:p-8 shadow-xl shadow-neutral-900/5">
              <div className="space-y-3">
                <h4 className="text-3xl font-semibold tracking-tight">Standard</h4>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold leading-none">$99</span>
                  <span className="text-sm text-neutral-500 pb-1">/ month</span>
                </div>
                <p className="text-sm text-neutral-500">Year 11 or Year 12 - pick one</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {["Year 11 only", "Year 12 only"].map((pill) => (
                    <span key={pill} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold text-neutral-600">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <ul className="mt-7 space-y-3 text-sm text-neutral-600">
                {[
                  "All 4 maths subjects",
                  "Filter by topic, subtopic and dot point",
                  "LaTeX questions + worked solutions",
                  "Images included where needed",
                  "30 exam generation tokens / month",
                  "Unlimited PDF exports after generation",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="mt-8 block w-full rounded-xl border border-neutral-300 bg-white py-3 text-center text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100"
              >
                Choose Standard
              </Link>
            </div>

            <div className="rounded-[2rem] border-2 border-[#2563eb] bg-white p-6 sm:p-8 shadow-2xl shadow-blue-900/10 relative">
              <span className="absolute left-8 top-0 -translate-y-1/2 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-700">
                Most popular
              </span>

              <div className="space-y-3">
                <h4 className="text-3xl font-semibold tracking-tight">Pro</h4>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold leading-none">$199</span>
                  <span className="text-sm text-neutral-500 pb-1">/ month</span>
                </div>
                <p className="text-sm text-neutral-500">Year 11 and Year 12 - both included</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {["Year 11", "Year 12"].map((pill) => (
                    <span key={pill} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold text-neutral-600">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <ul className="mt-7 space-y-3 text-sm text-neutral-700">
                {[
                  "Everything in Standard",
                  "Both year levels included",
                  "100 exam generation tokens / month",
                  "Unlimited PDF exports after generation",
                  "Unlimited tutor accounts",
                  "Priority support",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#4c1d95]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="mt-8 block w-full rounded-xl bg-[#2563eb] py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                Choose Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-20 border-t border-neutral-100 bg-white">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center text-[10px] font-bold uppercase tracking-widest text-neutral-300">
          <div className="flex items-center space-x-3 text-neutral-900 mb-6 md:mb-0">
            <div className="w-6 h-6 bg-neutral-900 rounded flex items-center justify-center text-white font-serif text-sm leading-none">
              <span className="leading-none -translate-y-[0.5px]">∑</span>
            </div>
            <span className="tracking-[0.2em]">Praxis AI</span>
          </div>
          <p>© 2026 Praxis AI. Built for excellence.</p>
        </div>
      </footer>
    </div>
  );
}