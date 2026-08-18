import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Camera, Check, Copy, Loader2, Plus, Search, Send, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { sendGpMessage } from '@/lib/sendGpMessage';
import { normalizePhone } from '@/lib/phone';
import { FRET_STATUS_LABEL, type FretStatus } from '@/lib/fretApi';

interface Chauffeur {
  id: string;
  telephone: string;
  pin_code: string;
  nom_complet: string | null;
  immatriculation: string | null;
  routes: string[] | null;
  is_active: boolean;
}

interface Course {
  id: string;
  ref: string;
  destination: string;
  client_nom: string | null;
  client_phone: string | null;
  colis_description: string | null;
  photo_url: string | null;
  status: FretStatus;
  confirm_token: string;
  remis_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  chauffeur_id: string | null;
}

const STATUS_TONE: Record<FretStatus, string> = {
  A_ENLEVER: 'bg-orange-500/15 text-orange-600',
  PENDING_ACCEPT: 'bg-amber-500/15 text-amber-600',
  REMIS_CHAUFFEUR: 'bg-blue-500/15 text-blue-500',
  EN_ROUTE: 'bg-blue-500/15 text-blue-500',
  ARRIVE: 'bg-violet-500/15 text-violet-500',
  LIVRE: 'bg-emerald-500/15 text-emerald-600',
  ANNULE: 'bg-muted text-muted-foreground',
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/** Alerte : arrivé depuis plus de 24h sans confirmation client. */
function isStale(c: Course) {
  return c.status === 'ARRIVE' && !!c.arrived_at && Date.now() - new Date(c.arrived_at).getTime() > 24 * 3600 * 1000;
}

export function FretRoutierTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [bordereau, setBordereau] = useState<{ course: Course; chauffeur: Chauffeur } | null>(null);

  const courses = useQuery({
    queryKey: ['fret-courses'],
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase
        .from('fret_courses' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Course[];
    },
    refetchInterval: 60_000,
  });

  const chauffeurs = useQuery({
    queryKey: ['chauffeurs'],
    queryFn: async (): Promise<Chauffeur[]> => {
      const { data, error } = await supabase
        .from('chauffeurs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Chauffeur[];
    },
  });

  const byId = useMemo(() => {
    const m = new Map<string, Chauffeur>();
    (chauffeurs.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [chauffeurs.data]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = courses.data ?? [];
    if (!s) return all;
    return all.filter((c) =>
      c.ref.toLowerCase().includes(s) ||
      c.destination.toLowerCase().includes(s) ||
      (c.client_nom ?? '').toLowerCase().includes(s) ||
      (byId.get(c.chauffeur_id ?? '')?.nom_complet ?? '').toLowerCase().includes(s));
  }, [q, courses.data, byId]);

  const alerts = (courses.data ?? []).filter(isStale);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Réf · destination · chauffeur" className="pl-9 h-10" />
        </div>
        <Button size="sm" className="h-10 shrink-0" onClick={() => setOpen(true)} aria-label="Nouvelle remise">
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

      {courses.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Aucune course. Créez la première remise de colis.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const ch = byId.get(c.chauffeur_id ?? '');
            return (
              <div key={c.id} className="rounded-xl border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{c.ref}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_TONE[c.status]}`}>
                    {FRET_STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="font-medium text-sm truncate">{c.destination} · {c.client_nom || 'Client'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  <Truck className="w-3 h-3 inline mr-1" />
                  {ch?.nom_complet || ch?.telephone || 'Chauffeur inconnu'}
                  {ch?.immatriculation ? ` · ${ch.immatriculation}` : ''} · remis {fmt(c.remis_at)}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-8 text-xs"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${window.location.origin}/suivre/${c.ref}`);
                      toast.success('Lien de suivi copié');
                    }}>
                    <Copy className="w-3 h-3 mr-1" /> Lien suivi
                  </Button>
                  {ch && (
                    <Button size="sm" variant="outline" className="h-8 text-xs"
                      onClick={() => setBordereau({ course: c, chauffeur: ch })}>
                      Bordereau
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RemiseDialog
        open={open}
        onOpenChange={setOpen}
        chauffeurs={chauffeurs.data ?? []}
        onDone={(course, chauffeur) => {
          qc.invalidateQueries({ queryKey: ['fret-courses'] });
          qc.invalidateQueries({ queryKey: ['chauffeurs'] });
          setBordereau({ course, chauffeur });
        }}
      />

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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right break-all">{v}</span>
    </div>
  );
}

function RemiseDialog({ open, onOpenChange, chauffeurs, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chauffeurs: Chauffeur[];
  onDone: (c: Course, ch: Chauffeur) => void;
}) {
  const [phone, setPhone] = useState('');
  const [destination, setDestination] = useState('');
  const [clientNom, setClientNom] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [description, setDescription] = useState('');
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

      // 3. Course
      const { data: course, error: cErr } = await supabase
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

      // 4. Notification WhatsApp au chauffeur (lien direct vers sa PWA)
      await sendGpMessage({
        phone: chauffeur.telephone,
        message: `Nouveau colis a prendre en charge — ${destination.trim()}\n\nRef : ${(course as any).ref}\n\nOuvrez votre espace chauffeur pour accepter la course :\n${window.location.origin}/chauffeur\nCode PIN : ${chauffeur.pin_code}\n\nYobbante`,
        trigger_type: 'fret_routier_assignation',
        silent: true,
      });

      return { course: course as unknown as Course, chauffeur };
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
