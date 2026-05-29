import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { 
  Loader2, Plus, Trash2, Edit2, FileText, Eye, Mail, Variable, Sparkles,
  UserPlus, ArrowUpCircle, UserMinus, FileCheck, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DocumentRenderer } from './DocumentRenderer';

// ── Category & Sub-category Definitions ──
const CATEGORIES = [
  { 
    id: 'onboarding', label: 'Onboarding', icon: UserPlus, color: 'text-emerald-400',
    subcategories: [
      { id: 'appointment_letter', label: 'Appointment Letter' },
      { id: 'welcome_letter', label: 'Welcome Letter' },
      { id: 'employee_handbook', label: 'Employee Handbook' },
    ]
  },
  { 
    id: 'lifecycle', label: 'Employee Lifecycle', icon: ArrowUpCircle, color: 'text-blue-400',
    subcategories: [
      { id: 'promotion_letter', label: 'Promotion Letter' },
      { id: 'increment_letter', label: 'Increment Letter' },
      { id: 'confirmation_letter', label: 'Confirmation Letter' },
    ]
  },
  { 
    id: 'offboarding', label: 'Offboarding', icon: UserMinus, color: 'text-amber-400',
    subcategories: [
      { id: 'experience_letter', label: 'Experience Letter' },
      { id: 'relieving_letter', label: 'Relieving Letter' },
      { id: 'full_final_settlement', label: 'Full & Final Settlement' },
    ]
  },
  { 
    id: 'general', label: 'General / Others', icon: FileCheck, color: 'text-violet-400',
    subcategories: [
      { id: 'payslip', label: 'PaySlip' },
      { id: 'proof_of_employment', label: 'Proof of Employment' },
      { id: 'appreciation_letter', label: 'Appreciation Letter' },
      { id: 'warning_letter', label: 'Warning Letter' },
      { id: 'internship_certificate_3m', label: 'Internship Certificate (3-month)' },
      { id: 'internship_certificate_6m', label: 'Internship Certificate (6-month)' },
    ]
  },
];

// ── Employee Variables ──
export const EMPLOYEE_VARIABLES = [
  'Name', 'First Name', 'Last Name', 'Employee Code', 'Designation',
  'Department', 'Date of Joining', 'Work Email', 'Personal Email',
  'Phone', 'Gender', 'Today', 'Company Name'
];

export interface CustomVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'current_date' | 'random';
  required: boolean;
  random_config?: {
    length: number;
    type: 'text' | 'number' | 'mix';
    prefix?: string;
  };
}

interface SendDeskTemplate {
  id: string;
  name: string;
  category: string;
  sub_category: string | null;
  html_content: string;
  letterhead_url: string | null;
  email_subject: string | null;
  email_body: string | null;
  is_predefined_html: boolean;
  custom_variables: CustomVariable[];
  created_at: string;
}

function VariableButtons({ variables, onInsert }: { variables: string[], onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map(v => (
        <button 
          key={v}
          type="button"
          onClick={() => onInsert(`{{${v}}}`)}
          className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}

export function SendDeskTemplates() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SendDeskTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['senddesk-templates', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('senddesk_templates')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SendDeskTemplate[];
    },
    enabled: !!profile?.company_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('senddesk_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senddesk-templates'] });
      toast.success('Template deleted');
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of templates) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }, [templates]);

  const filtered = filterCategory 
    ? templates.filter(t => t.category === filterCategory) 
    : templates;

  const getCategoryInfo = (catId: string) => CATEGORIES.find(c => c.id === catId);
  const getSubCategoryLabel = (catId: string, subId: string | null) => {
    if (!subId) return null;
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat?.subcategories.find(s => s.id === subId)?.label || subId;
  };

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
          <h2 className="text-xl font-bold tracking-tight">Document Templates</h2>
          <p className="text-sm text-muted-foreground">Create & manage reusable HR document templates with dynamic fields</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setIsEditorOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !filterCategory ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          <Filter className="h-3 w-3" /> All ({templates.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = categoryCounts[cat.id] || 0;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(filterCategory === cat.id ? null : cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-3 w-3" /> {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((template) => {
          const catInfo = getCategoryInfo(template.category);
          const CatIcon = catInfo?.icon || FileText;
          return (
            <Card key={template.id} className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors group">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CatIcon className={`h-4 w-4 ${catInfo?.color || 'text-primary'}`} />
                    {template.name}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" size="icon" aria-label="Edit template" className="h-8 w-8"
                      onClick={() => { setEditingTemplate(template); setIsEditorOpen(true); }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" size="icon" aria-label="Delete template"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm('Delete this template?')) deleteMutation.mutate(template.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">{template.category}</Badge>
                  {template.sub_category && (
                    <Badge variant="outline" className="text-[10px]">
                      {getSubCategoryLabel(template.category, template.sub_category)}
                    </Badge>
                  )}
                </div>
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
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full h-48 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg bg-muted/5 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">{filterCategory ? 'No templates in this category.' : 'No templates found. Create one to get started.'}</p>
          </div>
        )}
      </div>

      <TemplateEditorDialog 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)} 
        template={editingTemplate} 
      />
    </div>
  );
}

