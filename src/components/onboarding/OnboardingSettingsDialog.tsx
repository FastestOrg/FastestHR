
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Trash2, Settings2, ClipboardList, 
  Mail, Hash, Loader2, Save, X, Edit2,
  PartyPopper, Upload, Monitor, Users, FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const ICON_OPTIONS = [
  { name: 'ClipboardList', icon: ClipboardList },
  { name: 'PartyPopper', icon: PartyPopper },
  { name: 'Upload', icon: Upload },
  { name: 'Monitor', icon: Monitor },
  { name: 'Users', icon: Users },
];

const ICON_DICT = ICON_OPTIONS.reduce((acc: any, option) => {
  acc[option.name] = option.icon;
  return acc;
}, {});

interface OnboardingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export function OnboardingSettingsDialog({ open, onOpenChange, companyId }: OnboardingSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('id-generation');
  
  // Custom states for steps
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({ title: '', description: '', icon_name: 'ClipboardList' });

  // Custom states for document requirements
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({ title: '', description: '', type: 'file', is_mandatory: true });

  // Fetch Company Settings
  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company-settings', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('employee_id_prefix, employee_id_next_number')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch Onboarding Steps
  const { data: steps = [], isLoading: isLoadingSteps } = useQuery({
    queryKey: ['onboarding-steps', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_steps')
        .select('*')
        .eq('company_id', companyId)
        .order('order_index');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch Document Requirements
  const { data: docRequirements = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['onboarding-doc-requirements', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_document_requirements')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Mutations
  const updateCompanyMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companyId)
        .select('id');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings', companyId] });
      toast.success('ID Generation settings updated');
    },
  });

  const saveStepMutation = useMutation({
    mutationFn: async (step: any) => {
      if (editingStepId) {
        const { error } = await supabase
          .from('onboarding_steps')
          .update(step)
          .eq('id', editingStepId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('onboarding_steps')
          .insert([{ ...step, company_id: companyId, order_index: steps.length }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-steps', companyId] });
      toast.success(editingStepId ? 'Step updated' : 'Step added');
      setIsAddingStep(false);
      setEditingStepId(null);
      setStepForm({ title: '', description: '', icon_name: 'ClipboardList' });
    },
  });

  const saveDocMutation = useMutation({
    mutationFn: async (doc: any) => {
      if (editingDocId) {
        const { error } = await supabase
          .from('onboarding_document_requirements')
          .update(doc)
          .eq('id', editingDocId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('onboarding_document_requirements')
          .insert([{ ...doc, company_id: companyId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-doc-requirements', companyId] });
      toast.success(editingDocId ? 'Document requirement updated' : 'Document requirement added');
      setIsAddingDoc(false);
      setEditingDocId(null);
      setDocForm({ title: '', description: '', type: 'file', is_mandatory: true });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from('onboarding_steps').delete().eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-steps', companyId] });
      toast.success('Step removed');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from('onboarding_document_requirements').delete().eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-doc-requirements', companyId] });
      toast.success('Document requirement removed');
    },
  });

  const [idPrefix, setIdPrefix] = useState('EMP-');
  const [idStart, setIdStart] = useState<number>(1);

  useEffect(() => {
    if (company) {
      setIdPrefix(company.employee_id_prefix || 'EMP-');
      setIdStart(company.employee_id_next_number || 1);
    }
  }, [company]);

  const handleSaveIdSettings = () => {
    updateCompanyMutation.mutate({
      employee_id_prefix: idPrefix,
      employee_id_next_number: idStart,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Onboarding Dashboard Settings
          </DialogTitle>
          <DialogDescription>
            Configure how your company manages new hires, employee IDs, and onboarding workflows.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="id-generation" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              ID Generation
            </TabsTrigger>
            <TabsTrigger value="steps" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Workflow Steps
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center gap-2 text-xs">
              <FileText className="h-4 w-4" />
              Required Documents
            </TabsTrigger>
            <TabsTrigger value="automations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Automations
            </TabsTrigger>
          </TabsList>

          {/* ID Generation Tab */}
          <TabsContent value="id-generation" className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="id-prefix">Employee ID Prefix</Label>
                <Input 
                  id="id-prefix" 
                  value={idPrefix} 
                  onChange={(e) => setIdPrefix(e.target.value)} 
                  placeholder="e.g. EMP-"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="id-start">Next / Current ID Number</Label>
                <Input 
                  id="id-start" 
                  type="number" 
                  value={idStart} 
                  onChange={(e) => setIdStart(parseInt(e.target.value) || 1)} 
                />
              </div>
            </div>

            <Card className="bg-muted/30 border-dashed">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Preview</CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4 text-2xl font-mono font-bold text-primary">
                {idPrefix}{idStart}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveIdSettings} disabled={updateCompanyMutation.isPending}>
                {updateCompanyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save ID Settings
              </Button>
            </div>
          </TabsContent>

          {/* Workflow Steps Tab */}
          <TabsContent value="steps" className="py-4">
             {/* ... existing steps management logic ... */}
             <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Onboarding Pipeline Steps</h3>
              {!isAddingStep && (
                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => setIsAddingStep(true)}>
                  <Plus className="h-4 w-4" /> Add Step
                </Button>
              )}
            </div>

            {isAddingStep && (
              <Card className="mb-4 border-primary/20 bg-primary/5">
                <CardContent className="pt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Step Title</Label>
                        <Input value={stepForm.title} onChange={e => setStepForm(p=>({...p, title: e.target.value}))} placeholder="e.g. IT Setup" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Icon</Label>
                        <div className="flex gap-2">
                            {ICON_OPTIONS.map(opt => (
                                <Button 
                                    key={opt.name} 
                                    variant={stepForm.icon_name === opt.name ? 'default' : 'outline'} 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => setStepForm(p=>({...p, icon_name: opt.name}))}
                                    aria-label={`Select icon ${opt.name}`}
                                >
                                    <opt.icon className="h-4 w-4" />
                                </Button>
                            ))}
                        </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Description</Label>
                    <Textarea value={stepForm.description} onChange={e => setStepForm(p=>({...p, description: e.target.value}))} placeholder="Describe the task..." className="h-20" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => {setIsAddingStep(false); setEditingStepId(null);}}>Cancel</Button>
                    <Button size="sm" onClick={() => saveStepMutation.mutate(stepForm)}>Save Step</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-2">
                {steps.map((step: any) => {
                    const Icon = ICON_DICT[step.icon_name] || ClipboardList;
                    return (
                        <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border group bg-card transition-all hover:border-primary/30">
                            <div className="bg-primary/10 p-2 rounded text-primary"><Icon className="h-4 w-4" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{step.title}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{step.description}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                <Button size="icon" aria-label="Edit step" variant="ghost" className="h-8 w-8" onClick={() => {
                                    setEditingStepId(step.id);
                                    setStepForm({ title: step.title, description: step.description || '', icon_name: step.icon_name || 'ClipboardList' });
                                    setIsAddingStep(true);
                                }}><Edit2 className="h-4 w-4" /></Button>
                                <Button size="icon" aria-label="Delete step" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteStepMutation.mutate(step.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* New Document Requirements Tab */}
          <TabsContent value="docs" className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Mandatory Onboarding Documents</h3>
              {!isAddingDoc && (
                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => setIsAddingDoc(true)}>
                  <Plus className="h-4 w-4" /> Add Requirement
                </Button>
              )}
            </div>

            {isAddingDoc && (
              <Card className="mb-4 border-primary/20 bg-primary/5">
                <CardContent className="pt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Document Title</Label>
                        <Input value={docForm.title} onChange={e => setDocForm(p=>({...p, title: e.target.value}))} placeholder="e.g. Passport Copy" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Input Type</Label>
                        <Select value={docForm.type} onValueChange={v => setDocForm(p=>({...p, type: v}))}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="file">File Upload (PDF, Doc, Image)</SelectItem>
                                <SelectItem value="text">Text Input (e.g. Bio, Details)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Description / Instructions</Label>
                    <Textarea value={docForm.description} onChange={e => setDocForm(p=>({...p, description: e.target.value}))} placeholder="Instructions for the new hire..." className="h-20" />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                        <Switch checked={docForm.is_mandatory} onCheckedChange={v => setDocForm(p=>({...p, is_mandatory: v}))} />
                        <Label className="text-xs">Is Mandatory</Label>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => {setIsAddingDoc(false); setEditingDocId(null);}}>Cancel</Button>
                        <Button size="sm" onClick={() => saveDocMutation.mutate(docForm)}>Save Requirement</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-2">
                {isLoadingDocs ? (
                    <div className="space-y-2"><Loader2 className="h-4 w-4 animate-spin" /><p className="text-xs">Loading definitions...</p></div>
                ) : docRequirements.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground/40">
                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-xs italic">Define required documents for your onboarding process</p>
                    </div>
                ) : (
                    docRequirements.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border group bg-card hover:border-primary/30">
                            <div className="bg-primary/10 p-2 rounded text-primary">
                                {doc.type === 'file' ? <Upload className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{doc.title}</p>
                                    {doc.is_mandatory && <Badge className="text-[8px] h-3 px-1 bg-amber-500/10 text-amber-600 border-amber-500/20">MANDATORY</Badge>}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{doc.description}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                <Button size="icon" aria-label="Edit document requirement" variant="ghost" className="h-8 w-8" onClick={() => {
                                    setEditingDocId(doc.id);
                                    setDocForm({ title: doc.title, description: doc.description || '', type: doc.type, is_mandatory: doc.is_mandatory });
                                    setIsAddingDoc(true);
                                }}><Edit2 className="h-4 w-4" /></Button>
                                <Button size="icon" aria-label="Delete document requirement" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteDocMutation.mutate(doc.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))
                )}
              </div>
            </ScrollArea>
            <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <p className="text-[10px] text-amber-700 leading-relaxed">
                    Once a new hire completes these, they can't delete them. HR can view all documents and their percentages in the onboarding dashboard.
                </p>
            </div>
          </TabsContent>

          {/* Automations Tab */}
          <TabsContent value="automations" className="py-4">
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm italic">Email automation management coming soon in v1.1</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
