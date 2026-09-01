import { motion } from 'framer-motion';
import { CheckCircle2, ShieldCheck, MapPin, Briefcase, ExternalLink, Lock, Award, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { GlobalEmployee } from '@/types/global-employee';

interface GlobalEmployeeCardProps {
  employee: GlobalEmployee;
  onClick?: () => void;
  onRequestConsent?: (e: React.MouseEvent) => void;
  showActions?: boolean;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const stars = [];
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Star key={i} className={`${iconSize} fill-amber-400 text-amber-400`} />);
    } else if (i === full && half) {
      stars.push(
        <span key={i} className="relative">
          <Star className={`${iconSize} text-zinc-600`} />
          <Star className={`${iconSize} fill-amber-400 text-amber-400 absolute inset-0`} style={{ clipPath: 'inset(0 50% 0 0)' }} />
        </span>
      );
    } else {
      stars.push(<Star key={i} className={`${iconSize} text-zinc-600`} />);
    }
  }

  return <div className="flex items-center gap-0.5">{stars}</div>;
}

export { StarRating };

export function GlobalEmployeeCard({ employee, onClick, onRequestConsent }: GlobalEmployeeCardProps) {
  const initials = employee.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const latestJob = employee.work_experience?.[0];
  const structuredRefsCount = (employee.structured_references?.length || 0) + (employee.feedbacks_by_employer?.length || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* Glow effect */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500" />

      <div className="relative bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-lg shadow-black/5 group-hover:border-primary/30 group-hover:shadow-primary/5 transition-all duration-300">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
            <AvatarImage src={employee.profile_picture || ''} />
            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-purple-500/30 text-primary font-bold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold truncate">{employee.name}</h3>
              {employee.verified && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                </motion.div>
              )}
            </div>

            {latestJob && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                <Briefcase className="h-3 w-3 shrink-0" />
                {latestJob.designation} at {latestJob.company_name}
              </p>
            )}

            {(employee.city || employee.country) && (
              <p className="text-xs text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {[employee.city, employee.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <ExternalLink className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>

        {/* Unified Rating Bar */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StarRating rating={Number(employee.rating) || 0} />
            <span className="text-xs font-bold text-foreground font-mono">
              {Number(employee.rating) > 0 ? Number(employee.rating).toFixed(1) : '0.0'}
            </span>
            {structuredRefsCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({structuredRefsCount} review{structuredRefsCount !== 1 ? 's' : ''})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {employee.verified ? (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-semibold">
                <ShieldCheck className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">
                Pending Audit
              </Badge>
            )}
          </div>
        </div>

        {/* Skills preview */}
        {employee.skills && employee.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {employee.skills.slice(0, 3).map((skill, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full bg-primary/5 text-primary/80 text-[10px] font-medium border border-primary/10"
              >
                {skill}
              </span>
            ))}
            {employee.skills.length > 3 && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                +{employee.skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Privacy & Consent indicator */}
        <div className="mt-3 pt-2 border-t border-border/20 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-emerald-500" /> Masked ID Tokenized
          </span>
          <span className="font-medium text-primary/80 group-hover:text-primary transition-colors">
            View Career Passport →
          </span>
        </div>
      </div>
    </motion.div>
  );
}
