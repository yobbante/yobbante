import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertTriangle, Database, Radio, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type SyncLog = {
  id: string;
  created_at: string;
  source: string;
  status: 'ok' | 'error';
  count: number;
  partner_authenticated: boolean;
  raw_payload: unknown;
  error_message: string | null;
};

type LiveResponse = {
  source: 'konnekt' | 'cache' | 'mock';
  partner_authenticated: boolean;
  count: number;
  generated_at: string;
  lkg_updated_at: string | null;
  error_message?: string;
  departures: unknown[];
};

const SOURCE_META = {
  konnekt: { Icon: Radio,        label: 'Konnekt (live)',  cls: 'text-emerald-500' },
  cache:   { Icon: Database,     label: 'Cache (LKG)',     cls: 'text-amber-500' },
  mock:    { Icon: FlaskConical, label: 'Mock',            cls: 'text-muted-foreground' },
} as const;

export function KonnektMonitorTab() {
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: logs = [], isLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['konnekt-sync-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('konnekt_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as SyncLog[];
    },
  });

  const last = logs[0];

  const runTest = async () => {
    setTesting(true);
    try {
      // supabase.functions.invoke() drops query params, so we call the function URL directly
      // with ?refresh=1 to bypass CDN cache and force a fresh Konnekt fetch.
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/list-departures?refresh=1`;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || anonKey;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as LiveResponse;
      setLive(json);
      await refetchLogs();
      if (json.source === 'konnekt') {
        toast.success(`Konnekt OK · ${json.count} départs live`);
      } else if (json.source === 'cache') {
        toast.warning(`Konnekt KO → cache LKG (${json.count}). ${json.error_message || ''}`);
      } else {
        toast.error(`Konnekt KO → mock. ${json.error_message || 'Aucune donnée'}`);
      }
    } catch (e) {
      toast.error(`Échec retest : ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-base font-bold text-foreground">Konnekt — synchronisation départs</p>
          <p className="text-xs text-muted-foreground">
            Statut de l'endpoint <code className="text-[10px]">list-departures</code> et historique des sync.
          </p>
        </div>
        <Button onClick={runTest} disabled={testing} className="gap-2">
          <RefreshCw className={cn('w-4 h-4', testing && 'animate-spin')} />
          {testing ? 'Retest…' : 'Retester maintenant'}
        </Button>
      </div>

      {/* Last status card */}
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard
          label="Dernière source"
          value={last ? SOURCE_META[(last.source as keyof typeof SOURCE_META) || 'mock']?.label || last.source : '—'}
          icon={last ? SOURCE_META[(last.source as keyof typeof SOURCE_META) || 'mock']?.Icon : null}
          tone={last?.source === 'konnekt' ? 'ok' : last?.source === 'cache' ? 'warn' : 'muted'}
        />
        <StatCard
          label="Départs renvoyés"
          value={last ? String(last.count) : '—'}
          tone={last && last.count > 0 ? 'ok' : 'warn'}
        />
        <StatCard
          label="Statut"
          value={last ? (last.status === 'ok' ? 'OK' : 'Erreur') : '—'}
          icon={last ? (last.status === 'ok' ? CheckCircle2 : AlertTriangle) : null}
          tone={last?.status === 'ok' ? 'ok' : 'error'}
        />
      </div>

      {/* Live retest result */}
      {live && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Dernier retest manuel</p>
            <Badge variant="outline" className="text-[10px]">{new Date(live.generated_at).toLocaleString('fr-FR')}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Field label="source" value={live.source} />
            <Field label="count" value={String(live.count)} />
            <Field label="partner_auth" value={String(live.partner_authenticated)} />
            <Field label="lkg" value={live.lkg_updated_at ? new Date(live.lkg_updated_at).toLocaleString('fr-FR') : '—'} />
          </div>
          {live.error_message && (
            <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1.5">
              ⚠️ {live.error_message}
            </p>
          )}
        </div>
      )}

      {/* History */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Historique (20 dernières sync)</p>
        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aucune sync enregistrée. Lance un retest pour démarrer le journal.
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }> | null;
  tone: 'ok' | 'warn' | 'error' | 'muted';
}) {
  const IconCmp = icon as React.ComponentType<{ className?: string }> | null | undefined;
  const toneCls = {
    ok: 'text-emerald-500',
    warn: 'text-amber-500',
    error: 'text-destructive',
    muted: 'text-muted-foreground',
  }[tone];
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</p>
      <div className={cn('mt-1 flex items-center gap-1.5 text-base font-bold', toneCls)}>
        {IconCmp ? <IconCmp className="w-4 h-4" /> : null}
        {value}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</p>
      <p className="font-mono text-xs text-foreground truncate">{value}</p>
    </div>
  );
}

function LogRow({ log }: { log: SyncLog }) {
  const [open, setOpen] = useState(false);
  const meta = SOURCE_META[(log.source as keyof typeof SOURCE_META)] || SOURCE_META.mock;
  const IconCmp = meta.Icon;
  return (
    <div className="bg-card border border-border rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/40 transition-colors rounded-xl"
      >
        {IconCmp ? <IconCmp className={cn('w-4 h-4 shrink-0', meta.cls)} /> : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">{meta.label}</span>
            <span className={cn(
              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
              log.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive',
            )}>{log.status}</span>
            <span className="text-muted-foreground">· {log.count} départs</span>
            {log.partner_authenticated && (
              <span className="text-[10px] text-emerald-500">· authed</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {new Date(log.created_at).toLocaleString('fr-FR')}
            {log.error_message && <span className="text-amber-500"> · {log.error_message}</span>}
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{open ? 'Masquer' : 'Voir JSON'}</span>
      </button>
      {open && (
        <pre className="text-[10px] font-mono text-muted-foreground bg-background/60 border-t border-border p-3 overflow-x-auto max-h-72 rounded-b-xl">
{JSON.stringify(log.raw_payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
