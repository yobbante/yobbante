import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
  delivery_days: number | null;
  status: string;
  image_url: string | null;
  source_type: string;
  created_at: string;
};

const STATUS_FILTERS: { id: 'all' | 'draft' | 'published' | 'archived'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'draft', label: 'Draft' },
  { id: 'published', label: 'Publiés' },
  { id: 'archived', label: 'Archivés' },
];

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Draft', bg: '#FAEEDA', color: '#633806' },
  published: { label: 'Publié', bg: '#E1F5EE', color: '#085041' },
  archived: { label: 'Archivé', bg: '#F5F5F5', color: 'hsl(var(--muted-foreground))' },
};

const emptyForm = {
  name: '',
  description: '',
  category: 'Électronique',
  price_eur: 0,
  origin_country: 'CN',
  stock_mode: 'stock',
  delivery_days: 7,
  image_url: '',
  source_type: 'reception',
  status: 'draft',
};

export function BoutiqueTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setProducts((data as any as Product[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? products : products.filter(p => p.status === filter);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('products' as any).update({ status }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(status === 'published' ? 'Produit publié' : status === 'archived' ? 'Archivé' : 'Mis à jour');
    load();
  };

  const submit = async () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      price_eur: Math.round(Number(form.price_eur) || 0),
      price_fcfa: Math.round((Number(form.price_eur) || 0) * 655),
      origin_country: form.origin_country,
      stock_mode: form.stock_mode,
      delivery_days: form.stock_mode === 'commande' ? Number(form.delivery_days) || 7 : null,
      image_url: form.image_url.trim() || null,
      source_type: form.source_type,
      status: form.status,
    };
    if (!payload.name || !payload.price_eur) {
      toast.error('Nom et prix requis');
      return;
    }
    const q = editingId
      ? supabase.from('products' as any).update(payload).eq('id', editingId)
      : supabase.from('products' as any).insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(editingId ? 'Produit mis à jour' : 'Produit créé');
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    load();
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category,
      price_eur: p.price_eur,
      origin_country: p.origin_country,
      stock_mode: p.stock_mode,
      delivery_days: p.delivery_days || 7,
      image_url: p.image_url || '',
      source_type: p.source_type,
      status: p.status,
    });
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}>Boutique</h2>
          <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{products.length} produits</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setShowForm(true); }}
          style={{ background: '#1a1a1a', color: '#fff', height: 36, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}
        >
          + Ajouter un produit
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              height: 32, padding: '0 12px', borderRadius: 999, fontSize: 12,
              background: filter === f.id ? '#1a1a1a' : 'transparent',
              color: filter === f.id ? '#fff' : 'hsl(var(--muted-foreground))',
              border: filter === f.id ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
            {editingId ? 'Modifier le produit' : 'Nouveau produit'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nom"><Input value={form.name} onChange={v => setForm({ ...form, name: v })} /></Field>
            <Field label="Catégorie">
              <Select value={form.category} onChange={v => setForm({ ...form, category: v })}
                options={['Électronique','Mode','Auto','Maison','Tech','Beauté']} />
            </Field>
            <Field label="Description"><Input value={form.description} onChange={v => setForm({ ...form, description: v })} /></Field>
            <Field label="Image URL"><Input value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} /></Field>
            <Field label="Prix EUR (entier)"><Input type="number" value={String(form.price_eur)} onChange={v => setForm({ ...form, price_eur: Number(v) })} /></Field>
            <Field label="Origine">
              <Select value={form.origin_country} onChange={v => setForm({ ...form, origin_country: v })}
                options={[['CN','Chine'],['US','USA'],['FR','France'],['OTHER','Autre']]} />
            </Field>
            <Field label="Disponibilité">
              <Select value={form.stock_mode} onChange={v => setForm({ ...form, stock_mode: v })}
                options={[['stock','En stock'],['commande','Sur commande']]} />
            </Field>
            {form.stock_mode === 'commande' && (
              <Field label="Délai (jours)"><Input type="number" value={String(form.delivery_days)} onChange={v => setForm({ ...form, delivery_days: Number(v) })} /></Field>
            )}
            <Field label="Source">
              <Select value={form.source_type} onChange={v => setForm({ ...form, source_type: v })}
                options={[['reception','Réception'],['sourcing','Sourcing']]} />
            </Field>
            <Field label="Statut">
              <Select value={form.status} onChange={v => setForm({ ...form, status: v })}
                options={[['draft','Draft'],['published','Publié'],['archived','Archivé']]} />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submit} style={{ background: '#1a1a1a', color: '#fff', height: 36, padding: '0 14px', borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              {editingId ? 'Enregistrer' : 'Créer'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: 'transparent', height: 36, padding: '0 14px', borderRadius: 8, fontSize: 13, border: '0.5px solid hsl(var(--color-border-tertiary))', cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Aucun produit</div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'hsl(var(--secondary))' }}>
              <tr>
                {['', 'Nom', 'Catégorie', 'Prix', 'Statut', 'Origine', 'Date', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const b = STATUS_BADGE[p.status] || STATUS_BADGE.draft;
                return (
                  <tr key={p.id} style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
                    <td style={{ padding: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: '#F5F5F5', overflow: 'hidden' }}>
                        {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{p.category}</td>
                    <td style={{ padding: '10px 12px' }}>{Math.round(p.price_eur).toLocaleString('fr-FR')} €</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: b.bg, color: b.color, fontSize: 11, padding: '3px 8px', borderRadius: 6 }}>{b.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{p.origin_country}</td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
                      {new Date(p.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {p.status !== 'published' && (
                        <ActionBtn onClick={() => setStatus(p.id, 'published')}>Publier</ActionBtn>
                      )}
                      <ActionBtn onClick={() => startEdit(p)}>Modifier</ActionBtn>
                      {p.status !== 'archived' && (
                        <ActionBtn onClick={() => setStatus(p.id, 'archived')}>Archiver</ActionBtn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12 }}>
      <span style={{ display: 'block', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = 'text' }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', height: 36, padding: '0 10px', fontSize: 13,
        border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8,
        background: 'hsl(var(--background-primary))', color: 'hsl(var(--foreground))',
      }}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: (string | [string, string])[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', height: 36, padding: '0 10px', fontSize: 13,
        border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8,
        background: 'hsl(var(--background-primary))', color: 'hsl(var(--foreground))',
      }}
    >
      {options.map(o => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

function ActionBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: '0.5px solid hsl(var(--color-border-tertiary))',
        borderRadius: 6, padding: '4px 10px', fontSize: 11, marginLeft: 4, cursor: 'pointer',
        color: 'hsl(var(--foreground))',
      }}
    >
      {children}
    </button>
  );
}
