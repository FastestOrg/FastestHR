import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, UserPlus, X, ShieldCheck, Filter, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { GlobalEmployee } from '@/types/global-employee';
import { GlobalEmployeeCard } from './GlobalEmployeeCard';

interface GlobalEmployeeSearchProps {
  onSelect?: (employee: GlobalEmployee) => void;
  onAddNew?: () => void;
}

export function GlobalEmployeeSearch({ onSelect, onAddNew }: GlobalEmployeeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.rpc('search_global_employees', {
        p_query: q.trim(),
      });

      if (error) throw error;
      setResults((data as unknown as GlobalEmployee[]) || []);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => search(query), 350);
    return () => clearTimeout(timeout);
  }, [query, search]);

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
        <div className="relative flex items-center gap-3 bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl px-5 py-3.5 shadow-lg shadow-black/5 focus-within:border-primary/50 focus-within:shadow-primary/10 transition-all duration-300">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            placeholder="Search verified professionals by Name, Work Email, Company, or Masked ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base placeholder:text-muted-foreground/50 h-auto p-0"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full"
              onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {loading && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
        </div>
      </div>

      {/* Trust & Privacy Guarantee Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-primary/5 rounded-xl border border-primary/10 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Decentralized Global Trust Registry • All lookups audit-logged per FCRA & GDPR standards</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-primary hidden sm:inline">
          Live Verification Active
        </span>
      </div>

      {/* Results */}
      {searched && !loading && results.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Search className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">No matching career passport found</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              No verified records match "{query}". You can invite this professional to self-verify or register their initial credentials.
            </p>
          </div>
          {onAddNew && (
            <Button onClick={onAddNew} className="gap-2 mt-2 bg-gradient-to-r from-primary to-purple-600">
              <UserPlus className="h-4 w-4" /> Register Candidate Profile
            </Button>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-muted-foreground font-medium">
              Found {results.length} verified professional profile{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((emp) => (
              <GlobalEmployeeCard
                key={emp.id}
                employee={emp}
                onClick={() => onSelect?.(emp)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
