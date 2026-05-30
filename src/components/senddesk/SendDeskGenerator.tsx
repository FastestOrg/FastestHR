import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { 
  Loader2, FileText, Eye, Search, Users, ChevronRight, Check, Download, 
  UserPlus, ArrowUpCircle, UserMinus, FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentRenderer, replaceDocVariables } from './DocumentRenderer';
import { EMPLOYEE_VARIABLES, type CustomVariable } from './SendDeskTemplates';
import { generateAndUploadSendDeskPDF } from '@/lib/pdf-generator';

const CATEGORY_ICONS: Record<string, any> = {
  onboarding: UserPlus,
  lifecycle: ArrowUpCircle,
  offboarding: UserMinus,
  general: FileCheck,
};

const CATEGORY_COLORS: Record<string, string> = {
  onboarding: 'text-emerald-400',
  lifecycle: 'text-blue-400',
  offboarding: 'text-amber-400',
  general: 'text-violet-400',
};

const generateRandomString = (length: number, type: 'text' | 'number' | 'mix') => {
  const chars = {
    text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    number: '0123456789',
    mix: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  };
  const charset = chars[type] || chars.mix;
  let result = '';
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    result += charset.charAt(randomValues[i] % charset.length);
  }
  return result;
};

interface Template {
  id: string;
  name: string;
  category: string;
  sub_category: string | null;
  html_content: string;
  letterhead_url: string | null;
  is_predefined_html: boolean;
  custom_variables: CustomVariable[];
  email_subject: string | null;
  email_body: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string | null;
  work_email: string | null;
  personal_email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_joining: string | null;
  department_id: string | null;
  designation_id: string | null;
  departments?: { name: string } | null;
  designations?: { title: string } | null;
}

