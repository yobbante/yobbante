import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDossiers } from '@/hooks/useDossiers';
import { toast } from 'sonner';

/**
 * Relais D — Chemin "Sourcing D".
 * Le client envoie photo(s) + description + lien de référence + quantité + budget.
 * Yobbanté recherche en Chine, constate le prix réel et un poids estimé majoré,
 * puis envoie une proposition à valider avant tout paiement.
 */
export function SourcingDForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [refLink, setRefLink] = useState('');
  const [qty, setQty] = useState(1);
  const [budget, setBudget] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  function addPhotos(list: FileList | null) {
    if (!list) return;
    setPhotos(p => [...p, ...Array.from(list)].slice(0, 5));
  }

  async function submit() {
    if (!description.trim()) {
      toast.error('Décrivez le produit recherché');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.message('Connectez-vous pour envoyer votre demande — elle reste enregistrée.');
      navigate(`/auth?redirect=${encodeURIComponent('/relais-d/sourcing')}`);
      return;
    }
    setSending(true);
    try {
      const dossier = await createDossier.mutateAsync({
        product_description: `Sourcing D — ${description.trim().slice(0, 120)}`,
        origin_country: 'CN',
        destination_country: 'SN',
        needs_sourcing: true,
        contact_phone: phone || null,
        budget_eur: budget ? Number(budget) : null,
        notes: [
          'SOURCING D — RECHERCHE FOURNISSEUR (CHINE) · statut : en recherche',
          `Description: ${description.trim()}`,
          `Quantité souhaitée: ${qty}`,
          refLink ? `Lien de référence: ${refLink}` : '',
          budget ? `Budget indicatif: ${budget}€` : '',
          phone ? `Téléphone client: ${phone}` : '',
          photos.length ? `${photos.length} photo(s) jointe(s) au dossier` : '',
          '',
          'ACTION ADMIN :',
          '1. Rechercher le produit en Chine, saisir le(s) lien(s) trouvé(s) et le prix réel constaté.',
          '2. Saisir un POIDS ESTIMÉ MAJORÉ (arrondi vers le haut, obligatoire).',
          '3. Envoyer la proposition au client (devis) — validation client obligatoire avant achat.',
          '4. Après paiement → « Achat en cours », réception via l\'adresse relais Chine (Guangzhou).',
        ].filter(Boolean).join('\n'),
        app_source: 'relais_d_sourcing',
      });

      // Photos facultatives → dossier-documents
      for (const photo of photos) {
        if (!dossier?.id) break;
        const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${dossier.id}/sourcing-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('dossier-documents').upload(path, photo, { contentType: photo.type });
        if (!upErr) {
          await supabase.from('dossier_documents').insert({
            dossier_id: dossier.id,
            file_path: path,
            file_name: photo.name,
            mime_type: photo.type || null,
            size_bytes: photo.size,
            kind: 'other',
            uploaded_by: user.id,
          });
        }
      }

      supabase.functions.invoke('relais-d-notify', {
        body: {
          kind: 'sourcing',
          reference: (dossier as any)?.reference ?? '',
          dossier_id: (dossier as any)?.id ?? null,
          summary: `${description.trim().slice(0, 120)} · qté ${qty}`,
        },
      }).catch(() => {});

      toast.success('Demande envoyée — short-list sous 24-48h 🏭');
      onBack();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-8 sm:py-12">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">Sourcing D</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Décrivez le produit — notre équipe le recherche en Chine, négocie et vous envoie une proposition
          à valider avant tout paiement.
        </p>

        <div className="mt-8 space-y-5">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-border hover:border-foreground transition-colors flex flex-col items-center justify-center gap-2 py-8"
          >
            <Camera className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Photos du produit (facultatif, jusqu'à 5)</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                 onChange={e => addPhotos(e.target.files)} />

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                  <img src={URL.createObjectURL(p)} alt={`Photo ${i + 1} du produit recherché`} className="w-full h-full object-cover" />
                  <button onClick={() => setPhotos(ps => ps.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white" aria-label="Retirer la photo">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Description du produit *</span>
            <textarea
              rows={4} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex : baskets Nike Air Max taille 42, couleur noire…"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Lien de référence (facultatif)</span>
            <input
              value={refLink} onChange={e => setRefLink(e.target.value)}
              placeholder="Pinterest, Alibaba, Instagram…"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Quantité souhaitée</span>
              <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                     className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Budget indicatif (€)</span>
              <input type="number" min="0" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)}
                     placeholder="Ex : 50"
                     className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Téléphone / contact</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 …"
                   className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
          </label>

          <button
            onClick={submit} disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer ma demande
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            Sans engagement · Vous validez la proposition avant tout paiement · Frais d'acheminement estimés
            et légèrement majorés : aucun complément ne vous sera jamais demandé.
          </p>
        </div>
      </main>
    </div>
  );
}
