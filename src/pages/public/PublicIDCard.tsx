import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';
import { Loader2, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { escapeHtml } from '@/lib/utils';

export default function PublicIDCard() {
  const { publicId } = useParams<{ publicId: string }>();

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ['public-id-card', publicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employee_by_public_id', {
        p_public_id: publicId,
      });
      
      if (error) throw error;
      return data as any;
    },
    enabled: !!publicId,
  });

  const renderCard = () => {
    if (!employee || !employee.companies) return null;
    
    let html = employee.companies.id_card_template || '';
    const placeholders: Record<string, string> = {
      '{{company_name}}': employee.companies.name || '',
      '{{logo_url}}': employee.companies.logo_url || '',
      '{{primary_color}}': employee.companies.id_card_primary_color || '#4F46E5',
      '{{full_name}}': `${employee.first_name} ${employee.last_name}`,
      '{{designation}}': employee.designations?.title || 'Employee',
      '{{employee_code}}': employee.employee_code || '',
      '{{email}}': employee.work_email || employee.personal_email || '',
      '{{phone}}': employee.phone || '',
      '{{avatar_url}}': employee.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + employee.first_name,
    };

    Object.entries(placeholders).forEach(([key, val]) => {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escapedKey, 'g'), () => escapeHtml(String(val)));
    });

    return DOMPurify.sanitize(html, { ADD_TAGS: ['style'], ADD_ATTR: ['style'], FORCE_BODY: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfd] dark:bg-[#09090b]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse font-medium">Verifying Credentials...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-6">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Invalid or Expired ID</h1>
        <p className="text-muted-foreground max-w-md">
          {error ? `Verification Error: ${error.message}` : "The Virtual ID Card you are looking for could not be verified. It may have been deactivated or the link is incorrect."}
        </p>
        <div className="mt-4 text-xs font-mono text-muted-foreground opacity-50">
          ID: {publicId}
        </div>
        <a href="/" className="mt-8 text-primary font-semibold hover:underline">Return to FastestHR.com</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#020202] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg space-y-8 animate-in fade-in zoom-in-95 duration-500">
        {/* Verification Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/10 text-success border border-success/20 text-sm font-semibold shadow-sm">
            <CheckCircle2 className="h-4 w-4" /> Verified by FastestHR.com
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Official Employee Identity</h1>
          <p className="text-sm text-muted-foreground">
            This digital ID card is issued and verified by <span className="font-bold text-foreground">{employee.companies.name}</span> via the FastestHR platform.
          </p>
        </div>

        {/* The Card */}
        <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-border/50">
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] [background-size:20px_20px] opacity-40"></div>
          <div 
            className="relative z-10 flex justify-center p-4 sm:p-8"
            dangerouslySetInnerHTML={{ __html: renderCard() }} 
          />
        </div>

        {/* Verification Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-background border border-border/40 rounded-2xl shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${employee.status === 'active' ? 'bg-success animate-pulse' : 'bg-destructive'}`}></div>
              <span className="text-sm font-bold capitalize">
                {employee.status?.replace('_', ' ') || 'Inactive'} Employee
              </span>
            </div>
          </div>
          <div className="p-4 bg-background border border-border/40 rounded-2xl shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Issued Date</p>
            <p className="text-sm font-bold">{new Date(employee.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-border/40 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 text-muted-foreground grayscale hover:grayscale-0 transition-all duration-300 opacity-60">
            <Globe className="h-4 w-4" />
            <span className="text-xs font-medium tracking-widest uppercase">Global Verification Standard</span>
          </div>
          <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed capitalize">
            FastestHR ensures the authenticity of this digital credential through secure blockchain-inspired hashing and multi-factor verification.
          </p>
        </div>
      </div>
    </div>
  );
}
