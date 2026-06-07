import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Download, Send, Copy, ExternalLink } from 'lucide-react';
import { useTransporteurs, type Transporteur } from '@/hooks/useTransporteurs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type Status = 'not_invited' | 'invited' | 'opened' | 'registered';

const STATUS_LABEL: Record<Status, string> = {
  not_invited: 'Non invité',
  invited: 'Invité',
  opened: 'Lien ouvert',
  registered: 'Inscrit',
};

const STATUS_TONE: Record<Status, string> = {
  not_invited: 'bg-muted text-muted-foreground',
  invited: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  opened: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  registered: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

function gpRef(reference: string | null | undefined) {
  return `GP${String(reference || '').replace(/\D/g, '').padStart(4, '0')}`;
}

function statusOf(gp: Transporteur): Status {
  if (gp.konnekt_registered) return 'registered';
  if (gp.konnekt_link_opened_at) return 'opened';
  if (gp.konnekt_invited_at) return 'invited';
  return 'not_invited';
}

function formatName(gp: Transporteur) {
  const p = (gp.prenom ?? '').trim();
  const n = (gp.nom ?? '').trim();
  if (!p) return n || '—';
  if (!n) return p;
  return `${p} ${n}`;
}

function buildOnboardingUrl(gp: Transporteur) {
  return `https://usekonnekt.com/onboarding/${gpRef(gp.reference)}`;
}

function buildRelanceMessage(gp: Transporteur) {
  const prenom = (gp.prenom?.trim() || gp.nom?.split(' ')[0] || 'cher partenaire');
  const st = statusOf(gp);
  const url = buildOnboardingUrl(gp);
  if (st === 'opened') {
    return `Salam ${prenom}, c'est Amath (Yobbanté). J'ai vu que tu as ouvert le lien Konnekt — un souci pour finaliser ton inscription ? Je peux t'aider en 2 min. Voici le lien pour reprendre : ${url}`;
  }
  if (st === 'invited') {
    return `Salam ${prenom}, c'est Amath (Yobbanté). Petit rappel pour Konnekt — c'est 2 minutes pour t'inscrire et recevoir tes premières missions en priorité : ${url}`;
  }
  // not_invited
  return `Salam ${prenom}, c'est Amath (Yobbanté). Je t'envoie ton lien Konnekt personnel — tu publies tes départs, tu fixes ton prix. 2 minutes pour rejoindre : ${url}`;
}

function buildRelanceWa(gp: Transporteur) {
  const phone = (gp.telephone_1 || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildRelanceMessage(gp))}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return '—'; }
}

function toCsv(rows: Transporteur[]) {
  const header = ['Nom', 'Reference', 'Telephone', 'Statut', 'Date invitation', 'Date ouverture lien', 'Date inscription', 'Onboarding URL'];
  const lines = [header.join(',')];
  for (const gp of rows) {
    const cells = [
      formatName(gp),
      gpRef(gp.reference),
      gp.telephone_1 ?? '',
      STATUS_LABEL[statusOf(gp)],
      gp.konnekt_invited_at ?? '',
      gp.konnekt_link_opened_at ?? '',
      gp.konnekt_registered_at ?? '',
      buildOnboardingUrl(gp),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

export function SuiviOnboardingTab() {
  const { list } = useTransporteurs();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');

  const all = list.data ?? [];

  const stats = useMemo(() => {
    const total = all.length;
    let invited = 0, opened = 0, registered = 0;
    for (const gp of all) {
      const s = statusOf(gp);
      if (s !== 'not_invited') invited++;
      if (s === 'opened' || s === 'registered') opened++;
      if (s === 'registered') registered++;
    }
    const conversion = invited > 0 ? Math.round((registered / invited) * 100) : 0;
    return { total, invited, opened, registered, conversion };
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter(gp => filter === 'all' ? true : statusOf(gp) === filter)
      .filter(gp => !needle || `${formatName(gp)} ${gp.telephone_1 ?? ''} ${gpRef(gp.reference)}`.toLowerCase().includes(needle));
  }, [all, q, filter]);

  const handleRelance = async (gp: Transporteur) => {
    const url = buildRelanceWa(gp);
    window.open(url, '_blank', 'noopener,noreferrer');
    // Mark as invited if it wasn't yet
    if (!gp.konnekt_invited_at) {
      try {
        await supabase.from('transporteurs' as any).update({ konnekt_invited_at: new Date().toISOString() }).eq('id', gp.id);
        list.refetch();
      } catch { /* noop */ }
    }
  };

  const handleCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suivi-onboarding-gp-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Export ${filtered.length} lignes`);
  };

  const KpiCard = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone ?? 'text-foreground'}`}>{value}</div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <KpiCard label="Total GP" value={stats.total} />
        <KpiCard label="Invités" value={stats.invited} tone="text-amber-600 dark:text-amber-400" />
        <KpiCard label="Ont ouvert" value={stats.opened} tone="text-blue-600 dark:text-blue-400" />
        <KpiCard label="Inscrits" value={stats.registered} tone="text-emerald-600 dark:text-emerald-400" />
        <KpiCard label="Conversion" value={`${stats.conversion}%`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher nom, téléphone, réf…"
            className="pl-8"
          />
        </div>
        {(['all', 'not_invited', 'invited', 'opened', 'registered'] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tous' : STATUS_LABEL[f]}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={handleCsv}>
          <Download className="h-4 w-4 mr-1" />Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2 font-medium">Nom GP</th>
                <th className="text-left p-2 font-medium">Réf.</th>
                <th className="text-left p-2 font-medium">Téléphone</th>
                <th className="text-left p-2 font-medium">Statut</th>
                <th className="text-left p-2 font-medium">Invité</th>
                <th className="text-left p-2 font-medium">Lien ouvert</th>
                <th className="text-left p-2 font-medium">Inscrit</th>
                <th className="text-right p-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={8} className="p-2"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Aucun GP</td></tr>
              ) : filtered.map(gp => {
                const s = statusOf(gp);
                const url = buildOnboardingUrl(gp);
                return (
                  <tr key={gp.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2 font-medium">{formatName(gp)}</td>
                    <td className="p-2 font-mono text-xs">{gpRef(gp.reference)}</td>
                    <td className="p-2">{gp.telephone_1 ?? '—'}</td>
                    <td className="p-2">
                      <Badge variant="secondary" className={STATUS_TONE[s]}>
                        {STATUS_LABEL[s]}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{fmtDate(gp.konnekt_invited_at)}</td>
                    <td className="p-2 text-muted-foreground">{fmtDate(gp.konnekt_link_opened_at)}</td>
                    <td className="p-2 text-muted-foreground">{fmtDate(gp.konnekt_registered_at)}</td>
                    <td className="p-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Copier le lien onboarding"
                          onClick={() => { navigator.clipboard.writeText(url); toast.success('Lien copié'); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Ouvrir le lien onboarding"
                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant={s === 'registered' ? 'ghost' : 'default'}
                          disabled={s === 'registered'}
                          onClick={() => handleRelance(gp)}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Relancer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
