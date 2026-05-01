import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight, Sparkles, X, Hash, Copy, ExternalLink, MessageCircle,
  Wallet, Package as PackageIcon, FileText, User, Phone, Mail, MapPin,
  CheckCircle2, Circle, Loader2, AlertTriangle, ShoppingBag, Truck, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type Dossier, COUNTRY_FLAGS, COUNTRY_NAMES, DOSSIER_STATUS_LABELS,
} from '@/lib/types';
import { AdminInlineEditor } from '@/components/admin/AdminInlineEditor';

const KONNEKT_APP_URL = 'https://konnekt.lovable.app';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function flagOf(c?: string | null) {
  if (!c) return '🌍';
  return (COUNTRY_FLAGS as Record<string, string>)[c.toUpperCase()] || '🌍';
}
function nameOf(c?: string | null) {
  if (!c) return '—';
  return (COUNTRY_NAMES as Record<string, string>)[c.toUpperCase()] || c;
}

type Milestone = { key: string; label: string; desc: string };
const SOURCING_MILESTONES: Milestone[] = [
  { key: 'SUBMITTED',  label: 'Soumis',      desc: 'Demande reçue, équipe notifiée' },
  { key: 'IN_REVIEW',  label: 'Analyse',     desc: 'Sélection du fournisseur, vérifications' },
  { key: 'SOURCING',   label: 'Négociation', desc: 'Négociation prix, validation produit' },
  { key: 'PROCURED',   label: 'Acheté',      desc: 'Produit acheté et regroupé' },
  { key: 'IN_TRANSIT', label: 'En transit',  desc: 'Acheminement vers la destination' },
  { key: 'DELIVERED',  label: 'Livré',       desc: 'Remis au destinataire' },
];
const SOURCING_RANK: Record<string, number> = {
  SUBMITTED: 1, IN_REVIEW: 2, SOURCING: 3, PROCURED: 4,
  IN_TRANSIT: 5, CUSTOMS: 5, DELIVERED: 6, CLOSED: 6,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: Dossier | null;
}

