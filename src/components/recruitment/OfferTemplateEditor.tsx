import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Edit2, FileText, ExternalLink, Eye, Mail, Variable } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OfferLetterRenderer } from './OfferLetterRenderer';

export interface CustomVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'current_date';
  required: boolean;
}

interface OfferTemplate {
  id: string;
  name: string;
  html_content: string;
  letterhead_url: string | null;
  email_subject: string | null;
  email_body: string | null;
  is_predefined_html: boolean;
  custom_variables: CustomVariable[];
  created_at: string;
}

const OFFER_VARIABLES = [
  '{{Name}}', 
  '{{Designation}}', 
  '{{Offer Number}}', 
  '{{Joined Date}}', 
  '{{Payout}}', 
  '{{Offer Link}}', 
  '{{Today}}',
  '{{Basic Pay Percent}}',
  '{{DA Percent}}',
  '{{HRA Percent}}',
  '{{Conveyance Percent}}',
  '{{Special Allowance Percent}}',
  '{{Medical Insurance Percent}}'
];

function VariableButtons({ variables, onInsert }: { variables: string[], onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map(v => (
        <button 
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function OfferTemplateList() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OfferTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['offer-templates', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_templates')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as OfferTemplate[];
    },
    enabled: !!profile?.company_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('offer_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete template');
      console.error(error);
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Offer Templates</h2>
          <p className="text-sm text-muted-foreground">Manage offer letter templates including email subject, body, and the PDF letter content</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setIsEditorOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors group">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {template.name}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    aria-label="Edit template"
                    className="h-8 w-8"
                    onClick={() => { setEditingTemplate(template); setIsEditorOpen(true); }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    aria-label="Delete template"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this template?')) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {template.email_subject && (
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {template.email_subject}
                </p>
              )}
              <p className="text-xs text-muted-foreground line-clamp-3 font-mono bg-muted/30 p-2 rounded">
                {template.html_content.substring(0, 150)}...
              </p>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                {template.letterhead_url && (
                  <span className="flex items-center gap-1 text-primary">
                    <ExternalLink className="h-3 w-3" /> Letterhead
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full h-48 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg bg-muted/5 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No templates found. Create one to get started.</p>
          </div>
        )}
      </div>

      <OfferTemplateEditor 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)} 
        template={editingTemplate} 
      />
    </div>
  );
}

