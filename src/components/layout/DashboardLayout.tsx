import { ReactNode, Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileLayout } from './MobileLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-120px)]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLayout title={title}>{children}</MobileLayout>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-[272px] pr-2">
        <Topbar title={title} />
        <main className="p-6 pt-8 animate-fade-in">
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
