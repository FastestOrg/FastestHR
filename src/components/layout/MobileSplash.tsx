import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const STATUS_MESSAGES = [
  "Initializing Neural Engine...",
  "Syncing Workforce Data...",
  "Optimizing Smart Interface...",
  "Securing Cloud Session...",
  "Loading FastestHR Experience...",
];

interface MobileSplashProps {
  onTimeout?: () => void;
  isError?: boolean;
}

export const MobileSplash: React.FC<MobileSplashProps> = ({ onTimeout, isError }) => {
  const [statusIndex, setStatusIndex] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2000);

    // Timeout safeguard: 10 seconds
    const timeout = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onTimeout]);

  // Ensure we only show on mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  // If there's an error or it timed out, we might want to show a small retry hint or just fade out
  // For now, we'll keep showing the UI but add an error state if needed

  const containerVariants = {
    initial: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: shouldReduceMotion ? 0.3 : 0.8, ease: "easeInOut" } }
  };

  const logoVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { duration: shouldReduceMotion ? 0.5 : 1, ease: "easeOut" as const }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      exit="exit"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b] text-white overflow-hidden safe-area-padding"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] opacity-50" />
        <div className="absolute -top-[10%] -right-[10%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-xs px-6">
        {/* Animated Logo Container */}
        <motion.div
          variants={logoVariants}
          initial="initial"
          animate="animate"
          className="mb-12 relative"
        >
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
          <div className="relative flex flex-col items-center">
            <span className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-primary/50">
              FastestHR
            </span>
            {!shouldReduceMotion && (
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.5, duration: 1 }}
                className="h-1 bg-gradient-to-r from-transparent via-primary to-transparent mt-1"
              />
            )}
          </div>
        </motion.div>

        {/* Premium Spinner / Error State */}
        <div className="relative w-20 h-20 mb-8">
          {isError || timedOut ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-full flex items-center justify-center text-destructive"
            >
              <svg viewBox="0 0 24 24" className="w-12 h-12 fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </motion.div>
          ) : (
            <>
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="spinner-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="100%" stopColor="currentColor" />
                  </linearGradient>
                </defs>
                <circle
                  className="opacity-10"
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="url(#spinner-grad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="251.2"
                  animate={shouldReduceMotion ? {} : { rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  style={{ originX: "50px", originY: "50px" }}
                  className="text-primary"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              </div>
            </>
          )}
        </div>

        {/* Status Messages */}
        <div className="h-6 flex items-center justify-center overflow-hidden w-full">
          <AnimatePresence mode="wait">
            <motion.p
              key={isError || timedOut ? 'error' : statusIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className={`text-xs font-mono tracking-widest uppercase text-center ${isError || timedOut ? 'text-destructive' : 'text-white/50'}`}
            >
              {isError || timedOut ? "Connection Trouble..." : STATUS_MESSAGES[statusIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
        
        {(isError || timedOut) && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => window.location.reload()}
            className="mt-6 text-[10px] font-bold text-white/40 border border-white/10 px-4 py-2 rounded-full hover:bg-white/5 transition-colors"
          >
            RETRY CONNECTION
          </motion.button>
        )}
      </div>

      {/* Bottom Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-12 left-0 right-0 flex flex-col items-center"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="text-[10px] font-medium tracking-[0.3em] text-white/20 uppercase">
          Powered by Neural Core v2.0
        </span>
      </motion.div>
    </motion.div>
  );
};
