import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Camera, Check, Copy, Loader2, MapPin, Package, Plus, Search, Send, Truck,
  UserRound, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { HubTab } from './hub-ui';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { sendGpMessage } from '@/lib/sendGpMessage';
import { normalizePhone } from '@/lib/phone';
import { FRET_STATUS_LABEL, type FretStatus } from '@/lib/fretApi';
import {
  useChauffeurs, useFretCourses, FRET_ACTIVE_STATUSES,
  type AdminChauffeur as Chauffeur, type AdminFretCourse as Course,
} from '@/hooks/useFretAdmin';
import { FretCourseSheet } from './fret/FretCourseSheet';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<FretStatus, string> = {
  A_ENLEVER: 'bg-orange-500/15 text-orange-600',
  PENDING_ACCEPT: 'bg-amber-500/15 text-amber-600',
  REMIS_CHAUFFEUR: 'bg-blue-500/15 text-blue-500',
  EN_ROUTE: 'bg-blue-500/15 text-blue-500',
  ARRIVE: 'bg-violet-500/15 text-violet-500',
  LIVRE: 'bg-emerald-500/15 text-emerald-600',
  ANNULE: 'bg-muted text-muted-foreground',
};

const FILTERS: { id: 'all' | FretStatus; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'A_ENLEVER', label: "À enlever" },
  { id: 'PENDING_ACCEPT', label: "En attente d'acceptation" },
  { id: 'EN_ROUTE', label: 'En route' },
  { id: 'ARRIVE', label: 'Arrivé' },
  { id: 'LIVRE', label: 'Livré' },
];

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/** Alerte : arrivé depuis plus de 24h sans confirmation client. */
function isStale(c: Course) {
  return c.status === 'ARRIVE' && !!c.arrived_at && Date.now() - new Date(c.arrived_at).getTime() > 24 * 3600 * 1000;
}

const SUB_TABS = ['courses', 'demandes', 'chauffeurs', 'destinations'] as const;
type SubTab = typeof SUB_TABS[number];

