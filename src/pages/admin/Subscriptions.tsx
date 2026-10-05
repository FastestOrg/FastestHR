import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, TrendingUp, CheckCircle2, AlertTriangle, Building2, Loader2, DollarSign, Wallet } from 'lucide-react';

export default function Subscriptions() {
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['admin-subscriptions-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, plan, wallet_balance, price_per_license, license_limit, is_active, created_at');

      if (error) throw error;
      return data || [];
    },
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['admin-subscriptions-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*, companies(name, plan)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.warn('Could not fetch wallet transactions:', error);
        return [];
      }
      return data || [];
    },
  });

  // Calculate live revenue metrics
  const activeCompaniesCount = companies.filter((c: any) => c.is_active).length;
  const totalWalletReserve = companies.reduce((sum: number, c: any) => sum + (Number(c.wallet_balance) || 0), 0);
  const paidPlansCount = companies.filter((c: any) => c.plan && c.plan.toLowerCase() !== 'trial').length;

  const planBreakdown = companies.reduce((acc: Record<string, number>, c: any) => {
    const p = c.plan || 'Free Trial';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const isLoading = loadingCompanies || loadingTx;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Platform Subscriptions</h1>
          <p className="text-muted-foreground mt-1">SuperAdmin — Live Revenue, Plans & Wallet Transactions</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-6">
            <h3 className="text-xs text-muted-foreground mb-2 uppercase font-medium">Total Wallet Reserves</h3>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-foreground font-mono">
                ${totalWalletReserve.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-medium text-emerald-600 flex items-center bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Wallet className="w-3 h-3 mr-1" /> Live
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-6">
            <h3 className="text-xs text-muted-foreground mb-2 uppercase font-medium">Active Tenants</h3>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-foreground font-mono">
                {activeCompaniesCount} / {companies.length}
              </span>
              <span className="text-xs font-medium text-primary flex items-center bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                <Building2 className="w-3 h-3 mr-1" /> {paidPlansCount} Paid
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-6">
            <h3 className="text-xs text-muted-foreground mb-2 uppercase font-medium">Plan Distribution</h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {Object.entries(planBreakdown).map(([plan, count]) => (
                <Badge key={plan} variant="outline" className="capitalize text-xs font-mono">
                  {plan}: {String(count)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/50 col-span-1 lg:col-span-2">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center text-foreground font-semibold gap-2 text-base">
              <CreditCard className="w-5 h-5 text-primary" /> Recent Wallet & Payment Transactions
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Live ledger entries reconciled from payment gateways and wallet credits
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span>Loading ledger...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No recent payment transactions recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 text-sm">
                {transactions.map((tx: any) => {
                  const isSuccess = tx.status === 'success' || tx.status === 'completed';
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        {isSuccess ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-foreground">
                            {tx.companies?.name || 'Company'} — {tx.description || tx.type || 'Transaction'}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString()} &bull; Order: {tx.razorpay_order_id || 'Direct'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground font-mono">
                          ${Number(tx.amount || 0).toFixed(2)}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] uppercase px-1.5 py-0 ${
                            isSuccess 
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' 
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          }`}
                        >
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant Plan Breakdown Card */}
        <Card className="border-border/50">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Active Tenant Tiers</CardTitle>
            <CardDescription className="text-xs">Live tier status by company</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {companies.slice(0, 8).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-muted/20">
                <div className="min-w-0 pr-2">
                  <div className="font-medium text-xs truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">${Number(c.wallet_balance || 0).toFixed(2)} balance</div>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                  {c.plan || 'Trial'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
