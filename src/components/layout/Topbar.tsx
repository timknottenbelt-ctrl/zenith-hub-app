import { memo, useState, useEffect, useCallback } from 'react';
import { Search, Bell, Mail, Ship, FileText, Users, X, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface TopbarProps {
  title: string;
}

interface SearchResult {
  type: 'email' | 'vessel' | 'contact' | 'fda';
  id: string | number;
  title: string;
  subtitle: string;
  route: string;
}

interface Notification {
  id: string;
  type: 'email' | 'fda';
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

export const Topbar = memo(function Topbar({ title }: TopbarProps) {
  const { t } = useLanguage();
  const navigate = useTransitionNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      // Fetch recent draft emails as notifications
      const { data: emails } = await supabase
        .from('email')
        .select('id, subject, created_at, contact_name')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(5);

      const emailNotifications: Notification[] = (emails || []).map((email) => ({
        id: `email-${email.id}`,
        type: 'email' as const,
        title: 'Nieuwe aanvraag',
        message: email.subject || `Van ${email.contact_name || 'Onbekend'}`,
        time: new Date(email.created_at),
        read: false,
      }));

      // Fetch recent FDA projects
      const { data: fdaProjects } = await supabase
        .from('fda_projects')
        .select('id, ship_name, status, created_at')
        .in('status', ['draft', 'processing'])
        .order('created_at', { ascending: false })
        .limit(3);

      const fdaNotifications: Notification[] = (fdaProjects || []).map((project) => ({
        id: `fda-${project.id}`,
        type: 'fda' as const,
        title: 'FDA Project',
        message: `${project.ship_name} - ${project.status}`,
        time: new Date(project.created_at!),
        read: false,
      }));

      const allNotifications = [...emailNotifications, ...fdaNotifications].sort(
        (a, b) => b.time.getTime() - a.time.getTime()
      );
      
      setNotifications(allNotifications);
      setUnreadCount(allNotifications.length);
    };

    fetchNotifications();
  }, []);

  // Search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results: SearchResult[] = [];
    const searchTerm = `%${query}%`;

    try {
      // Search emails
      const { data: emails } = await supabase
        .from('email')
        .select('id, subject, contact_name, vessel_name')
        .or(`subject.ilike.${searchTerm},contact_name.ilike.${searchTerm},vessel_name.ilike.${searchTerm}`)
        .limit(5);

      if (emails) {
        emails.forEach((email) => {
          results.push({
            type: 'email',
            id: email.id,
            title: email.subject || 'Geen onderwerp',
            subtitle: email.contact_name || email.vessel_name || 'Email',
            route: '/inquiries',
          });
        });
      }

      // Search vessels
      const { data: vessels } = await supabase
        .from('vessels')
        .select('id, name, imo_number, flag')
        .or(`name.ilike.${searchTerm},imo_number.ilike.${searchTerm}`)
        .limit(5);

      if (vessels) {
        vessels.forEach((vessel) => {
          results.push({
            type: 'vessel',
            id: vessel.id,
            title: vessel.name,
            subtitle: `IMO: ${vessel.imo_number}${vessel.flag ? ` • ${vessel.flag}` : ''}`,
            route: '/vessels',
          });
        });
      }

      // Search contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, company, email')
        .or(`name.ilike.${searchTerm},company.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (contacts) {
        contacts.forEach((contact) => {
          results.push({
            type: 'contact',
            id: contact.id,
            title: contact.name,
            subtitle: contact.company || contact.email || 'Contact',
            route: '/contacts',
          });
        });
      }

      // Search FDA projects
      const { data: fdaProjects } = await supabase
        .from('fda_projects')
        .select('id, ship_name, lbh_number, client_name')
        .or(`ship_name.ilike.${searchTerm},lbh_number.ilike.${searchTerm},client_name.ilike.${searchTerm}`)
        .limit(5);

      if (fdaProjects) {
        fdaProjects.forEach((project) => {
          results.push({
            type: 'fda',
            id: project.id,
            title: project.ship_name,
            subtitle: `LBH: ${project.lbh_number}${project.client_name ? ` • ${project.client_name}` : ''}`,
            route: '/fda-creator',
          });
        });
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(result.route);
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-primary" />;
      case 'vessel':
        return <Ship className="w-4 h-4 text-blue-500" />;
      case 'contact':
        return <Users className="w-4 h-4 text-green-500" />;
      case 'fda':
        return <FileText className="w-4 h-4 text-orange-500" />;
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <>
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        
        <div className="flex items-center gap-4">
          {/* Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="relative w-64 flex items-center gap-2 h-9 px-3 bg-muted/50 rounded-md text-muted-foreground text-sm hover:bg-muted transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>{t('common.search')}</span>
            <kbd className="absolute right-3 pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground hidden sm:flex">
              ⌘K
            </kbd>
          </button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notificaties</span>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                    onClick={markAllAsRead}
                  >
                    Markeer als gelezen
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Geen notificaties
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  {notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                      onClick={() => {
                        const route = notification.type === 'email' ? '/inquiries' : '/fda-creator';
                        navigate(route);
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {notification.type === 'email' ? (
                          <Mail className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                        )}
                        <span className="font-medium text-sm">{notification.title}</span>
                        {!notification.read && (
                          <span className="ml-auto w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground pl-6 line-clamp-1">
                        {notification.message}
                      </p>
                      <span className="text-[10px] text-muted-foreground pl-6">
                        {formatDistanceToNow(notification.time, { addSuffix: true, locale: nl })}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-[550px] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="sr-only">Zoeken</DialogTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Zoek emails, schepen, contacten, FDA projecten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-11 text-base"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[400px]">
            {isSearching ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Zoeken...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="p-2">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    {getResultIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Geen resultaten gevonden voor "{searchQuery}"
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Begin met typen om te zoeken...
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
});
