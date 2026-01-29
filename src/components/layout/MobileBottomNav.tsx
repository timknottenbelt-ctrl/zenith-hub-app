import { memo } from 'react';
import { useLocation } from 'react-router-dom';
import { TransitionLink } from '@/components/TransitionLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Settings,
  Send,
} from 'lucide-react';

const bottomNavItems = [
  { key: 'overview', icon: LayoutDashboard, path: '/', label: 'Overview' },
  { key: 'aiInquiries', icon: MessageSquare, path: '/inquiries', label: 'Inquiries' },
  { key: 'sentPDAs', icon: Send, path: '/inquiries/sent', label: 'Sent' },
  { key: 'fdaCreator', icon: FileText, path: '/fda', label: 'FDA' },
  { key: 'settings', icon: Settings, path: '/settings', label: 'Settings' },
];

export const MobileBottomNav = memo(function MobileBottomNav() {
  const location = useLocation();
  const { t } = useLanguage();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/inquiries') return location.pathname === '/inquiries' || location.pathname.startsWith('/inquiries/manual');
    if (path === '/inquiries/sent') return location.pathname === '/inquiries/sent';
    if (path === '/fda') return location.pathname.startsWith('/fda');
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <TransitionLink
              key={item.key}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5 mb-1', active && 'text-primary')} />
              <span className={cn(
                'text-[10px] font-medium',
                active ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </TransitionLink>
          );
        })}
      </div>
    </nav>
  );
});
