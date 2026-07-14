import { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, ArrowRight, AlertTriangle, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatFcfa } from '@/lib/yobbantePricing';
import { QUARTIER_GROUPS, type DakarZoneCategory } from '@/lib/dakarZones';

export function RecapRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-bold tabular-nums' : 'font-medium text-right text-sm'}>{value}</span>
    </div>
  );
}

export function RecapGroup({
  icon, title, children, onEdit, incomplete, missingLabel,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  incomplete?: boolean;
  missingLabel?: string;
}) {
  return (
    <div className={cn('px-5 py-4 border-t border-border space-y-1.5', incomplete && 'bg-danger/5')}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium inline-flex items-center gap-1.5 text-muted-foreground">
          {incomplete && <span className="w-1.5 h-1.5 rounded-full bg-danger" aria-hidden />}
          <span className="inline-flex items-center gap-1.5">{icon} {title}</span>
          {incomplete && (
            <span className="ml-1 text-[10px] normal-case tracking-normal text-danger font-medium">
              · {missingLabel ?? 'champs manquants'}
            </span>
          )}
        </p>
        {onEdit && (
          <button type="button" onClick={onEdit}
            className="text-[11px] font-medium text-foreground hover:underline underline-offset-2 shrink-0">
            Modifier
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function EmailRecapCard({ dossierId }: { dossierId: string }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const onSend = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email invalide'); return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-confirmation-email', {
        body: { dossier_id: dossierId, email },
      });
      if (error) throw error;
      setSent(true);
      toast.success('Récapitulatif envoyé !');
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally { setSending(false); }
  };
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm font-semibold mb-1">📧 Recevoir votre récapitulatif</p>
      <p className="text-[11px] text-muted-foreground mb-3">Recommandé si vous n'avez pas de compte Yobbanté.</p>
      {sent ? (
        <p className="text-sm text-emerald-600">Envoyé ✓</p>
      ) : (
        <div className="flex gap-2">
          <input type="email" inputMode="email" placeholder="votre@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={onSend} disabled={sending}
            className="rounded-lg bg-foreground text-background px-3 py-2 text-sm font-semibold disabled:opacity-60">
            {sending ? '…' : 'Envoyer →'}
          </button>
        </div>
      )}
    </div>
  );
}

export function StepCollapsed({ title, lines, onEdit }: { title: string; lines: string[]; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit}
      className="w-full text-left rounded-2xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        </div>
        {lines.length > 0 && (
          <p className="mt-1 text-[11.5px] text-muted-foreground line-clamp-2 pl-5">
            {lines.join(' · ')}
          </p>
        )}
      </div>
      <span className="text-[11px] underline underline-offset-2 text-muted-foreground shrink-0">Modifier</span>
    </button>
  );
}

export function LockedStep({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-3 flex items-center justify-between gap-3 opacity-70">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground">
          Étape {step} / {total}
        </p>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground truncate">{title}</p>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">À venir</span>
    </div>
  );
}

export function StepSupportLink() {
  return (
    <div className="mt-5 flex items-center justify-center">
      <a
        href="https://wa.me/221786078080?text=Bonjour%20Yobbant%C3%A9%2C%20j%27ai%20besoin%20d%27aide%20pour%20ma%20commande%20en%20cours"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Besoin d'aide ? → Contacter le support
      </a>
    </div>
  );
}

export function AddressField({
  label, value, onChange, placeholder, invalid,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean }) {
  return (
    <label className="block">
      <span className={cn('block text-xs mb-1.5 font-medium', invalid ? 'text-danger' : 'text-muted-foreground')}>{label}</span>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={2}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full border-2 rounded-xl px-4 py-3 text-sm bg-card placeholder:text-muted-foreground/60 focus:outline-none transition-all resize-none',
          invalid ? 'border-danger focus:border-danger' : 'border-border focus:border-foreground',
        )}
      />
    </label>
  );
}

export function CoverageBadge({ level, city, loading }: { level: 'direct' | 'partner' | 'none'; city: string; loading: boolean }) {
  if (loading) return <div className="h-9 w-64 rounded-xl bg-secondary/40 animate-pulse" />;
  if (level === 'direct') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 inline-flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5" /> Collecte disponible à {city}
      </div>
    );
  }
  if (level === 'partner') {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-900 inline-flex items-center gap-2">
        <ArrowRight className="w-3.5 h-3.5" /> Collecte via partenaire local — délai +24h
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-center gap-2 flex-wrap">
      <AlertTriangle className="w-3.5 h-3.5" />
      Zone non couverte directement.
      <a
        href={`https://wa.me/221786078080?text=${encodeURIComponent("Bonjour Yobbanté, je souhaite expédier un colis mais ma zone semble non couverte. Pouvez-vous m'aider ?")}`}
        target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 font-semibold underline">
        <MessageCircle className="w-3 h-3" /> Nous contacter
      </a>
    </div>
  );
}

/** Quartier Dakar picker (dropdown groupé). */
export function QuartierDakarPicker({
  value, onChange, label,
}: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1.5 font-medium text-muted-foreground">
        {label ?? 'Quartier de collecte'} <span className="text-muted-foreground/60">(optionnel)</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-2 border-border rounded-xl px-4 py-3 text-sm bg-card focus:outline-none focus:border-foreground transition-all"
      >
        <option value="">— Sélectionner un quartier —</option>
        {QUARTIER_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.quartiers.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Zone Dakar badge — affiche frais d'enlèvement / livraison. */
export function ZoneBadge({
  frais, mode = 'enlevement',
}: {
  frais: { zone: DakarZoneCategory; surcharge: number; gratuit: boolean; message: string };
  mode?: 'enlevement' | 'livraison';
}) {
  if (frais.gratuit) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[12px] text-emerald-300 inline-flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {mode === 'livraison'
          ? 'Livraison gratuite à Dakar centre'
          : 'Enlèvement gratuit à Dakar centre'}
      </div>
    );
  }
  const icon = frais.zone === 'hors_dakar' ? '⚠️' : '📍';
  const label = mode === 'livraison'
    ? (frais.zone === 'hors_dakar' ? 'Livraison hors Dakar' : 'Livraison en banlieue')
    : (frais.zone === 'hors_dakar' ? 'Adresse hors Dakar' : 'Zone périphérique Dakar');
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-300 flex items-start gap-2">
      <span aria-hidden>{icon}</span>
      <span>
        {label} — frais de déplacement&nbsp;:
        <strong className="ml-1">+ {formatFcfa(frais.surcharge)}</strong>
      </span>
    </div>
  );
}
