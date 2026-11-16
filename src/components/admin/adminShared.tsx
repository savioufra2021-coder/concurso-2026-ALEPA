import React from 'react';
import { PublicationStatus } from '../../types';

export const ADMIN_STATUS_BADGE: Record<PublicationStatus, { label: string; cls: string }> = {
  draft: {
    label: 'Rascunho',
    cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
  },
  in_review: {
    label: 'Em Revisão',
    cls: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800',
  },
  approved: {
    label: 'Aprovado',
    cls: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800',
  },
  published: {
    label: 'Publicado',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800',
  },
  archived: {
    label: 'Arquivado',
    cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export const PUBLICATION_STATUS_LIST: PublicationStatus[] = [
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
];

export function renderAdminStatusBadge(status?: PublicationStatus) {
  const key: PublicationStatus = status || 'published';
  const meta = ADMIN_STATUS_BADGE[key] || ADMIN_STATUS_BADGE.draft;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}
