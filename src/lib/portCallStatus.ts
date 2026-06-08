// Manual port-call lifecycle status (distinct from the fine-grained live status
// derived from SOF events). Shared by the list board and the dossier.

export type Lifecycle = 'expected' | 'nominated' | 'alongside' | 'sailed' | 'closed';

export const LIFECYCLE_ORDER: Lifecycle[] = ['expected', 'nominated', 'alongside', 'sailed', 'closed'];

export const LIFECYCLE_META: Record<Lifecycle, { label: string; tone: string; dot: string }> = {
  expected: { label: 'Verwacht', tone: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  nominated: { label: 'Genomineerd', tone: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  alongside: { label: 'Langszij', tone: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  sailed: { label: 'Vertrokken', tone: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  closed: { label: 'Afgesloten', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

export function lifecycleMeta(status: string | null | undefined) {
  return (status && LIFECYCLE_META[status as Lifecycle]) || null;
}

/** Open = still needs operational attention (not sailed/closed). */
export function isOpenLifecycle(status: string | null | undefined): boolean {
  return status !== 'sailed' && status !== 'closed';
}
