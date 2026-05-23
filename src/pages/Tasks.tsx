import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, ListTodo, Timer, LayoutGrid, Sun, FileText, Clock, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

// Sub-components
import { MorningSetup } from '@/components/tasks/MorningSetup';
import { SprintBoard } from '@/components/tasks/SprintBoard';
import { TaskList } from '@/components/tasks/TaskList';
import { DailyReportForm } from '@/components/tasks/DailyReportForm';

const Tasks = () => {
  const { profile } = useAuthStore();
  const isAdminOrManager = profile?.platform_role === 'company_admin' || profile?.platform_role === 'hr_manager';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-full overflow-x-hidden px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-gradient-to-r from-primary/10 via-transparent to-transparent p-5 sm:p-6 rounded-3xl border border-primary/5">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-foreground">
            Daily Execution <span className="text-primary">Hub</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg italic">"Success is the sum of small daily wins."</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl border border-border/50 shadow-sm w-fit">
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Tracking Active</span>
        </div>
      </div>

      <Tabs defaultValue="planner" className="w-full">
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide flex sm:justify-center mb-6 sm:mb-10">
          <TabsList className="flex w-max sm:w-auto h-14 p-1.5 bg-secondary/30 backdrop-blur-md rounded-2xl border border-border/50 shadow-inner">
            <TabsTrigger value="planner" className="flex items-center gap-2 px-4 sm:px-6 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all h-full text-xs sm:text-sm">
              <Sun className="h-4.5 w-4.5" />
              <span className="font-bold">Daily Planner</span>
            </TabsTrigger>
            <TabsTrigger value="tracker" className="flex items-center gap-2 px-4 sm:px-6 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all h-full text-xs sm:text-sm">
              <Timer className="h-4.5 w-4.5" />
              <span className="font-bold">Live Tracker</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 px-4 sm:px-6 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all h-full text-xs sm:text-sm">
              <FileText className="h-4.5 w-4.5" />
              <span className="font-bold">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="sprints" className="flex items-center gap-2 px-4 sm:px-6 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all h-full text-xs sm:text-sm">
              <LayoutGrid className="h-4.5 w-4.5" />
              <span className="font-bold opacity-80">Sprints</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="planner" className="space-y-4 focus-visible:outline-none">
          <MorningSetup />
        </TabsContent>

        <TabsContent value="tracker" className="space-y-4 focus-visible:outline-none">
          <TaskList />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 focus-visible:outline-none">
          <DailyReportForm />
        </TabsContent>

        <TabsContent value="sprints" className="space-y-4 focus-visible:outline-none">
          <SprintBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tasks;
