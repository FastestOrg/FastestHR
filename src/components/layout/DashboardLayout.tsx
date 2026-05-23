import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { AIAssistant } from '@/components/AIAssistant';
import { MobileBottomNav } from './MobileBottomNav';
import { ScrollToTop } from './ScrollToTop';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 max-w-full overflow-x-hidden">
          <Topbar />
          <main className={`flex-1 min-w-0 max-w-full overflow-x-hidden ${isMobile ? 'p-4 pb-24' : 'p-6'}`}>
            {children}
          </main>
        </div>
      </div>
      {isMobile && <MobileBottomNav />}
      {isMobile && <ScrollToTop />}
      <AIAssistant />
    </SidebarProvider>
  );
}
