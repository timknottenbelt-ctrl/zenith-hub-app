import { memo } from 'react';
import { TransitionLink } from '@/components/TransitionLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useOpenInquiriesCount } from '@/hooks/useOpenInquiriesCount';
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
  Calculator,
} from 'lucide-react';

const navItems = [
  { key: 'overview', icon: LayoutDashboard, path: '/', group: 'main' },
  { key: 'aiInquiries', icon: MessageSquare, path: '/inquiries', group: 'operations' },
  { key: 'sentPDAs', icon: Send, path: '/inquiries/sent', group: 'operations' },
  { key: 'pdaAdmin', icon: Anchor, path: '/pda-admin', group: 'operations' },
  { key: 'daCreator', icon: Calculator, path: '/da-creator', group: 'operations' },
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

// Request a high-res flag (w160) — it's displayed small, so a larger source
// keeps it crisp on retina screens instead of blurry.
const getOfficeFlagUrl = (officeCode: string) =>
  `${FLAGCDN_BASE}/w160/${officeCode.toLowerCase()}.png`;

const groupLabels: Record<string, string> = {
  main: '',
  operations: 'OPERATIONS',
  documents: 'DOCUMENTS',
  resources: 'RESOURCES',
};

export const Sidebar = memo(function Sidebar() {
  const { t, office } = useLanguage();
  const { user, signOut, isAdmin } = useAuth();
  const officeFlagUrl = office ? getOfficeFlagUrl(office) : null;
  const openInquiries = useOpenInquiriesCount();

  const groups = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const userInitial = (user?.user_metadata?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <aside className="fixed left-3 top-3 bottom-3 w-[256px] bg-card rounded-2xl flex flex-col z-50 border border-border/40"
      style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)' }}>
      {/* Logo */}
      <div className="h-[68px] flex items-center px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"
            style={{ boxShadow: '0 4px 12px -2px rgba(0,128,255,0.35)' }}>
            <Ship className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground text-[16px] leading-tight tracking-tight">LBH Portal</span>
            <span className="text-[11px] text-muted-foreground/60 leading-tight font-medium">Maritime Services</span>
          </div>
          {officeFlagUrl && (
            <img
              src={officeFlagUrl}
              srcSet={`${officeFlagUrl} 1x, ${officeFlagUrl.replace('/w160/', '/w320/')} 2x`}
              alt={`${office?.toUpperCase() || ''} flag`}
              className="ml-auto h-5 w-[30px] rounded-[3px] object-cover ring-1 ring-black/10 shadow-sm"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-5 pb-3 overflow-y-auto overflow-x-hidden min-h-0 sidebar-scroll">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className={group !== 'main' ? 'mt-4' : ''}>
            {groupLabels[group] && (
              <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
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
                        'flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-medium transition-all duration-150 ease-out',
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-foreground/60 hover:bg-black/[0.03] hover:text-foreground active:scale-[0.98]'
                      )
                    }
                    style={({ isActive }) => isActive ? { boxShadow: '0 2px 8px -2px rgba(0,128,255,0.4)' } : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                        <span className="truncate">{t(`nav.${item.key}`)}</span>
                        {item.key === 'aiInquiries' && openInquiries > 0 && (
                          <span
                            className={cn(
                              'ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums shrink-0',
                              isActive
                                ? 'bg-white text-primary'
                                : 'bg-red-500 text-white shadow-[0_1px_4px_-1px_rgba(239,68,68,0.6)]'
                            )}
                          >
                            {openInquiries > 99 ? '99+' : openInquiries}
                          </span>
                        )}
                      </>
                    )}
                  </TransitionLink>
                );
              })}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div className="mt-4">
            <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
              ADMIN
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
                        'flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-medium transition-all duration-150 ease-out',
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-foreground/60 hover:bg-black/[0.03] hover:text-foreground active:scale-[0.98]'
                      )
                    }
                    style={({ isActive }) => isActive ? { boxShadow: '0 2px 8px -2px rgba(0,128,255,0.4)' } : undefined}
                  >
                    <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                    <span className="truncate">{t(`common.${item.key}`)}</span>
                  </TransitionLink>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

      {/* User */}
      <div className="p-3 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white">{userInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
              {user?.user_metadata?.name || t('common.user')}
            </p>
            <p className="text-[11px] text-muted-foreground/60 truncate leading-tight">
              {user?.email || ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground/60 hover:text-destructive mt-0.5 h-8 text-[13px] rounded-lg"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t('common.logout')}
        </Button>
      </div>
    </aside>
  );
});
