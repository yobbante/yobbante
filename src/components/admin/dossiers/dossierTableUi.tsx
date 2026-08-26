import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatXof } from '@/lib/dossierAmount';
import { TIMING_TONE_CLASS, type DossierTiming } from '@/lib/dossierTiming';

/**
 * Coquille de tableau partagée par TOUTES les listes de fiches admin
 * (demandes entrantes, routier, aérien, maritime, GP) pour qu'elles soient
 * visuellement et structurellement identiques.
 */
export function DossierTableShell({
  assignLabel = 'GP',
  children,
}: {
  assignLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <table className="w-full text-sm table-fixed">
        <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-2 md:px-3 py-2 w-[38%] md:w-[19%]">Réf</th>
            <th className="text-left font-medium px-2 md:px-3 py-2 w-[36%] md:w-[22%]">Client</th>
            <th className="text-left font-medium px-2 md:px-3 py-2 w-[26%] md:w-[15%]">Statut</th>
            <th className="text-left font-medium px-2 md:px-3 py-2 w-[16%] hidden md:table-cell">Échéance</th>
            <th className="text-left font-medium px-2 md:px-3 py-2 w-[16%] hidden md:table-cell">{assignLabel}</th>
            <th className="text-right font-medium px-2 md:px-3 py-2 w-[12%] hidden md:table-cell">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function TimingCellBody({ timing }: { timing: DossierTiming }) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">{timing.label}</div>
      <div className={cn('text-[13px] font-medium leading-tight mt-0.5', TIMING_TONE_CLASS[timing.tone])}>
        {timing.value}
      </div>
      {timing.hint && (
        <div className={cn('text-[10px] leading-none opacity-80', TIMING_TONE_CLASS[timing.tone])}>{timing.hint}</div>
      )}
    </>
  );
}

/**
 * Montant éditable en ligne — l'admin peut corriger le prix (par ex. après
 * pesée réelle). `onSave(null)` efface le prix validé.
 */
export function InlineAmount({
  value,
  isFinal,
  onSave,
  className,
  disabled,
}: {
  value: number | null;
  isFinal?: boolean;
  onSave: (v: number | null) => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? String(value) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value != null ? String(value) : '');
  }, [value, editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    if (next != null && Number.isNaN(next)) return;
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={cn(
          'group inline-flex items-center gap-1 tabular-nums text-[13px] hover:underline',
          value == null ? 'text-muted-foreground text-xs' : 'text-foreground font-medium',
          !isFinal && value != null && 'italic',
          className,
        )}
        title={value == null ? 'Définir le prix' : isFinal ? 'Prix validé — modifier' : 'Estimation — modifier'}
      >
        {value == null ? '—' : formatXof(value)}
        {!disabled && <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-24 h-7 rounded border border-border bg-background px-1.5 text-right text-[12px] tabular-nums"
        placeholder="FCFA"
      />
      <button type="button" disabled={busy} onClick={commit} className="text-emerald-500 hover:text-emerald-400">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
