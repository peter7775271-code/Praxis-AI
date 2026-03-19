"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  ArrowRight,
  Zap,
  UserPlus,
  User,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { SUBJECTS_BY_YEAR, BROWSE_GRADES_SENIOR } from "../dashboard/syllabus-config";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

  :root {
    --clr-primary: #b5a45d;
    --clr-primary-light: #fdf8e6;
    --clr-surface: #ffffff;
    --foreground: #1a1a1a;
  }

  body {
    background-color: #fafafa;
    color: var(--foreground);
    font-family: 'Inter', sans-serif;
  }

  .font-serif {
    font-family: 'Playfair Display', serif;
  }

  .text-primary {
    color: var(--clr-primary);
  }

  .hover\\:text-primary:hover {
    color: var(--clr-primary);
  }

  .hover\\:bg-primary:hover {
    background-color: var(--clr-primary);
  }

  .bg-primary-light {
    background-color: var(--clr-primary-light);
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

  .glass-card {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.04);
  }

  .input-field {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .input-field:focus-within {
    border-color: var(--clr-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(181, 164, 93, 0.1);
  }

  .fade-in {
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

type AuthView = "signin" | "signup";

export default function SignUpPage() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [defaultGrade, setDefaultGrade] = useState<'Year 11' | 'Year 12'>('Year 12');
  const [defaultSubject, setDefaultSubject] = useState<string>('Mathematics Advanced');

  const defaultSubjectsForGrade = useMemo(
    () => SUBJECTS_BY_YEAR[defaultGrade] ?? [],
    [defaultGrade]
  );

  useEffect(() => {
    if (!defaultSubjectsForGrade.includes(defaultSubject)) {
      setDefaultSubject(defaultSubjectsForGrade[0] ?? 'Mathematics Advanced');
    }
  }, [defaultGrade, defaultSubjectsForGrade, defaultSubject]);

  const toggleView = () => {
    setView((prev) => (prev === "signin" ? "signup" : "signin"));
    setShowPassword(false);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (view === "signup") {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            companyName,
            email,
            password,
            defaultGrade,
            defaultSubject,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "Sign up failed");
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setSuccess("Account created successfully.");
        router.push("/dashboard/settings/pricing?onboarding=1");
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setSuccess("Login successful.");
      router.push("/dashboard");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#fafafa]">
      <style>{styles}</style>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-light/30 rounded-full blur-[120px] -mr-64 -mt-64"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary-light/20 rounded-full blur-[120px] -ml-64 -mb-64"></div>

      <header className="p-8 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center space-x-2 text-neutral-400 hover:text-neutral-900 transition-colors text-xs font-bold uppercase tracking-widest group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-serif italic text-xl">A</div>
          <span className="font-bold text-lg tracking-tight uppercase">
            Praxis<span className="text-neutral-300 font-light">AI</span>
          </span>
        </Link>
        <div className="w-32 hidden md:block"></div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md fade-in" key={view}>
          <div className="text-center mb-10 space-y-3">
            {view === "signin" ? (
              <>
                <h1 className="text-4xl font-light">
                  Welcome <span className="font-serif italic">Back.</span>
                </h1>
                <p className="text-neutral-400 text-sm font-medium uppercase tracking-[0.2em]">Enter your account details</p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-light">
                  Begin Your <span className="font-serif italic">Journey.</span>
                </h1>
                <p className="text-neutral-400 text-sm font-medium uppercase tracking-[0.2em]">Create your scholar account</p>
              </>
            )}
          </div>

          <div className="glass-card rounded-[2.5rem] p-10 md:p-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
              {success && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>{success}</span>
                </div>
              )}

              {view === "signup" && (
                <div className="space-y-2 fade-in">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1" htmlFor="name">
                    Full Name
                  </label>
                  <div className="input-field relative flex items-center bg-neutral-50/50 border border-neutral-100 rounded-2xl">
                    <User size={18} className="absolute left-4 text-neutral-300" />
                    <input
                      id="name"
                      type="text"
                      placeholder="Alex Sterling"
                      className="w-full bg-transparent py-4 pl-12 pr-4 text-sm focus:outline-none placeholder:text-neutral-300"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 mt-2" htmlFor="company">
                    Company Name
                  </label>
                  <div className="input-field relative flex items-center bg-neutral-50/50 border border-neutral-100 rounded-2xl">
                    <Zap size={18} className="absolute left-4 text-neutral-300" />
                    <input
                      id="company"
                      type="text"
                      placeholder="Your organisation"
                      className="w-full bg-transparent py-4 pl-12 pr-4 text-sm focus:outline-none placeholder:text-neutral-300"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2 mt-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1" htmlFor="default-grade">
                      Default Exam Year
                    </label>
                    <select
                      id="default-grade"
                      value={defaultGrade}
                      onChange={(e) => setDefaultGrade(e.target.value as 'Year 11' | 'Year 12')}
                      className="w-full bg-neutral-50/50 border border-neutral-100 rounded-2xl py-4 px-4 text-sm focus:outline-none"
                      disabled={isLoading}
                    >
                      {BROWSE_GRADES_SENIOR.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1" htmlFor="default-subject">
                      Default Subject
                    </label>
                    <select
                      id="default-subject"
                      value={defaultSubject}
                      onChange={(e) => setDefaultSubject(e.target.value)}
                      className="w-full bg-neutral-50/50 border border-neutral-100 rounded-2xl py-4 px-4 text-sm focus:outline-none"
                      disabled={isLoading}
                      required
                    >
                      {defaultSubjectsForGrade.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1" htmlFor="email">
                  Email
                </label>
                <div className="input-field relative flex items-center bg-neutral-50/50 border border-neutral-100 rounded-2xl">
                  <Mail size={18} className="absolute left-4 text-neutral-300" />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="w-full bg-transparent py-4 pl-12 pr-4 text-sm focus:outline-none placeholder:text-neutral-300"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest" htmlFor="password">
                    password
                  </label>
                  {view === "signin" && (
                    <Link href="/forgot-password" className="text-[10px] font-bold text-primary hover:underline decoration-primary/30 underline-offset-4 tracking-widest uppercase">
                      Forgot?
                    </Link>
                  )}
                </div>
                <div className="input-field relative flex items-center bg-neutral-50/50 border border-neutral-100 rounded-2xl">
                  <Lock size={18} className="absolute left-4 text-neutral-300" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-transparent py-4 pl-12 pr-12 text-sm focus:outline-none placeholder:text-neutral-300"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 text-neutral-300 hover:text-neutral-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                disabled={isLoading}
                className="w-full bg-neutral-900 text-white py-5 rounded-2xl font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-primary transition-all shadow-2xl shadow-neutral-900/10 flex items-center justify-center space-x-3 group relative overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="relative z-10">{view === "signin" ? "login" : "create account"}</span>
                    <ArrowRight size={14} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-neutral-50 text-center space-y-4">
              <p className="text-xs text-neutral-400 font-medium">
                {view === "signin" ? "New to the platform?" : "Already have an account?"}
              </p>
              <button
                onClick={toggleView}
                className="w-full py-4 bg-white border border-neutral-100 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-900 hover:border-primary hover:text-primary transition-all flex items-center justify-center space-x-2 shadow-sm"
                type="button"
              >
                {view === "signin" ? (
                  <>
                    <UserPlus size={14} />
                    <span>Create an Account</span>
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} className="rotate-180" />
                    <span>Back to Login</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center space-x-8 text-[10px] font-bold text-neutral-300 uppercase tracking-widest">
            <span className="flex items-center">
              <Zap size={12} className="mr-1.5 text-primary" /> Single Sign-On
            </span>
            <span className="flex items-center">
              <ShieldCheck size={12} className="mr-1.5" /> Encrypted Vault
            </span>
          </div>
        </div>
      </main>

      <footer className="p-8 text-center text-[10px] font-bold text-neutral-300 uppercase tracking-[0.3em] relative z-10">
        Curated Excellence • Praxis AI © 2026
      </footer>
    </div>
  );
}