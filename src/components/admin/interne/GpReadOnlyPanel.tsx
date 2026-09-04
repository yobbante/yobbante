import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

type Gp = {
  id: string;
  reference: string | null;
  nom: string | null;
  prenom: string | null;
  telephone_1: string | null;
  ville: string | null;
  actif: boolean | null;
};

/** Base des transporteurs GP — LECTURE SEULE (nettoyage / cartographie). */
export function GpReadOnlyPanel() {
  const [q, setQ] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['interne-gp-readonly'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transporteurs')
        .select('id, reference, nom, prenom, telephone_1, ville, actif')
        .order('nom')
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Gp[];
    },
  });

  const needle = q.trim().toLowerCase();
  const rows = needle
    ? data.filter(g =>
        [g.reference, g.nom, g.prenom, g.telephone_1, g.ville]
          .filter(Boolean).join(' ').toLowerCase().includes(needle))
    : data;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher un GP (nom, réf, ville, téléphone)"
          className="pl-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length} transporteur(s) — lecture seule.
      </p>
      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.slice(0, 300).map(g => (
            <Card key={g.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {[g.prenom, g.nom].filter(Boolean).join(' ') || 'Sans nom'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {g.reference ?? '—'} · {g.ville ?? 'Ville inconnue'} · {g.telephone_1 ?? 'Sans téléphone'}
                </div>
              </div>
              <Badge variant={g.actif ? 'secondary' : 'outline'} className="text-[10px] shrink-0">
                {g.actif ? 'Actif' : 'Inactif'}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
