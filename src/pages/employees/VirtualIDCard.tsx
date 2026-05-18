import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Download, Upload, Share2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { escapeHtml } from '@/lib/utils';

export default function VirtualIDCard() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: employee, isLoading: loadingEmp } = useQuery({
    queryKey: ['my-id-card-data', profile?.id],
    queryFn: async () => {
      const { data: emp } = await supabase
        .from('employees')
        .select('*, companies(*), designations(title)')
        .eq('user_id', profile!.id)
        .single();
      return emp as any;
    },
    enabled: !!profile?.id,
  });

  const updatePhotoMutation = useMutation({
    mutationFn: async (url: string) => {
      const history = employee.id_card_image_history || [];
      const newHistory = [...history, { url, updated_at: new Date().toISOString() }];
      
      const { error } = await supabase
        .from('employees')
        .update({
          avatar_url: url,
          id_card_image_history: newHistory
        } as any)
        .eq('id', employee.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-id-card-data'] });
      toast.success('ID Card photo updated successfully');
    },
  });

  const checkUploadEligibility = () => {
    if (!employee?.id_card_image_history) return { eligible: true };
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const recentUpdates = employee.id_card_image_history.filter((h: any) => 
      new Date(h.updated_at) > sixMonthsAgo
    );
    
    if (recentUpdates.length >= 2) {
      const oldestRelevant = new Date(recentUpdates[0].updated_at);
      const nextAvailable = new Date(oldestRelevant);
      nextAvailable.setMonth(nextAvailable.getMonth() + 6);
      
      return { 
        eligible: false, 
        reason: `Maximum 2 updates allowed per 6 months. Next update available after ${nextAvailable.toLocaleDateString()}`,
        count: recentUpdates.length
      };
    }
    
    return { eligible: true, count: recentUpdates.length };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const eligibility = checkUploadEligibility();
    if (!eligibility.eligible) {
      toast.error(eligibility.reason);
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employee.id}-${crypto.randomUUID()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-assets')
        .getPublicUrl(filePath);

      await updatePhotoMutation.mutateAsync(publicUrl);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

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

  const eligibility = checkUploadEligibility();

  if (loadingEmp) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/id/${employee?.public_id}`;

  return (
    <div className="container max-w-4xl py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Virtual ID Card</h1>
          <p className="text-muted-foreground mt-1">View, share and manage your official digital identity.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            toast.success('Sharing link copied to clipboard');
          }}>
            <Share2 className="h-4 w-4" /> Share Card
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-10 items-start">
        {/* Card View */}
        <div className="flex justify-center p-8 bg-muted/30 rounded-3xl border border-border/50 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
          <div 
            className="relative z-10 transition-transform duration-500 group-hover:scale-[1.02]"
            dangerouslySetInnerHTML={{ __html: renderCard() }} 
          />
        </div>

        {/* Management Side */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" /> Update Profile Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {!eligibility.eligible ? (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Update Limit Reached</AlertTitle>
                  <AlertDescription className="text-xs">
                    {eligibility.reason}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Updates Available</p>
                    <p className="text-xs text-muted-foreground">You have {2 - eligibility.count} update(s) remaining for this 6-month period.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <Label className="text-sm font-semibold">Requirement</Label>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                  <li>Square image (1:1 aspect ratio) recommended</li>
                  <li>Clear professional background</li>
                  <li>Face should be clearly visible</li>
                  <li>Max file size: 2MB (JPG, PNG)</li>
                </ul>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <Input
                  type="file"
                  id="photo-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={!eligibility.eligible || uploading}
                />
                <Button
                  className="w-full h-12 text-base font-semibold transition-all hover:shadow-primary/20"
                  disabled={!eligibility.eligible || uploading}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {uploading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="mr-2 h-5 w-5" /> Select New Photo</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm border-dashed bg-transparent">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
                  <Share2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Verified Shareable Link</p>
                  <p className="text-xs text-muted-foreground break-all bg-muted/50 p-2 rounded mt-2 border border-border/50">
                    {shareUrl}
                  </p>
                  <p className="text-[10px] text-muted-foreground italic mt-2">
                    Anyone with this link can verify your employment status and view your official ID card.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
