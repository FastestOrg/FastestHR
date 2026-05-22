import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Briefcase, Users, UserPlus, FileUp, Download, 
  Loader2, CheckCircle2, ChevronRight, Search, 
  Mail, Phone, User
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { BulkUploadDialog } from '@/components/recruitment/BulkUploadDialog';
import { generateSampleCSV } from '@/lib/csv-parser';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReferralPortal() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['active-jobs', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*, departments(name)')
        .eq('company_id', profile!.company_id!)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedJob || !profile?.company_id) throw new Error('Missing required info');
      
      const { data, error } = await supabase
        .from('candidates')
        .insert([
          {
            job_id: selectedJob,
            company_id: profile.company_id,
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone || null,
            source: 'referral',
            stage: 'applied',
            referred_by: profile.id,
          },
        ])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Referral submitted successfully!');
      setFormData({ fullName: '', email: '', phone: '' });
      setSelectedJob(null);
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: (error: any) => {
      console.error('Error adding referral:', error);
      toast.error(error.message || 'Failed to submit referral');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) {
      toast.error('Please select a job position first');
      return;
    }
    if (!formData.fullName || !formData.email) {
      toast.error('Please fill in required fields');
      return;
    }
    mutation.mutate();
  };

  const handleDownloadSample = () => {
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'referral_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV downloaded');
  };

  // Optimization: Pre-calculate lowercased search term outside the filter loop
  const searchLower = searchQuery.toLowerCase();
  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchLower) ||
    (job as any).departments?.name?.toLowerCase().includes(searchLower)
  );

  const selectedJobData = jobs.find(j => j.id === selectedJob);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-foreground">Referral Portal</h1>
        <p className="text-muted-foreground text-lg">Help us grow our team by referring talented people you know.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Job Selection Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="glass-card border-none shadow-xl overflow-hidden bg-background/50 backdrop-blur-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Select Position
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search jobs..." 
                  className="pl-9 bg-muted/50 border-none focus-visible:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 space-y-1 max-h-[500px] overflow-y-auto scrollbar-hide">
              {loadingJobs ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground italic text-sm">
                  No active positions found
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job.id)}
                    className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                      selectedJob === job.id
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 translate-x-1'
                        : 'hover:bg-primary/5 text-foreground hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-bold text-sm truncate uppercase tracking-tight">
                          {job.title}
                        </p>
                        <p className={`text-[10px] font-medium uppercase tracking-widest mt-0.5 ${selectedJob === job.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {(job as any).departments?.name || 'General'}
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${selectedJob === job.id ? 'translate-x-1 opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submission Column */}
        <div className="lg:col-span-2">
          {!selectedJob ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-muted/20 border-2 border-dashed border-border/50 rounded-3xl space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary/30">
                <UserPlus className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Select a position to begin</h3>
                <p className="text-muted-foreground text-sm max-w-[300px] mx-auto mt-1">
                  Choose a job position from the left to refer candidates for that role.
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="glass-card border-none shadow-2xl bg-background/50 backdrop-blur-xl overflow-hidden rounded-3xl">
                <div className="p-1 px-6 bg-primary/10 border-b border-primary/5">
                  <div className="flex items-center gap-2 py-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest text-primary">
                      Position: {selectedJobData?.title}
                    </span>
                  </div>
                </div>

                <Tabs defaultValue="manual" className="p-8">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 mb-8 rounded-2xl">
                    <TabsTrigger value="manual" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <User className="h-4 w-4 mr-2" />
                      Individual Referral
                    </TabsTrigger>
                    <TabsTrigger value="bulk" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <FileUp className="h-4 w-4 mr-2" />
                      Bulk Upload
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Candidate Full Name *</Label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                              id="fullName"
                              required
                              value={formData.fullName}
                              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                              placeholder="e.g. John Doe"
                              className="h-12 pl-12 bg-muted/30 border-none focus-visible:ring-primary/20 rounded-xl transition-all"
                              disabled={mutation.isPending}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Email Address *</Label>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                              id="email"
                              type="email"
                              required
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              placeholder="e.g. john@example.com"
                              className="h-12 pl-12 bg-muted/30 border-none focus-visible:ring-primary/20 rounded-xl transition-all"
                              disabled={mutation.isPending}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Phone Number</Label>
                        <div className="relative group">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                            className="h-12 pl-12 bg-muted/30 border-none focus-visible:ring-primary/20 rounded-xl transition-all"
                            disabled={mutation.isPending}
                          />
                        </div>
                      </div>

                      <div className="pt-4 flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={mutation.isPending}
                          className="h-12 px-10 rounded-xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95 min-w-[200px]"
                        >
                          {mutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                            </>
                          ) : (
                            <>Submit Referral</>
                          )}
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="bulk" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col items-center justify-center py-12 px-6 rounded-3xl bg-muted/30 border-2 border-dashed border-border/50 hover:border-primary/50 transition-all group">
                      <div className="p-6 bg-primary/10 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-500">
                        <FileUp className="h-10 w-10 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Bulk Candidate Import</h3>
                      <p className="text-muted-foreground text-sm max-w-[400px] text-center mb-8">
                        Upload a CSV file with multiple candidates. We'll automatically process them and associate them with your profile.
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-4 w-full max-w-sm">
                        <Button 
                          variant="outline" 
                          onClick={handleDownloadSample} 
                          className="flex-1 rounded-xl h-11 font-bold border-muted-foreground/20 hover:bg-muted/50"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Sample CSV
                        </Button>
                        <Button 
                          onClick={() => setIsBulkOpen(true)} 
                          className="flex-1 rounded-xl h-11 font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10"
                        >
                          <FileUp className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {selectedJob && (
        <BulkUploadDialog
          jobId={selectedJob}
          isOpen={isBulkOpen}
          onOpenChange={setIsBulkOpen}
          source="referral"
          referredBy={profile?.id}
        />
      )}
    </div>
  );
}
