import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Search, Bell, Mail, Ship, FileText, Users, ExternalLink, Loader2 } from 'lucide-react';
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isInquiriesRoute = location.pathname === '/inquiries';

  useEffect(() => {
    if (!isInquiriesRoute) return;
    const q = searchParams.get('q') ?? '';
    setSearchQuery((prev) => (prev === q ? prev : q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInquiriesRoute, searchParams]);

  const updateInquiriesQueryParam = useCallback(
    (value: string) => {
      if (!isInquiriesRoute) return;
      const next = new URLSearchParams(searchParams);
      const trimmed = value.trim();
      if (trimmed) next.set('q', value);
      else next.delete('q');
      setSearchParams(next, { replace: true });
    },
    [isInquiriesRoute, searchParams, setSearchParams]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
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

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results: SearchResult[] = [];
    const searchTerm = `%${query}%`;

    try {
      const { data: emails } = await supabase
        .from('email')
        .select('id, subject, contact_name, vessel_name, status')
        .or(`subject.ilike.${searchTerm},contact_name.ilike.${searchTerm},vessel_name.ilike.${searchTerm}`)
        .limit(4);

      if (emails) {
        emails.forEach((email) => {
          const emailRouteBase = email.status === 'approved' || email.status === 'sent' ? '/inquiries/sent' : '/inquiries';
          results.push({
            type: 'email', id: email.id,
            title: email.subject || 'Geen onderwerp',
            subtitle: email.contact_name || email.vessel_name || 'Email',
            route: `${emailRouteBase}?emailId=${email.id}`,
          });
        });
      }

      const { data: vessels } = await supabase
        .from('vessels')
        .select('id, name, imo_number, flag')
        .or(`name.ilike.${searchTerm},imo_number.ilike.${searchTerm}`)
        .limit(4);

      if (vessels) {
        vessels.forEach((vessel) => {
          results.push({
            type: 'vessel', id: vessel.id,
            title: vessel.name,
            subtitle: `IMO: ${vessel.imo_number}${vessel.flag ? ` · ${vessel.flag}` : ''}`,
            route: '/vessels',
          });
        });
      }

      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, company, email')
        .or(`name.ilike.${searchTerm},company.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(4);

      if (contacts) {
        contacts.forEach((contact) => {
          results.push({
            type: 'contact', id: contact.id,
            title: contact.name,
            subtitle: contact.company || contact.email || 'Contact',
            route: '/contacts',
          });
        });
      }

      const { data: fdaProjects } = await supabase
        .from('fda_projects')
        .select('id, ship_name, lbh_number, client_name')
        .or(`ship_name.ilike.${searchTerm},lbh_number.ilike.${searchTerm},client_name.ilike.${searchTerm}`)
        .limit(4);

      if (fdaProjects) {
        fdaProjects.forEach((project) => {
          results.push({
            type: 'fda', id: project.id,
            title: project.ship_name,
            subtitle: `LBH: ${project.lbh_number}${project.client_name ? ` · ${project.client_name}` : ''}`,
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

  useEffect(() => {
    const timer = setTimeout(() => { performSearch(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowResults(true);
      }
      if (e.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery('');
    navigate(result.route);
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4 text-primary" />;
      case 'vessel': return <Ship className="w-4 h-4 text-primary" />;
      case 'contact': return <Users className="w-4 h-4 text-primary" />;
      case 'fda': return <FileText className="w-4 h-4 text-primary" />;
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <header className="h-[68px] py-5 mt-3 mx-0 rounded-2xl flex items-center justify-between px-6 sticky top-3 z-40 glass border-b border-gray-200"
      style={{ boxShadow: '0 2px 12px -4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)' }}>
      <h1 className="text-[17px] font-semibold text-foreground tracking-tight">{title}</h1>

      <div className="flex items-center gap-2.5">
        {/* Search */}
        <div ref={searchContainerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              ref={inputRef}
              type="search"
              placeholder={`${t('common.search')}...`}
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                updateInquiriesQueryParam(value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              className="pl-9 pr-16 h-9 w-64 bg-black/[0.03] border-transparent hover:bg-black/[0.05] focus:bg-white focus:border-primary/20 rounded-xl text-sm placeholder:text-muted-foreground/40"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 bg-black/[0.04] px-1.5 py-0.5 rounded-md font-mono">
              ⌘K
            </kbd>
          </div>

          {showResults && (searchQuery || searchResults.length > 0) && (
            <div className="absolute top-full right-0 mt-2 min-w-[420px] bg-white rounded-2xl z-50 overflow-hidden"
              style={{ boxShadow: '0 16px 48px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
              <ScrollArea className="max-h-[400px]">
                {isSearching ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Zoeken...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="p-2">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleResultClick(result)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-black/[0.03] rounded-xl transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{result.title}</p>
                          <p className="text-xs text-muted-foreground/60 truncate">{result.subtitle}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Geen resultaten voor "{searchQuery}"
                  </div>
                ) : null}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl hover:bg-black/[0.03]">
              <Bell className="w-[18px] h-[18px] text-muted-foreground/60" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full ring-2 ring-white" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl p-0 overflow-hidden"
            style={{ boxShadow: '0 16px 48px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
            <DropdownMenuLabel className="flex items-center justify-between py-3 px-4">
              <span className="font-semibold text-sm">Notificaties</span>
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
            <DropdownMenuSeparator className="m-0" />
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Geen notificaties
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                {notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer rounded-none"
                    onClick={() => {
                      const route = notification.type === 'email' ? '/inquiries' : '/fda-creator';
                      navigate(route);
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {notification.type === 'email' ? (
                        <Mail className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                      )}
                      <span className="font-medium text-sm">{notification.title}</span>
                      {!notification.read && (
                        <span className="ml-auto w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground pl-6 line-clamp-1">{notification.message}</p>
                    <span className="text-[10px] text-muted-foreground/50 pl-6">
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
  );
});
