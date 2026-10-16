import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-[#050505] pt-14 sm:pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 sm:gap-12 mb-12 sm:mb-16">
          
          {/* Brand info */}
          <div className="sm:col-span-2 space-y-4 sm:space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                <Zap className="w-3.5 h-3.5 text-black" />
              </div>
              <span className="font-bold tracking-tight text-xl text-white">FastestHR</span>
            </div>
            <p className="text-zinc-400 font-light text-xs sm:text-sm max-w-sm leading-relaxed">
              The world's highest velocity HR operating system. Built for modern, scaling enterprises with sub-millisecond data synchronization.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>All 14 Global Regions Active</span>
            </div>
          </div>
          
          {/* Solutions Column */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-300">Solutions</h4>
            <nav className="flex flex-col space-y-2.5">
              <Link to="/solutions/startups" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors font-medium py-0.5">For Tech Startups</Link>
              <Link to="/vs/legacy-hrms" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors font-medium py-0.5">VS. Legacy Systems</Link>
              <Link to="/platform/core-engine" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">Enterprise Core</Link>
              <Link to="/register" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">Global Scaling</Link>
            </nav>
          </div>
          
          {/* Intelligence Hub Column */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-300">Intelligence Hub</h4>
            <nav className="flex flex-col space-y-2.5">
              <Link to="/blog" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">HR Glossary & Guides</Link>
              <Link to="/company/about" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">OS Architecture</Link>
              <Link to="/legal/security" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">Security Whitepaper</Link>
              <Link to="/platform/api-docs" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">Developer Portal</Link>
            </nav>
          </div>

          {/* Legal Column */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-300">Governance</h4>
            <nav className="flex flex-col space-y-2.5">
              <Link to="/legal/terms" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">Terms of Service</Link>
              <Link to="/legal/privacy" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">Privacy Shield</Link>
              <Link to="/company/changelog" className="text-zinc-400 hover:text-cyan-400 text-xs sm:text-sm transition-colors py-0.5">Release Changelog</Link>
              <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-wider">v4.2.9-stable</span>
            </nav>
          </div>
        </div>
        
        {/* Bottom Sub-bar */}
        <div className="border-t border-white/5 pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="text-xs text-zinc-500 font-mono">
            © {new Date().getFullYear()} FastestHR Inc. All packets cryptographically secured.
          </div>
          <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
            Engineered with <span className="text-rose-500 animate-pulse">❤️</span> for modern scaling teams
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-zinc-400 hover:text-white">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
            </div>
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-zinc-400 hover:text-white">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