function OfferTemplateEditor({ isOpen, onClose, template }: { isOpen: boolean, onClose: () => void, template: OfferTemplate | null }) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isPredefinedHtml, setIsPredefinedHtml] = useState(false);
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Build dynamic variable lists by appending custom variables
  const ALL_VARIABLES = [...OFFER_VARIABLES, ...customVariables.map(v => `{{${v.key}}}`) ];

  useEffect(() => {
    if (template) {
      setName(template.name);
      setHtmlContent(template.html_content);
      setLetterheadUrl(template.letterhead_url || '');
      setEmailSubject(template.email_subject || '');
      setEmailBody(template.email_body || '');
      setIsPredefinedHtml(template.is_predefined_html || false);
      setCustomVariables(Array.isArray((template as any).custom_variables) ? (template as any).custom_variables : []);
    } else {
      setName('');
      setHtmlContent('<h1>Offer Letter</h1>\n<p>Dear {{Name}},</p>\n<p>We are pleased to offer you the position of {{Designation}}...</p>\n<p>Joining Date: {{Joined Date}}</p>\n<p>Annual Payout: {{Payout}}</p>');
      setLetterheadUrl('');
      setEmailSubject('Offer of Employment — {{Designation}}');
      setEmailBody('Dear {{Name}},\n\nWe are excited to offer you the position of {{Designation}}!\n\nPlease find your official offer letter attached as a PDF.\n\nYou can also view and accept your offer online:\n{{Offer Link}}\n\nBest regards,\nThe Hiring Team');
      setIsPredefinedHtml(false);
      setCustomVariables([]);
    }
  }, [template, isOpen]);

  const { data: company } = useQuery({
    queryKey: ['company-settings', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('currency')
        .eq('id', profile!.company_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id && isOpen,
  });

  const currencySymbol = company?.currency || 'USD';

  const handleSave = async () => {
    if (!name.trim() || !htmlContent.trim()) {
      toast.error('Please fill in template name and HTML content');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        company_id: profile!.company_id!,
        name,
        html_content: htmlContent,
        letterhead_url: letterheadUrl || null,
        email_subject: emailSubject || null,
        email_body: emailBody || null,
        is_predefined_html: isPredefinedHtml,
        custom_variables: customVariables,
      };

      if (template) {
        const { error } = await supabase
          .from('offer_templates')
          .update(payload as any)
          .eq('id', template.id);
        if (error) throw error;
        toast.success('Template updated');
      } else {
        const { error } = await supabase
          .from('offer_templates')
          .insert(payload as any);
        if (error) throw error;
        toast.success('Template created');
      }

      queryClient.invalidateQueries({ queryKey: ['offer-templates'] });
      onClose();
    } catch (error: unknown) {
      toast.error(`Error: ${(error instanceof Error ? error.message : String(error))}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedSamplePayout = new Number(120000).toLocaleString('en-US', {
    style: 'currency',
    currency: currencySymbol,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'New Offer Template'}</DialogTitle>
          <DialogDescription>
            Configure the email and offer letter PDF. Use the variable buttons to insert dynamic values.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-3.5 w-3.5" /> Email Settings
            </TabsTrigger>
            <TabsTrigger value="letter" className="gap-2">
              <Edit2 className="h-3.5 w-3.5" /> Offer Letter (PDF)
            </TabsTrigger>
            <TabsTrigger value="variables" className="gap-2">
              <Variable className="h-3.5 w-3.5" /> Variables
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-3.5 w-3.5" /> Live Preview
            </TabsTrigger>
          </TabsList>

          {/* ── Email Settings ── */}
          <TabsContent value="email" className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template Name *</label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. Standard Developer Offer" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Subject</label>
                <VariableButtons variables={ALL_VARIABLES} onInsert={(v) => setEmailSubject(prev => prev + v)} />
              </div>
              <Input 
                value={emailSubject} 
                onChange={(e) => setEmailSubject(e.target.value)} 
                placeholder="Offer of Employment — {{job_title}}" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Body</label>
                <VariableButtons variables={ALL_VARIABLES} onInsert={(v) => setEmailBody(prev => prev + v)} />
              </div>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={10}
                placeholder="Dear {{Name}},&#10;&#10;We are excited to offer you..."
                className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-y leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground italic">
                The PDF offer letter will be attached automatically. Use <code>{"{{Offer Link}}"}</code> to insert the online acceptance link.
              </p>
            </div>
          </TabsContent>

          {/* ── Offer Letter HTML (PDF content) ── */}
          <TabsContent value="letter" className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Letterhead Image URL (Optional)</label>
              <Input 
                value={letterheadUrl} 
                onChange={(e) => setLetterheadUrl(e.target.value)} 
                placeholder="https://example.com/logo.png" 
              />
              <p className="text-[10px] text-muted-foreground">This will be shown at the top of the A4 size letter.</p>
            </div>
            
            <div className="flex items-center space-x-2 my-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <input 
                type="checkbox" 
                id="predefined-html" 
                checked={isPredefinedHtml}
                onChange={(e) => setIsPredefinedHtml(e.target.checked)}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
              />
              <div className="grid gap-0.5 leading-none">
                <label 
                  htmlFor="predefined-html" 
                  className="text-sm font-semibold leading-none cursor-pointer"
                >
                  Predefined HTML Mode
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Remove all default paddings, page breaks, and system styles. Use this if your HTML already has its own layout and page divisions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HTML Content (Offer Letter PDF) *</label>
                <VariableButtons variables={ALL_VARIABLES} onInsert={(v) => setHtmlContent(prev => prev + v)} />
              </div>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={14}
                className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none font-mono leading-relaxed resize-y"
                placeholder="<html>...</html>"
              />
            </div>
          </TabsContent>

          {/* ── Variables ── */}
          <TabsContent value="variables" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Variables</label>
                  <p className="text-[10px] text-muted-foreground">Define additional fields to collect when sending an offer. Use <code>{`{{Variable Name}}`}</code> in your email body or offer letter HTML.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCustomVariables(prev => [...prev, { key: '', label: '', type: 'text', required: false }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Variable
                </Button>
              </div>
            </div>

            {customVariables.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg bg-muted/5 text-muted-foreground">
                <Variable className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No custom variables defined.</p>
                <p className="text-[10px] mt-1">Click "Add Variable" to create additional input fields for the offer dialog.</p>
              </div>
            )}

            <div className="space-y-3">
              {customVariables.map((cv, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-background/50">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Variable Name</label>
                        <Input
                          value={cv.key}
                          onChange={(e) => {
                            const updated = [...customVariables];
                            updated[idx] = { ...cv, key: e.target.value, label: e.target.value };
                            setCustomVariables(updated);
                          }}
                          placeholder="e.g. Department"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Input Type</label>
                        <select
                          value={cv.type}
                          onChange={(e) => {
                            const updated = [...customVariables];
                            const newType = e.target.value as 'text' | 'number' | 'date' | 'current_date';
                            // If current_date, it's auto-filled so it doesn't need to be required from the user
                            updated[idx] = { ...cv, type: newType, required: newType === 'current_date' ? false : cv.required };
                            setCustomVariables(updated);
                          }}
                          className="flex h-8 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="current_date">Current Date (Auto-filled)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cv.type !== 'current_date' ? (
                        <>
                          <input
                            type="checkbox"
                            id={`required-${idx}`}
                            checked={cv.required}
                            onChange={(e) => {
                              const updated = [...customVariables];
                              updated[idx] = { ...cv, required: e.target.checked };
                              setCustomVariables(updated);
                            }}
                            className="w-3.5 h-3.5 text-primary bg-background border-border rounded focus:ring-primary"
                          />
                          <label htmlFor={`required-${idx}`} className="text-xs text-muted-foreground cursor-pointer">Required field</label>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Computed automatically when sent</span>
                      )}
                      {cv.key && (
                        <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                          {`{{${cv.key}}}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove custom variable"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 mt-5"
                    onClick={() => setCustomVariables(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Live Preview ── */}
          <TabsContent value="preview" className="py-2">
            <div className="bg-muted/10 rounded-xl p-8 border border-border/50 max-h-[60vh] overflow-auto flex justify-center">
              <div className="scale-[0.8] origin-top">
                <OfferLetterRenderer 
                  htmlContent={htmlContent}
                  letterheadUrl={letterheadUrl}
                  variables={{
                    'Name': 'John Doe',
                    'Designation': 'Senior Software Engineer',
                    'job_title': 'Senior Software Engineer',
                    'Joined Date': new Date().toLocaleDateString(),
                    'Payout': formattedSamplePayout,
                    'Offer Number': 'OFFER-2026-0001',
                    'Offer Link': 'https://fastesthre.com/offer/sample-token',
                    'Today': new Date().toLocaleDateString(),
                    ...Object.fromEntries(customVariables.map(v => [
                      v.key, 
                      v.type === 'number' ? '12345' : 
                      (v.type === 'date' || v.type === 'current_date') ? new Date().toLocaleDateString() : 
                      `Sample ${v.key}`
                    ])),
                  }}
                  isPredefinedHtml={isPredefinedHtml}
                />
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-4 italic">
              * Preview shown with sample data. Actual values will be replaced when sending.
            </p>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {template ? 'Update Template' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