export function SourcingDetailDrawer({ open, onOpenChange, dossier }: Props) {
  const navigate = useNavigate();
  if (!dossier) return null;

  const status = dossier.status;
  const statusLabel = DOSSIER_STATUS_LABELS[status] ?? status;
  const rank = SOURCING_RANK[status] ?? 0;
  const isDelivered = status === 'DELIVERED' || status === 'CLOSED';
  const isPending = status === 'SUBMITTED' || status === 'IN_REVIEW';

  const description = dossier.product_description?.trim() || '—';
  const price = dossier.estimated_cost ?? dossier.budget_eur ?? null;
  const priceLabel = dossier.estimated_cost ? 'Estimation' : 'Budget';
  const eta = dossier.estimated_delivery_date;

  // Live messages count
  const [msgCount, setMsgCount] = useState<number | null>(null);
  useEffect(() => {
    if (!open || !dossier?.id) { setMsgCount(null); return; }
    let alive = true;
    (async () => {
      const { count } = await supabase
        .from('dossier_messages')
        .select('id', { count: 'exact', head: true })
        .eq('dossier_id', dossier.id);
      if (alive) setMsgCount(count ?? 0);
    })();
    return () => { alive = false; };
  }, [open, dossier?.id]);

  const copyRef = () => {
    navigator.clipboard.writeText(dossier.reference);
    toast.success('Référence copiée');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 overflow-y-auto bg-background border-l border-border"
      >
        {/* ─── HERO ─── */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_55%)]" />
          <div className="relative px-5 sm:px-6 pt-5 pb-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/15 backdrop-blur flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                    Sourcing
                  </p>
                  <p className="text-[11px] font-mono text-foreground/80 truncate max-w-[180px]">
                    {dossier.reference}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-lg bg-card/60 backdrop-blur border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product hero */}
            <p className="text-base font-bold text-foreground line-clamp-3 mb-4">
              {description}
            </p>

            {/* Route */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Origine</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl">{flagOf(dossier.origin_country)}</span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground truncate">
                      {nameOf(dossier.origin_country)}
                    </p>
                    {dossier.supplier_country && dossier.supplier_country !== dossier.origin_country && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        Fournisseur · {dossier.supplier_country}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center pb-1">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-1.5">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-primary/60" />
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  <div className="w-1 h-1 rounded-full bg-primary/20" />
                </div>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Livraison</p>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground truncate">
                      {nameOf(dossier.destination_country)}
                    </p>
                  </div>
                  <span className="text-2xl">{flagOf(dossier.destination_country)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <StatusPill status={status} label={statusLabel} />
              {dossier.dossier_type === 'business' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                  <Sparkles className="w-3.5 h-3.5" /> Business
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── BODY ─── */}
        <div className="px-5 sm:px-6 py-5 space-y-6 pb-12">
          {/* Reference */}
          <button
            onClick={copyRef}
            className="w-full flex items-center gap-3 p-3.5 bg-secondary/60 hover:bg-secondary rounded-xl border border-border/60 transition-colors group"
          >
            <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Référence dossier</p>
              <p className="text-sm font-mono font-semibold text-foreground truncate">{dossier.reference}</p>
            </div>
            <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Admin-only inline editor */}
          <AdminInlineEditor
            kind="dossier"
            id={dossier.id}
            status={status}
            reference={dossier.reference}
          />

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <Kpi label={priceLabel} value={price != null ? fmtEur(price) : '—'} icon={<Wallet className="w-3.5 h-3.5" />} />
            <Kpi
              label="Poids est."
              value={dossier.estimated_weight != null ? `${dossier.estimated_weight} kg` : '—'}
              icon={<PackageIcon className="w-3.5 h-3.5" />}
            />
            <Kpi
              label="Livraison"
              value={eta ? new Date(eta).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
              icon={<Truck className="w-3.5 h-3.5" />}
            />
          </div>

          {/* Alerts */}
          {isPending && (
            <Alert tone="amber" icon={<AlertTriangle className="w-4 h-4" />}>
              Notre équipe étudie votre demande. Vous recevrez une proposition de fournisseur dans les 24–48h.
            </Alert>
          )}

          {/* Konnekt link */}
          {dossier.konnekt_order_id && (
            <a
              href={`${KONNEKT_APP_URL}/admin/orders/${dossier.konnekt_order_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Konnekt</p>
                  <p className="text-sm font-mono text-foreground truncate">#{dossier.konnekt_order_id}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                Ouvrir <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </a>
          )}

          {/* Timeline */}
          <Section title="Étapes du sourcing">
            <div className="relative pl-1">
              {SOURCING_MILESTONES.map((m, i) => {
                const isDone = rank > i;
                const isActive = rank === i + 1 || (rank === 0 && i === 0);
                const isLast = i === SOURCING_MILESTONES.length - 1;
                return (
                  <div key={m.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all
                        ${isDone ? 'bg-primary text-primary-foreground' :
                          isActive ? 'bg-primary/15 ring-2 ring-primary text-primary' :
                          'bg-secondary text-muted-foreground'}`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" />
                         : isActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                         : <Circle className="w-3 h-3" />}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 my-1 min-h-[32px] ${isDone ? 'bg-primary' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className={`flex-1 pb-5 ${!isDone && !isActive ? 'opacity-40' : ''}`}>
                      <p className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>{m.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Produit */}
          <Section title="Produit demandé">
            <Card>
              <Row icon={<FileText />} label="Description" value={description} />
              <Row icon={<PackageIcon />} label="Quantité"
                value={dossier.quantity ? `${dossier.quantity}${dossier.unit ? ` ${dossier.unit}` : ''}` : null} />
              <Row icon={<Wallet />} label="Valeur déclarée"
                value={dossier.declared_value != null
                  ? `${dossier.declared_value} ${dossier.currency ?? 'EUR'}`
                  : null} />
              <Row icon={<FileText />} label="Code HS" value={dossier.hs_code} />
              <Row icon={<FileText />} label="Incoterm" value={dossier.incoterm} />
            </Card>
          </Section>

          {/* Fournisseur */}
          {(dossier.supplier_name || dossier.supplier_country || dossier.supplier_contact) && (
            <Section title="Fournisseur">
              <Card>
                <Row icon={<User />} label="Nom" value={dossier.supplier_name} />
                <Row icon={<MapPin />} label="Pays" value={dossier.supplier_country} />
                <Row icon={<Phone />} label="Contact" value={dossier.supplier_contact} copy />
              </Card>
            </Section>
          )}

          {/* Acheteur / contact */}
          {(dossier.buyer_name || dossier.contact_phone || dossier.contact_email) && (
            <Section title="Contact">
              <Card>
                <Row icon={<User />} label="Nom" value={dossier.buyer_name} />
                <Row icon={<Phone />} label="Téléphone" value={dossier.contact_phone} copy />
                <Row icon={<Mail />} label="Email" value={dossier.contact_email} copy />
                <Row icon={<MapPin />} label="Pays" value={dossier.buyer_country} />
              </Card>
            </Section>
          )}

          {/* Notes client */}
          {dossier.notes && (
            <Section title="Notes">
              <div className="bg-card border border-border rounded-xl p-3.5">
                <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {dossier.notes}
                </p>
              </div>
            </Section>
          )}

          {/* Open full file CTA */}
          <Button
            onClick={() => { onOpenChange(false); navigate(`/app/dossier/${dossier.id}`); }}
            className="w-full"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Ouvrir le dossier complet
            {msgCount != null && msgCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                {msgCount}
              </span>
            )}
            <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            Créé le {new Date(dossier.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────────── Primitives ───────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl px-3 divide-y divide-border/60">
      {children}
    </div>
  );
}

function Row({
  icon, label, value, copy,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode | null;
  copy?: boolean;
}) {
  if (value == null || value === '' || value === false) return null;
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(value));
    toast.success(`${label} copié`);
  };
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="text-muted-foreground mt-0.5 [&_svg]:w-4 [&_svg]:h-4 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm text-foreground mt-0.5 break-words">{value}</p>
      </div>
      {copy && (
        <button
          onClick={onCopy}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label={`Copier ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground mt-1 flex items-center gap-1 truncate">
        {icon}<span className="truncate">{value}</span>
      </p>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'DELIVERED' || status === 'CLOSED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : status === 'SUBMITTED' || status === 'IN_REVIEW' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-primary/15 text-primary border-primary/30';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${tone}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function Alert({ tone, icon, children }: { tone: 'amber' | 'red'; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = tone === 'amber'
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    : 'bg-red-500/10 border-red-500/30 text-red-400';
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${cls}`}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  );
}