export function SendDeskGenerator() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [customVarValues, setCustomVarValues] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState<{ current: number; total: number } | null>(null);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['senddesk-templates', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('senddesk_templates')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('category', { ascending: true });
      if (error) throw error;
      return data as unknown as Template[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees-list', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, departments(name), designations(title)')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null)
        .order('first_name', { ascending: true });
      if (error) throw error;
      return data as unknown as Employee[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: company } = useQuery({
    queryKey: ['company-basic', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('companies')
        .select('name, senddesk_sequence_prefix, senddesk_sequence_current')
        .eq('id', profile!.company_id!)
        .single();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const searchableMetadata = useMemo(() => {
    return employees.map(e => ({
      employee: e,
      fullNameLower: `${e.first_name} ${e.last_name}`.toLowerCase(),
      codeLower: (e.employee_code || '').toLowerCase(),
      emailLower: (e.work_email || '').toLowerCase(),
    }));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const s = searchTerm.toLowerCase();
    return searchableMetadata
      .filter(m =>
        m.fullNameLower.includes(s) ||
        m.codeLower.includes(s) ||
        m.emailLower.includes(s)
      )
      .map(m => m.employee);
  }, [employees, searchableMetadata, searchTerm]);

  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, Template[]> = {};
    templates.forEach(t => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });
    return grouped;
  }, [templates]);

  const buildVariables = (emp: Employee): Record<string, string> => {
    const vars: Record<string, string> = {
      'Name': `${emp.first_name} ${emp.last_name}`,
      'First Name': emp.first_name,
      'Last Name': emp.last_name,
      'Employee Code': emp.employee_code || '',
      'Designation': emp.designations?.title || '',
      'Department': emp.departments?.name || '',
      'Date of Joining': emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString() : '',
      'Work Email': emp.work_email || '',
      'Personal Email': emp.personal_email || '',
      'Phone': emp.phone || '',
      'Gender': emp.gender || '',
      'Today': new Date().toLocaleDateString(),
      'Company Name': company?.name || '',
      ...customVarValues,
    };
    // Handle current_date custom variables
    if (selectedTemplate?.custom_variables) {
      selectedTemplate.custom_variables.forEach(cv => {
        if (cv.type === 'current_date') {
          vars[cv.key] = new Date().toLocaleDateString();
        } else if (cv.type === 'random') {
          const config = cv.random_config || { length: 8, type: 'mix' };
          vars[cv.key] = (config.prefix || '') + generateRandomString(config.length, config.type);
        }
      });
    }
    return vars;
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || selectedEmployees.length === 0) {
      toast.error('Please select a template and at least one employee');
      return;
    }

    // Validate required custom variables
    const missingRequired = selectedTemplate.custom_variables
      ?.filter(cv => cv.required && cv.type !== 'current_date' && cv.type !== 'random' && !customVarValues[cv.key]?.trim());
    if (missingRequired?.length) {
      toast.error(`Please fill required fields: ${missingRequired.map(v => v.key).join(', ')}`);
      return;
    }

    setIsGenerating(true);
    try {
      let seqCurrent = company?.senddesk_sequence_current || 0;
      const prefix = company?.senddesk_sequence_prefix || 'DOC-';
      const year = new Date().getFullYear();

      const user = (await supabase.auth.getUser()).data.user;

      // Pre-calculate document parameters sequentially to preserve sequence increments
      const docConfigs = selectedEmployees.map(emp => {
        seqCurrent++;
        const docNumber = `${prefix}${year}-${String(seqCurrent).padStart(4, '0')}`;
        const vars = buildVariables(emp);
        const renderedHtml = replaceDocVariables(selectedTemplate.html_content, vars);
        const docId = crypto.randomUUID();

        return {
          emp,
          docNumber,
          vars,
          renderedHtml,
          docId,
        };
      });

      // Generate all PDFs sequentially to prevent browser layout thrashing and white flash
      const newDocuments = [];
      setGeneratingProgress({ current: 0, total: selectedEmployees.length });

      for (let i = 0; i < docConfigs.length; i++) {
        const config = docConfigs[i];
        setGeneratingProgress({ current: i + 1, total: selectedEmployees.length });

        const { pdfPath } = await generateAndUploadSendDeskPDF({
          htmlContent: config.renderedHtml,
          letterheadUrl: selectedTemplate.letterhead_url,
          companyId: profile!.company_id!,
          documentId: config.docId,
          documentName: selectedTemplate.name,
          isPredefinedHtml: selectedTemplate.is_predefined_html,
        });

        newDocuments.push({
          id: config.docId,
          company_id: profile!.company_id!,
          template_id: selectedTemplate.id,
          employee_id: config.emp.id,
          document_number: config.docNumber,
          name: `${selectedTemplate.name} — ${config.emp.first_name} ${config.emp.last_name}`,
          category: selectedTemplate.category,
          sub_category: selectedTemplate.sub_category,
          html_content: config.renderedHtml,
          pdf_url: pdfPath,
          variable_values: config.vars,
          status: 'generated',
          is_predefined_html: selectedTemplate.is_predefined_html,
          letterhead_url: selectedTemplate.letterhead_url,
          created_by: user?.id,
        });
      }

      // Bulk insert all generated documents
      if (newDocuments.length > 0) {
        const { error } = await supabase
          .from('senddesk_documents')
          .insert(newDocuments as any);

        if (error) throw error;
      }

      // Update company sequence
      await supabase
        .from('companies')
        .update({ senddesk_sequence_current: seqCurrent } as any)
        .eq('id', profile!.company_id!)
        .select('id');

      toast.success(`Generated ${selectedEmployees.length} document(s) successfully!`);
      queryClient.invalidateQueries({ queryKey: ['senddesk-documents'] });
      
      // Reset
      setStep(1);
      setSelectedTemplate(null);
      setSelectedEmployees([]);
      setCustomVarValues({});
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingProgress(null);
    }
  };

  const toggleEmployee = (emp: Employee) => {
    setSelectedEmployees(prev =>
      prev.find(e => e.id === emp.id)
        ? prev.filter(e => e.id !== emp.id)
        : [...prev, emp]
    );
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: 'Select Template' },
          { num: 2, label: 'Select Employee(s)' },
          { num: 3, label: 'Fill Variables & Generate' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/30" />}
            <button
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                step === s.num
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : step > s.num
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-muted/30 text-muted-foreground border border-transparent'
              }`}
            >
              <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                step > s.num ? 'bg-emerald-500 text-white' : step === s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
              </span>
              {s.label}
            </button>
          </div>
        ))}
      </div>

      {/* Step 1: Select Template */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Choose a Template</h2>
          {loadingTemplates ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : templates.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No templates found. Create one in the Templates tab first.</p>
            </div>
          ) : (
            Object.entries(templatesByCategory).map(([catId, catTemplates]) => {
              const Icon = CATEGORY_ICONS[catId] || FileText;
              return (
                <div key={catId}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${CATEGORY_COLORS[catId] || 'text-primary'}`} />
                    {catId.charAt(0).toUpperCase() + catId.slice(1)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                    {catTemplates.map(t => (
                      <Card
                        key={t.id}
                        onClick={() => { setSelectedTemplate(t); setStep(2); }}
                        className={`cursor-pointer transition-all hover:border-primary/50 ${
                          selectedTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'bg-background/50 border-border/50'
                        }`}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            selectedTemplate?.id === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                          }`}>
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{t.name}</p>
                            {t.sub_category && (
                              <p className="text-[10px] text-muted-foreground capitalize">{t.sub_category.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                          {selectedTemplate?.id === t.id && <Check className="h-5 w-5 text-primary shrink-0" />}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Step 2: Select Employees */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Select Employee(s)</h2>
            <Badge variant="secondary" className="text-xs">{selectedEmployees.length} selected</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, code or email..."
              className="pl-10"
            />
          </div>

          {selectedEmployees.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
              {selectedEmployees.map(emp => (
                <Badge key={emp.id} variant="secondary" className="gap-1.5 cursor-pointer hover:bg-destructive/20 transition-colors"
                  onClick={() => toggleEmployee(emp)}
                >
                  {emp.first_name} {emp.last_name} ✕
                </Badge>
              ))}
            </div>
          )}

          {loadingEmployees ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
              {filteredEmployees.map(emp => {
                const isSelected = selectedEmployees.some(e => e.id === emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleEmployee(emp)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                      isSelected ? 'border-primary/30 bg-primary/5' : 'border-border/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isSelected ? <Check className="h-4 w-4" /> : `${emp.first_name[0]}${emp.last_name[0]}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.first_name} {emp.last_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {emp.designations?.title || 'No title'} • {emp.employee_code || 'No code'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={() => setStep(3)} disabled={selectedEmployees.length === 0}>
              Continue ({selectedEmployees.length}) →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Variables & Generate */}
      {step === 3 && selectedTemplate && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Fill Variables & Generate</h2>
            <div className="flex gap-2">
              {selectedEmployees.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => {
                    setPreviewEmployee(selectedEmployees[0]);
                    setIsPreviewOpen(true);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
              )}
            </div>
          </div>

          {/* Auto-filled variables summary */}
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Auto-filled from Employee Data ({selectedEmployees.length} employee{selectedEmployees.length > 1 ? 's' : ''})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYEE_VARIABLES.map(v => (
                  <span key={v} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">{`{{${v}}}`}</span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom variable inputs */}
          {selectedTemplate.custom_variables && selectedTemplate.custom_variables.length > 0 && (
            <Card className="bg-background/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Custom Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedTemplate.custom_variables
                  .filter(cv => cv.type !== 'current_date' && cv.type !== 'random')
                  .map(cv => (
                    <div key={cv.key} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {cv.key} {cv.required && <span className="text-destructive">*</span>}
                      </label>
                      <Input
                        type={cv.type === 'number' ? 'number' : cv.type === 'date' ? 'date' : 'text'}
                        value={customVarValues[cv.key] || ''}
                        onChange={e => setCustomVarValues(prev => ({ ...prev, [cv.key]: e.target.value }))}
                        placeholder={`Enter ${cv.key}`}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {generatingProgress 
                    ? `Generating ${generatingProgress.current} of ${generatingProgress.total}...` 
                    : 'Generating...'}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate {selectedEmployees.length} Document(s)
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>
              {previewEmployee && `Preview for ${previewEmployee.first_name} ${previewEmployee.last_name}`}
            </DialogDescription>
          </DialogHeader>
          {previewEmployee && selectedTemplate && (
            <div className="bg-muted/10 rounded-xl p-6 border border-border/50 max-h-[65vh] overflow-auto flex justify-center">
              <div className="scale-[0.65] origin-top">
                <DocumentRenderer
                  htmlContent={selectedTemplate.html_content}
                  letterheadUrl={selectedTemplate.letterhead_url}
                  variables={buildVariables(previewEmployee)}
                  isPredefinedHtml={selectedTemplate.is_predefined_html}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
