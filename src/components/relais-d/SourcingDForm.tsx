import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDossiers } from '@/hooks/useDossiers';
import { toast } from 'sonner';

/**
 * Relais D — Chemin "Sourcing D".
 * Le client envoie une photo + description + budget.
 * Yobbanté recherche en Chine (fournisseurs), constate le prix réel
 * et envoie un devis avec taux de change majoré.
 */
export function SourcingDForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [sending, setSending] = useState(false);

  function pickPhoto(f: File | null) {
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : null);
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
        budget_eur: budget ? Number(budget) : null,
        notes: [
          'SOURCING D — RECHERCHE FOURNISSEUR (CHINE)',
          `Description: ${description.trim()}`,
          budget ? `Budget indicatif: ${budget}€` : '',
          '',
          'Action admin : rechercher le produit chez les fournisseurs, constater le prix réel, appliquer le taux de change majoré, envoyer le devis. Passage en « Achat en cours » après paiement.',
        ].filter(Boolean).join('\n'),
        app_source: 'relais_d_sourcing',
      });

      // Photo facultative → dossier-documents
      if (photo && dossier?.id) {
        const path = `${dossier.id}/sourcing-${Date.now()}-${photo.name}`;
        const { error: upErr } = await supabase.storage.from('dossier-documents').upload(path, photo);
        if (!upErr) {
          await supabase.from('dossier_documents').insert({
            dossier_id: dossier.id,
            file_path: path,
            file_name: photo.name,
            doc_type: 'product_photo',
          });
        }
      }

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
          Décrivez le produit — notre équipe le recherche en Chine, négocie et vous envoie un devis tout compris.
        </p>

        <div className="mt-8 space-y-5">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[16/7] rounded-2xl border-2 border-dashed border-border hover:border-foreground transition-colors flex flex-col items-center justify-center gap-2 overflow-hidden relative"
          >
            {preview ? (
              <>
                <img src={preview} alt="Photo du produit recherché" className="absolute inset-0 w-full h-full object-cover" />
                <span
                  onClick={e => { e.stopPropagation(); pickPhoto(null); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"
                  role="button" aria-label="Retirer la photo"
                >
                  <X className="w-4 h-4" />
                </span>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Photo du produit (facultatif)</span>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
                 onChange={e => pickPhoto(e.target.files?.[0] ?? null)} />

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Description du produit *</span>
            <textarea
              rows={4} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex : baskets Nike Air Max taille 42, couleur noire…"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Budget indicatif (€, facultatif)</span>
            <input
              type="number" min="0" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)}
              placeholder="Ex : 50"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </label>

          <button
            onClick={submit} disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer ma demande
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            Sans engagement · Short-list fournisseurs sous 24-48h · Achat uniquement après validation du devis
          </p>
        </div>
      </main>
    </div>
  );
}
