import { ReactNode, Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
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
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Topbar title={title} />
        <main className="p-6">
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
