import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, ChevronDown, UserPlus, FileUp, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { BulkUploadDialog } from './BulkUploadDialog';
import { generateSampleCSV } from '@/lib/csv-parser';

interface AddCandidateDialogProps {
  jobId: string;
  variant?: 'full' | 'icon';
}

export function AddCandidateDialog({ jobId, variant = 'full' }: AddCandidateDialogProps) {
  const [isIndividualOpen, setIsIndividualOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    source: 'direct',
    score: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !profile?.company_id) throw new Error('Missing required info');
      const { data, error } = await supabase
        .from('candidates')
        .insert([
          {
            job_id: jobId,
            company_id: profile.company_id,
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone || null,
            source: formData.source,
            stage: 'applied',
            score: formData.score ? parseFloat(formData.score) : null,
            assigned_to: profile.id,
            assigned_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
      queryClient.invalidateQueries({ queryKey: ['leads-board'] });
      toast.success('Applicant added successfully');
      setIsIndividualOpen(false);
      setFormData({ fullName: '', email: '', phone: '', source: 'direct', score: '' });
    },
    onError: (error) => {
      console.error('Error adding applicant:', error);
      toast.error('Failed to add applicant');
    },
  });

  const handleCloseIndividual = () => {
    setFormData({ fullName: '', email: '', phone: '', source: 'direct', score: '' });
    setIsIndividualOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) {
      toast.error('Please fill in required fields');
      return;
    }
    mutation.mutate();
  };

  const handleDownloadSample = (e: React.MouseEvent) => {
    e.stopPropagation();
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_applicants.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV downloaded');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === 'full' ? (
            <Button 
              variant="outline" 
              size="sm"
              className="h-8 gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary group transition-all rounded-lg px-3 shadow-sm hover:shadow-md animate-in fade-in zoom-in duration-300"
            >
              <Users className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-tight">Add Applicant</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="icon"
              aria-label="Add Applicant"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all rounded-lg relative group/icon"
              title="Add Applicant"
            >
              <div className="relative">
                <Users className="h-4 w-4 group-hover/icon:scale-110 transition-transform" />
                <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-0.5 border-2 border-background">
                  <Plus className="h-2 w-2" />
                </div>
              </div>
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-[200px] p-1 bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl rounded-xl animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <DropdownMenuItem 
            onClick={() => setIsIndividualOpen(true)} 
            className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-primary/10 data-[highlighted]:bg-primary/10 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Individual</span>
              <span className="text-[10px] text-muted-foreground">Add manually</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setIsBulkOpen(true)} 
            className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-primary/10 data-[highlighted]:bg-primary/10 transition-colors group/bulk"
          >
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <FileUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Bulk Upload</span>
              <span className="text-[10px] text-muted-foreground">Upload CSV</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Download sample CSV"
              className="ml-auto h-7 w-7 rounded-full opacity-0 group-hover/bulk:opacity-100 hover:bg-emerald-500/20 hover:text-emerald-500 transition-all"
              onClick={handleDownloadSample}
              title="Download sample CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Individual Dialog */}
      <Dialog open={isIndividualOpen} onOpenChange={handleCloseIndividual}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Applicant</DialogTitle>
            <DialogDescription>
              Add a new candidate manually to this job pipeline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 890"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value })}
                disabled={mutation.isPending}
              >
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="indeed">Indeed</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="score">Score (0.0 - 10.0)</Label>
              <Input
                id="score"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={formData.score}
                onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                placeholder="e.g. 8.5"
                disabled={mutation.isPending}
              />
            </div>
            <div className="flex justify-end pt-4 space-x-2">
              <Button type="button" variant="outline" onClick={handleCloseIndividual} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mutation.isPending ? 'Adding...' : 'Add Applicant'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog 
        jobId={jobId} 
        isOpen={isBulkOpen} 
        onOpenChange={setIsBulkOpen} 
      />
    </>
  );
}
