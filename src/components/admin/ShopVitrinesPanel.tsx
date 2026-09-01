import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SHOP_SITES } from '@/lib/shopSites';

/**
 * Admin — « Vitrines Commander en ligne ».
 * Gestion des produits tendances affichés sur la vitrine interne de chaque site
 * (Relais D → Commander en ligne). Un produit tendance cliqué côté client
 * s'ajoute directement au panier Yobbanté.
 */

type Row = {
  id: string;
  site_id: string;
  title: string;
  image_url: string | null;
  product_url: string;
  price_label: string | null;
  position: number;
  active: boolean;
};

const emptyForm = { site_id: SHOP_SITES[0].id, title: '', image_url: '', product_url: '', price_label: '', position: 0 };

export function ShopVitrinesPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('shop_trending_products' as never)
      .select('*')
      .order('site_id', { ascending: true })
      .order('position', { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const path = `vitrines/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: data.publicUrl }));
      toast.success('Image téléversée');
    } catch (e: any) {
      toast.error(e?.message ?? 'Upload impossible — collez une URL d\'image à la place');
    } finally {
      setUploading(false);
    }
  }

  async function add() {
    if (!form.title.trim() || !form.product_url.trim()) {
      toast.error('Titre et lien produit obligatoires');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('shop_trending_products' as never).insert({
      site_id: form.site_id,
      title: form.title.trim(),
      image_url: form.image_url.trim() || null,
      product_url: form.product_url.trim(),
      price_label: form.price_label.trim() || null,
      position: Number(form.position) || 0,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Produit tendance ajouté');
    setForm({ ...emptyForm, site_id: form.site_id });
    load();
  }

  async function toggle(row: Row) {
    const { error } = await supabase
      .from('shop_trending_products' as never)
      .update({ active: !row.active, updated_at: new Date().toISOString() } as never)
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function remove(row: Row) {
    if (!confirm(`Retirer « ${row.title} » de la vitrine ?`)) return;
    const { error } = await supabase.from('shop_trending_products' as never).delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Produit retiré');
    load();
  }

  const visible = siteFilter === 'all' ? rows : rows.filter(r => r.site_id === siteFilter);

  return (
    <div className="space-y-5">
      {/* Formulaire d'ajout */}
      <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, padding: 16 }} className="space-y-3">
        <p className="text-sm font-semibold">Ajouter un produit tendance</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Site">
            <select
              value={form.site_id}
              onChange={e => setForm({ ...form, site_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {SHOP_SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Titre du produit">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                   className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Lien produit">
            <input value={form.product_url} onChange={e => setForm({ ...form, product_url: e.target.value })}
                   placeholder="https://…"
                   className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Prix affiché (optionnel)">
            <input value={form.price_label} onChange={e => setForm({ ...form, price_label: e.target.value })}
                   placeholder="Ex : ~45 000 FCFA"
                   className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Image (URL)">
            <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                   placeholder="https://…"
                   className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label={uploading ? 'Téléversement…' : 'ou téléverser une image'}>
            <input type="file" accept="image/*" disabled={uploading}
                   onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
                   className="w-full text-xs" />
          </Field>
          <Field label="Ordre d'affichage">
            <input type="number" value={form.position}
                   onChange={e => setForm({ ...form, position: Number(e.target.value) || 0 })}
                   className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </Field>
        </div>
        {form.image_url && <img src={form.image_url} alt="" className="w-20 h-20 rounded-lg object-cover" />}
        <button onClick={add} disabled={saving}
                style={{ background: '#1a1a1a', color: '#fff', height: 38, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Ajout…' : '+ Ajouter à la vitrine'}
        </button>
      </div>

      {/* Filtre par site */}
      <div className="flex gap-2 flex-wrap">
        {([['all', 'Tous'], ...SHOP_SITES.map(s => [s.id, s.name] as [string, string])]).map(([k, label]) => {
          const active = siteFilter === k;
          return (
            <button key={k} onClick={() => setSiteFilter(k)}
                    style={{
                      background: active ? '#C97B3A' : 'transparent',
                      color: active ? '#fff' : '#6B6B6B',
                      border: `0.5px solid ${active ? '#C97B3A' : 'hsl(var(--color-border-tertiary))'}`,
                      borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucun produit tendance pour l'instant.</div>
        ) : visible.map(r => (
          <div key={r.id} className="flex items-center gap-3 p-3" style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}>
            {r.image_url
              ? <img src={r.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              : <div className="w-12 h-12 rounded-lg bg-secondary shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {SHOP_SITES.find(s => s.id === r.site_id)?.name ?? r.site_id} · ordre {r.position}
                {r.price_label ? ` · ${r.price_label}` : ''}
              </p>
              <a href={r.product_url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-muted-foreground truncate block">
                {r.product_url}
              </a>
            </div>
            <button onClick={() => toggle(r)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-foreground transition-colors">
              {r.active ? 'Actif' : 'Masqué'}
            </button>
            <button onClick={() => remove(r)}
                    className="text-xs px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
