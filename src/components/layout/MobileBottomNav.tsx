import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  CalendarCheck,
  Menu,
} from 'lucide-react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { useSidebar } from '@/components/ui/sidebar';

interface NavItem {
  icon: React.ElementType;
  label: string;
  route: string;
  matchRoutes?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    route: '/dashboard',
  },
  {
    icon: Clock,
    label: 'Attendance',
    route: '/attendance',
  },
  {
    icon: CalendarDays,
    label: 'Leave',
    route: '/leave',
    matchRoutes: ['/leave', '/leave/apply'],
  },
  {
    icon: CalendarCheck,
    label: 'Tasks',
    route: '/tasks',
  },
  {
    icon: Menu,
    label: 'More',
    route: '__more__',
  },
];

function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(8);
  }
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { direction, isAtTop, scrollY } = useScrollDirection();
  const { toggleSidebar } = useSidebar();

  const isHidden = direction === 'down' && !isAtTop && scrollY > 80;

  const isActive = (item: NavItem) => {
    if (item.route === '__more__') return false;
    const routes = item.matchRoutes || [item.route];
    return routes.some((r) => location.pathname.startsWith(r));
  };

  const handleTap = (item: NavItem) => {
    triggerHaptic();
    if (item.route === '__more__') {
      toggleSidebar();
    } else {
      navigate(item.route);
    }
  };

  return (
    <motion.nav
      initial={false}
      animate={{
        y: isHidden ? 100 : 0,
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 35,
      }}
      className="mobile-bottom-nav"
      aria-label="Mobile navigation"
    >
      {/* Top edge shadow */}
      <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

      <div className="mobile-bottom-nav-inner">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.route}
              onClick={() => handleTap(item)}
              className={`mobile-bottom-nav-item ${active ? 'active' : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {/* Active indicator pill */}
              <AnimatePresence>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className="mobile-nav-pill"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              <item.icon
                className={`mobile-bottom-nav-icon ${active ? 'active' : ''}`}
              />

              <AnimatePresence>
                {active && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 4, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mobile-bottom-nav-label"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {!active && (
                <span className="mobile-bottom-nav-label-inactive">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
