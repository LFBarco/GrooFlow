import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  Activity,
  ChevronRight,
  Moon,
  Sun,
  LockKeyhole,
  TrendingUp,
  BarChart3,
  Brain,
  Building2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "../components/ui/checkbox";
import { supabase } from "../../../utils/supabase/client";

/* ═══════════════════════════════════════════════════
   GrooFlow SVG Logo — "G" + EKG Heartbeat
   ═══════════════════════════════════════════════════ */
function GrooFlowLogo({ isDark }: { isDark: boolean }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
      <defs>
        <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: isDark ? '#d8b4fe' : '#7c3aed', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: isDark ? '#22d3ee' : '#0891b2', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="intenseGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={isDark ? 3.5 : 2} result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* The "G" Principal */}
      <path
        d="M 75 35 A 35 35 0 1 0 75 80 L 50 80 L 40 65"
        stroke="url(#neonGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#intenseGlow)"
        fill="none"
      />

      {/* EKG Heartbeat Line */}
      <path
        className="splash-ekg-line"
        d="M 25 55 L 35 55 L 42 35 L 52 75 L 60 55 L 85 55"
        stroke={isDark ? '#67e8f9' : '#0891b2'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#intenseGlow)"
        fill="none"
      />

      {/* Decorative tech dots */}
      <circle cx="85" cy="55" r="2" fill={isDark ? '#22d3ee' : '#0891b2'} className="animate-pulse" />
      <circle cx="75" cy="35" r="2" fill={isDark ? '#a855f7' : '#7c3aed'} className="animate-pulse" style={{ animationDelay: '1s' }} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════
   FEATURE PILLS DATA
   ═══════════════════════════════════════════════════ */
const FEATURES = [
  { label: 'Flujo de Caja', icon: TrendingUp, color: '#22d3ee', lightColor: '#0891b2' },
  { label: 'P&L en Tiempo Real', icon: BarChart3, color: '#34d399', lightColor: '#059669' },
  { label: 'Analítica AI', icon: Brain, color: '#c084fc', lightColor: '#7c3aed' },
  { label: 'Multi-Sede', icon: Building2, color: '#fbbf24', lightColor: '#d97706' },
];

/* ═══════════════════════════════════════════════════
   TYPEWRITER COMPONENT
   ═══════════════════════════════════════════════════ */
function TypewriterText({ text, delay = 1500, speed = 60, color }: { text: string; delay?: number; speed?: number; color: string }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) return;
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [started, displayed, text, speed]);

  return (
    <span style={{ color }} className="splash-typewriter-cursor">
      {displayed}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   SCHEMAS
   ═══════════════════════════════════════════════════ */
const loginSchema = z.object({
  email: z.string().email("Ingrese un correo valido"),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres"),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onLogin: (email: string, name?: string) => void;
  currentTheme: "dark" | "light";
  onToggleTheme: () => void;
}

/* ═══════════════════════════════════════════════════
   THEME COLOR SYSTEM
   ═══════════════════════════════════════════════════ */
function useThemeColors(isDark: boolean) {
  return useMemo(() => ({
    // Page
    pageBg: isDark ? '#090515' : '#F5F3FF',
    pageText: isDark ? '#E4E0FF' : '#1e1b4b',

    // Left panel
    leftBg: isDark ? '#090515' : '#F0EDFF',
    vignetteColor: isDark ? '#090515' : '#F0EDFF',

    // Orbs
    orbCyan: isDark ? 'rgba(34,211,238,0.15)' : 'rgba(34,211,238,0.12)',
    orbViolet: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(139,92,246,0.15)',

    // Image overlay
    imgOverlay1: isDark
      ? 'linear-gradient(135deg, rgba(9,5,21,0.85) 0%, rgba(9,5,21,0.5) 50%, rgba(9,5,21,0.2) 100%)'
      : 'linear-gradient(135deg, rgba(240,237,255,0.85) 0%, rgba(240,237,255,0.5) 50%, rgba(240,237,255,0.3) 100%)',
    imgOverlay2: isDark
      ? 'linear-gradient(to bottom, rgba(88,28,135,0.15) 0%, rgba(9,5,21,0.6) 100%)'
      : 'linear-gradient(rgba(109,40,217,0.06) 0%, transparent 100%)',
    imgOpacity: isDark ? 0.65 : 0.3,
    imgBlend: isDark ? 'color-dodge' as const : 'multiply' as const,

    // Title
    titleColor: isDark ? '#ffffff' : '#1e1b4b',
    titleGlow: isDark ? '0 0 30px rgba(168,85,247,0.6)' : '0 0 20px rgba(109,40,217,0.2)',

    // Divider
    dividerBg: isDark
      ? 'linear-gradient(to right, transparent, #a855f7, transparent)'
      : 'linear-gradient(to right, transparent, #7c3aed, transparent)',

    // Subtitle
    subtitleColor: isDark ? 'rgba(228,224,255,0.7)' : 'rgba(30,27,75,0.55)',
    subtitleAccent: isDark ? '#d8b4fe' : '#7c3aed',

    // Status
    statusMuted: isDark ? '#8b5cf6' : '#8b7cf8',
    statusCyan: isDark ? '#22d3ee' : '#0891b2',
    statusDot: isDark ? 'bg-cyan-400' : 'bg-cyan-600',

    // Bracket colors
    bracketCyan: isDark ? 'rgba(34,211,238,0.6)' : 'rgba(34,211,238,0.3)',
    bracketViolet: isDark ? 'rgba(192,132,252,0.6)' : 'rgba(139,92,246,0.3)',

    // Footer
    footerColor: isDark ? '#6d28d9' : '#8b7cf8',

    // Right panel
    rightBg: isDark
      ? 'linear-gradient(180deg, rgba(15,10,31,0.85) 0%, rgba(9,5,21,0.9) 100%)'
      : 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFE 100%)',
    rightBorder: isDark
      ? '1px solid rgba(139,92,246,0.2)'
      : '1px solid rgba(139,92,246,0.12)',
    rightShadow: isDark
      ? '-20px 0 60px rgba(0,0,0,0.6)'
      : '-20px 0 60px rgba(139,92,246,0.08)',
    rightGlowLine: isDark
      ? 'linear-gradient(180deg, transparent, rgba(34,211,238,0.5) 40%, rgba(192,132,252,0.5) 60%, transparent)'
      : 'linear-gradient(180deg, transparent, rgba(109,40,217,0.15) 40%, rgba(34,211,238,0.15) 60%, transparent)',

    // Badge
    badgeBg: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(109,40,217,0.06)',
    badgeBorder: isDark ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(109,40,217,0.12)',
    badgeTextColor: isDark ? '#d8b4fe' : '#6d28d9',
    badgeIconColor: isDark ? 'text-purple-400' : 'text-violet-600',

    // Headings
    headingColor: isDark ? '#ffffff' : '#1e1b4b',
    subHeadingColor: isDark ? '#9ca3af' : '#64748b',

    // Labels
    labelColor: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(30,27,75,0.45)',

    // Inputs
    inputBg: isDark ? 'rgba(15, 10, 30, 0.6)' : 'rgba(255,255,255,0.9)',
    inputBorder: isDark ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(139,92,246,0.18)',
    inputText: isDark ? '#E4E0FF' : '#1e1b4b',
    inputPlaceholder: isDark ? '#6b5fa5' : '#94a3b8',

    // Buttons
    btnPrimaryBg: isDark
      ? 'linear-gradient(90deg, #06b6d4 0%, #7c3aed 100%)'
      : 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)',
    btnPrimaryBorder: isDark
      ? '1px solid rgba(124,58,237,0.5)'
      : '1px solid rgba(109,40,217,0.3)',
    btnPrimaryText: isDark ? '#ffffff' : '#ffffff',
    btnPrimaryGlow: isDark ? '0 0 25px rgba(124,58,237,0.4)' : '0 4px 20px rgba(109,40,217,0.2)',
    btnPrimaryHoverGlow: isDark ? '0 0 40px rgba(124,58,237,0.6), 0 0 80px rgba(34,211,238,0.2)' : '0 4px 30px rgba(109,40,217,0.35)',

    btnSecondaryBg: isDark
      ? 'rgba(124,58,237,0.1)'
      : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    btnSecondaryBorder: isDark
      ? '1px solid rgba(124,58,237,0.3)'
      : '1px solid rgba(124,58,237,0.3)',
    btnSecondaryText: isDark ? '#c084fc' : '#ffffff',
    btnSecondaryGlow: isDark ? '0 0 15px rgba(124,58,237,0.1)' : '0 4px 20px rgba(124,58,237,0.2)',

    // Google btn
    googleBtnBg: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
    googleBtnBorder: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
    googleBtnText: isDark ? '#E4E0FF' : '#374151',
    googleBtnHoverBg: isDark ? 'rgba(255,255,255,0.08)' : '#f9fafb',

    // Links
    linkColor: isDark ? '#8b7cf8' : '#6d28d9',
    linkHover: isDark ? '#c084fc' : '#4f46e5',

    // Errors
    errorColor: isDark ? '#fb7185' : '#ef4444',

    // Checkbox
    checkboxBorder: isDark ? 'border-slate-600' : 'border-slate-300',

    // Eye icon
    eyeColor: isDark ? '#6b5fa5' : '#94a3b8',

    // Divider line
    sectionDivider: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(109,40,217,0.08)',

    // Footer bottom
    footerBottomColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(109,40,217,0.25)',

    // Dots
    dotActive: isDark ? 'bg-cyan-400' : 'bg-violet-500',
    dotInactive: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(109,40,217,0.12)',

    // Theme toggle icon color
    themeToggleColor: isDark ? 'text-slate-500 hover:text-cyan-400' : 'text-slate-400 hover:text-violet-600',
    themeToggleBgHover: isDark ? 'hover:bg-white/5' : 'hover:bg-violet-50',

    // "Or" separator
    separatorColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(109,40,217,0.1)',
    separatorText: isDark ? '#6b5fa5' : '#94a3b8',
  }), [isDark]);
}

/* ═══════════════════════════════════════════════════
   LOGIN PAGE COMPONENT
   ═══════════════════════════════════════════════════ */
export function LoginPage({
  onLogin,
  currentTheme,
  onToggleTheme,
}: LoginPageProps) {
  const isDark = currentTheme === "dark";
  const t = useThemeColors(isDark);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false },
  });

  // Load remembered credentials
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("grooflow_remember_email");
    const rememberedPassword = localStorage.getItem("grooflow_remember_password");
    if (rememberedEmail) {
      setValue("email", rememberedEmail);
      setValue("remember", true);
    }
    if (rememberedPassword) {
      setValue("password", rememberedPassword);
    }
  }, [setValue]);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    if (data.remember) {
      localStorage.setItem("grooflow_remember_email", data.email);
      localStorage.setItem("grooflow_remember_password", data.password);
    } else {
      localStorage.removeItem("grooflow_remember_email");
      localStorage.removeItem("grooflow_remember_password");
    }
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      if (authData.session) {
        toast.success("ACCESO CONCEDIDO", {
          className: "bg-background border border-primary text-primary font-mono",
        });
        onLogin(data.email, authData.user?.user_metadata?.name);
      }
    } catch (error: any) {
      if ((data.email === "admin@grooflow.com" || data.email === "admin@vetflow.com") && data.password === "123456") {
        toast.success("ACCESO DEMO (OFFLINE)", {
          className: "bg-background border border-primary text-primary font-mono",
        });
        onLogin(data.email, "Admin Principal");
        return;
      }
      let errorMessage = error.message;
      if (errorMessage === "Invalid login credentials") {
        errorMessage = "Credenciales incorrectas. Intente nuevamente.";
      } else {
        console.error("Login error:", error);
        errorMessage = errorMessage || "Error al iniciar sesion";
      }
      toast.error(errorMessage, {
        className: "bg-background border border-destructive text-destructive font-mono",
      });
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info("RECUPERACION DE ACCESO", {
      description: "Para restablecer tu contraseña, contacta al Administrador del sistema. El podrá asignarte una nueva contraseña.",
      duration: 8000,
      icon: <LockKeyhole className="w-5 h-5" />,
      className: "bg-background border border-blue-500 text-blue-500 font-mono",
    });
  };

  /* ─── RENDER ─── */
  return (
    <div
      className="flex min-h-screen w-full overflow-hidden font-sans relative selection:bg-cyan-500/30 selection:text-cyan-300"
      style={{ background: t.pageBg, color: t.pageText, transition: 'background 500ms ease, color 500ms ease' }}
    >
      {/* ══════════════════════════════════════════════════
          ANIMATED BACKGROUND LAYERS
          ══════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%', width: '600px', height: '600px',
          background: `radial-gradient(circle, ${t.orbCyan} 0%, transparent 70%)`,
          borderRadius: '50%', filter: 'blur(60px)', animation: 'orb-drift 25s infinite ease-in-out alternate'
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-10%', width: '700px', height: '700px',
          background: `radial-gradient(circle, ${t.orbViolet} 0%, transparent 70%)`,
          borderRadius: '50%', filter: 'blur(80px)', animation: 'orb-drift 30s infinite ease-in-out alternate-reverse'
        }} />
      </div>

      {/* ══════════════════════════════════════════════════
          MAIN LAYOUT
          ══════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row w-full h-screen relative z-10">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            LEFT PANEL — SPLASH HERO
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div
          className="lg:w-[58%] relative flex flex-col justify-center items-center overflow-hidden"
          style={{ background: t.leftBg, transition: 'background 500ms ease' }}
        >
          {/* 3D Perspective Cyber Grid */}
          <div
            className={`absolute w-[200%] h-[200%] top-[-50%] left-[-50%] pointer-events-none ${isDark ? 'splash-grid' : 'splash-grid-light'}`}
            style={{ opacity: isDark ? 0.3 : 0.4, zIndex: 0 }}
          />

          {/* Vignette overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(circle at center, transparent 0%, ${t.vignetteColor} 80%)`,
            zIndex: 1
          }} />

          {/* Background — generative gradient (no external image needed) */}
          <motion.div
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            className="absolute inset-0 z-[1]"
          >
            <div className="absolute inset-0 z-10" style={{ background: t.imgOverlay1 }} />
            <div className="absolute inset-0 z-10" style={{ background: t.imgOverlay2 }} />
            {/* Generative financial chart background */}
            <div className="absolute inset-0" style={{
              background: isDark
                ? 'linear-gradient(135deg, #0d0a1f 0%, #130d2e 30%, #1a0a35 60%, #0a1525 100%)'
                : 'linear-gradient(135deg, #ede9ff 0%, #ddd6fe 30%, #c4b5fd 60%, #e0f2fe 100%)',
            }}>
              {/* Decorative SVG chart lines */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="chartGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={isDark ? '#22d3ee' : '#7c3aed'} stopOpacity="0" />
                    <stop offset="30%" stopColor={isDark ? '#22d3ee' : '#7c3aed'} stopOpacity={isDark ? 0.6 : 0.4} />
                    <stop offset="70%" stopColor={isDark ? '#a855f7' : '#4f46e5'} stopOpacity={isDark ? 0.6 : 0.4} />
                    <stop offset="100%" stopColor={isDark ? '#a855f7' : '#4f46e5'} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="chartGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={isDark ? '#34d399' : '#059669'} stopOpacity="0" />
                    <stop offset="50%" stopColor={isDark ? '#34d399' : '#059669'} stopOpacity={isDark ? 0.4 : 0.3} />
                    <stop offset="100%" stopColor={isDark ? '#34d399' : '#059669'} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isDark ? '#22d3ee' : '#7c3aed'} stopOpacity={isDark ? 0.15 : 0.1} />
                    <stop offset="100%" stopColor={isDark ? '#22d3ee' : '#7c3aed'} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Horizontal grid lines */}
                {[100, 200, 300, 400, 500].map(y => (
                  <line key={y} x1="0" y1={y} x2="800" y2={y} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(109,40,217,0.06)'} strokeWidth="1" />
                ))}
                {/* Vertical grid lines */}
                {[100, 200, 300, 400, 500, 600, 700].map(x => (
                  <line key={x} x1={x} y1="0" x2={x} y2="600" stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(109,40,217,0.05)'} strokeWidth="1" />
                ))}
                {/* Area fill under main chart */}
                <path d="M 0 450 L 80 420 L 160 390 L 240 360 L 320 330 L 400 280 L 480 240 L 560 200 L 640 180 L 720 160 L 800 140 L 800 600 L 0 600 Z" fill="url(#areaGrad)" />
                {/* Main uptrend line */}
                <polyline
                  points="0,450 80,420 160,390 240,360 320,330 400,280 480,240 560,200 640,180 720,160 800,140"
                  fill="none" stroke="url(#chartGrad1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                />
                {/* Secondary line */}
                <polyline
                  points="0,500 100,490 200,470 300,440 400,420 500,380 600,350 700,320 800,300"
                  fill="none" stroke="url(#chartGrad2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="6 4"
                />
                {/* EKG pulse line */}
                <polyline
                  points="50,300 120,300 150,220 180,380 210,300 280,300 310,260 340,340 370,300 450,300 480,250 510,350 540,300 620,300"
                  fill="none" stroke={isDark ? 'rgba(34,211,238,0.35)' : 'rgba(109,40,217,0.25)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
                {/* Data point dots */}
                {[[80,420],[240,360],[400,280],[560,200],[720,160]].map(([x,y],i) => (
                  <circle key={i} cx={x} cy={y} r="4" fill={isDark ? '#22d3ee' : '#7c3aed'} opacity={isDark ? 0.7 : 0.5} />
                ))}
                {/* Currency symbols */}
                <text x="60" y="80" fontSize="48" fill={isDark ? 'rgba(34,211,238,0.06)' : 'rgba(109,40,217,0.06)'} fontFamily="monospace">S/</text>
                <text x="600" y="120" fontSize="36" fill={isDark ? 'rgba(168,85,247,0.06)' : 'rgba(79,70,229,0.06)'} fontFamily="monospace">$</text>
                <text x="350" y="520" fontSize="28" fill={isDark ? 'rgba(52,211,153,0.07)' : 'rgba(5,150,105,0.07)'} fontFamily="monospace">USD</text>
              </svg>
            </div>
          </motion.div>

          {/* ─── SPLASH CONTENT ─── */}
          <div className="relative z-30 flex flex-col items-center justify-center p-10 splash-entrance">

            {/* Animated SVG Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="w-36 h-36 md:w-48 md:h-48 lg:w-56 lg:h-56 mb-6 relative splash-heartbeat"
            >
              <GrooFlowLogo isDark={isDark} />
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="text-center relative"
            >
              <h1
                className="tracking-tighter mb-2 select-none"
                style={{
                  fontSize: 'clamp(4.5rem, 9vw, 7rem)',
                  fontFamily: "'Outfit', 'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  lineHeight: 0.9,
                  letterSpacing: '-0.04em',
                }}
              >
                <span style={{ color: t.titleColor, textShadow: t.titleGlow }}>Groo</span>
                <span className="splash-gradient-flow">Flow</span>
              </h1>

              {/* Gradient divider */}
              <div className="h-px w-full my-4" style={{ background: t.dividerBg, opacity: 0.5 }} />

              {/* Subtitle */}
              <p className="mb-6" style={{
                fontSize: '1.05rem', color: t.subtitleColor,
                fontWeight: 300, letterSpacing: '0.03em', maxWidth: '420px'
              }}>
                Sistema Financiero Veterinario de{" "}
                <span style={{ color: t.subtitleAccent, fontWeight: 600 }}>Nueva Generacion</span>
              </p>

              {/* ── PREMIUM FEATURE PILLS ── */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap justify-center gap-2.5 mb-8"
              >
                {FEATURES.map((feat, i) => {
                  const Icon = feat.icon;
                  const color = isDark ? feat.color : feat.lightColor;
                  return (
                    <motion.div
                      key={feat.label}
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 1.0 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ scale: 1.06, y: -2 }}
                      className={`splash-pill-shimmer flex items-center gap-2 px-4 py-2 rounded-full cursor-default`}
                      style={{
                        background: isDark
                          ? `rgba(255,255,255,0.03)`
                          : `rgba(255,255,255,0.75)`,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: `1px solid ${isDark ? `${color}30` : `${color}25`}`,
                        boxShadow: isDark
                          ? `0 0 12px ${color}15, inset 0 1px 0 rgba(255,255,255,0.04)`
                          : `0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)`,
                        transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      <Icon
                        className="w-3.5 h-3.5"
                        style={{
                          color: color,
                          filter: isDark ? `drop-shadow(0 0 4px ${color}60)` : 'none',
                        }}
                      />
                      <span style={{
                        color: color,
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        letterSpacing: '0.02em',
                      }}>
                        {feat.label}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Status bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="flex items-center justify-center gap-3 text-xs tracking-[0.15em] uppercase"
                style={{ color: t.statusMuted, fontFamily: "'JetBrains Mono', monospace" }}
              >
                <div
                  className={`w-2 h-2 rounded-full ${t.statusDot} splash-status-organic`}
                  style={{ color: t.statusCyan }}
                />
                <span style={{ color: t.statusCyan }}>System Online</span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>v2.4.0</span>
              </motion.div>
            </motion.div>

            {/* Reflection effect */}
            <div className="splash-reflection mt-[-8px] pointer-events-none select-none" aria-hidden="true">
              <h1
                className="tracking-tighter"
                style={{
                  fontSize: 'clamp(4.5rem, 9vw, 7rem)',
                  fontFamily: "'Outfit', 'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  color: isDark ? 'white' : '#6d28d9',
                  filter: 'blur(3px)',
                  lineHeight: 0.9,
                }}
              >
                GrooFlow
              </h1>
            </div>
          </div>

          {/* Corner tech brackets with pulse */}
          <div className="absolute top-8 left-8 w-6 h-6 z-40 splash-bracket" style={{ borderTop: `2px solid ${t.bracketCyan}`, borderLeft: `2px solid ${t.bracketCyan}` }} />
          <div className="absolute bottom-8 left-8 w-6 h-6 z-40 splash-bracket" style={{ borderBottom: `2px solid ${t.bracketCyan}`, borderLeft: `2px solid ${t.bracketCyan}`, animationDelay: '1s' }} />
          <div className="absolute top-8 right-8 w-6 h-6 z-40 splash-bracket" style={{ borderTop: `2px solid ${t.bracketViolet}`, borderRight: `2px solid ${t.bracketViolet}`, animationDelay: '2s' }} />
          <div className="absolute bottom-8 right-8 w-6 h-6 z-40 splash-bracket" style={{ borderBottom: `2px solid ${t.bracketViolet}`, borderRight: `2px solid ${t.bracketViolet}`, animationDelay: '3s' }} />

          {/* Footer typewriter text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isDark ? 0.4 : 0.6 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-6 z-40 text-xs tracking-[0.2em]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <TypewriterText
              text="INICIALIZANDO CONEXION SEGURA..."
              delay={1800}
              speed={50}
              color={t.footerColor}
            />
          </motion.div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            RIGHT PANEL — LOGIN FORM
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div
          className="lg:w-[42%] relative flex flex-col justify-center p-8 lg:p-14 z-40 overflow-y-auto"
          style={{
            background: t.rightBg,
            borderLeft: t.rightBorder,
            boxShadow: t.rightShadow,
            transition: 'background 500ms ease, border-color 500ms ease, box-shadow 500ms ease',
          }}
        >
          {/* Cyber border left glow */}
          <div className="absolute left-0 inset-y-0 w-px" style={{ background: t.rightGlowLine }} />

          {/* Top right controls */}
          <div className="absolute top-6 right-6 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className={`${t.themeToggleColor} ${t.themeToggleBgHover} h-8 w-8`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${t.dotActive} animate-pulse`}
                style={{ boxShadow: isDark ? '0 0 6px rgba(34,211,238,0.8)' : '0 0 6px rgba(109,40,217,0.5)' }}
              />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.dotInactive }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.dotInactive }} />
            </div>
          </div>

          <div className="max-w-sm w-full mx-auto relative z-10 my-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Form header */}
              <div className="mb-8">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
                  style={{ background: t.badgeBg, border: t.badgeBorder }}
                >
                  <Activity className={`w-3 h-3 ${t.badgeIconColor}`} />
                  <span
                    className="text-xs uppercase tracking-[0.15em]"
                    style={{ color: t.badgeTextColor, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
                  >
                    ACCESO AL SISTEMA
                  </span>
                </div>
                <h2 className="text-3xl mb-2" style={{ color: t.headingColor, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                  Bienvenido
                </h2>
                <p className="text-sm" style={{ color: t.subHeadingColor }}>
                  Ingrese sus credenciales para continuar.
                </p>
              </div>

              {/* ─── LOGIN FORM ─── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5 group">
                    <Label className="text-xs uppercase tracking-[0.14em]" style={{ color: t.labelColor, fontWeight: 700 }}>
                      Email
                    </Label>
                    <Input
                      {...register("email")}
                      type="email"
                      placeholder="usuario@empresa.com"
                      className="h-12 pl-4 text-sm rounded-xl splash-input-focus"
                      style={{ background: t.inputBg, border: t.inputBorder, color: t.inputText }}
                    />
                    {errors.email && (
                      <p className="text-xs mt-1" style={{ color: t.errorColor, fontFamily: "'JetBrains Mono', monospace" }}>
                        &gt; {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5 group">
                    <Label className="text-xs uppercase tracking-[0.14em]" style={{ color: t.labelColor, fontWeight: 700 }}>
                      Contrasena
                    </Label>
                    <div className="relative">
                      <Input
                        {...register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="h-12 pl-4 pr-12 text-sm rounded-xl splash-input-focus"
                        style={{ background: t.inputBg, border: t.inputBorder, color: t.inputText }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: t.eyeColor }}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs mt-1" style={{ color: t.errorColor, fontFamily: "'JetBrains Mono', monospace" }}>
                        &gt; {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        onCheckedChange={(c) => setValue("remember", c === true)}
                        className={`w-4 h-4 rounded ${t.checkboxBorder} data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500`}
                      />
                      <label htmlFor="remember" className="text-xs" style={{ color: t.subHeadingColor }}>
                        Recordar acceso
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs transition-colors"
                      style={{ color: t.linkColor, fontWeight: 700 }}
                      onMouseEnter={e => (e.currentTarget.style.color = t.linkHover)}
                      onMouseLeave={e => (e.currentTarget.style.color = t.linkColor)}
                    >
                      Olvido su clave?
                    </button>
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 rounded-xl uppercase tracking-wider text-sm mt-2 relative overflow-hidden group/btn"
                    style={{
                      background: isLoading ? (isDark ? 'rgba(34,211,238,0.15)' : 'rgba(109,40,217,0.3)') : t.btnPrimaryBg,
                      border: t.btnPrimaryBorder,
                      color: t.btnPrimaryText,
                      boxShadow: isLoading ? 'none' : t.btnPrimaryGlow,
                      fontWeight: 700,
                      transition: 'all 300ms ease',
                    }}
                    onMouseEnter={e => {
                      if (!isLoading) e.currentTarget.style.boxShadow = t.btnPrimaryHoverGlow;
                    }}
                    onMouseLeave={e => {
                      if (!isLoading) e.currentTarget.style.boxShadow = t.btnPrimaryGlow;
                    }}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>Inicializando...</span>
                        </>
                      ) : (
                        <>
                          <span>Iniciar Sesion</span>
                          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </button>
                </form>
              </motion.div>

              {/* Access info note */}
              <div className="mt-6 p-3 rounded-lg text-center" style={{ background: t.badgeBg, border: t.badgeBorder }}>
                <p className="text-xs" style={{ color: t.subHeadingColor }}>
                  El acceso es gestionado por el{" "}
                  <span style={{ color: t.subtitleAccent, fontWeight: 600 }}>Administrador del sistema</span>.
                  <br />Contactelo si necesita sus credenciales.
                </p>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 text-center" style={{ borderTop: `1px solid ${t.sectionDivider}` }}>
                <p className="text-xs" style={{
                  color: t.footerBottomColor,
                  letterSpacing: '0.1em',
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  CONTROL FINANCIERO &middot;  &middot; GROOFLOW v2.4.0
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}