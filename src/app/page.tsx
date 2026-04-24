"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Brain,
  Timer,
  Sparkles,
  Layers,
  LineChart,
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
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [displayedQuestionCount, setDisplayedQuestionCount] = useState<number | null>(null);

  const formattedQuestionCount = displayedQuestionCount !== null
    ? new Intl.NumberFormat("en-AU").format(displayedQuestionCount)
    : null;

  const questionCountLabel = displayedQuestionCount === 1 ? "exam style question" : "exam style questions";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

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

          <div className="hidden md:flex items-center space-x-12">
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

            <h1 className="text-6xl md:text-8xl font-light leading-[1.1] tracking-tight">
              Master the <br />
              <span className="font-serif italic font-normal">Exam,</span> <br />
              <span className="font-bold gold-shimmer-text">Own the Result.</span>
            </h1>

            <p className="text-lg text-neutral-500 max-w-lg leading-relaxed font-light">
              Don&apos;t just study—practice with thousands of board-certified questions. Create custom exams tailored to your specific weak points.
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

          <div className="relative reveal animate-float hidden lg:block">
            <div className="glass rounded-[3rem] p-4 shadow-2xl border-white/50 relative z-20 overflow-hidden">
              <div className="bg-white rounded-[2.5rem] p-10 space-y-8">
                <div className="flex justify-between items-center border-b border-neutral-100 pb-6">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[#b5a45d] uppercase tracking-widest">Question Bank Archive</div>
                    <div className="text-3xl font-bold">{formattedQuestionCount ?? ""}</div>
                  </div>
                  <BookOpen size={32} className="text-neutral-900" />
                </div>
                <div className="space-y-4">
                  {["Mathematics", "Chemistry", "Physics", "Biology"].map((subject) => (
                    <div key={subject} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                      <span className="text-sm font-medium">{subject}</span>
                      <span className="text-[10px] font-bold text-neutral-400">1,000+ Qs</span>
                    </div>
                  ))}
                </div>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 glass rounded-[3rem] p-12 flex flex-col justify-between overflow-hidden relative reveal group shadow-sm">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <Layers size={240} />
              </div>
              <div className="space-y-6 relative z-10">
                <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center text-white">
                  <BookOpen size={24} />
                </div>
                <h4 className="text-4xl font-bold tracking-tight text-neutral-900">Massive Question Library</h4>
                <p className="text-neutral-500 text-lg max-w-md leading-relaxed">
                  {formattedQuestionCount ? (
                    <>
                      Access over <span className="text-neutral-900 font-bold">{formattedQuestionCount} {questionCountLabel}</span> designed to mimic the exact style and rigor of real national examinations.
                    </>
                  ) : (
                    <>
                      Access a growing archive of exam style questions designed to mimic the exact style and rigor of real national examinations.
                    </>
                  )}
                </p>
              </div>
              <div className="pt-12 relative z-10">
                <div className="flex flex-wrap gap-2">
                  {["Grade 9", "Grade 10", "Grade 11", "Grade 12"].map((grade) => (
                    <span key={grade} className="px-4 py-2 bg-neutral-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      {grade}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass rounded-[3rem] p-12 flex flex-col justify-between reveal group shadow-2xl border-neutral-100">
              <div className="space-y-6">
                <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center text-white">
                  <SlidersHorizontal size={24} />
                </div>
                <h4 className="text-3xl font-semibold tracking-tight leading-tight text-neutral-900">Custom Exam Architect</h4>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  Build your own exams by selecting specific <span className="text-neutral-900 font-medium">topics, years, and difficulty levels</span>. Practice only what you need.
                </p>
              </div>
              <Link href="/dashboard" className="w-full mt-10 py-5 bg-neutral-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-lg text-center">
                Start Building
              </Link>
            </div>

            <div className="glass rounded-[3rem] p-10 flex flex-col justify-between reveal">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Timer size={22} />
                </div>
                <h4 className="text-xl font-bold text-neutral-900">Authentic Simulation</h4>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Simulate real boards like <span className="text-neutral-900 font-medium">SAT, IB, and GCSE</span> with official timers and formatting.
                </p>
              </div>
            </div>

            <div id="analytics" className="glass rounded-[3rem] p-10 flex flex-col justify-between reveal" style={{ transitionDelay: "0.1s" }}>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(181, 164, 93, 0.1)", color: "#b5a45d" }}>
                  <Brain size={22} />
                </div>
                <h4 className="text-xl font-bold text-neutral-900">AI Step-by-Step</h4>
                <p className="text-sm text-neutral-400 leading-relaxed">Stuck? Our AI tutor breaks down complex problems into manageable logical steps.</p>
              </div>
            </div>

            <div className="glass rounded-[3rem] p-10 flex flex-col justify-between reveal" style={{ transitionDelay: "0.2s" }}>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center">
                  <LineChart size={22} />
                </div>
                <h4 className="text-xl font-bold text-neutral-900">Topic Mastery Hub</h4>
                <p className="text-sm text-neutral-400 leading-relaxed">Identify exactly which topics are dragging down your average with visual heatmaps.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-40 bg-neutral-50 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-8 text-center space-y-12 reveal">
          <h2 className="text-6xl md:text-7xl font-light leading-tight tracking-tighter">
            Elevate your <span className="font-serif italic">Potential.</span>
          </h2>
          <p className="text-xl text-neutral-400 font-light max-w-xl mx-auto">
            Stop guessing what will be on the test. Join the elite students practicing with the world&apos;s largest certified archive.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto bg-neutral-900 text-white px-12 py-6 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-primary transition-all shadow-2xl text-center">
              Get Instant Access
            </Link>
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