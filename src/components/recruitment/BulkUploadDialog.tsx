import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, Download, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { parseCandidatesCSV, BulkCandidate } from '@/lib/csv-parser';

interface BulkUploadDialogProps {
  jobId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
  referredBy?: string;
}

export function BulkUploadDialog({ jobId, isOpen, onOpenChange, source = 'bulk_upload', referredBy }: BulkUploadDialogProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [candidates, setCandidates] = useState<BulkCandidate[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const mutation = useMutation({
    mutationFn: async (candidatesToInsert: BulkCandidate[]) => {
      if (!jobId || !profile?.company_id) throw new Error('Missing required info');
      
      const payload = candidatesToInsert.map(c => {
        // Separate core fields from extra fields
        const { full_name, email, phone, ...extra } = c;
        return {
          job_id: jobId,
          company_id: profile.company_id,
          full_name,
          email,
          phone: phone || null,
          source,
          stage: 'applied',
          referred_by: referredBy || null,
          parsed_data: extra, // Store all extra columns dynamically
          assigned_to: referredBy ? null : profile.id,
          assigned_at: referredBy ? null : new Date().toISOString(),
        };
      });

      const { data, error } = await supabase
        .from('candidates')
        .insert(payload)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
      queryClient.invalidateQueries({ queryKey: ['leads-board'] });
      toast.success(`${candidates.length} applicants added successfully`);
      handleClose();
    },
    onError: (error) => {
      console.error('Error in bulk upload:', error);
      toast.error('Failed to upload applicants');
    },
  });

  const handleClose = () => {
    setCandidates([]);
    onOpenChange(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers: parsedHeaders, candidates: parsedCandidates } = parseCandidatesCSV(text);
      if (parsedCandidates.length === 0) {
        toast.error('No valid candidates found in CSV. Please check headers: Name, Email, etc.');
      } else {
        setHeaders(parsedHeaders);
        setCandidates(parsedCandidates);
        toast.success(`Found ${parsedCandidates.length} candidates`);
      }
      setIsParsing(false);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsParsing(false);
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (candidates.length === 0) return;
    mutation.mutate(candidates);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl p-0 overflow-hidden">
        <div className="p-6 pb-4 border-b border-border/10 bg-muted/30">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              </div>
              Bulk Upload Applicants
            </DialogTitle>
            <DialogDescription className="text-sm">
              Quickly import multiple candidates into this job pipeline using a CSV file.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="p-6 space-y-6">
          {candidates.length === 0 ? (
            <div className="group relative border-2 border-dashed border-border/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-2xl p-12 transition-all duration-300">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-primary/5 p-5 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-lg">Click or drag CSV file</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
                    Ensure your file contains Name, Email, Phone, and other required headers.
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="bulk-csv-upload"
                />
                <Button variant="outline" className="rounded-full px-8 pointer-events-none group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                  Browse Files
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center font-bold text-emerald-500">
                    {candidates.length}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Candidates Found</h4>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ready for import</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCandidates([])} 
                  className="h-8 px-3 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                >
                  <X className="h-4 w-4 mr-2" /> Start Over
                </Button>
              </div>

                <div className="max-h-[300px] overflow-auto border border-border/50 rounded-xl shadow-inner bg-card/50">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        {headers.map((header, i) => (
                          <th key={i} className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {candidates.slice(0, 10).map((c, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          {headers.map((header, j) => {
                            const key = header.toLowerCase().replace(/\s+/g, '_');
                            return (
                              <td key={j} className={`px-4 py-3 whitespace-nowrap ${j === 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                                {c[key] || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {candidates.length > 10 && (
                        <tr className="bg-muted/10">
                          <td colSpan={headers.length} className="px-4 py-3 text-center text-xs text-muted-foreground font-medium italic">
                            + {candidates.length - 10} more applicants identified
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
          )}

          <div className="flex justify-end items-center gap-3 pt-2">
            <Button variant="ghost" onClick={handleClose} disabled={mutation.isPending} className="rounded-full px-6">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={candidates.length === 0 || mutation.isPending}
              className="rounded-full px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-bold min-w-[160px]"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...
                </>
              ) : (
                <>Import {candidates.length > 0 ? `${candidates.length} Applicants` : 'Applicants'}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
