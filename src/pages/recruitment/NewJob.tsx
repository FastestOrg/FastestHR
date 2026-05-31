import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Briefcase, Loader2, Plus, Send, Save, X, GripVertical, Settings, Mail, Bell, Sparkles, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { AIWriterModal } from '@/components/recruitment/AIWriterModal';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';

const FIXED_STAGES = ['applied', 'offer', 'hired'];

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const;
const JOB_STATUS = ['open', 'closed', 'paused', 'draft'] as const;
const WORK_TYPES = ['on_site', 'remote', 'hybrid'] as const;

const Field = ({ label, name, value, onChange, type = 'text', required = false, placeholder = '' }: {
  label: string; 
  name: string; 
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string; 
  required?: boolean; 
  placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <Input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className="bg-background/50 border-border/50 text-sm h-10 focus:border-primary"
    />
  </div>
);

const SelectField = ({ label, name, value, onChange, options }: {
  label: string; 
  name: string; 
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
    >
      <option value="">— Select —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const SortableStage = ({ id, stage, isFixed, onDelete, onSettings, automationCount }: { 
  id: string; 
  stage: string; 
  isFixed: boolean; 
  onDelete: () => void;
  onSettings: () => void;
  automationCount: number;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 p-2 rounded-md border ${
        isFixed ? 'bg-muted/30 border-dashed opacity-70' : 'bg-background border-border hover:border-primary/50'
      } transition-colors`}
    >
      <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing ${isFixed ? 'hidden' : 'text-muted-foreground'}`}>
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm font-medium capitalize">
        {stage.replace(/_/g, ' ')}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-7 px-2 gap-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
            automationCount > 0 ? 'text-primary bg-primary/10' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
          }`}
          onClick={onSettings}
        >
          <Settings className="h-3 w-3" />
          {automationCount > 0 ? `${automationCount} Action${automationCount > 1 ? 's' : ''}` : 'Automation'}
        </Button>
        {isFixed ? (
          <Badge variant="secondary" className="text-[10px] font-normal uppercase tracking-wider">Fixed</Badge>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete stage"
            title="Delete stage"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:text-destructive focus-visible:ring-2 focus-visible:ring-offset-2"
            onClick={onDelete}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

const EMPTY_AUTOMATION = {};

const AutomationModal = ({ 
  isOpen, 
  onClose, 
  stage, 
  automation = {}, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  stage: string; 
  automation: any; 
  onSave: (config: any) => void 
}) => {
  const { profile } = useAuthStore();
  const [templates, setTemplates] = useState<{ id: string, name: string }[]>([]);
  const isOfferStage = stage === 'offer';

  const [config, setConfig] = useState({
    send_email: false,
    email_template: 'standard_welcome',
    offer_template_id: '',
    notify_team: false,
    ...automation
  });

  useEffect(() => {
    if (isOpen && profile?.company_id && isOfferStage) {
      supabase
        .from('offer_templates')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .then(({ data }) => {
          if (data) setTemplates(data);
        });
    }
  }, [isOpen, profile?.company_id, isOfferStage]);

  useEffect(() => {
    if (isOpen) {
      setConfig({
        send_email: false,
        email_template: 'standard_welcome',
        offer_template_id: '',
        notify_team: false,
        ...(automation || {})
      });
    }
  }, [automation, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Stage Automation: <span className="capitalize">{stage.replace(/_/g, ' ')}</span>
          </DialogTitle>
          <DialogDescription>
            Configure actions that trigger when a candidate is moved to this stage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">

          {/* ── Offer stage: just pick the template ── */}
          {isOfferStage ? (
            <div className="rounded-md border p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="send_email"
                  checked={config.send_email}
                  onChange={(e) => setConfig({ ...config, send_email: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="send_email" className="text-sm font-medium">Send Offer Letter to Candidate</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically generate a PDF offer letter and email it when a candidate reaches this stage.
                  </p>
                </div>
              </div>
              {config.send_email && (
                <div className="ml-7 space-y-2">
                  <SelectField
                    label="Offer Letter Template"
                    name="offer_template_id"
                    value={config.offer_template_id || ''}
                    onChange={(e) => setConfig({ ...config, offer_template_id: e.target.value })}
                    options={templates.map(t => ({ value: t.id, label: t.name }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Email subject, body, and PDF layout are all configured inside the template. Go to Recruitment → Offer Templates to customise.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ── Non-offer stages: generic email options ── */
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
              <div className="pt-1">
                <input 
                  type="checkbox" 
                  id="send_email"
                  checked={config.send_email}
                  onChange={(e) => setConfig({ ...config, send_email: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>
              <div className="space-y-1 leading-none">
                <Label htmlFor="send_email" className="text-sm font-medium">Send Email to Candidate</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically send a confirmation email when moved to this stage.
                </p>
                {config.send_email && (
                  <div className="mt-3 space-y-3 w-full">
                    <SelectField
                      label="Email Template"
                      name="email_template"
                      value={config.email_template}
                      onChange={(e) => setConfig({ ...config, email_template: e.target.value })}
                      options={[
                        { value: 'standard_welcome', label: 'Standard Welcome' },
                        { value: 'interview_invite', label: 'Interview Invitation' },
                        { value: 'assessment_link', label: 'Assessment Instructions' },
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
            <div className="pt-1">
              <input 
                type="checkbox" 
                id="notify_team"
                checked={config.notify_team}
                onChange={(e) => setConfig({ ...config, notify_team: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
            <div className="space-y-1 leading-none">
              <Label htmlFor="notify_team" className="text-sm font-medium">Notify Hiring Team</Label>
              <p className="text-xs text-muted-foreground">
                Alert the department head and recruiters via system notification.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(config)}>Save Automation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function NewJob() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const isEditing = !!id;

  const [form, setForm] = useState({
    title: '',
    job_slug: '',
    department_id: '',
    is_new_department: false,
    new_department_name: '',
    location: '',
    employment_type: 'full_time' as typeof EMPLOYMENT_TYPES[number],
    work_type: 'on_site' as typeof WORK_TYPES[number],
    status: 'open' as typeof JOB_STATUS[number],
    description: '',
    requirements: '',
    min_salary: '',
    max_salary: '',
    openings: '1',
    ai_interview_enabled: false,
  });

  const [pipelineStages, setPipelineStages] = useState<string[]>(['applied', 'screening', 'interview', 'offer', 'hired']);
  const [stageAutomations, setStageAutomations] = useState<Record<string, any>>({});
  const [newStageName, setNewStageName] = useState('');
  const [editingAutomation, setEditingAutomation] = useState<string | null>(null);
  const [aiWriterModal, setAiWriterModal] = useState<{ open: boolean; type: 'job_description' | 'requirements' | 'about_company' }>({
    open: false,
    type: 'job_description',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: jobData, isLoading: isLoadingJob } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (jobData) {
      setForm({
        title: jobData.title || '',
        department_id: jobData.department_id || '',
        is_new_department: false,
        new_department_name: '',
        location: jobData.location || '',
        employment_type: (jobData.employment_type as any) || 'full_time',
        work_type: (jobData.work_type as any) || 'on_site',
        status: (jobData.status as any) || 'open',
        description: jobData.description || '',
        requirements: jobData.requirements || '',
        min_salary: jobData.min_salary?.toString() || '',
        max_salary: jobData.max_salary?.toString() || '',
        openings: jobData.openings?.toString() || '1',
        job_slug: jobData.job_slug || '',
        ai_interview_enabled: (jobData as any).ai_interview_enabled || false,
      });
      if ((jobData as any).pipeline_stages) {
        setPipelineStages((jobData as any).pipeline_stages);
      }
      if ((jobData as any).stage_automations) {
        setStageAutomations((jobData as any).stage_automations);
      }
    }
  }, [jobData]);

  const { data: departments = [], refetch: refetchDepartments } = useQuery({
    queryKey: ['departments', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').eq('company_id', profile!.company_id!).order('name');
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('currency').eq('id', profile!.company_id!).single();
      return data;
    },
    enabled: !!profile?.company_id,
  });
  const currency = companySettings?.currency || 'USD';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) {
        throw new Error('Company ID is missing. Please log out and log back in.');
      }

      const companyId = profile.company_id;
      let deptId: string | null = form.department_id || null;

      // Step 1: Create department if needed
      if (form.is_new_department && form.new_department_name.trim()) {
        const { data: newDept, error: deptError } = await supabase
          .from('departments')
          .insert({ 
            company_id: companyId, 
            name: form.new_department_name.trim() 
          })
          .select()
          .single();
        
        if (deptError) {
          throw new Error(`Failed to create department: ${deptError.message}`);
        }
        deptId = newDept.id;
        await refetchDepartments();
      }

      // Step 2: Save the job
      const jobPayload = {
        company_id: companyId,
        title: form.title,
        job_slug: form.job_slug.trim() || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        department_id: deptId,
        location: form.location || null,
        employment_type: form.employment_type,
        work_type: form.work_type || null,
        status: form.status,
        description: form.description || null,
        requirements: form.requirements || null,
        min_salary: form.min_salary ? parseFloat(form.min_salary) : null,
        max_salary: form.max_salary ? parseFloat(form.max_salary) : null,
        openings: parseInt(form.openings) || 1,
        pipeline_stages: pipelineStages,
        stage_automations: stageAutomations,
        ai_interview_enabled: form.ai_interview_enabled,
      };

      if (isEditing) {
        const { data, error } = await supabase
          .from('jobs')
          .update(jobPayload)
          .eq('id', id)
          .select()
          .single();

        if (error) throw new Error(`Failed to update job: ${error.message}`);
        return data;
      } else {
        const { data, error } = await supabase
          .from('jobs')
          .insert(jobPayload)
          .select()
          .single();

        if (error) throw new Error(`Failed to create job: ${error.message}`);
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ['job', id] });
      }
      toast.success(isEditing ? 'Job listing updated successfully' : 'Job listing posted successfully');
      navigate('/recruitment');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save job');
    },
  });

  const handleAddStage = () => {
    const trimmed = newStageName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    if (pipelineStages.includes(trimmed)) {
      toast.error('Stage already exists');
      return;
    }
    // Insert before 'offer' and 'hired'
    const offerIndex = pipelineStages.indexOf('offer');
    const newStages = [...pipelineStages];
    if (offerIndex !== -1) {
      newStages.splice(offerIndex, 0, trimmed);
    } else {
      newStages.push(trimmed);
    }
    setPipelineStages(newStages);
    setNewStageName('');
  };

  const handleRemoveStage = (stage: string) => {
    if (FIXED_STAGES.includes(stage)) return;
    setPipelineStages(pipelineStages.filter(s => s !== stage));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = pipelineStages.indexOf(active.id);
      const newIndex = pipelineStages.indexOf(over.id);
      
      // Prevent moving outside fixed boundaries or moving fixed stages
      if (FIXED_STAGES.includes(pipelineStages[oldIndex])) return;
      
      // Prevent moving to the first position (applied) or after offer/hired
      if (newIndex === 0) return; // 'applied' is at 0
      const offerIndex = pipelineStages.indexOf('offer');
      if (offerIndex !== -1 && newIndex >= offerIndex) return;

      setPipelineStages(arrayMove(pipelineStages, oldIndex, newIndex));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'department_id') {
      if (value === 'ADD_NEW') {
        setForm((prev) => ({ ...prev, department_id: '', is_new_department: true }));
      } else {
        setForm((prev) => ({ ...prev, department_id: value, is_new_department: false }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Job title is required');
      return;
    }
    if (form.is_new_department && !form.new_department_name.trim()) {
      toast.error('Department name is required');
      return;
    }
    saveMutation.mutate();
  };


  if (isEditing && isLoadingJob) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          title="Go back"
          onClick={() => navigate('/recruitment')}
          className="border border-border/50 hover:border-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {isEditing ? <Save className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            {isEditing ? 'Edit Job Posting' : 'Post New Job'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isEditing ? 'Update the details for this job listing' : 'Create a new job listing'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5">01</span>
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field 
                label="Job Title" 
                name="title" 
                required 
                placeholder="Senior Frontend Engineer" 
                value={form.title}
                onChange={handleChange}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Field 
                label="Job Slug (Career Page URL)" 
                name="job_slug" 
                placeholder="senior-frontend-engineer (Leave blank to auto-generate)" 
                value={form.job_slug}
                onChange={handleChange}
              />
              <p className="text-[10px] text-muted-foreground ml-1">This will be the URL for this job: /jobs/[job-slug]</p>
            </div>
            <div className="space-y-4">
              <SelectField
                label="Department"
                name="department_id"
                value={form.is_new_department ? 'ADD_NEW' : form.department_id}
                onChange={handleChange}
                options={[
                  ...departments.map((d: any) => ({ value: d.id, label: d.name })),
                  { value: 'ADD_NEW', label: '+ Add New Department' }
                ]}
              />
              {form.is_new_department && (
                <Field
                  label="New Department Name"
                  name="new_department_name"
                  required
                  placeholder="e.g. Engineering"
                  value={form.new_department_name}
                  onChange={handleChange}
                />
              )}
            </div>
            <Field 
              label="Location" 
              name="location" 
              placeholder="Remote / New York, NY" 
              value={form.location}
              onChange={handleChange}
            />
            <SelectField
              label="Employment Type"
              name="employment_type"
              value={form.employment_type}
              onChange={handleChange}
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))}
            />
            <SelectField
              label="Work Type"
              name="work_type"
              value={form.work_type}
              onChange={handleChange}
              options={WORK_TYPES.map((w) => ({ value: w, label: w.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))}
            />
            <SelectField
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={JOB_STATUS.map((s) => ({ value: s, label: s.replace(/\b\w/g, c => c.toUpperCase()) }))}
            />
            <Field 
              label="Number of Openings" 
              name="openings" 
              type="number" 
              placeholder="1" 
              value={form.openings}
              onChange={handleChange}
            />
          </CardContent>
        </Card>

        {/* Compensation */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5">02</span>
              Compensation Range
            </CardTitle>
            <CardDescription className="text-xs font-medium">Optional salary band (annual)</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
            <Field 
              label={`Min Salary (${currency})`}
              name="min_salary" 
              type="number" 
              placeholder="80000" 
              value={form.min_salary}
              onChange={handleChange}
            />
            <Field 
              label={`Max Salary (${currency})`}
              name="max_salary" 
              type="number" 
              placeholder="120000" 
              value={form.max_salary}
              onChange={handleChange}
            />
          </CardContent>
        </Card>

        {/* hiring process */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5">03</span>
              Hiring Process
            </CardTitle>
            <CardDescription className="text-xs font-medium">Define the custom stages for this role's pipeline</CardDescription>
          </CardHeader>
          {/* AI Interview Toggle */}
          <div className="px-6 pt-4 pb-0">
            <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
              form.ai_interview_enabled
                ? 'bg-primary/5 border-primary/30'
                : 'bg-muted/20 border-border/40'
            }`}>
              <div className={`mt-0.5 flex-shrink-0 p-2 rounded-xl ${
                form.ai_interview_enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-foreground">Enable AI Voice Interview</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When on, candidates will complete an autonomous AI screening call (powered by Gemini Live) before submitting their application.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.ai_interview_enabled}
                    onClick={() => setForm(prev => ({ ...prev, ai_interview_enabled: !prev.ai_interview_enabled }))}
                    className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      form.ai_interview_enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                      form.ai_interview_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                {form.ai_interview_enabled && (
                  <div className="mt-2 text-[11px] text-primary/70 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    AI will ask 4-5 questions based on your job requirements and score candidates automatically.
                  </div>
                )}
              </div>
            </div>
          </div>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Phone Screen"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStage())}
                className="bg-background/50 border-border/50"
              />
              <Button type="button" onClick={handleAddStage} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add Stage
              </Button>
            </div>

            <div className="space-y-2 mt-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pipelineStages}
                  strategy={verticalListSortingStrategy}
                >
                  {pipelineStages.map((stage) => {
                    const automation = stageAutomations[stage] || {};
                    const automationCount = (automation.send_email ? 1 : 0) + (automation.notify_team ? 1 : 0);
                    
                    return (
                      <SortableStage
                        key={stage}
                        id={stage}
                        stage={stage}
                        isFixed={FIXED_STAGES.includes(stage)}
                        automationCount={automationCount}
                        onDelete={() => handleRemoveStage(stage)}
                        onSettings={() => setEditingAutomation(stage)}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              * Drag and drop stages to reorder. "Applied", "Offer", and "Hired" are fixed steps that cannot be removed or moved.
            </p>
          </CardContent>
        </Card>

        {/* Automation Modal */}
        <AutomationModal 
          isOpen={!!editingAutomation}
          stage={editingAutomation || ''}
          automation={editingAutomation ? (stageAutomations[editingAutomation] || EMPTY_AUTOMATION) : EMPTY_AUTOMATION}
          onClose={() => setEditingAutomation(null)}
          onSave={(config) => {
            setStageAutomations({ ...stageAutomations, [editingAutomation!]: config });
            setEditingAutomation(null);
            toast.success(`Automations updated for ${editingAutomation}`);
          }}
        />

        {/* Description */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5">04</span>
              Job Description
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Job Description</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 gap-1.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary border border-primary/20"
                  onClick={() => setAiWriterModal({ open: true, type: 'job_description' })}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Take Fastu AI Assistance
                </Button>
              </div>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={5}
                placeholder="Describe the role, responsibilities, and what the candidate will work on..."
                className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Requirements</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 gap-1.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary border border-primary/20"
                  onClick={() => setAiWriterModal({ open: true, type: 'requirements' })}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Take Fastu AI Assistance
                </Button>
              </div>
              <textarea
                name="requirements"
                value={form.requirements}
                onChange={handleChange}
                rows={4}
                placeholder="List key skills, qualifications, and experience required..."
                className="flex w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Writer Modal */}
        <AIWriterModal
          open={aiWriterModal.open}
          onOpenChange={(o) => setAiWriterModal(prev => ({ ...prev, open: o }))}
          type={aiWriterModal.type}
          context={{
            title: form.title,
            department: departments.find((d: any) => d.id === form.department_id)?.name,
            location: form.location,
            employmentType: form.employment_type,
            workType: form.work_type,
            minSalary: form.min_salary,
            maxSalary: form.max_salary,
          }}
          onAccept={(content) => {
            setForm(prev => ({ ...prev, [aiWriterModal.type === 'job_description' ? 'description' : 'requirements']: content }));
            toast.success('AI content applied!');
          }}
        />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/recruitment')}
            className="border-border/50 hover:border-primary/50 transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="gap-2 min-w-[160px]"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              <Save className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Job' : 'Post Job'}
          </Button>
        </div>
      </form>
    </div>
  );
}
