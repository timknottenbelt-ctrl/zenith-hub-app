import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  // Instant render without flash
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Trigger animation after paint
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Topbar title={title} />
        <main 
          className={`p-6 transition-opacity duration-100 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}
          style={{ willChange: 'opacity' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
