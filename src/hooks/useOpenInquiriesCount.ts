import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Live count of open AI inquiries that still need attention:
 * not archived and not yet approved/sent. Used for the sidebar badge.
 * Refreshes on mount, on an interval, and whenever the window regains focus.
 */
export function useOpenInquiriesCount(intervalMs = 45000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      // `archived` is added by migration 20260607120000 and not yet in the
      // generated types — cast just the column key to keep TS happy.
      const { count: c } = await supabase.from('email')
        .select('id', { count: 'exact', head: true })
        .eq('archived' as never, false as never)
        .not('status', 'in', '("approved","sent")');
      if (active && typeof c === 'number') setCount(c);
    };

    load();
    const id = setInterval(load, intervalMs);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs]);

  return count;
}