export function FretRoutierTab() {
  const qc = useQueryClient();
  const [sub, setSub] = useState<SubTab>('courses');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | FretStatus>('all');
  const [bordereau, setBordereau] = useState<{ course: Course; chauffeur: Chauffeur } | null>(null);
  const [assign, setAssign] = useState<Course | null>(null);
  const [detail, setDetail] = useState<Chauffeur | null>(null);
  const [courseDetail, setCourseDetail] = useState<Course | null>(null);

  const courses = useFretCourses();
  const chauffeurs = useChauffeurs();

  const byId = useMemo(() => {
    const m = new Map<string, Chauffeur>();
    (chauffeurs.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [chauffeurs.data]);

  const all = courses.data ?? [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (!s) return true;
      return c.ref.toLowerCase().includes(s) ||
        c.destination.toLowerCase().includes(s) ||
        (c.client_nom ?? '').toLowerCase().includes(s) ||
        (c.expediteur_nom ?? '').toLowerCase().includes(s) ||
        (c.client_phone ?? '').includes(s) ||
        (byId.get(c.chauffeur_id ?? '')?.nom_complet ?? '').toLowerCase().includes(s);
    });
  }, [q, all, status, byId]);

  /** Demandes d'enlèvement clients (créées depuis /terminal-d) sans chauffeur. */
  const demandes = useMemo(
    () => all.filter((c) => !c.chauffeur_id && c.status === 'A_ENLEVER'),
    [all],
  );

  const alerts = all.filter(isStale);

  const byDestination = useMemo(() => {
    const m = new Map<string, { total: number; actives: number; scope: string | null }>();
    for (const c of all) {
      const key = c.destination || '—';
      const cur = m.get(key) ?? { total: 0, actives: 0, scope: c.scope ?? null };
      cur.total += 1;
      if (FRET_ACTIVE_STATUSES.includes(c.status)) cur.actives += 1;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([destination, v]) => ({ destination, ...v }))
      .sort((a, b) => b.actives - a.actives || b.total - a.total);
  }, [all]);

  const coursesByChauffeur = useMemo(() => {
    const m = new Map<string, Course[]>();
    for (const c of all) {
      if (!c.chauffeur_id) continue;
      m.set(c.chauffeur_id, [...(m.get(c.chauffeur_id) ?? []), c]);
    }
    return m;
  }, [all]);

  const toggleChauffeur = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('chauffeurs' as any).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Chauffeur mis à jour');
      qc.invalidateQueries({ queryKey: ['chauffeurs'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Mise à jour impossible'),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Réf · destination · client · chauffeur" className="pl-9 h-10" />
        </div>
        <Button size="sm" className="h-10 shrink-0" onClick={() => { setAssign(null); setOpen(true); }} aria-label="Nouvelle remise">
          <Plus className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Remise colis</span>
        </Button>
      </div>

      {alerts.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p>
            <strong>{alerts.length}</strong> colis arrivé(s) depuis plus de 24h sans confirmation client :{' '}
            {alerts.map((a) => a.ref).join(', ')}
          </p>
        </div>
      )}

      <Tabs value={sub} onValueChange={(v) => setSub(v as SubTab)}>
        <TabsList>
          <HubTab value="courses" icon={Package} label="Courses" />
          <HubTab
            value="demandes"
            icon={Truck}
            label="Demandes d'enlèvement"
            badge={demandes.length > 0 ? (
              <span className="ml-1 text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5 tabular-nums">
                {demandes.length}
              </span>
            ) : undefined}
          />
          <HubTab value="chauffeurs" icon={Users} label="Chauffeurs" />
          <HubTab value="destinations" icon={MapPin} label="Destinations" />
        </TabsList>

        {/* ── Toutes les courses ─────────────────────────── */}
        <TabsContent value="courses" className="mt-3 space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.map((f) => {
              const n = f.id === 'all' ? all.length : all.filter((c) => c.status === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatus(f.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    status === f.id ? 'border-[#F5C518] bg-[#F5C518]/10 text-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  {f.label} <span className="tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>

          {courses.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Aucune course pour ce filtre.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  chauffeur={byId.get(c.chauffeur_id ?? '') ?? null}
                  onAssign={() => { setAssign(c); setOpen(true); }}
                  onOpen={() => setCourseDetail(c)}
                  onBordereau={(ch) => setBordereau({ course: c, chauffeur: ch })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Demandes d'enlèvement clients ──────────────── */}
        <TabsContent value="demandes" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Réservations créées par les clients depuis /terminal-d, en attente d'assignation à un chauffeur.
          </p>
          {courses.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : demandes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Aucune demande en attente.</p>
          ) : demandes.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              chauffeur={null}
              onAssign={() => { setAssign(c); setOpen(true); }}
              onOpen={() => setCourseDetail(c)}
              onBordereau={() => {}}
            />
          ))}
        </TabsContent>

        {/* ── Chauffeurs ─────────────────────────────────── */}
        <TabsContent value="chauffeurs" className="mt-3 space-y-2">
          {chauffeurs.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (chauffeurs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Aucun chauffeur enregistré.</p>
          ) : (chauffeurs.data ?? []).map((ch) => {
            const list = coursesByChauffeur.get(ch.id) ?? [];
            const actives = list.filter((c) => FRET_ACTIVE_STATUSES.includes(c.status)).length;
            return (
              <div key={ch.id} className="rounded-xl border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate flex items-center gap-1.5">
                    <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
                    {ch.nom_complet || ch.telephone}
                  </p>
                  <span className={cn('text-[11px] px-2 py-0.5 rounded-full',
                    ch.is_active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                    {ch.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ch.telephone}{ch.immatriculation ? ` · ${ch.immatriculation}` : ''} · PIN {ch.pin_code}
                </p>
                <p className="text-xs text-muted-foreground">
                  {list.length} course(s) · {actives} active(s) · {list.filter(c => c.status === 'LIVRE').length} livrée(s)
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDetail(ch)}>
                    Fiche détaillée
                  </Button>
                  <Button
                    size="sm"
                    variant={ch.is_active ? 'outline' : 'default'}
                    className="h-8 text-xs"
                    disabled={toggleChauffeur.isPending}
                    onClick={() => toggleChauffeur.mutate({ id: ch.id, is_active: !ch.is_active })}
                  >
                    {ch.is_active ? 'Désactiver' : 'Réactiver'}
                  </Button>
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ── Destinations / zones ───────────────────────── */}
        <TabsContent value="destinations" className="mt-3 space-y-2">
          {byDestination.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Aucune course.</p>
          ) : byDestination.map((d) => (
            <button
              key={d.destination}
              onClick={() => { setQ(d.destination); setSub('courses'); setStatus('all'); }}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium truncate">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {d.destination}
                {d.scope === 'international' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">International</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {d.actives} active(s) · {d.total} au total
              </span>
            </button>
          ))}
        </TabsContent>
      </Tabs>

      <FretCourseSheet
        course={courseDetail ? (all.find((c) => c.id === courseDetail.id) ?? courseDetail) : null}
        open={!!courseDetail}
        onOpenChange={(v) => { if (!v) setCourseDetail(null); }}
        onAssign={(c) => { setCourseDetail(null); setAssign(c); setOpen(true); }}
      />

      <RemiseDialog
        key={assign?.id ?? 'new'}
        course={assign}
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setAssign(null); }}
        chauffeurs={chauffeurs.data ?? []}
        onDone={(course, chauffeur) => {
          qc.invalidateQueries({ queryKey: ['fret-courses'] });
          qc.invalidateQueries({ queryKey: ['chauffeurs'] });
          setBordereau({ course, chauffeur });
        }}
      />

      {/* Fiche chauffeur */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.nom_complet || detail?.telephone}</DialogTitle>
            <DialogDescription>Fiche chauffeur et historique des courses.</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <Row k="Téléphone" v={detail.telephone} />
                <Row k="Immatriculation" v={detail.immatriculation || '—'} />
                <Row k="Code PIN" v={detail.pin_code} />
                <Row k="Statut" v={detail.is_active ? 'Actif' : 'Inactif'} />
                <Row k="Routes" v={(detail.routes ?? []).join(', ') || '—'} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Courses</p>
                {(coursesByChauffeur.get(detail.id) ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune course.</p>
                ) : (coursesByChauffeur.get(detail.id) ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                    <span className="font-mono truncate">{c.ref}</span>
                    <span className="truncate">{c.destination}</span>
                    <span className={cn('shrink-0 px-1.5 py-0.5 rounded-full text-[10px]', STATUS_TONE[c.status])}>
                      {FRET_STATUS_LABEL[c.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!bordereau} onOpenChange={(v) => !v && setBordereau(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bordereau de course</DialogTitle>
            <DialogDescription>Preuve de remise du colis au chauffeur.</DialogDescription>
          </DialogHeader>
          {bordereau && (
            <div className="space-y-2 text-sm">
              {bordereau.course.photo_url && (
                <img src={bordereau.course.photo_url} alt="Colis" className="w-full h-40 object-cover rounded-xl border border-border" />
              )}
              <Row k="Réf. colis" v={bordereau.course.ref} />
              <Row k="Chauffeur" v={bordereau.chauffeur.nom_complet || bordereau.chauffeur.telephone} />
              <Row k="Téléphone" v={bordereau.chauffeur.telephone} />
              <Row k="Immatriculation" v={bordereau.chauffeur.immatriculation || '—'} />
              <Row k="Destination" v={bordereau.course.destination} />
              <Row k="Heure de remise" v={fmt(bordereau.course.remis_at)} />
              <Row k="Code PIN chauffeur" v={bordereau.chauffeur.pin_code} />
              <Row k="Suivi client" v={`/suivre/${bordereau.course.ref}`} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseCard({ course: c, chauffeur: ch, onAssign, onOpen, onBordereau }: {
  course: Course;
  chauffeur: Chauffeur | null;
  onAssign: () => void;
  onOpen: () => void;
  onBordereau: (ch: Chauffeur) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="rounded-xl border border-border bg-card p-3 space-y-1.5 cursor-pointer hover:border-primary/50 hover:bg-secondary/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{c.ref}</span>
        <div className="flex items-center gap-1.5">
          {c.scope === 'international' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">International</span>
          )}
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_TONE[c.status]}`}>
            {FRET_STATUS_LABEL[c.status]}
          </span>
        </div>
      </div>
      <p className="font-medium text-sm truncate">{c.destination} · {c.client_nom || 'Client'}</p>
      {c.pickup_address && (
        <p className="text-xs text-muted-foreground">
          Enlèvement : {c.pickup_address}
          {c.pickup_zone ? ` · ${c.pickup_zone}` : ''}
          {c.pickup_fee_fcfa ? ` · +${c.pickup_fee_fcfa.toLocaleString('fr-FR')} FCFA` : ''}
        </p>
      )}
      {(c.expediteur_nom || c.total_fcfa) && (
        <p className="text-xs text-muted-foreground">
          {c.expediteur_nom ? `Expéditeur : ${c.expediteur_nom}` : ''}
          {c.expediteur_phone ? ` (${c.expediteur_phone})` : ''}
          {c.total_fcfa ? ` · Total ${c.total_fcfa.toLocaleString('fr-FR')} FCFA` : ''}
        </p>
      )}
      {c.client_phone && (
        <p className="text-xs text-muted-foreground">Destinataire : {c.client_nom || '—'} ({c.client_phone})</p>
      )}
      <p className="text-xs text-muted-foreground truncate">
        <Truck className="w-3 h-3 inline mr-1" />
        {!c.chauffeur_id
          ? 'Aucun chauffeur assigné'
          : `${ch?.nom_complet || ch?.telephone || 'Chauffeur inconnu'}${ch?.immatriculation ? ` · ${ch.immatriculation}` : ''} · remis ${fmt(c.remis_at)}`}
      </p>
      <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        {!c.chauffeur_id && (
          <Button size="sm" className="h-8 text-xs" onClick={onAssign}>Assigner un chauffeur</Button>
        )}
        <Button size="sm" variant="outline" className="h-8 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/suivre/${c.ref}`);
            toast.success('Lien de suivi copié');
          }}>
          <Copy className="w-3 h-3 mr-1" /> Lien suivi
        </Button>
        {ch && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onBordereau(ch)}>
            Bordereau
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right break-all">{v}</span>
    </div>
  );
}

function RemiseDialog({ open, onOpenChange, chauffeurs, onDone, course }: {
  course?: Course | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chauffeurs: Chauffeur[];
  onDone: (c: Course, ch: Chauffeur) => void;
}) {
  const [phone, setPhone] = useState('');
  const [destination, setDestination] = useState(course?.destination ?? '');
  const [clientNom, setClientNom] = useState(course?.client_nom ?? '');
  const [clientPhone, setClientPhone] = useState(course?.client_phone ?? '');
  const [description, setDescription] = useState(course?.colis_description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [nomComplet, setNomComplet] = useState('');
  const [immat, setImmat] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const match = useMemo(() => {
    const tail = normalizePhone(phone).replace(/\D/g, '').slice(-9);
    if (tail.length < 9) return null;
    return chauffeurs.find((c) => c.telephone.replace(/\D/g, '').slice(-9) === tail) ?? null;
  }, [phone, chauffeurs]);

  const isNew = !match && normalizePhone(phone).replace(/\D/g, '').length >= 9;

  const reset = () => {
    setPhone(''); setDestination(''); setClientNom(''); setClientPhone('');
    setDescription(''); setFile(null); setNomComplet(''); setImmat('');
  };

  const submit = useMutation({
    mutationFn: async () => {
      const tel = normalizePhone(phone);
      if (tel.replace(/\D/g, '').length < 9) throw new Error('Numéro chauffeur invalide');
      if (!destination.trim()) throw new Error('Destination requise');

      // 1. Chauffeur : récupéré ou créé à la volée (PIN auto)
      let chauffeur = match;
      if (!chauffeur) {
        const { data, error } = await supabase
          .from('chauffeurs' as any)
          .insert({
            telephone: tel,
            nom_complet: nomComplet.trim() || null,
            immatriculation: immat.trim() || null,
            routes: destination.trim() ? [destination.trim()] : [],
          })
          .select()
          .single();
        if (error) throw error;
        chauffeur = data as unknown as Chauffeur;
      } else if (nomComplet.trim() || immat.trim()) {
        await supabase.from('chauffeurs' as any).update({
          ...(nomComplet.trim() ? { nom_complet: nomComplet.trim() } : {}),
          ...(immat.trim() ? { immatriculation: immat.trim() } : {}),
        }).eq('id', chauffeur.id);
      }

      // 2. Photo du colis (bucket privé + URL signée longue durée)
      let photoUrl: string | null = null;
      if (file) {
        const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('fret-photos').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from('fret-photos').createSignedUrl(path, 60 * 60 * 24 * 365);
        photoUrl = signed?.signedUrl ?? null;
      }

      // 3. Course — mise à jour si demande d'enlèvement existante, sinon création
      let created: Course;
      if (course) {
        const { data, error } = await supabase
          .from('fret_courses' as any)
          .update({
            chauffeur_id: chauffeur.id,
            destination: destination.trim(),
            client_nom: clientNom.trim() || null,
            client_phone: clientPhone.trim() ? normalizePhone(clientPhone) : null,
            colis_description: description.trim() || null,
            ...(photoUrl ? { photo_url: photoUrl } : {}),
            status: 'PENDING_ACCEPT',
            remis_at: new Date().toISOString(),
          })
          .eq('id', course.id)
          .select()
          .single();
        if (error) throw error;
        created = data as unknown as Course;
      } else {
        const { data: inserted, error: cErr } = await supabase
          .from('fret_courses' as any)
          .insert({
            chauffeur_id: chauffeur.id,
            destination: destination.trim(),
            client_nom: clientNom.trim() || null,
            client_phone: clientPhone.trim() ? normalizePhone(clientPhone) : null,
            colis_description: description.trim() || null,
            photo_url: photoUrl,
          })
          .select()
          .single();
        if (cErr) throw cErr;
        created = inserted as unknown as Course;
      }

      // 4. Notification WhatsApp au chauffeur (lien direct vers sa PWA)
      await sendGpMessage({
        phone: chauffeur.telephone,
        message: `Nouveau colis a prendre en charge — ${destination.trim()}\n\nRef : ${created.ref}\n\nOuvrez votre espace chauffeur pour accepter la course :\n${window.location.origin}/chauffeur\nCode PIN : ${chauffeur.pin_code}\n\nYobbante`,
        trigger_type: 'fret_routier_assignation',
        silent: true,
      });

      // 5. Notification push sur le téléphone du chauffeur (même app fermée)
      try {
        await supabase.functions.invoke('push-send', {
          body: {
            chauffeur_id: chauffeur.id,
            title: 'Nouveau colis à prendre en charge',
            body: `${destination.trim()} — ${created.ref}`,
            url: '/chauffeur',
            tag: `course-${created.id}`,
          },
        });
      } catch { /* non bloquant */ }

      return { course: created, chauffeur };
    },
    onSuccess: ({ course, chauffeur }) => {
      toast.success('Colis remis — chauffeur notifié');
      onDone(course, chauffeur);
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Enregistrement impossible'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remise d'un colis</DialogTitle>
          <DialogDescription>Assignation du colis à un chauffeur.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ch-phone">Téléphone du chauffeur</Label>
            <Input id="ch-phone" inputMode="tel" placeholder="77 123 45 67" value={phone}
              onChange={(e) => setPhone(e.target.value)} className="h-11" />
            {match && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> {match.nom_complet || 'Chauffeur connu'} · PIN {match.pin_code}
              </p>
            )}
            {isNew && <p className="text-xs text-amber-600">Nouveau chauffeur — complétez sa fiche ci-dessous.</p>}
          </div>

          {(isNew || (match && (!match.nom_complet || !match.immatriculation))) && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nom complet" value={nomComplet} onChange={(e) => setNomComplet(e.target.value)} className="h-11" />
              <Input placeholder="Immatriculation" value={immat} onChange={(e) => setImmat(e.target.value)} className="h-11" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="dest">Destination</Label>
            <Input id="dest" placeholder="Ex : Tambacounda" value={destination}
              onChange={(e) => setDestination(e.target.value)} className="h-11" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nom client" value={clientNom} onChange={(e) => setClientNom(e.target.value)} className="h-11" />
            <Input placeholder="Tél. client" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="h-11" />
          </div>

          <Input placeholder="Description du colis (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} className="h-11" />

          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" className="w-full h-11" onClick={() => fileRef.current?.click()}>
            <Camera className="w-4 h-4 mr-2" />
            {file ? file.name.slice(0, 24) : 'Photographier le colis'}
          </Button>
        </div>

        <DialogFooter>
          <Button className="w-full h-12" disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Valider la remise</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
