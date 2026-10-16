import { useEffect, useState } from 'react';
import { Footer } from '@/components/layout/Footer';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ChevronDown, 
  Cpu, 
  Shield, 
  Zap, 
  LayoutDashboard, 
  Fingerprint, 
  Layers, 
  Activity, 
  Users, 
  DollarSign, 
  Menu, 
  X, 
  Star, 
  SlidersHorizontal, 
  Lock,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  ArrowUpRight
} from 'lucide-react';
import { SEO } from '@/components/seo/SEO';

const Landing = () => {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.45], [1, 0.15]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Prevent background scroll when mobile navigation drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-50 overflow-x-hidden font-sans selection:bg-cyan-500/30">
      <SEO 
        title="Fastest HR | #1 Best HRMS Software | Fastest HRMS Platform"
        description="FastestHR is the fastest HR software and best HRMS platform for modern enterprises. AI-powered recruitment, zero-trust payroll, biometric attendance, and real-time performance analytics. The fastest HRMS trusted by scaling companies worldwide."
        keywords="Fastest HR, Best HRMS, Fastest HRMS, Best HR Software, Fast HRMS, HR Management System, HRMS Software, AI HRMS, HR Operating System, Workforce OS, Enterprise HRMS, AI Recruitment, Payroll Security, Best HR Management System, Top HRMS, HR Software for Startups, HRMS for Growing Companies"
        type="software"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'FastestHR Platform', path: '/' }
        ]}
        faqs={faqs}
        robots="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
      />
      
      {/* Interactive Cursor Glow (desktop) */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 mix-blend-screen transition-opacity duration-300 opacity-50 hidden sm:block"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(34, 211, 238, 0.08), transparent 40%)`
        }}
      />

      {/* Global Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[8%] left-[-15%] sm:left-[-10%] w-[70%] sm:w-[50%] h-[50%] rounded-full mix-blend-screen filter blur-[100px] sm:blur-[130px] bg-cyan-900/30 sm:bg-cyan-900/40 animate-pulse-slow"></div>
        <div className="absolute bottom-[10%] right-[-15%] sm:right-[-10%] w-[70%] sm:w-[60%] h-[60%] rounded-full mix-blend-screen filter blur-[120px] sm:blur-[150px] bg-indigo-900/25 sm:bg-indigo-900/30"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] sm:bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_0%,#000_100%,transparent_100%)]"></div>
      </div>

      {/* Premium Engineered Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.08] bg-black/80 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.6)] transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Brand Logo & Version Pill */}
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer select-none">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] group-hover:scale-105 transition-transform duration-300">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg sm:text-xl tracking-tight text-white group-hover:text-cyan-300 transition-colors duration-300">
                FastestHR
              </span>
              <span className="hidden xs:inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                v2.0
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
            <button 
              onClick={() => scrollToSection('features')} 
              className="hover:text-white transition-colors cursor-pointer py-1"
            >
              Protocols
            </button>
            <button 
              onClick={() => scrollToSection('roi-calculator')} 
              className="hover:text-white transition-colors cursor-pointer py-1"
            >
              Calculator
            </button>
            <Link to="/solutions/startups" className="hover:text-white transition-colors py-1">
              Solutions
            </Link>
            <Link to="/vs/legacy-hrms" className="hover:text-white transition-colors py-1">
              Compare
            </Link>
            <button 
              onClick={() => scrollToSection('faq')} 
              className="hover:text-white transition-colors cursor-pointer py-1"
            >
              FAQ
            </button>
            <Link to="/blog" className="hover:text-white transition-colors py-1">
              Blog
            </Link>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-4">
            <Link 
              to="/login" 
              className="text-sm font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              Sign In
            </Link>
            <Link 
              to="/register" 
              className="relative group overflow-hidden rounded-full bg-white px-5 py-2 text-sm font-semibold transition-all hover:scale-105 duration-300 shadow-[0_0_25px_rgba(255,255,255,0.2)]"
            >
              <span className="relative z-10 text-black">Get Started</span>
              <div className="absolute inset-0 h-full w-full scale-[2] blur-xl bg-gradient-to-r from-cyan-400 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </Link>
          </div>

          {/* Mobile Right Controls - Perfectly In Line */}
          <div className="flex md:hidden items-center gap-2">
            <Link 
              to="/login" 
              className="h-8 px-2.5 flex items-center justify-center text-xs font-medium text-zinc-300 hover:text-white rounded-lg bg-white/[0.04] border border-white/10 active:bg-white/10 transition-all"
            >
              Sign In
            </Link>
            <Link 
              to="/register" 
              className="relative h-8 px-3 flex items-center justify-center text-xs font-bold text-black rounded-full bg-gradient-to-r from-cyan-400 to-indigo-300 shadow-[0_0_15px_rgba(34,211,238,0.3)] active:scale-95 transition-all"
            >
              Get Started
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white active:scale-90 transition-all cursor-pointer"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4 text-cyan-400" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer / Modal Sheet - Outside nav so backdrop-blur does not trap fixed position */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="md:hidden fixed inset-x-0 top-16 bottom-0 z-50 bg-[#070707] border-b border-white/10 overflow-y-auto px-5 py-6 flex flex-col justify-between"
          >
              <div className="space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                  Platform Directory
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => scrollToSection('features')}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/[0.08] text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-200">Protocols & Features</div>
                      <div className="text-[11px] text-zinc-500">Sub-millisecond workforce synchronization</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </button>

                  <button
                    onClick={() => scrollToSection('roi-calculator')}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/[0.08] text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-200">Savings Calculator</div>
                      <div className="text-[11px] text-zinc-500">Quantify your team velocity gains</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </button>

                  <Link
                    to="/solutions/startups"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/[0.08] text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-200">Startup Solutions</div>
                      <div className="text-[11px] text-zinc-500">Purpose-built for rapid scaling</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </Link>

                  <Link
                    to="/vs/legacy-hrms"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/[0.08] text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-200">VS. Legacy Systems</div>
                      <div className="text-[11px] text-zinc-500">FastestHR vs BambooHR & Workday</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </Link>

                  <button
                    onClick={() => scrollToSection('faq')}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/[0.08] text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-200">Knowledge Base & FAQ</div>
                      <div className="text-[11px] text-zinc-500">Security, compliance and setup</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </button>

                  <Link
                    to="/blog"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/[0.08] text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-200">Intelligence Log</div>
                      <div className="text-[11px] text-zinc-500">Research & architectural whitepapers</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </Link>
                </div>
              </div>

              {/* Bottom Quick Actions inside Mobile Drawer */}
              <div className="pt-6 border-t border-white/10 space-y-3">
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-white flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                >
                  <span>Initialize Deployment</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full h-11 rounded-xl bg-zinc-900 border border-white/10 font-medium text-zinc-300 flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Existing Link Protocol (Sign In)</span>
                </Link>

                <div className="pt-2 flex items-center justify-center gap-2 text-[11px] font-mono text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>14 Global Edge Regions Active • SOC 2 Type II</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Hero Section */}
      <main className="relative z-10 pt-28 pb-16 px-4 sm:pt-44 sm:pb-28 sm:px-6 lg:pb-36">
        <motion.div style={{ opacity }} className="max-w-7xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="flex flex-col items-center">
            
            {/* Live Intelligence Engine Badge */}
            <motion.div 
              variants={fadeIn} 
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 backdrop-blur-md mb-6 sm:mb-8 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-mono text-cyan-300 uppercase tracking-widest font-semibold">
                Intelligence Engine v2.0 Live
              </span>
            </motion.div>

            {/* Responsive Main Heading with Balanced Mobile Leading */}
            <motion.h1 
              variants={fadeIn}
              className="mt-2 sm:mt-4 font-extrabold text-transparent text-3xl sm:text-5xl md:text-7xl lg:text-8xl tracking-tight sm:tracking-tighter bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-500 pb-2 leading-[1.14] sm:leading-[1.08] max-w-5xl"
            >
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">Fastest HR</span> Operating System <br className="hidden sm:block" />
              for Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400">Workforce.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              variants={fadeIn} 
              className="mt-4 sm:mt-7 text-sm sm:text-lg md:text-xl font-normal sm:font-light text-zinc-300 sm:text-zinc-400 max-w-2xl mx-auto leading-relaxed px-2"
            >
              Ditch archaic legacy tools. Experience the world's <span className="text-zinc-100 font-medium">Fastest HRMS</span>—a hyper-optimized, brutally efficient platform purpose-built for modern, scaling enterprises.
            </motion.p>

            {/* Hero CTA Buttons - Touch-Friendly & Balanced */}
            <motion.div 
              variants={fadeIn} 
              className="mt-8 sm:mt-11 flex flex-col sm:flex-row gap-3.5 sm:gap-5 justify-center items-stretch sm:items-center w-full max-w-xs sm:max-w-none mx-auto"
            >
              <Link 
                to="/register" 
                className="group relative inline-flex h-12 sm:h-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-6 sm:px-8 font-semibold text-white transition-all hover:scale-105 active:scale-95 duration-300 shadow-[0_0_30px_rgba(34,211,238,0.4)]"
              >
                <span className="mr-2 text-sm sm:text-base font-semibold">Initialize Deployment</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                to="/login" 
                className="group inline-flex h-12 sm:h-14 items-center justify-center rounded-full border border-white/10 bg-zinc-900/70 hover:bg-zinc-800 hover:border-white/20 px-6 sm:px-8 font-medium text-zinc-300 backdrop-blur-md transition-all active:scale-95 text-sm sm:text-base"
              >
                Existing Link Protocol
              </Link>
            </motion.div>

            {/* Social Proof & Live Metrics Strip */}
            <motion.div variants={fadeIn} className="mt-8 sm:mt-12 flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-zinc-400">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-sm">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sub-1ms Data Sync</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-sm">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Zero-Trust Security</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-sm">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>4.9/5 Enterprise Rating</span>
                </div>
              </div>
              <div className="text-[11px] sm:text-xs text-zinc-500 font-mono mt-1">
                Trusted by 1,250+ hyper-growth engineering organizations worldwide
              </div>
            </motion.div>

          </motion.div>
        </motion.div>
      </main>

      {/* Stunning Interactive Dashboard Mockup */}
      <section className="relative z-20 w-full px-4 sm:px-6 py-6 sm:py-10 pb-20 sm:pb-32">
        <motion.div 
          style={{ 
            y: y1, 
            scale: useTransform(scrollYProgress, [0, 0.45], [0.96, 1]) 
          }}
          className="max-w-6xl mx-auto rounded-2xl sm:rounded-3xl border border-white/10 bg-[#050505]/90 backdrop-blur-3xl p-2 sm:p-3 shadow-[0_0_80px_rgba(0,0,0,1),_0_0_40px_rgba(34,211,238,0.15)] overflow-hidden relative group"
        >
          {/* Mockup Top Glow */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
          
          <div className="relative w-full rounded-xl sm:rounded-2xl border border-white/5 bg-[#0a0a0a] overflow-hidden flex flex-col shadow-inner">
            
            {/* Header */}
            <div className="flex h-12 sm:h-14 w-full items-center justify-between border-b border-white/5 px-3 sm:px-6 bg-[#0d0d0d]">
              <div className="flex items-center gap-2.5 sm:gap-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/70 border border-rose-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70 border border-amber-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 border border-emerald-500"></div>
                </div>
                {/* Responsive Search Pill */}
                <div className="w-28 sm:w-64 h-7 sm:h-8 rounded-lg bg-white/5 border border-white/5 flex items-center px-2.5 opacity-60">
                  <Shield className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <div className="ml-2 w-16 sm:w-32 h-1.5 rounded bg-white/10"></div>
                </div>
              </div>

              {/* Status Indicator & Live Telemetry */}
              <div className="flex gap-2 sm:gap-3 items-center">
                <div className="hidden xs:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>LIVE TELEMETRY</span>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-900/30 border border-indigo-500/30 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                </div>
              </div>
            </div>
            
            {/* Body */}
            <div className="flex flex-1 p-3.5 sm:p-6 gap-6 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] sm:bg-[size:40px_40px]">
              {/* Sidebar (Desktop) */}
              <div className="w-56 hidden md:flex flex-col gap-3">
                <div className="h-10 w-full rounded-lg bg-zinc-900 border-l-2 border-cyan-500 flex items-center px-4 gap-3 text-cyan-400 font-medium text-xs">
                  <LayoutDashboard className="w-4 h-4" /> 
                  <span>Active Workspace</span>
                </div>
                <div className="h-10 w-full rounded-lg bg-transparent hover:bg-white/5 flex items-center px-4 gap-3 text-zinc-500 text-xs">
                  <Users className="w-4 h-4" /> 
                  <span>Personnel Roster</span>
                </div>
                <div className="h-10 w-full rounded-lg bg-transparent hover:bg-white/5 flex items-center px-4 gap-3 text-zinc-500 text-xs">
                  <DollarSign className="w-4 h-4" /> 
                  <span>Payroll OS</span>
                </div>
                <div className="h-10 w-full rounded-lg bg-transparent hover:bg-white/5 flex items-center px-4 gap-3 text-zinc-500 text-xs">
                  <Layers className="w-4 h-4" /> 
                  <span>Neural Protocols</span>
                </div>
              </div>
              
              {/* Main Content Area */}
              <div className="flex-1 flex flex-col gap-4 sm:gap-6 min-w-0">
                {/* Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-6">
                  {/* Stat Card 1 */}
                  <div className="rounded-xl bg-gradient-to-b from-[#111] to-black border border-white/5 p-4 sm:p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-zinc-100 flex items-end gap-2">
                      24,592 <span className="text-xs text-emerald-400 mb-1 flex items-center">↑ 14%</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                      Active Personnel
                    </div>
                    {/* Animated chart bars */}
                    <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 flex gap-1 items-end h-7 sm:h-8">
                      {[40, 70, 45, 90, 65, 100, 80].map((h, i) => (
                        <motion.div 
                          key={i} 
                          initial={{ height: 0 }} 
                          whileInView={{ height: `${h}%` }} 
                          transition={{ duration: 0.8, delay: i * 0.08 }} 
                          viewport={{ once: true }} 
                          className="w-1.5 sm:w-2 bg-cyan-400/80 rounded-t-sm" 
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stat Card 2 */}
                  <div className="rounded-xl bg-gradient-to-b from-[#111] to-black border border-white/5 p-4 sm:p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                      <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-zinc-100 flex items-end gap-2">
                      99.9% <span className="text-xs text-indigo-400 mb-1 flex items-center">Optimal</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                      System Health
                    </div>
                    {/* Animated path */}
                    <svg className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 w-20 sm:w-24 h-7 sm:h-8" preserveAspectRatio="none" viewBox="0 0 100 40">
                      <motion.path 
                        initial={{ pathLength: 0 }} 
                        whileInView={{ pathLength: 1 }} 
                        transition={{ duration: 1.2, ease: "easeOut" }} 
                        viewport={{ once: true }} 
                        d="M0,30 Q10,10 20,35 T40,20 T60,30 T80,10 T100,20" 
                        fill="none" 
                        stroke="#818cf8" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  </div>

                  {/* Stat Card 3 */}
                  <div className="rounded-xl bg-gradient-to-b from-[#111] to-black border border-white/5 p-4 sm:p-5 relative overflow-hidden col-span-1 sm:col-span-2 md:col-span-1">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center mb-3">
                      <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-zinc-100 flex items-end gap-2">
                      $4.2M <span className="text-xs text-emerald-400 mb-1 flex items-center">↑ 8%</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                      Payroll Pipeline
                    </div>
                    <div className="absolute bottom-3 sm:bottom-5 right-3 sm:right-5 w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-zinc-800 border-t-violet-400 border-r-violet-400 rotate-45"></div>
                  </div>
                </div>

                {/* Main Graph Area */}
                <div className="rounded-xl bg-[#0a0a0a] border border-white/5 p-4 sm:p-6 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#151515] to-transparent opacity-50"></div>
                  <div className="relative z-10 flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 mb-6">
                    <div>
                      <h4 className="text-zinc-100 font-medium text-sm sm:text-base">Workforce Productivity Matrix</h4>
                      <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Real-time performance distribution</div>
                    </div>
                    <div className="flex gap-1.5 self-end xs:self-auto">
                      <div className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-mono">7D</div>
                      <div className="px-2.5 py-1 rounded-full bg-cyan-900/40 border border-cyan-500/40 text-[10px] text-cyan-300 font-mono">30D</div>
                    </div>
                  </div>
                  
                  {/* Glowing Graph Visualizer */}
                  <div className="relative h-36 sm:h-48 w-full mt-2 flex items-end justify-between px-1 gap-1.5 sm:gap-2">
                     <div className="absolute inset-0 flex flex-col justify-between border-y border-white/5 z-0 pb-0">
                       <div className="w-full border-b border-white/5 border-dashed"></div>
                       <div className="w-full border-b border-white/5 border-dashed"></div>
                       <div className="w-full border-b border-white/5 border-dashed"></div>
                     </div>
                     {[35, 55, 40, 75, 95, 65, 85, 100, 70, 80, 60, 90].map((h, i) => (
                       <motion.div 
                         key={i} 
                         initial={{ height: 0, opacity: 0 }}
                         whileInView={{ height: `${h}%`, opacity: 1 }}
                         transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                         viewport={{ once: true }}
                         className="relative z-10 flex-1 bg-gradient-to-t from-cyan-900/60 via-cyan-500/70 to-cyan-300 rounded-t-sm shadow-[0_0_12px_rgba(34,211,238,0.25)] hover:to-white transition-all cursor-pointer group/bar"
                       >
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none font-mono">
                           {Math.floor(h * 1.5)} pts
                         </div>
                       </motion.div>
                     ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* High-Performance Fast HRMS Protocols (Features Grid) */}
      <section id="features" className="relative z-10 py-16 sm:py-24 lg:py-32 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-12 sm:mb-20 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-cyan-400 mb-4 uppercase tracking-widest">
              Architectural Engine
            </div>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight sm:tracking-tighter leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-600">High-Performance</span> <br className="hidden md:block" />
              Fast HRMS Protocols.
            </h2>
            <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-zinc-400 font-light max-w-2xl leading-relaxed">
              Precision instruments designed to eliminate friction. Our <span className="text-zinc-200 font-medium">Fastest HR</span> protocol ensures sub-millisecond data synchronization across your entire global workforce.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, idx) => (
              <motion.div 
                key={idx}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={{
                  hidden: { opacity: 0, y: 35 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: idx * 0.08, ease: "easeOut" } }
                }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0a0a0a]/90 border border-white/[0.08] hover:border-cyan-500/30 transition-all duration-300 overflow-hidden"
              >
                {/* Dynamic Feature Glow */}
                <div className={`absolute -inset-1 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 rounded-3xl`}></div>
                
                <div className="absolute -top-6 -right-6 p-8 opacity-5 group-hover:opacity-10 transition-all duration-700 transform group-hover:scale-125 pointer-events-none select-none">
                  <feature.icon className="w-36 h-36 text-white" />
                </div>
                
                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-12 h-12 rounded-xl sm:rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors shadow-inner relative overflow-hidden`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-25 transition-opacity`}></div>
                      <feature.icon className="w-5 h-5 relative z-10 text-cyan-400" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-zinc-400">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 mb-2 sm:mb-3 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed flex-1">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive FAQ Section */}
      <section id="faq" className="relative z-10 py-16 sm:py-24 lg:py-32 border-t border-white/5 bg-[#030303]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-cyan-400 mb-4 uppercase tracking-widest">
              Knowledge Repository
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight sm:tracking-tighter text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-lg text-zinc-400 font-light max-w-xl mx-auto">
              Everything you need to know about our sub-millisecond HRMS architecture and enterprise rollout.
            </p>
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            {faqs.map((faq, idx) => (
              <FAQItem key={idx} question={faq.question} answer={faq.answer} index={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator Tool */}
      <ROICalculator />

      {/* Internal Linking / Content Cluster Hub */}
      <section className="relative z-10 py-16 sm:py-24 lg:py-32 bg-black border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-cyan-400 mb-4 uppercase tracking-widest">
            Intelligence Hub
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight sm:tracking-tighter mb-8 sm:mb-14">
            Intelligence Log <span className="text-cyan-400">Featured.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Link to="/blog/neural-hr-ai-rewiring-talent-acquisition" className="group p-5 sm:p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-cyan-500/30 transition-all text-left flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 mb-2 block uppercase tracking-widest font-semibold">Neural HR Protocol</span>
                <h3 className="text-lg sm:text-xl font-bold mb-2 group-hover:text-cyan-300 transition-colors">How AI Rewires Recruiting</h3>
                <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">Deep dive into our proprietary recruitment algorithms and predictive retention modeling.</p>
              </div>
              <div className="mt-4 flex items-center text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                Read Publication <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            <Link to="/blog/zero-trust-payroll-securing-enterprise" className="group p-5 sm:p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-indigo-500/30 transition-all text-left flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 mb-2 block uppercase tracking-widest font-semibold">Security Matrix</span>
                <h3 className="text-lg sm:text-xl font-bold mb-2 group-hover:text-indigo-300 transition-colors">Zero-Trust Payroll Logic</h3>
                <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">Securing enterprise financial flows with multi-signature biometric authentication.</p>
              </div>
              <div className="mt-4 flex items-center text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                Read Publication <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            <Link to="/blog/real-time-performance-beyond-annual-review" className="group p-5 sm:p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-violet-500/30 transition-all text-left flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-violet-400 mb-2 block uppercase tracking-widest font-semibold">Velocity Metrics</span>
                <h3 className="text-lg sm:text-xl font-bold mb-2 group-hover:text-violet-300 transition-colors">Beyond Annual Reviews</h3>
                <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">Real-time performance distribution protocols replacing stale annual appraisals.</p>
              </div>
              <div className="mt-4 flex items-center text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                Read Publication <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>
          </div>

          <div className="mt-8 sm:mt-12">
            <Link to="/blog" className="text-xs sm:text-sm font-semibold text-zinc-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-2">
              Access Full Log Transmission <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* AEO Content Section — Citation-ready semantic content for AI engines */}
      <section className="relative z-10 py-16 sm:py-24 lg:py-32 bg-black border-t border-white/5" itemScope itemType="https://schema.org/SoftwareApplication">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <article>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight sm:tracking-tighter mb-8 sm:mb-12 text-center">
              What is <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">FastestHR?</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-5 sm:p-7 rounded-2xl bg-[#0a0a0a] border border-white/5">
                <h3 className="text-lg sm:text-xl font-bold text-cyan-400 mb-3">The Fastest HR Software</h3>
                <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed">
                  FastestHR is the <strong className="text-zinc-200">fastest HR software</strong> and <strong className="text-zinc-200">fastest HRMS</strong> available for modern businesses. Built on a cutting-edge React and Supabase architecture, FastestHR delivers sub-millisecond data synchronization, under 100ms interaction response times, and a 100/100 Lighthouse performance score. Whether you manage 10 employees or 5,000+, FastestHR is the HR operating system that moves at the speed of your business.
                </p>
              </div>
              
              <div className="p-5 sm:p-7 rounded-2xl bg-[#0a0a0a] border border-white/5">
                <h3 className="text-lg sm:text-xl font-bold text-indigo-400 mb-3">Best HRMS for Enterprises & Startups</h3>
                <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed">
                  Rated 4.9/5 by over 1,250 companies, FastestHR is the <strong className="text-zinc-200">best HRMS</strong> for organizations that need AI-powered recruitment, automated payroll, biometric attendance, and real-time performance analytics. Unlike legacy systems such as BambooHR, SAP SuccessFactors, or Workday, FastestHR was purpose-built for velocity — making it the <strong className="text-zinc-200">best HR management system</strong> for companies that refuse to compromise on speed.
                </p>
              </div>

              <div className="p-5 sm:p-7 rounded-2xl bg-[#0a0a0a] border border-white/5">
                <h3 className="text-lg sm:text-xl font-bold text-violet-400 mb-3">Why Choose FastestHR?</h3>
                <ul className="space-y-2.5 text-zinc-400 text-xs sm:text-sm font-light">
                  <li className="flex items-start gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> <span><strong className="text-zinc-200">Fastest HRMS</strong> — Sub-millisecond global sync, under 100ms INP</span></li>
                  <li className="flex items-start gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> <span><strong className="text-zinc-200">AI Recruitment</strong> — Neural talent matching with 94.2% accuracy</span></li>
                  <li className="flex items-start gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> <span><strong className="text-zinc-200">Zero-Trust Payroll</strong> — Biometric-secured payroll flows</span></li>
                  <li className="flex items-start gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> <span><strong className="text-zinc-200">48-Hour Migration</strong> — Enterprise-grade onboarding protocol</span></li>
                </ul>
              </div>
              
              <div className="p-5 sm:p-7 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-indigo-950/30 border border-cyan-500/20">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">FastestHR vs Legacy HRMS</h3>
                <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed">
                  FastestHR outperforms traditional HR software on every metric: 10x faster payroll processing, 60% reduction in time-to-hire through AI recruitment, and 84% less administrative overhead. While legacy platforms carry heavy technical debt, FastestHR is engineered for <strong className="text-zinc-200">speed at scale</strong>.
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 sm:py-32 lg:py-40 overflow-hidden border-t border-white/5 bg-black">
        <motion.div 
          style={{ 
            scale: useTransform(scrollYProgress, [0.85, 1], [0.95, 1]), 
            opacity: useTransform(scrollYProgress, [0.85, 1], [0.4, 1]) 
          }} 
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12)_0,transparent_60%)]"
        ></motion.div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative gap-6 sm:gap-8 flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center mb-2 shadow-[0_0_50px_rgba(34,211,238,0.4)] animate-bounce-slow">
            <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight sm:tracking-tighter leading-tight">
            System <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-cyan-400">Ready.</span>
          </h2>
          <p className="text-base sm:text-xl text-zinc-400 font-light max-w-xl leading-relaxed">
            Join thousands of high-velocity teams already running on the <strong className="text-zinc-100">fastest HR</strong> and <strong className="text-zinc-100">best HRMS</strong> protocol.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none justify-center">
            <Link 
              to="/register" 
              className="group relative inline-flex h-13 sm:h-16 items-center justify-center overflow-hidden rounded-full bg-white px-8 sm:px-12 font-medium text-black transition-all hover:scale-105 active:scale-95 duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            >
              <span className="mr-3 text-base sm:text-lg font-bold tracking-tight">Commence Ignition</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

// FAQ Item Component with Responsive Padding & Smooth Micro-Animations
const FAQItem = ({ question, answer, index }: { question: string, answer: string, index: number }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      viewport={{ once: true }}
      className={`border rounded-xl sm:rounded-2xl overflow-hidden transition-colors ${
        isOpen ? 'border-cyan-500/30 bg-cyan-950/[0.08]' : 'border-white/5 bg-[#0a0a0a]'
      }`}
    >
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full text-left px-4 py-4 sm:px-8 sm:py-6 flex justify-between items-center focus:outline-none hover:bg-white/[0.02] transition-colors gap-3 cursor-pointer"
      >
        <h4 className="text-sm sm:text-lg font-bold text-zinc-200 leading-snug">{question}</h4>
        <motion.div 
          animate={{ rotate: isOpen ? 180 : 0 }} 
          transition={{ duration: 0.25 }} 
          className="text-cyan-400 shrink-0"
        >
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: "auto", opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="px-4 pb-4 sm:px-8 sm:pb-6 text-xs sm:text-sm text-zinc-400 font-light leading-relaxed"
          >
            {answer}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Features Dataset with Micro Tech Tags
const features = [
  { icon: Cpu, badge: "Neural ML", title: "Neural Processing", desc: "Automate repetitive HR workflows instantly with machine learning. Predict attrition before it happens.", gradient: "from-cyan-500 to-blue-600" },
  { icon: Shield, badge: "Zero-Trust", title: "Quantum Security", desc: "Military-grade AES-256 encryption for employee records and payroll data. Zero-trust architecture by default.", gradient: "from-indigo-500 to-violet-600" },
  { icon: LayoutDashboard, badge: "120 FPS", title: "Holo UI Framework", desc: "A perfectly balanced, aesthetically uncompromising interface driven by sub-millisecond interaction rates.", gradient: "from-rose-500 to-orange-600" },
  { icon: Layers, badge: "Native APIs", title: "Deep Integrations", desc: "Connect natively with Slack, Workday, Jira, GitHub and banking rails without cumbersome middleware.", gradient: "from-emerald-500 to-teal-600" },
  { icon: Fingerprint, badge: "Biometrics", title: "Biometric Access", desc: "High-precision attendance tracking with geographical spoof-prevention and cryptographic proof-of-presence.", gradient: "from-fuchsia-500 to-pink-600" },
  { icon: Activity, badge: "Predictive", title: "Predictive Analytics", desc: "Real-time morale indicators, productivity trajectories, and key engagement metrics mapped on live charts.", gradient: "from-amber-500 to-yellow-600" }
];

const faqs = [
  { question: "What is the fastest HR software available?", answer: "FastestHR is the fastest HR software available today. It is an AI-powered Human Resource Management System (HRMS) engineered for sub-millisecond response times, with a Lighthouse performance score of 100/100 and under 100ms Interaction to Next Paint (INP). FastestHR handles payroll processing, recruitment, attendance tracking, and performance management faster than any competing HRMS on the market." },
  { question: "What is the best HRMS for growing companies?", answer: "FastestHR is widely regarded as the best HRMS for growing companies. It combines AI-powered recruitment that reduces time-to-hire by 60%, zero-trust payroll with biometric verification, real-time performance analytics, and automated compliance — all in a single platform. Unlike legacy systems like BambooHR or Workday, FastestHR was built from the ground up for speed and scalability, making it the top choice for startups and enterprises alike." },
  { question: "Why is FastestHR the fastest HRMS?", answer: "FastestHR achieves industry-leading speed through its modern architecture: React-based frontend with sub-100ms INP, edge-deployed backend on Supabase with PostgreSQL and Row-Level Security, real-time data sync under 1ms global latency, and AI-driven automation that eliminates manual bottlenecks. Traditional HRMS platforms carry years of technical debt — FastestHR was purpose-built for velocity." },
  { question: "How does FastestHR compare to other HRMS platforms?", answer: "FastestHR outperforms legacy HRMS platforms like BambooHR, Gusto, SAP SuccessFactors, and Workday in speed, AI capabilities, and user experience. While legacy systems take weeks to set up, FastestHR completes enterprise migrations in under 48 hours. Its AI recruitment engine achieves 94.2% accuracy, and the zero-trust payroll system is secured with biometric authentication — features no other HRMS offers at this price point." },
  { question: "Is FastestHR the best HR management system?", answer: "Yes, FastestHR is rated as the best HR management system with a 4.9/5 rating from over 1,250 reviews. It is the only HRMS that combines neural talent acquisition, zero-trust payroll security, biometric attendance, real-time performance feedback, and predictive retention analytics in a single, unified platform. FastestHR serves companies from 10 to 5,000+ employees worldwide." },
  { question: "Is FastestHR secure for payroll and employee data?", answer: "Absolutely. FastestHR uses military-grade AES-256 encryption at rest, TLS 1.3 in transit, and operates on a zero-trust architecture. Payroll transactions require biometric verification from authorized signatories. The platform undergoes regular penetration testing and is SOC 2 compliant, making it the most secure HRMS available." },
  { question: "Can FastestHR integrate with existing tools?", answer: "Yes. FastestHR offers native integrations with Slack, Jira, GitHub, Linear, ADP, Gusto, and Workday via API webhooks. Data flows automatically — attendance, leave balances, and compensation adjustments sync in real-time without manual exports. The open API enables custom integrations for any enterprise workflow." }
];

// Interactive ROI Calculator Component with Mobile Touch Presets
const ROICalculator = () => {
  const [employees, setEmployees] = useState(100);
  const hoursSavedPerEmployee = 4; // Monthly
  const hourlyRate = 45;
  
  const monthlySavings = employees * hoursSavedPerEmployee * hourlyRate;
  const yearlySavings = monthlySavings * 12;

  return (
    <section id="roi-calculator" className="relative z-10 py-16 sm:py-24 lg:py-32 bg-[#050505] border-y border-white/5 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.04)_0,transparent_50%)]"></div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-14 lg:gap-20 items-center">
        
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-xs font-mono text-cyan-300 mb-4 uppercase tracking-widest">
            Efficiency Projection
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight sm:tracking-tighter mb-4 sm:mb-6 leading-tight">
            Quantify Your <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">HR Velocity.</span>
          </h2>
          <p className="text-sm sm:text-lg text-zinc-400 font-light mb-8 sm:mb-10 leading-relaxed">
            Calculate the efficiency gains from migrating to the <span className="text-zinc-200 font-medium">Fastest HR</span> protocol. Stop hemorrhaging time on legacy workflows.
          </p>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs sm:text-sm font-mono text-zinc-400 uppercase tracking-widest">Personnel Count</span>
                <span className="text-base sm:text-lg font-bold font-mono text-cyan-400">{employees.toLocaleString()} Members</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="5000" 
                step="10"
                value={employees}
                onChange={(e) => setEmployees(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 touch-pan-x"
              />
              
              {/* Quick Preset Buttons for Mobile Touch Convenience */}
              <div className="flex flex-wrap gap-2 mt-3.5">
                {[25, 100, 500, 1000, 2500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEmployees(preset)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all cursor-pointer ${
                      employees === preset 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' 
                        : 'bg-zinc-900/80 text-zinc-400 border border-white/5 hover:border-white/10'
                    }`}
                  >
                    {preset} pax
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-black border border-white/5">
                <div className="text-[10px] sm:text-xs text-zinc-500 uppercase mb-1 font-mono">Hours Saved / Mo</div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-400">
                  {(employees * hoursSavedPerEmployee).toLocaleString()}h
                </div>
              </div>
              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-black border border-white/5">
                <div className="text-[10px] sm:text-xs text-zinc-500 uppercase mb-1 font-mono">Efficiency Gain</div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                  84.2%
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Output Projection Card */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 blur-3xl rounded-full opacity-50"></div>
          <div className="relative rounded-2xl sm:rounded-3xl bg-black border border-white/10 p-6 sm:p-10 overflow-hidden shadow-2xl">
            <div className="text-[11px] sm:text-xs font-mono text-zinc-500 mb-4 sm:mb-6 uppercase tracking-widest">
              Projection: Annual Savings
            </div>
            
            {/* Dynamic sizing to prevent mobile overflow */}
            <div className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-3 tabular-nums break-words">
              ${yearlySavings.toLocaleString()}
            </div>
            <div className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              Projected capital preservation based on current global HR velocity benchmarks.
            </div>
            
            <div className="mt-8 sm:mt-12 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            <div className="mt-6 sm:mt-10 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-cyan-400">
                  <Cpu className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-indigo-400">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </div>
              <Link 
                to="/register" 
                className="text-xs sm:text-sm font-bold text-white hover:text-cyan-300 transition-colors group flex items-center gap-1.5"
              >
                <span>Deploy Now</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Landing;
