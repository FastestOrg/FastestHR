import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Eye, Code, Save, Info, Sparkles } from 'lucide-react';
import { escapeHtml } from '@/lib/utils';

export function IDCardTemplateEditor() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F46E5');
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-id-card', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('name, logo_url, id_card_template, id_card_primary_color')
        .eq('id', profile!.company_id!)
        .single();
      return data as any;
    },
    enabled: !!profile?.company_id,
  });

  useEffect(() => {
    if (company) {
      setTemplate(company.id_card_template || '');
      setPrimaryColor(company.id_card_primary_color || '#4F46E5');
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('companies')
        .update({
          id_card_template: template,
          id_card_primary_color: primaryColor,
        } as any)
        .eq('id', profile!.company_id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-id-card'] });
      toast.success('ID Card template updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update template');
    },
  });

  const renderPreview = () => {
    if (!company) return '';
    
    let html = template;
    const placeholders: Record<string, string> = {
      '{{company_name}}': company.name || 'FastestHR',
      '{{logo_url}}': company.logo_url || 'https://via.placeholder.com/150?text=Logo',
      '{{primary_color}}': primaryColor,
      '{{full_name}}': 'John Doe',
      '{{designation}}': 'Software Engineer',
      '{{employee_code}}': 'EMP-001',
      '{{email}}': 'john.doe@company.com',
      '{{phone}}': '+1 234 567 890',
      '{{avatar_url}}': 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    };

    Object.entries(placeholders).forEach(([key, val]) => {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escapedKey, 'g'), () => escapeHtml(String(val)));
    });

    return DOMPurify.sanitize(html, { ADD_TAGS: ['style'], ADD_ATTR: ['style'], FORCE_BODY: true });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">ID Card Designer</h3>
          <p className="text-sm text-muted-foreground">Customize how your company ID cards look for all employees.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(previewMode === 'edit' ? 'preview' : 'edit')}
            className="gap-2"
          >
            {previewMode === 'edit' ? (
              <><Eye className="h-4 w-4" /> Live Preview</>
            ) : (
              <><Code className="h-4 w-4" /> Edit Code</>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="gap-2 shadow-md shadow-primary/20"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Editor Side */}
        <div className={`space-y-6 ${previewMode === 'preview' ? 'hidden lg:block' : ''}`}>
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/5">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" /> HTML Template
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color" className="text-xs uppercase tracking-wider text-muted-foreground">Primary Theme Color</Label>
                <div className="flex gap-3 items-center">
                  <Input
                    id="primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 p-1 bg-background border-border/50 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 font-mono text-sm h-10 border-border/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template" className="text-xs uppercase tracking-wider text-muted-foreground">HTML/CSS Code</Label>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono bg-muted/30">HTML5</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono bg-muted/30">Inline CSS</Badge>
                  </div>
                </div>
                <Textarea
                  id="template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="min-h-[400px] font-mono text-xs p-4 bg-[#09090b] text-[#a1a1aa] border-none focus-visible:ring-1 focus-visible:ring-primary/30 leading-relaxed overflow-y-auto custom-scrollbar"
                  spellCheck={false}
                />
              </div>

              <div className="p-3 rounded-lg bg-info/5 border border-info/20 space-y-2">
                <p className="text-[11px] font-bold text-info uppercase flex items-center gap-1.5">
                  <Info className="h-3 w-3" /> Available Placeholders
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '{{company_name}}', '{{logo_url}}', '{{primary_color}}',
                    '{{full_name}}', '{{designation}}', '{{employee_code}}',
                    '{{email}}', '{{phone}}', '{{avatar_url}}'
                  ].map(p => (
                    <code key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border/50 text-muted-foreground">{p}</code>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Side */}
        <div className={`space-y-6 ${previewMode === 'edit' ? 'hidden lg:block' : ''}`}>
          <Card className="border-border/40 shadow-sm sticky top-20 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/5 bg-muted/10">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 flex justify-center min-h-[500px] bg-muted/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-10"></div>
              <div 
                className="transform scale-[0.85] sm:scale-100 transition-transform origin-top z-10"
                dangerouslySetInnerHTML={{ __html: renderPreview() }} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
