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
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { key: 'overview', icon: LayoutDashboard, path: '/', group: 'main' },
  { key: 'aiInquiries', icon: MessageSquare, path: '/inquiries', group: 'operations' },
  { key: 'sentPDAs', icon: Send, path: '/inquiries/sent', group: 'operations' },
  { key: 'pdaAdmin', icon: Anchor, path: '/pda-admin', group: 'operations' },
  { key: 'fdaCreator', icon: FileText, path: '/fda', group: 'documents' },
  { key: 'fdaCuracao', icon: FileText, path: '/fda-curacao', group: 'documents' },
  { key: 'knowledgeBase', icon: BookOpen, path: '/knowledge', group: 'resources' },
  { key: 'contacts', icon: Users, path: '/contacts', group: 'resources' },
  { key: 'settings', icon: Settings, path: '/settings', group: 'resources' },
];

const adminItems = [
  { key: 'userManagement', icon: ShieldCheck, path: '/admin/users' },
];

const FLAGCDN_BASE = 'https://flagcdn.com';

const getOfficeFlagUrl = (officeCode: string) =>
  `${FLAGCDN_BASE}/w80/${officeCode.toLowerCase()}.png`;

const groupLabels: Record<string, string> = {
  main: '',
  operations: 'Operations',
  documents: 'Documents',
  resources: 'Resources',
};

export const Sidebar = memo(function Sidebar() {
  const { t, office } = useLanguage();
  const { user, signOut, isAdmin } = useAuth();
  const officeFlagUrl = office ? getOfficeFlagUrl(office) : null;

  // Group nav items
  const groups = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-border/60 flex flex-col z-50">
      {/* Logo Area */}
      <div className="h-[72px] flex items-center px-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <Ship className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground text-[15px] leading-tight tracking-tight">LBH Portal</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Maritime Services</span>
          </div>
          {officeFlagUrl && (
            <img
              src={officeFlagUrl}
              alt={`${office?.toUpperCase() || ''} flag`}
              className="ml-auto h-4 w-6 rounded-[2px] object-cover opacity-80"
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
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className={group !== 'main' ? 'mt-5' : ''}>
            {groupLabels[group] && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                {groupLabels[group]}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const needsExactMatch = item.path === '/inquiries' || item.path === '/fda' || item.path === '/fda-curacao' || item.path === '/pda-admin';
                return (
                  <TransitionLink
                    key={item.key}
                    to={item.path}
                    end={needsExactMatch}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 ease-out',
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]'
                      )
                    }
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1 truncate">{t(`nav.${item.key}`)}</span>
                    <ChevronRight className={cn(
                      'w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all duration-100',
                      'group-hover:opacity-40 group-hover:translate-x-0'
                    )} />
                  </TransitionLink>
                );
              })}
            </div>
          </div>
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <div className="mt-5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
              Admin
            </p>
            <div className="space-y-0.5">
              {adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TransitionLink
                    key={item.key}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 ease-out',
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]'
                      )
                    }
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1 truncate">{t(`common.${item.key}`)}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all duration-100 group-hover:opacity-40 group-hover:translate-x-0" />
                  </TransitionLink>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-border/60">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">
              {(user?.user_metadata?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate leading-tight">
              {user?.user_metadata?.name || t('common.user')}
            </p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {user?.email || ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive mt-1 h-8 text-[13px]"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t('common.logout')}
        </Button>
      </div>
    </aside>
  );
});
