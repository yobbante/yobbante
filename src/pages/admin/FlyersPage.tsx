/**
 * /admin/flyers — Traitement des flyers GP reçus par WhatsApp.
 *
 * Liste les images entrantes (numéros bots Yobbanté 607 / 926) avec :
 *   - aperçu de l'image (si URL HTTP disponible)
 *   - métadonnées (expéditeur, date)
 *   - extraction IA (bot_intent + bot_response Claude Vision)
 *   - actions : Créer ce départ (overlay ManualDepartureForm prérempli),
 *               Ignorer (archive), Retraiter les non lus (batch Claude).
 *
 * Accessible depuis la sidebar admin et depuis "Retraiter les flyers non lus"
 * dans /admin/terrain.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ImageOff, Loader2, Plus, RefreshCcw, X, Calendar, Phone, Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  ManualDepartureForm, type ManualDeparturePrefill,
} from '@/components/admin/ManualDepartureForm';

interface FlyerRow {
  id: string;
  from_phone: string;
  from_name: string | null;
  media_url: string | null;
  bot_intent: string | null;
  bot_response: string | null;
  received_at: string;
}

const ARCHIVED_INTENT = 'image_archived';
const SINCE = '2026-06-09T00:00:00Z';

/** Parse une réponse Claude texte pour deviner ville d'arrivée + date départ. */
function guessFromResponse(text: string | null) {
  if (!text) return {};
  const out: { destCity?: string; departureDate?: string } = {};
  // "Dakar → Paris" / "Dakar -> Paris" / "vers Paris"
  const arrow = text.match(/(?:→|->)\s*([A-ZÉÈÀÂÎÔÛÇ][\wÀ-ÿ' -]{2,30})/);
  if (arrow) out.destCity = arrow[1].trim();
  else {
    const vers = text.match(/\bvers\s+([A-ZÉÈÀÂÎÔÛÇ][\wÀ-ÿ' -]{2,30})/i);
    if (vers) out.destCity = vers[1].trim();
  }
  // date dd/mm/yyyy
  const d = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (d) out.departureDate = `${d[3]}-${d[2]}-${d[1]}`;
  return out;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function FlyersPage() {
  const qc = useQueryClient();
  const [reprocessing, setReprocessing] = useState(false);
  const [prefill, setPrefill] = useState<ManualDeparturePrefill | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: flyers = [], isLoading } = useQuery({
    queryKey: ['admin-flyers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_inbound_messages')
        .select('id, from_phone, from_name, media_url, bot_intent, bot_response, received_at')
        .eq('message_type', 'image')
        .gte('received_at', SINCE)
        .neq('bot_intent', ARCHIVED_INTENT)
        .order('received_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []) as FlyerRow[];
    },
  });

  // Resolve GP per phone (tail-9 match). Single query, then map.
  const phones = useMemo(() => Array.from(new Set(flyers.map(f => f.from_phone))), [flyers]);
  const { data: gpMap = {} } = useQuery({
    queryKey: ['admin-flyers-gp', phones],
    enabled: phones.length > 0,
    queryFn: async () => {
      const tails = phones.map(p => p.replace(/\D/g, '').slice(-9)).filter(t => t.length >= 8);
      if (tails.length === 0) return {};
      // Fetch transporteurs whose phone fields contain any tail. We use OR.
      const orExpr = tails.flatMap(t => [`telephone_1.ilike.%${t}%`, `whatsapp.ilike.%${t}%`]).join(',');
      const { data } = await supabase
        .from('transporteurs' as any)
        .select('id, reference, prenom, nom, telephone_1, whatsapp')
        .or(orExpr)
        .limit(500);
      const map: Record<string, any> = {};
      for (const phone of phones) {
        const tail = phone.replace(/\D/g, '').slice(-9);
        const found = (data ?? []).find((t: any) =>
          (t.telephone_1 || '').includes(tail) || (t.whatsapp || '').includes(tail),
        );
        if (found) map[phone] = found;
      }
      return map;
    },
  });

  async function archive(id: string) {
    const { error } = await supabase
      .from('whatsapp_inbound_messages')
      .update({ bot_intent: ARCHIVED_INTENT })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Flyer archivé');
    qc.invalidateQueries({ queryKey: ['admin-flyers'] });
  }

  async function reprocess() {
    setReprocessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gp-bot-reprocess-flyers');
      if (error) throw error;
      const sent = (data?.results ?? []).filter((r: any) => r.status === 'sent').length;
      toast.success(`Retraitement : ${sent} récap(s) envoyé(s) sur ${data?.pending ?? 0} image(s)`);
      qc.invalidateQueries({ queryKey: ['admin-flyers'] });
    } catch (e: any) {
      toast.error(e?.message || 'Erreur retraitement');
    } finally { setReprocessing(false); }
  }

  function openCreate(flyer: FlyerRow) {
    const gp = gpMap[flyer.from_phone];
    const guess = guessFromResponse(flyer.bot_response);
    setPrefill({
      transporteurRef: gp?.reference ?? null,
      originCountry: 'SN',
      originCity: 'Dakar',
      destCity: guess.destCity ?? null,
      departureDate: guess.departureDate ?? null,
      notes: flyer.bot_response ? `Flyer WhatsApp · ${flyer.from_phone}\n\n${flyer.bot_response}` : null,
    });
    setFormOpen(true);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 md:px-6 py-3 flex items-center gap-3">
        <Link to="/admin/terrain" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Flyers WhatsApp</h1>
          <p className="text-xs text-muted-foreground">
            Images reçues sur les bots Yobbanté (607 / 926) — extraction IA et création de départs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reprocess} disabled={reprocessing}>
          {reprocessing
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <RefreshCcw className="w-4 h-4 mr-2" />}
          Retraiter non lus
        </Button>
      </header>

      <main className="px-4 md:px-6 py-6 max-w-5xl mx-auto space-y-4">
        {isLoading && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Chargement…
          </div>
        )}
        {!isLoading && flyers.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Aucun flyer en attente.
          </div>
        )}
        {flyers.map((f) => {
          const gp = gpMap[f.from_phone];
          const guess = guessFromResponse(f.bot_response);
          const isHttpMedia = !!f.media_url && /^https?:\/\//i.test(f.media_url);
          return (
            <Card key={f.id} className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Image */}
                <div className="md:w-56 flex-shrink-0">
                  {isHttpMedia ? (
                    <a href={f.media_url!} target="_blank" rel="noopener noreferrer">
                      <img
                        src={f.media_url!}
                        alt={`Flyer de ${f.from_phone}`}
                        className="rounded-md w-full h-44 object-cover border border-border"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div className="rounded-md w-full h-44 border border-dashed border-border bg-secondary/40 flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
                      <ImageOff className="w-5 h-5" />
                      <span>Média stocké côté Meta</span>
                      {f.media_url && <span className="font-mono">{f.media_url.slice(0, 18)}…</span>}
                    </div>
                  )}
                </div>

                {/* Metadata + IA */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Phone className="w-3 h-3" /> {f.from_phone}
                      {f.from_name && <span className="text-foreground/80">· {f.from_name}</span>}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-3 h-3" /> {fmtDate(f.received_at)}
                    </span>
                    {gp && (
                      <Badge variant="secondary" className="font-mono">GP #{gp.reference} · {gp.prenom}</Badge>
                    )}
                    {f.bot_intent && (
                      <Badge variant={f.bot_intent.startsWith('image_ia_propose') ? 'default' : 'outline'} className="text-[10px]">
                        {f.bot_intent}
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-md bg-secondary/30 border border-border p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Brain className="w-3.5 h-3.5 text-[#F5C518]" /> Extraction IA
                    </div>
                    {f.bot_response ? (
                      <pre className="whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">
                        {f.bot_response}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground italic">
                        Aucune analyse — utilisez « Retraiter non lus » pour lancer Claude Vision.
                      </p>
                    )}
                    {(guess.destCity || guess.departureDate) && (
                      <div className="pt-1.5 flex flex-wrap gap-2 text-[11px]">
                        {guess.destCity && <Badge variant="outline">→ {guess.destCity}</Badge>}
                        {guess.departureDate && <Badge variant="outline">📅 {guess.departureDate}</Badge>}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => openCreate(f)}
                      className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Créer ce départ
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => archive(f.id)}>
                      <X className="w-3.5 h-3.5 mr-1.5" /> Ignorer
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </main>

      <ManualDepartureForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setPrefill(null);
          qc.invalidateQueries({ queryKey: ['admin-flyers'] });
        }}
        departure={null}
        prefill={prefill}
      />
    </div>
  );
}
