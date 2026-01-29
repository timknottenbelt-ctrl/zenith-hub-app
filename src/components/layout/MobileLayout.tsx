import { ReactNode, Suspense } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { Loader2 } from 'lucide-react';

interface MobileLayoutProps {
  children: ReactNode;
  title: string;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function MobileLayout({ children, title }: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MobileHeader title={title} />
      <main className="flex-1 p-4 pb-20 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </main>
      <MobileBottomNav />
    </div>
  );
}
