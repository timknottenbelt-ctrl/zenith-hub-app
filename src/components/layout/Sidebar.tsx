import { NavLink } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  BookOpen,
  Ship,
  Users,
  Settings,
} from 'lucide-react';

const navItems = [
  { key: 'overview', icon: LayoutDashboard, path: '/' },
  { key: 'aiInquiries', icon: MessageSquare, path: '/inquiries' },
  { key: 'fdaCreator', icon: FileText, path: '/fda' },
  { key: 'knowledgeBase', icon: BookOpen, path: '/knowledge' },
  { key: 'vessels', icon: Ship, path: '/vessels' },
  { key: 'contacts', icon: Users, path: '/contacts' },
  { key: 'settings', icon: Settings, path: '/settings' },
];

export function Sidebar() {
  const { t } = useLanguage();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Ship className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-lg">LBH Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">User</p>
            <p className="text-xs text-muted-foreground truncate">user@example.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