// ── Template Editor Dialog ──
function TemplateEditorDialog({ isOpen, onClose, template }: { isOpen: boolean, onClose: () => void, template: SendDeskTemplate | null }) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [subCategory, setSubCategory] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isPredefinedHtml, setIsPredefinedHtml] = useState(false);
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');

  const ALL_VARIABLES = [...EMPLOYEE_VARIABLES, ...customVariables.map(v => v.key)];

  const { data: company } = useQuery({
    queryKey: ['company-basic', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile!.company_id!)
        .single();
      return data;
    },
    enabled: !!profile?.company_id && isOpen,
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategory(template.category);
      setSubCategory(template.sub_category || '');
      setHtmlContent(template.html_content);
      setLetterheadUrl(template.letterhead_url || '');
      setEmailSubject(template.email_subject || '');
      setEmailBody(template.email_body || '');
      setIsPredefinedHtml(template.is_predefined_html || false);
      setCustomVariables(Array.isArray(template.custom_variables) ? template.custom_variables : []);
    } else {
      setName('');
      setCategory('general');
      setSubCategory('');
      setHtmlContent('<h1>Document Title</h1>\n<p>Date: {{Today}}</p>\n<p>Dear {{Name}},</p>\n<p>We are pleased to inform you...</p>\n<p>Designation: {{Designation}}</p>\n<p>Department: {{Department}}</p>\n<br/>\n<p>Regards,</p>\n<p>{{Company Name}}</p>');
      setLetterheadUrl('');
      setEmailSubject('{{Company Name}} — Document for {{Name}}');
      setEmailBody('Dear {{Name}},\n\nPlease find the attached document for your reference.\n\nBest regards,\nHR Team');
      setIsPredefinedHtml(false);
      setCustomVariables([]);
    }
    setAiInstructions('');
  }, [template, isOpen]);

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
        category,
        sub_category: subCategory || null,
        html_content: htmlContent,
        letterhead_url: letterheadUrl || null,
        email_subject: emailSubject || null,
        email_body: emailBody || null,
        is_predefined_html: isPredefinedHtml,
        custom_variables: customVariables,
      };

      if (template) {
        const { error } = await supabase
          .from('senddesk_templates')
          .update(payload as any)
          .eq('id', template.id);
        if (error) throw error;
        toast.success('Template updated');
      } else {
        const { error } = await supabase
          .from('senddesk_templates')
          .insert(payload as any);
        if (error) throw error;
        toast.success('Template created');
      }

      queryClient.invalidateQueries({ queryKey: ['senddesk-templates'] });
      onClose();
    } catch (error: unknown) {
      toast.error(`Error: ${(error instanceof Error ? error.message : String(error))}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIGenerate = async (type: 'template' | 'email' | 'improve') => {
    setIsGeneratingAI(true);
    try {
      const subCatLabel = CATEGORIES
        .find(c => c.id === category)
        ?.subcategories.find(s => s.id === subCategory)?.label || subCategory || 'general document';

      const { data, error } = await supabase.functions.invoke('generate-ai-content', {
        body: {
          type,
          category,
          sub_category: subCatLabel,
          current_content: type === 'improve' ? htmlContent : undefined,
          available_variables: ALL_VARIABLES,
          company_name: company?.name || 'Company',
          instructions: aiInstructions || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (type === 'template' || type === 'improve') {
        setHtmlContent(data.content);
        toast.success(type === 'improve' ? 'Content improved by AI!' : 'Template generated by AI!');
      } else if (type === 'email') {
        if (data.subject) setEmailSubject(data.subject);
        if (data.body) setEmailBody(data.body);
        toast.success('Email content generated by AI!');
      }
    } catch (err: any) {
      toast.error(`AI Error: ${err.message}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const currentSubcategories = CATEGORIES.find(c => c.id === category)?.subcategories || [];

  const sampleVars: Record<string, string> = {
    'Name': 'John Doe',
    'First Name': 'John',
    'Last Name': 'Doe',
    'Employee Code': 'EMP-001',
    'Designation': 'Senior Software Engineer',
    'Department': 'Engineering',
    'Date of Joining': new Date().toLocaleDateString(),
    'Work Email': 'john.doe@company.com',
    'Personal Email': 'john@gmail.com',
    'Phone': '+91 98765 43210',
    'Gender': 'Male',
    'Today': new Date().toLocaleDateString(),
    'Company Name': company?.name || 'Company',
    ...Object.fromEntries(customVariables.map(v => [
      v.key,
      v.type === 'number' ? '12345' :
      (v.type === 'date' || v.type === 'current_date') ? new Date().toLocaleDateString() :
      v.type === 'random' ? (
        (v.random_config?.prefix || '') + 
        (
          v.random_config?.type === 'number' ? '12345678' :
          v.random_config?.type === 'text' ? 'ABCDEFGH' : 'A1B2C3D4'
        ).substring(0, v.random_config?.length || 8)
      ) :
      `Sample ${v.key}`
    ])),
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'New Document Template'}</DialogTitle>
          <DialogDescription>
            Configure document template, email settings, and dynamic variables. Use AI to generate or improve content.
          </DialogDescription>
        </DialogHeader>

        {/* Meta Fields */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Template Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Appointment Letter" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category *</label>
            <select value={category} onChange={e => { setCategory(e.target.value); setSubCategory(''); }}
              className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Document Type</label>
            <select value={subCategory} onChange={e => setSubCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">— Select —</option>
              {currentSubcategories.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <Tabs defaultValue="letter" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="letter" className="gap-2"><Edit2 className="h-3.5 w-3.5" /> Document HTML</TabsTrigger>
            <TabsTrigger value="email" className="gap-2"><Mail className="h-3.5 w-3.5" /> Email Settings</TabsTrigger>
            <TabsTrigger value="variables" className="gap-2"><Variable className="h-3.5 w-3.5" /> Variables</TabsTrigger>
            <TabsTrigger value="preview" className="gap-2"><Eye className="h-3.5 w-3.5" /> Preview</TabsTrigger>
          </TabsList>

          {/* ── Document HTML ── */}
          <TabsContent value="letter" className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Letterhead Image URL (Optional)</label>
              <Input value={letterheadUrl} onChange={e => setLetterheadUrl(e.target.value)} placeholder="https://example.com/logo.png" />
            </div>

            <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <input type="checkbox" id="predefined-html" checked={isPredefinedHtml}
                onChange={e => setIsPredefinedHtml(e.target.checked)}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
              />
              <div className="grid gap-0.5 leading-none">
                <label htmlFor="predefined-html" className="text-sm font-semibold leading-none cursor-pointer">Predefined HTML Mode</label>
                <p className="text-[11px] text-muted-foreground">Remove default paddings and styles if your HTML has its own layout.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HTML Content *</label>
                <VariableButtons variables={ALL_VARIABLES} onInsert={v => setHtmlContent(prev => prev + v)} />
              </div>
              <textarea
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                rows={14}
                className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none font-mono leading-relaxed resize-y"
                placeholder="<html>...</html>"
              />
            </div>

            {/* AI Actions */}
            <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-lg border border-violet-500/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-semibold text-violet-300">AI Assistant</span>
              </div>
              <Input
                value={aiInstructions}
                onChange={e => setAiInstructions(e.target.value)}
                placeholder="Optional: Specific instructions for AI (e.g., 'Make it more formal', 'Add salary table')"
                className="bg-background/50 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-violet-500/30 hover:bg-violet-500/10"
                  onClick={() => handleAIGenerate('template')} disabled={isGeneratingAI}
                >
                  {isGeneratingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate Template
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-violet-500/30 hover:bg-violet-500/10"
                  onClick={() => handleAIGenerate('improve')} disabled={isGeneratingAI || !htmlContent.trim()}
                >
                  {isGeneratingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Improve Content
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">AI will automatically use available variables (like {"{{Name}}"}, {"{{Designation}}"}, etc.) in the generated content.</p>
            </div>
          </TabsContent>

          {/* ── Email Settings ── */}
          <TabsContent value="email" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Subject</label>
                <VariableButtons variables={ALL_VARIABLES} onInsert={v => setEmailSubject(prev => prev + v)} />
              </div>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Document — {{Name}}" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Body</label>
                <VariableButtons variables={ALL_VARIABLES} onInsert={v => setEmailBody(prev => prev + v)} />
              </div>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={10}
                placeholder="Dear {{Name}},&#10;&#10;Please find attached..."
                className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-y leading-relaxed"
              />
            </div>

            {/* AI for email */}
            <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-lg border border-violet-500/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-semibold text-violet-300">AI Email Assistant</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-violet-500/30 hover:bg-violet-500/10"
                  onClick={() => handleAIGenerate('email')} disabled={isGeneratingAI}
                >
                  {isGeneratingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate Email Content
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-violet-500/30 hover:bg-violet-500/10"
                  onClick={() => handleAIGenerate('improve')} disabled={isGeneratingAI || !emailBody.trim()}
                >
                  {isGeneratingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Improve Email
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Variables ── */}
          <TabsContent value="variables" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Built-in Variables</label>
                  <p className="text-[10px] text-muted-foreground">These are auto-filled from employee data.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 rounded-lg border border-border/50">
                {EMPLOYEE_VARIABLES.map(v => (
                  <span key={v} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Variables</label>
                  <p className="text-[10px] text-muted-foreground">Define extra fields to fill when generating documents.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => setCustomVariables(prev => [...prev, { key: '', label: '', type: 'text', required: false }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Variable
                </Button>
              </div>
            </div>

            {customVariables.length === 0 && (
              <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg bg-muted/5 text-muted-foreground">
                <Variable className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No custom variables defined.</p>
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
                          onChange={e => { const u = [...customVariables]; u[idx] = { ...cv, key: e.target.value, label: e.target.value }; setCustomVariables(u); }}
                          placeholder="e.g. New Salary"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Input Type</label>
                        <select
                          value={cv.type}
                          onChange={e => { const u = [...customVariables]; u[idx] = { ...cv, type: e.target.value as any }; setCustomVariables(u); }}
                          className="flex h-8 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="current_date">Current Date (Auto)</option>
                          <option value="random">Random String (Auto)</option>
                        </select>
                      </div>
                    </div>

                    {cv.type === 'random' && (
                      <div className="space-y-3 mt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prefix (Optional)</label>
                          <Input
                            value={cv.random_config?.prefix || ''}
                            onChange={e => {
                              const u = [...customVariables];
                              u[idx] = { ...cv, random_config: { ...(cv.random_config || { length: 8, type: 'mix' }), prefix: e.target.value } };
                              setCustomVariables(u);
                            }}
                            placeholder="e.g. DOC-"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Length</label>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={cv.random_config?.length || 8}
                              onChange={e => {
                                const u = [...customVariables];
                                u[idx] = { ...cv, random_config: { ...(cv.random_config || { length: 8, type: 'mix' }), length: parseInt(e.target.value) || 8 } };
                                setCustomVariables(u);
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Format</label>
                            <select
                              value={cv.random_config?.type || 'mix'}
                              onChange={e => {
                                const u = [...customVariables];
                                u[idx] = { ...cv, random_config: { ...(cv.random_config || { length: 8, type: 'mix' }), type: e.target.value as any } };
                                setCustomVariables(u);
                              }}
                              className="flex h-8 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                            >
                              <option value="text">Letters only</option>
                              <option value="number">Numbers only</option>
                              <option value="mix">Alphanumeric (Mix)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {cv.type !== 'current_date' && cv.type !== 'random' ? (
                        <>
                          <input type="checkbox" id={`req-${idx}`} checked={cv.required}
                            onChange={e => { const u = [...customVariables]; u[idx] = { ...cv, required: e.target.checked }; setCustomVariables(u); }}
                            className="w-3.5 h-3.5 text-primary bg-background border-border rounded focus:ring-primary"
                          />
                          <label htmlFor={`req-${idx}`} className="text-xs text-muted-foreground cursor-pointer">Required</label>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Auto-filled</span>
                      )}
                      {cv.key && <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">{`{{${cv.key}}}`}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove custom variable" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 mt-5"
                    onClick={() => setCustomVariables(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Preview ── */}
          <TabsContent value="preview" className="py-2">
            <div className="bg-muted/10 rounded-xl p-8 border border-border/50 max-h-[60vh] overflow-auto flex justify-center">
              <div className="scale-[0.7] origin-top">
                <DocumentRenderer 
                  htmlContent={htmlContent}
                  letterheadUrl={letterheadUrl}
                  variables={sampleVars}
                  isPredefinedHtml={isPredefinedHtml}
                />
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-4 italic">
              * Preview shown with sample data. Actual values will be replaced when generating.
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
