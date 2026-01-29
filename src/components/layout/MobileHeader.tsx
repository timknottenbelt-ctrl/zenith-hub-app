import { memo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { TransitionLink } from '@/components/TransitionLink';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  Menu,
  Ship,
  LayoutDashboard,
  MessageSquare,
  FileText,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';

const navItems = [
  { key: 'overview', icon: LayoutDashboard, path: '/' },
  { key: 'aiInquiries', icon: MessageSquare, path: '/inquiries' },
  { key: 'sentPDAs', icon: Send, path: '/inquiries/sent' },
  { key: 'fdaCreator', icon: FileText, path: '/fda' },
  { key: 'fdaCuracao', icon: FileText, path: '/fda-curacao' },
  { key: 'knowledgeBase', icon: BookOpen, path: '/knowledge' },
  { key: 'vessels', icon: Ship, path: '/vessels' },
  { key: 'contacts', icon: Users, path: '/contacts' },
  { key: 'settings', icon: Settings, path: '/settings' },
];

const adminItems = [
  { key: 'userManagement', icon: ShieldCheck, path: '/admin/users' },
];

interface MobileHeaderProps {
  title: string;
}

export const MobileHeader = memo(function MobileHeader({ title }: MobileHeaderProps) {
  const { t } = useLanguage();
  const { user, signOut, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
      {/* Logo links */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Ship className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>

      {/* Titel in het midden, met ruimte aan beide kanten */}
      <div className="flex-1 flex justify-center px-2 min-w-0">
        <h1 className="text-sm font-semibold text-foreground truncate">
          {title}
        </h1>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72 p-0 flex flex-col">
          <div className="h-14 flex items-center justify-between px-4 border-b border-border">
            <span className="font-semibold text-foreground">Menu</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const needsExactMatch = item.path === '/inquiries' || item.path === '/fda' || item.path === '/fda-curacao';
              return (
                <TransitionLink
                  key={item.key}
                  to={item.path}
                  end={needsExactMatch}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-75',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground hover:bg-muted'
                    )
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{t(`nav.${item.key}`)}</span>
                </TransitionLink>
              );
            })}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TransitionLink
                      key={item.key}
                      to={item.path}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-75',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-foreground hover:bg-muted'
                        )
                      }
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{t(`common.${item.key}`)}</span>
                    </TransitionLink>
                  );
                })}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-border space-y-3">
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.user_metadata?.name || t('common.user')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || ''}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('common.logout')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
});
