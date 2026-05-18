import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Wallet,
  ShieldCheck,
  Users,
  Calendar,
  TrendingUp,
  Gift,
  Tag,
  AlertTriangle,
  Loader2,
  Plus,
  Check,
  Sparkles,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const SUPABASE_URL = 'https://swlknrfufxsvpkfulqcx.supabase.co';

// ─── Animated Counter ────────────────────────────────────────────────
function AnimatedCounter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{prefix}{display.toLocaleString('en-IN')}</>;
}

// ─── Countdown Badge ─────────────────────────────────────────────────
function ExpiryCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!expiresAt) return <span className="text-muted-foreground text-sm">No expiry set</span>;

  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;
  const expired = diff <= 0;
  const days = Math.ceil(diff / 86_400_000);

  if (expired) {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-bold tracking-wider uppercase text-red-500 border-red-500/30 bg-red-500/10 animate-pulse">
        Expired
      </Badge>
    );
  }

  const color = days <= 7 ? 'text-red-500 border-red-500/30 bg-red-500/10' :
    days <= 30 ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
      'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';

  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-bold tracking-wider uppercase ${color}`}>
      {days} day{days !== 1 ? 's' : ''} left
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function Billing() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();

  // Dialogs
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [extendSubOpen, setExtendSubOpen] = useState(false);
  const [addSeatsOpen, setAddSeatsOpen] = useState(false);
  const [giftCardOpen, setGiftCardOpen] = useState(false);

  // Add Credits state
  const [creditAmount, setCreditAmount] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState<any>(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Extend sub state
  const [extendMonths, setExtendMonths] = useState(1);
  const [isExtending, setIsExtending] = useState(false);

  // Add seats state
  const [newSeats, setNewSeats] = useState(1);
  const [isAddingSeats, setIsAddingSeats] = useState(false);

  // Gift card state
  const [giftCardCode, setGiftCardCode] = useState('');
  const [isRedeemingGift, setIsRedeemingGift] = useState(false);

  // Animation mount state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // ─── Queries ─────────────────────────────────────────────────────
  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company-billing', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, currency, wallet_balance, license_limit, price_per_license, plan_expires_at, plan')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['wallet-transactions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: usedSeats = 0, isLoading: isLoadingSeats } = useQuery({
    queryKey: ['used-seats', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'active')
        .is('deleted_at', null);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
  });

  // ─── Derived Values ──────────────────────────────────────────────
  const currencySymbol = company?.currency === 'INR' ? '₹' : company?.currency === 'EUR' ? '€' : '$';
  const walletBalance = Number(company?.wallet_balance) || 0;
  const licenseLimit = Number(company?.license_limit) || 1;
  const pricePerLicense = Number(company?.price_per_license) || 500;
  const monthlySubscriptionCost = licenseLimit * pricePerLicense;
  const threeMonthCost = monthlySubscriptionCost * 3;
  const isLowBalance = walletBalance < threeMonthCost && walletBalance >= 0;
  const planExpired = company?.plan_expires_at ? new Date(company.plan_expires_at) < new Date() : true;

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['company-billing'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['used-seats'] });
  }, [queryClient]);

  // ─── Validate Discount Code ──────────────────────────────────────
  const handleValidateDiscount = async () => {
    if (!discountCode.trim() || !creditAmount) return;
    setIsValidatingDiscount(true);
    try {
      const { data, error } = await supabase.rpc('validate_discount_code', {
        p_code: discountCode.trim(),
        p_amount: Number(creditAmount),
      });
      if (error) throw error;
      const result = data as any;
      if (result?.valid) {
        setDiscountInfo(result);
        toast.success(`Discount applied! Saving ₹${result.discount}`);
      } else {
        setDiscountInfo(null);
        toast.error(result?.error || 'Invalid discount code');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
      setDiscountInfo(null);
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  // ─── Razorpay Payment ────────────────────────────────────────────
  const handleAddCredits = async () => {
    const amount = Number(creditAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setIsProcessingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create_order',
          amount,
          currency: company?.currency || 'INR',
          company_id: companyId,
          discount_code: discountCode.trim() || undefined,
        }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || 'Failed to create order');

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'FastestHR',
        description: `Add ₹${amount} credits`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'verify_payment',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                company_id: companyId,
                original_amount: amount,
                discount_code_id: discountInfo?.code_id || undefined,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              toast.success(`₹${amount} credited to wallet!`);
              setAddCreditsOpen(false);
              setCreditAmount('');
              setDiscountCode('');
              setDiscountInfo(null);
              refreshAll();
            } else {
              throw new Error('Verification failed');
            }
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        modal: { ondismiss: () => setIsProcessingPayment(false) },
        prefill: { email: profile?.full_name },
        theme: { color: '#6366F1' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        toast.error('Payment failed. Please try again.');
        setIsProcessingPayment(false);
      });
      rzp.open();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ─── Extend Subscription ─────────────────────────────────────────
  const extendCost = licenseLimit * pricePerLicense * extendMonths;

  const handleExtendSubscription = async () => {
    setIsExtending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('extend_subscription', {
        p_company_id: companyId!,
        p_months: extendMonths,
        p_user_id: user!.id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        toast.success(`Subscription extended by ${extendMonths} month(s)! New expiry: ${new Date(result.new_expiry).toLocaleDateString()}`);
        setExtendSubOpen(false);
        refreshAll();
      } else {
        toast.error(result?.error || 'Failed to extend subscription');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExtending(false);
    }
  };

  // ─── Add Seats ────────────────────────────────────────────────────
  const handleAddSeats = async () => {
    setIsAddingSeats(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('add_seats', {
        p_company_id: companyId!,
        p_seats: newSeats,
        p_user_id: user!.id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        toast.success(`${newSeats} seat(s) added! Pro-rata charge: ${currencySymbol}${result.cost}`);
        setAddSeatsOpen(false);
        setNewSeats(1);
        refreshAll();
      } else {
        toast.error(result?.error || 'Failed to add seats');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAddingSeats(false);
    }
  };

  // ─── Redeem Gift Card ─────────────────────────────────────────────
  const handleRedeemGiftCard = async () => {
    if (!giftCardCode.trim()) {
      toast.error('Enter a gift card code');
      return;
    }
    setIsRedeemingGift(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('redeem_gift_card', {
        p_code: giftCardCode.trim(),
        p_company_id: companyId!,
        p_user_id: user!.id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        toast.success(`Gift card redeemed! ${currencySymbol}${result.amount} added to wallet.`);
        setGiftCardOpen(false);
        setGiftCardCode('');
        refreshAll();
      } else {
        toast.error(result?.error || 'Failed to redeem gift card');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRedeemingGift(false);
    }
  };

  // ─── Render Helpers ───────────────────────────────────────────────
  const cardBaseClass = (delay: number) =>
    `border-border/50 bg-background/50 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`;

  const finalPayAmount = discountInfo
    ? Math.max(0, Number(creditAmount) - discountInfo.discount)
    : Number(creditAmount) || 0;

  // ─── Loading ──────────────────────────────────────────────────────
  if (isLoadingCompany) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className={`transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">Manage your wallet, licenses, and subscription</p>
      </div>

      {/* ─── Low Balance Warning ────────────────────────────────── */}
      {isLowBalance && walletBalance >= 0 && (
        <div className={`flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 animate-pulse">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-red-500">Low Wallet Balance</p>
            <p className="text-sm text-muted-foreground">
              Your balance ({currencySymbol}{walletBalance.toLocaleString('en-IN')}) is less than 3 months of subscription cost ({currencySymbol}{threeMonthCost.toLocaleString('en-IN')}).
              Add funds to avoid service interruption.
            </p>
          </div>
        </div>
      )}

      {/* ─── Trial / License Warnings ────────────────────────────────── */}
      {company?.plan === 'trial' && planExpired && (
        <div className={`mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <Clock className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-red-500">Trial Expired</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your 14-day free trial has expired. To continue adding employees and using premium features, please upgrade to a paid subscription by adding seats.
              </p>
            </div>
          </div>
          <Button onClick={() => setAddSeatsOpen(true)} className="shrink-0 bg-red-500 hover:bg-red-600 text-white border-0 shadow-md">
            Upgrade Subscription
          </Button>
        </div>
      )}

      {usedSeats >= licenseLimit && (!company?.plan || company.plan !== 'trial' || !planExpired) && (
        <div className={`mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <Users className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-amber-500">License Limit Reached</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                You have reached your maximum license limit ({usedSeats}/{licenseLimit} seats). To onboard new employees, you must add more seats to your subscription.
              </p>
            </div>
          </div>
          <Button onClick={() => setAddSeatsOpen(true)} className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-md">
            Add More Seats
          </Button>
        </div>
      )}

      {/* ─── Cards Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Wallet Card ─────────────────────────────────────── */}
        <Card className={cardBaseClass(0)} style={{ transitionDelay: '100ms' }}>
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isLowBalance ? 'bg-red-500/10' : 'bg-indigo-500/10'} transition-colors duration-500`}>
                <Wallet className={`w-5 h-5 ${isLowBalance ? 'text-red-500 animate-pulse' : 'text-indigo-500'}`} />
              </div>
              <h3 className="font-semibold text-lg tracking-tight">Wallet Balance</h3>
            </div>
            <div className={`mb-2 mt-2 flex items-baseline gap-1 break-all ${isLowBalance ? 'text-red-500' : ''}`}>
              <span className={`text-4xl font-light ${isLowBalance ? 'text-red-400' : 'text-primary'}`}>{currencySymbol}</span>
              <span className="text-5xl font-bold tracking-tighter">
                <AnimatedCounter value={walletBalance} />
              </span>
            </div>
            {isLowBalance && (
              <p className="text-xs text-red-400 mb-4 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                Below 3-month subscription cost
              </p>
            )}
            <div className="mt-auto pt-2 space-y-2">
              <Button
                onClick={() => setAddCreditsOpen(true)}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white border-0 py-6 font-medium text-base shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Add Credits
              </Button>
              <Button
                variant="outline"
                onClick={() => setGiftCardOpen(true)}
                className="w-full border-border hover:bg-muted/50 py-5 font-medium text-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Gift className="w-4 h-4 mr-2" />
                Redeem Gift Card
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Subscription Card ───────────────────────────────── */}
        <Card className={cardBaseClass(1)} style={{ transitionDelay: '200ms' }}>
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="font-semibold text-lg tracking-tight">Subscription</h3>
            </div>

            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 ${company?.plan === 'trial' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' : 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'}`}>
                {company?.plan || 'TRIAL'}
              </Badge>
              <div className="text-sm text-muted-foreground font-medium">
                {currencySymbol}{pricePerLicense}/seat/mo
              </div>
            </div>

            <div className="mb-3 flex items-center gap-3 bg-muted/20 border border-border/40 rounded-lg p-3">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium text-muted-foreground">
                  {company?.plan_expires_at ? new Date(company.plan_expires_at).toLocaleDateString() : 'No expiry'}
                </span>
                <ExpiryCountdown expiresAt={company?.plan_expires_at || null} />
              </div>
            </div>

            <div className="rounded-lg bg-muted/10 border border-border/30 p-3 mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Monthly cost</span>
                <span className="font-medium text-foreground">{currencySymbol}{monthlySubscriptionCost.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{licenseLimit} seat{licenseLimit > 1 ? 's' : ''} × {currencySymbol}{pricePerLicense}</span>
                <span className="font-medium text-foreground">per month</span>
              </div>
            </div>

            <div className="mt-auto pt-2">
              <Button
                variant="outline"
                onClick={() => setExtendSubOpen(true)}
                className="w-full border-border hover:bg-muted/50 py-6 font-medium text-base hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Extend Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Licenses Card ───────────────────────────────────── */}
        <Card className={cardBaseClass(2)} style={{ transitionDelay: '300ms' }}>
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                <Users className="w-5 h-5 text-violet-500" />
              </div>
              <h3 className="font-semibold text-lg tracking-tight">Licenses</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 mt-2">
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4 flex flex-col items-center justify-center hover:bg-muted/40 transition-colors">
                <span className="text-4xl font-bold mb-1">
                  <AnimatedCounter value={licenseLimit} />
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total</span>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4 flex flex-col items-center justify-center hover:bg-muted/40 transition-colors">
                <span className="text-4xl font-bold mb-1">
                  {isLoadingSeats ? <Skeleton className="h-10 w-10 mt-1" /> : <AnimatedCounter value={usedSeats} />}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Used</span>
              </div>
            </div>

            {/* Usage bar */}
            <div className="mb-4">
              <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min((usedSeats / Math.max(licenseLimit, 1)) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {usedSeats}/{licenseLimit} seats used
              </p>
            </div>

            <div className="mt-auto pt-2">
              <Button
                variant="outline"
                onClick={() => setAddSeatsOpen(true)}
                className="w-full border-border hover:bg-muted/50 py-6 font-medium text-base hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Seats
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Recent Transactions ─────────────────────────────────── */}
      <Card className={`border-border/50 bg-background/50 shadow-sm mt-8 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: '400ms' }}>
        <CardContent className="p-0">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold text-lg tracking-tight">Recent Transactions</h3>
            <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
              {transactions.length} records
            </Badge>
          </div>

          <div className="p-4">
            {isLoadingTransactions ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-3">
                <Sparkles className="w-8 h-8 opacity-30" />
                <p>No transactions yet. Add credits to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {transactions.map((tx: any, i: number) => (
                  <div
                    key={tx.id}
                    className="py-3.5 flex items-center justify-between hover:bg-muted/10 transition-all px-4 rounded-lg group"
                    style={{
                      animationDelay: `${i * 60}ms`,
                      animation: mounted ? 'fadeSlideIn 0.4s ease-out forwards' : '',
                      opacity: 0,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${tx.type === 'credit' ? 'bg-emerald-500/10' : 'bg-red-500/10'} transition-transform group-hover:scale-110`}>
                        {tx.type === 'credit' ? (
                          <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.description || 'Wallet Top-up'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-sm ${tx.type === 'credit' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {tx.type === 'credit' ? '+' : '-'}{currencySymbol}{Number(tx.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── DIALOGS ─────────────────────────────────────────────── */}

      {/* Add Credits Dialog */}
      <Dialog open={addCreditsOpen} onOpenChange={(open) => { setAddCreditsOpen(open); if (!open) { setDiscountCode(''); setDiscountInfo(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-500" />
              Add Credits
            </DialogTitle>
            <DialogDescription>Add funds to your wallet via Razorpay</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount ({currencySymbol})</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={creditAmount}
                onChange={(e) => { setCreditAmount(e.target.value); setDiscountInfo(null); }}
                min={1}
              />
            </div>
            {/* Quick amount buttons */}
            <div className="flex gap-2 flex-wrap">
              {[500, 1000, 2000, 5000, 10000].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`text-xs hover:scale-105 active:scale-95 transition-transform ${Number(creditAmount) === amt ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : ''}`}
                  onClick={() => { setCreditAmount(String(amt)); setDiscountInfo(null); }}
                >
                  {currencySymbol}{amt.toLocaleString('en-IN')}
                </Button>
              ))}
            </div>

            {/* Discount Code */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Discount Code (optional)
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={discountCode}
                  onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountInfo(null); }}
                  className="font-mono uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleValidateDiscount}
                  disabled={!discountCode.trim() || !creditAmount || isValidatingDiscount}
                  className="px-4"
                >
                  {isValidatingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              {discountInfo && (
                <div className="flex items-center gap-2 text-sm text-emerald-500 bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{discountInfo.discount_value}% discount applied — saving {currencySymbol}{discountInfo.discount}</span>
                </div>
              )}
            </div>

            {/* Summary */}
            {Number(creditAmount) > 0 && (
              <div className="rounded-lg bg-muted/20 border border-border/40 p-4 space-y-2 animate-in fade-in duration-300">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{currencySymbol}{Number(creditAmount).toLocaleString('en-IN')}</span>
                </div>
                {discountInfo && (
                  <div className="flex justify-between text-sm text-emerald-500">
                    <span>Discount</span>
                    <span>-{currencySymbol}{discountInfo.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="border-t border-border/40 pt-2 flex justify-between text-sm font-bold">
                  <span>You pay</span>
                  <span>{currencySymbol}{finalPayAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credits added</span>
                  <span className="font-medium text-indigo-500">{currencySymbol}{Number(creditAmount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCreditsOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddCredits}
              disabled={!creditAmount || Number(creditAmount) <= 0 || isProcessingPayment}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              {isProcessingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Pay {currencySymbol}{finalPayAmount.toLocaleString('en-IN')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Subscription Dialog */}
      <Dialog open={extendSubOpen} onOpenChange={setExtendSubOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Extend Subscription
            </DialogTitle>
            <DialogDescription>Choose how many months to extend. Cost will be debited from your wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={extendMonths === m ? 'default' : 'outline'}
                  className={`py-8 flex flex-col gap-1 hover:scale-105 active:scale-95 transition-all ${extendMonths === m ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]' : ''}`}
                  onClick={() => setExtendMonths(m)}
                >
                  <span className="text-2xl font-bold">{m}</span>
                  <span className="text-[10px] opacity-80 uppercase font-semibold">Month{m > 1 ? 's' : ''}</span>
                </Button>
              ))}
            </div>

            <div className="rounded-lg bg-muted/20 border border-border/40 p-4 space-y-2 animate-in fade-in duration-300">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seats</span>
                <span className="font-medium">{licenseLimit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-medium">{currencySymbol}{pricePerLicense}/seat/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{extendMonths} month{extendMonths > 1 ? 's' : ''}</span>
              </div>
              <div className="border-t border-border/40 pt-2 flex justify-between text-sm font-bold">
                <span>Total (from wallet)</span>
                <span className={walletBalance < extendCost ? 'text-red-500' : 'text-emerald-500'}>
                  {currencySymbol}{extendCost.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Wallet balance</span>
                <span>{currencySymbol}{walletBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {walletBalance < extendCost && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/5 rounded-lg p-3 border border-red-500/20 animate-in fade-in duration-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Insufficient balance. Please add {currencySymbol}{(extendCost - walletBalance).toLocaleString('en-IN')} more to your wallet.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendSubOpen(false)}>Cancel</Button>
            <Button
              onClick={handleExtendSubscription}
              disabled={walletBalance < extendCost || isExtending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isExtending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Extend & Pay {currencySymbol}{extendCost.toLocaleString('en-IN')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Seats Dialog */}
      <Dialog open={addSeatsOpen} onOpenChange={setAddSeatsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-500" />
              Add Seats
            </DialogTitle>
            <DialogDescription>
              {planExpired
                ? 'Please extend your subscription first before adding seats.'
                : 'New seats are charged pro-rata until your current expiry date.'}
            </DialogDescription>
          </DialogHeader>
          {!planExpired && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Number of seats to add</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setNewSeats(Math.max(1, newSeats - 1))}
                    className="h-10 w-10"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={newSeats}
                    onChange={(e) => setNewSeats(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-center text-lg font-bold w-20"
                    min={1}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setNewSeats(newSeats + 1)}
                    className="h-10 w-10"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/20 border border-border/40 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current seats</span>
                  <span className="font-medium">{licenseLimit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">After adding</span>
                  <span className="font-medium">{licenseLimit + newSeats}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-medium">{currencySymbol}{pricePerLicense}/seat/mo (pro-rata)</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Exact pro-rata cost will be calculated server-side based on remaining days.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSeatsOpen(false)}>Cancel</Button>
            {!planExpired && (
              <Button
                onClick={handleAddSeats}
                disabled={isAddingSeats || newSeats < 1}
                className="bg-violet-500 hover:bg-violet-600 text-white"
              >
                {isAddingSeats ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add {newSeats} Seat{newSeats > 1 ? 's' : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Gift Card Dialog */}
      <Dialog open={giftCardOpen} onOpenChange={setGiftCardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-500" />
              Redeem Gift Card
            </DialogTitle>
            <DialogDescription>Enter your gift card code to add credits to your wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Gift Card Code</Label>
              <Input
                placeholder="Enter gift card code"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                className="font-mono text-lg tracking-wider uppercase text-center"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGiftCardOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRedeemGiftCard}
              disabled={!giftCardCode.trim() || isRedeemingGift}
              className="bg-pink-500 hover:bg-pink-600 text-white"
            >
              {isRedeemingGift ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
              Redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSS Animation Keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
