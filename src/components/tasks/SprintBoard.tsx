import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Plus, Calendar, Settings2, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { format, addDays } from 'date-fns';

export function SprintBoard() {
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingSprint, setIsAddingSprint] = useState(false);
  const isAdminOrManager = profile?.platform_role === 'company_admin' || profile?.platform_role === 'hr_manager';

  const { data: sprints, isLoading } = useQuery({
    queryKey: ['sprints', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const addSprintMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { data, error } = await supabase
        .from('sprints')
        .insert({
          ...formData,
          company_id: profile!.company_id!,
          status: 'planned'
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', profile?.company_id] });
      setIsAddingSprint(false);
      toast({ title: "Sprint created", description: "The new sprint has been added to the company timeline." });
    },
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Company Sprints
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm sm:text-base">Strategic milestones set by the organization.</p>
        </div>
        {isAdminOrManager && (
          <Button onClick={() => setIsAddingSprint(true)} variant="outline" className="w-full sm:w-auto border-primary/20 hover:bg-primary/5 h-10 text-sm">
            <Plus className="h-4 w-4 mr-2" />
            New Sprint
          </Button>
        )}
      </div>

      {isAddingSprint && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Create New Sprint</CardTitle>
            <CardDescription>Define the timeline and goals for the next milestone.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              addSprintMutation.mutate({
                name: formData.get('name'),
                description: formData.get('description'),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date'),
              });
            }}>
              <div className="space-y-2">
                <Input name="name" placeholder="Sprint Name (e.g. Q2 Product Launch)" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Start Date</label>
                  <Input name="start_date" type="date" required defaultValue={format(new Date(), 'yyyy-MM-dd')} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">End Date</label>
                  <Input name="end_date" type="date" required defaultValue={format(addDays(new Date(), 14), 'yyyy-MM-dd')} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addSprintMutation.isPending}>Create Sprint</Button>
                <Button variant="ghost" type="button" onClick={() => setIsAddingSprint(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sprints?.map((sprint) => (
          <Card key={sprint.id} className="relative overflow-hidden group hover:border-primary/30 transition-all border-none shadow-md bg-card/50 backdrop-blur-sm">
            <div className={`absolute top-0 left-0 w-1 h-full ${sprint.status === 'active' ? 'bg-green-500' : 'bg-muted'}`} />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={sprint.status === 'active' ? 'default' : 'secondary'} className={sprint.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}>
                  {sprint.status}
                </Badge>
                <Calendar className="h-4 w-4 text-muted-foreground opacity-50" />
              </div>
              <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">{sprint.name}</CardTitle>
              <CardDescription className="line-clamp-2 min-h-[40px]">{sprint.description || 'No description provided'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mt-2">
                <span>{format(new Date(sprint.start_date), 'MMM d')}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{format(new Date(sprint.end_date), 'MMM d, yyyy')}</span>
              </div>
              
              <div className="mt-6 flex gap-2 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" className="w-full text-xs h-8">View Roadmap</Button>
                {isAdminOrManager && (
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" aria-label="Sprint settings">
                     <Settings2 className="h-4 w-4" />
                   </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {sprints?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
            <LayoutGrid className="h-12 w-12 mb-4" />
            <p>No sprints planned yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
