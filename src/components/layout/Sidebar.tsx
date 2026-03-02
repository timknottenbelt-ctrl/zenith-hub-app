import { memo } from 'react';
import { TransitionLink } from '@/components/TransitionLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  BookOpen,
  Ship,
  Users,
  Settings,
  LogOut,
  Send,
  ShieldCheck,
  Anchor,
} from 'lucide-react';

const navItems = [
  { key: 'overview', icon: LayoutDashboard, path: '/' },
  { key: 'aiInquiries', icon: MessageSquare, path: '/inquiries' },
  { key: 'sentPDAs', icon: Send, path: '/inquiries/sent' },
  { key: 'pdaCreator', icon: Anchor, path: '/pda-creator' },
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

const FLAGCDN_BASE = 'https://flagcdn.com';

// Use w80 for crisp rendering at 2x+ displays
const getOfficeFlagUrl = (officeCode: string) =>
  `${FLAGCDN_BASE}/w80/${officeCode.toLowerCase()}.png`;

export const Sidebar = memo(function Sidebar() {
  const { t, office } = useLanguage();
  const { user, signOut, isAdmin } = useAuth();
  const officeFlagUrl = office ? getOfficeFlagUrl(office) : null;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Ship className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-lg">LBH Portal</span>
          {officeFlagUrl && (
            <img
              src={officeFlagUrl}
              alt={`${office?.toUpperCase() || ''} flag`}
              className="ml-2 h-4 w-6 rounded-[2px] object-cover"
              style={{ imageRendering: 'auto' }}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Use exact matching for routes that have child routes
          const needsExactMatch = item.path === '/inquiries' || item.path === '/fda' || item.path === '/fda-curacao' || item.path === '/pda-creator';
          return (
            <TransitionLink
              key={item.key}
              to={item.path}
              end={needsExactMatch}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-75 ease-out',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]'
                )
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{t(`nav.${item.key}`)}</span>
            </TransitionLink>
          );
        })}
        
        {/* Admin Section */}
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
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-75 ease-out',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]'
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

      {/* Footer with User Info */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
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
          <TransitionLink
            to="/settings"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            title={t('nav.settings')}
          >
            <Settings className="w-4 h-4" />
          </TransitionLink>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t('common.logout')}
        </Button>
      </div>
    </aside>
  );
});
