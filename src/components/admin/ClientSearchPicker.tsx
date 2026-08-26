import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, UserCheck, X } from 'lucide-react';

export interface ClientHit {
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  reference: string | null;
  tracking_id: string | null;
  dossier_count: number;
}

interface Props {
  /** Client déjà sélectionné (affiche la carte de confirmation). */
  selected?: ClientHit | null;
  onSelect: (c: ClientHit) => void;
  onClear?: () => void;
  label?: string;
}

const FIELDS =
  'reference, tracking_id, buyer_name, contact_email, contact_phone, sender_name, sender_phone, recipient_name, recipient_phone, origin_city, created_at';

function dedupe(rows: any[]): ClientHit[] {
  const map = new Map<string, ClientHit>();
  for (const r of rows) {
    const candidates = [
      { name: r.buyer_name, phone: r.contact_phone },
      { name: r.sender_name, phone: r.sender_phone },
      { name: r.recipient_name, phone: r.recipient_phone },
    ];
    for (const c of candidates) {
      const phone = (c.phone || '').trim();
      const name = (c.name || '').trim();
      if (!phone && !name) continue;
      const key = phone ? phone.replace(/\D/g, '').slice(-9) : name.toLowerCase();
      const prev = map.get(key);
      if (prev) {
        prev.dossier_count += 1;
        if (!prev.name && name) prev.name = name;
        continue;
      }
      map.set(key, {
        name,
        phone,
        email: r.contact_email ?? null,
        city: r.origin_city ?? null,
        reference: r.reference ?? null,
        tracking_id: r.tracking_id ?? null,
        dossier_count: 1,
      });
    }
  }
  return Array.from(map.values()).slice(0, 12);
}

/** Recherche un client existant par nom, référence, n° de suivi ou téléphone. */
export function ClientSearchPicker({ selected, onSelect, onClear, label = 'Rechercher un client existant' }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const digits = term.replace(/\D/g, '');
        const parts = [
          `buyer_name.ilike.%${term}%`,
          `sender_name.ilike.%${term}%`,
          `recipient_name.ilike.%${term}%`,
          `reference.ilike.%${term}%`,
          `tracking_id.ilike.%${term}%`,
        ];
        if (digits.length >= 5) {
          const tail = digits.slice(-9);
          parts.push(
            `contact_phone.ilike.%${tail}%`,
            `sender_phone.ilike.%${tail}%`,
            `recipient_phone.ilike.%${tail}%`,
          );
        }
        const { data } = await supabase
          .from('dossiers')
          .select(FIELDS)
          .or(parts.join(','))
          .order('created_at', { ascending: false })
          .limit(40);
        if (!cancelled) setRows(dedupe((data ?? []) as any[]));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  if (selected) {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{selected.name || 'Client'}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {selected.phone}
              {selected.reference ? ` · ${selected.reference}` : ''}
              {selected.dossier_count > 1 ? ` · ${selected.dossier_count} dossiers` : ''}
            </div>
          </div>
        </div>
        {onClear && (
          <Button type="button" size="sm" variant="ghost" onClick={() => { setQ(''); onClear(); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Changer
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${label} (nom, réf, n° suivi, tél)`}
          className="pl-8 h-9 text-xs"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {q.trim().length >= 2 && !loading && rows.length === 0 && (
        <Badge variant="secondary" className="text-[11px]">Nouveau client — saisir les infos</Badge>
      )}
      {rows.length > 0 && (
        <ul className="max-h-56 overflow-y-auto space-y-1 rounded-md border border-border p-1">
          {rows.map((c, i) => (
            <li key={`${c.phone}-${i}`}>
              <button
                type="button"
                onClick={() => { onSelect(c); setQ(''); setRows([]); }}
                className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
              >
                <div className="text-xs font-medium text-foreground truncate">{c.name || c.phone || '—'}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {c.phone}
                  {c.reference ? ` · ${c.reference}` : ''}
                  {c.dossier_count > 1 ? ` · ${c.dossier_count} dossiers` : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
