import { useMemo, useState } from 'react';
import {
  Receipt, Loader2, Download, FileDown, Bell, Check, AlertCircle, FileText, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useBusinessInvoices,
  exportInvoicesCSV,
  downloadCSV,
  type BusinessInvoice,
  type InvoiceStatus,
} from '@/hooks/useBusinessInvoices';
import { cn } from '@/lib/utils';

const STATUS_META: Record<InvoiceStatus, { label: string; tone: string }> = {
  draft:     { label: 'Brouillon', tone: 'bg-secondary text-muted-foreground border-border' },
  unpaid:    { label: 'En attente', tone: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  paid:      { label: 'Payée', tone: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  overdue:   { label: 'En retard', tone: 'bg-red-500/15 text-red-500 border-red-500/30' },
  cancelled: { label: 'Annulée', tone: 'bg-secondary text-muted-foreground border-border line-through' },
};

interface Props {
  businessId: string;
  isAdmin: boolean;
}

export function InvoicesSection({ businessId, isAdmin }: Props) {
  const { invoices, loading, refresh } = useBusinessInvoices(businessId);
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [period, setPeriod] = useState<'all' | '30d' | '90d' | 'year'>('all');

  const filtered = useMemo(() => {
    let list = invoices;
    if (filter !== 'all') list = list.filter(i => i.status === filter);
    if (period !== 'all') {
      const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      list = list.filter(i => new Date(i.issued_at) >= cutoff);
    }
    return list;
  }, [invoices, filter, period]);

  const totals = useMemo(() => {
    const unpaid = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue');
    const paid = invoices.filter(i => i.status === 'paid');
    return {
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((s, i) => s + Number(i.amount_eur), 0),
      paidAmount: paid.reduce((s, i) => s + Number(i.amount_eur), 0),
      overdueCount: invoices.filter(i => i.status === 'overdue').length,
    };
  }, [invoices]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('Aucune facture à exporter.');
      return;
    }
    const csv = exportInvoicesCSV(filtered);
    downloadCSV(`yobbante-factures-${Date.now()}.csv`, csv);
    toast.success(`${filtered.length} facture(s) exportée(s).`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Facturation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vos factures, paiements et exports comptables.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <FileDown className="w-4 h-4 mr-2" /> Exporter CSV
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Impayé" value={`${totals.unpaidAmount.toFixed(2)} €`} sub={`${totals.unpaidCount} facture(s)`} tone="amber" />
        <KPI label="En retard" value={totals.overdueCount} sub="à relancer" tone={totals.overdueCount > 0 ? 'red' : 'muted'} />
        <KPI label="Encaissé" value={`${totals.paidAmount.toFixed(2)} €`} sub={`${invoices.filter(i => i.status === 'paid').length} payée(s)`} tone="emerald" />
        <KPI label="Total" value={invoices.length} sub="factures" tone="primary" />
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="unpaid">En attente</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="paid">Payées</SelectItem>
            <SelectItem value="cancelled">Annulées</SelectItem>
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute période</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="90d">90 derniers jours</SelectItem>
            <SelectItem value="year">12 derniers mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {invoices.length === 0
              ? 'Aucune facture pour le moment. Elles apparaîtront ici après vos premiers envois.'
              : 'Aucune facture ne correspond aux filtres.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <InvoiceRow key={inv.id} invoice={inv} isAdmin={isAdmin} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone: 'amber' | 'red' | 'emerald' | 'primary' | 'muted' }) {
  const toneCls = {
    amber: 'text-amber-500',
    red: 'text-red-500',
    emerald: 'text-emerald-500',
    primary: 'text-primary',
    muted: 'text-muted-foreground',
  }[tone];
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className={cn('mt-2 text-2xl font-bold tracking-tight', toneCls)}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </Card>
  );
}

function InvoiceRow({ invoice, isAdmin, onChanged }: { invoice: BusinessInvoice; isAdmin: boolean; onChanged: () => void }) {
  const meta = STATUS_META[invoice.status];
  const [working, setWorking] = useState(false);

  const sendReminder = async () => {
    setWorking(true);
    const { error } = await supabase
      .from('business_invoices')
      .update({
        last_reminder_at: new Date().toISOString(),
        reminder_count: invoice.reminder_count + 1,
      })
      .eq('id', invoice.id);
    setWorking(false);
    if (error) toast.error('Impossible d\'enregistrer la relance.');
    else { toast.success('Relance enregistrée.'); onChanged(); }
  };

  const markPaid = async () => {
    setWorking(true);
    const { error } = await supabase
      .from('business_invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoice.id);
    setWorking(false);
    if (error) toast.error('Mise à jour impossible.');
    else { toast.success('Facture marquée comme payée.'); onChanged(); }
  };

  const downloadPDF = () => {
    // Mock PDF download — placeholder pour vraie génération PDF plus tard
    const content = [
      `FACTURE ${invoice.reference}`,
      `Émise le ${new Date(invoice.issued_at).toLocaleDateString('fr-FR')}`,
      `Échéance : ${new Date(invoice.due_at).toLocaleDateString('fr-FR')}`,
      `Statut : ${meta.label}`,
      ``,
      `Montant : ${invoice.amount_eur.toFixed(2)} €`,
      invoice.amount_xof ? `Soit ${invoice.amount_xof} XOF` : '',
      ``,
      invoice.description ?? '',
    ].filter(Boolean).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${invoice.reference}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.info('PDF en cours d\'implémentation — fichier texte généré.');
  };

  const isOverdue = invoice.status === 'overdue';
  const needsReminder = (invoice.status === 'unpaid' || isOverdue) && (
    !invoice.last_reminder_at ||
    Date.now() - new Date(invoice.last_reminder_at).getTime() > 7 * 24 * 60 * 60 * 1000
  );

  return (
    <Card className={cn('p-4', isOverdue && 'border-red-500/30')}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-[var(--radius)] bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold font-mono text-sm">{invoice.reference}</div>
            <Badge variant="outline" className={cn('text-xs', meta.tone)}>{meta.label}</Badge>
            {invoice.reminder_count > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Bell className="w-3 h-3" /> {invoice.reminder_count} relance{invoice.reminder_count > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Émise {new Date(invoice.issued_at).toLocaleDateString('fr-FR')} · Échéance {new Date(invoice.due_at).toLocaleDateString('fr-FR')}
            {invoice.description && ` · ${invoice.description}`}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-base">{Number(invoice.amount_eur).toFixed(2)} €</div>
          {invoice.amount_xof && (
            <div className="text-xs text-muted-foreground">{invoice.amount_xof.toLocaleString('fr-FR')} XOF</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button size="sm" variant="outline" onClick={downloadPDF}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
        </Button>
        {needsReminder && (
          <Button size="sm" variant="outline" onClick={sendReminder} disabled={working}>
            <Bell className="w-3.5 h-3.5 mr-1.5" /> Relancer
          </Button>
        )}
        {isAdmin && (invoice.status === 'unpaid' || isOverdue) && (
          <Button size="sm" variant="outline" onClick={markPaid} disabled={working} className="text-emerald-500 hover:text-emerald-500">
            <Check className="w-3.5 h-3.5 mr-1.5" /> Marquer payée
          </Button>
        )}
        {isOverdue && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 ml-auto">
            <AlertCircle className="w-3.5 h-3.5" /> Échéance dépassée
          </div>
        )}
      </div>
    </Card>
  );
}
