import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BoutiqueOrdersPanel } from './BoutiqueOrdersPanel';
import { BoutiqueStatsPanel } from './BoutiqueStatsPanel';
import { BoutiquePromosPanel } from './BoutiquePromosPanel';

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
  stock_qty: number | null;
  delivery_days: number | null;
  status: string;
  image_url: string | null;
  source_type: string;
  verified?: boolean;
  created_at: string;
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  published: { label: 'Publié',  bg: '#E1F5EE', color: '#085041' },
  draft:     { label: 'Draft',   bg: '#F5E6D8', color: '#8B5220' },
  archived:  { label: 'Archivé', bg: 'hsl(var(--background-secondary))', color: 'hsl(var(--muted-foreground))' },
};

const SOURCE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  manual:    { label: 'Manuel',    bg: 'hsl(var(--background-secondary))', color: 'hsl(var(--muted-foreground))' },
  reception: { label: 'Réception', bg: '#E1F5EE', color: '#085041' },
  sourcing:  { label: 'Sourcing',  bg: '#EFF6FF', color: '#1D4ED8' },
};

const CATEGORY_LABEL: Record<string, string> = {
  electronique: 'Électronique', mode: 'Mode', maison: 'Maison',
  auto: 'Auto', tech: 'Tech', beaute: 'Beauté', autre: 'Autre',
};
const CATEGORY_OPTIONS: [string, string][] = [
  ['electronique','Électronique'],['mode','Mode'],['maison','Maison'],
  ['auto','Auto'],['tech','Tech'],['beaute','Beauté'],['autre','Autre'],
];

const ORIGIN_OPTIONS: [string, string][] = [
  ['CN','🇨🇳 Chine'], ['US','🇺🇸 USA'], ['FR','🇫🇷 France'], ['OTHER','🌍 Autre'],
];

const fmtFcfa = (eur: number) => `${(Math.round(eur) * 655).toLocaleString('fr-FR')} FCFA`;
const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const emptyForm = {
  name: '',
  description: '',
  category: 'electronique',
  price_eur: 0,
  origin_country: 'CN',
  stock_mode: 'stock' as 'stock' | 'commande',
  stock_qty: '' as string,
  delivery_days: 7,
  image_url: '',
  verified: false,
  status: 'draft' as 'draft' | 'published',
};

export function BoutiqueTab() {
  const [view, setView] = useState<'products' | 'orders' | 'promos' | 'stats'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<'published' | 'draft'>('published');
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

  const published = useMemo(() => products.filter(p => p.status === 'published'), [products]);
  const drafts    = useMemo(() => products.filter(p => p.status === 'draft'),     [products]);
  const rows = tab === 'published' ? published : drafts;

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('products' as any).update({ status }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(status === 'published' ? 'Produit publié' : status === 'archived' ? 'Archivé' : 'Mis à jour');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer définitivement ce produit ?')) return;
    const { error } = await supabase.from('products' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Produit supprimé');
    load();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category,
      price_eur: p.price_eur,
      origin_country: p.origin_country,
      stock_mode: (p.stock_mode === 'commande' ? 'commande' : 'stock'),
      stock_qty: p.stock_qty == null ? '' : String(p.stock_qty),
      delivery_days: p.delivery_days || 7,
      image_url: p.image_url || '',
      verified: !!p.verified,
      status: (p.status === 'published' ? 'published' : 'draft'),
    });
    setShowForm(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    const description = form.description.trim();
    const image_url = form.image_url.trim();
    const price = Math.round(Number(form.price_eur) || 0);

    if (!name) return toast.error('Nom requis');
    if (!description) return toast.error('Description requise');
    if (!image_url) return toast.error('Image URL requise');
    if (price <= 0) return toast.error('Prix EUR requis');

    const payload: any = {
      name,
      description,
      category: form.category,
      price_eur: price,
      origin_country: form.origin_country,
      stock_mode: form.stock_mode,
      stock_qty: form.stock_qty === '' ? null : Math.max(0, Number(form.stock_qty) || 0),
      delivery_days: form.stock_mode === 'commande' ? Number(form.delivery_days) || 7 : null,
      image_url,
      source_type: editingId ? undefined : 'manual',
      verified: !!form.verified,
      status: form.status,
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(var(--muted-foreground))' }}>
            DËKK · BOUTIQUE
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
            {view === 'products' ? 'Gestion des produits'
              : view === 'orders' ? 'Commandes & suivi'
              : view === 'promos' ? 'Codes promo'
              : 'Statistiques boutique'}
          </h2>
        </div>
        {view === 'products' && (
          <button
            onClick={openCreate}
            style={{ background: '#1a1a1a', color: '#fff', height: 40, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}
          >
            + Ajouter un produit
          </button>
        )}
      </div>

      {/* Top selector */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}>
        <TabBtn active={view === 'products'} onClick={() => setView('products')}>Produits</TabBtn>
        <TabBtn active={view === 'orders'}   onClick={() => setView('orders')}>Commandes</TabBtn>
        <TabBtn active={view === 'promos'}   onClick={() => setView('promos')}>Codes promo</TabBtn>
        <TabBtn active={view === 'stats'}    onClick={() => setView('stats')}>Statistiques</TabBtn>
      </div>

      {view === 'orders' ? <BoutiqueOrdersPanel /> : (<>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}>
        <TabBtn active={tab === 'published'} onClick={() => setTab('published')}>Produits publiés</TabBtn>
        <TabBtn active={tab === 'draft'}     onClick={() => setTab('draft')}>Drafts ({drafts.length})</TabBtn>
      </div>

      {/* Table */}
      <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement…</div>
        ) : rows.length === 0 ? (
          <EmptyTab tab={tab} onCreate={openCreate} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead style={{ background: 'hsl(var(--background-secondary))' }}>
                <tr>
                  {['', 'Nom', 'Catégorie', 'Prix EUR', 'Disponibilité', 'Origine', ...(tab === 'draft' ? ['Source'] : []), 'Date', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const stock = p.stock_mode === 'stock'
                    ? { label: 'En stock', bg: '#E1F5EE', color: '#085041' }
                    : { label: `Sous ${p.delivery_days ?? 7} j`, bg: '#F5E6D8', color: '#8B5220' };
                  return (
                    <tr key={p.id} style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
                      <td style={{ padding: 8 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: 'hsl(var(--background-secondary))', overflow: 'hidden' }}>
                          {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{CATEGORY_LABEL[p.category] ?? p.category}</td>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace' }}>{Math.round(p.price_eur).toLocaleString('fr-FR')} €</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Pill label={stock.label} bg={stock.bg} color={stock.color} />
                      </td>
                      <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{p.origin_country}</td>
                      {tab === 'draft' && (
                        <td style={{ padding: '10px 12px' }}>
                          {(() => { const s = SOURCE_BADGE[p.source_type] || SOURCE_BADGE.manual; return (
                            <Pill label={s.label} bg={s.bg} color={s.color} />
                          ); })()}
                        </td>
                      )}
                      <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace', fontSize: 12 }}>
                        {fmtDate(p.created_at)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {tab === 'draft' && (
                          <button onClick={() => setStatus(p.id, 'published')} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, marginLeft: 4, cursor: 'pointer' }}>Publier</button>
                        )}
                        <Ghost onClick={() => startEdit(p)}>Modifier</Ghost>
                        {tab === 'draft' ? (
                          <Ghost danger onClick={() => remove(p.id)}>Supprimer</Ghost>
                        ) : (
                          <Ghost danger onClick={() => setStatus(p.id, 'archived')}>Archiver</Ghost>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form sheet */}
      {showForm && (
        <ProductFormSheet
          form={form}
          setForm={setForm}
          editing={!!editingId}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          onSubmit={submit}
        />
      )}
      </>)}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '10px 14px', fontSize: 13,
        fontWeight: active ? 500 : 400,
        color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
        borderBottom: active ? '2px solid #1a1a1a' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ background: bg, color, fontSize: 9, fontFamily: '"DM Mono", monospace', borderRadius: 20, padding: '3px 10px' }}>
      {label}
    </span>
  );
}

function Ghost({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none',
        padding: '5px 8px', fontSize: 12, marginLeft: 4, cursor: 'pointer',
        color: danger ? '#A32D2D' : 'hsl(var(--foreground))',
      }}
    >
      {children}
    </button>
  );
}

function EmptyTab({ tab, onCreate }: { tab: 'published' | 'draft'; onCreate: () => void }) {
  return (
    <div className="p-8 text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
      <p style={{ fontSize: 14, marginBottom: 12 }}>
        {tab === 'published' ? 'Aucun produit publié.' : 'Aucun draft en attente.'}
      </p>
      {tab === 'published' && (
        <button
          onClick={onCreate}
          style={{ background: '#1a1a1a', color: '#fff', height: 40, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}
        >
          + Ajouter un produit
        </button>
      )}
    </div>
  );
}

function ProductFormSheet({
  form, setForm, editing, onCancel, onSubmit,
}: {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  editing: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'hsl(var(--background-primary))', width: '100%', maxWidth: 560,
          borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
          {editing ? 'Modifier le produit' : 'Nouveau produit'}
        </h3>

        <Field label="Nom du produit *">
          <Input value={form.name} onChange={v => setForm({ ...form, name: v })} />
        </Field>

        <Field label="Description *">
          <textarea
            rows={3}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            style={{
              width: '100%', padding: '10px', fontSize: 13,
              border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8,
              background: 'hsl(var(--background-primary))', color: 'hsl(var(--foreground))',
              resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </Field>

        <Field label="Catégorie *">
          <Select value={form.category} onChange={v => setForm({ ...form, category: v })} options={CATEGORY_OPTIONS} />
        </Field>

        <Field label="Prix EUR *">
          <Input
            type="number"
            mono
            value={String(form.price_eur || '')}
            onChange={v => setForm({ ...form, price_eur: Math.max(0, Math.round(Number(v) || 0)) })}
          />
          <div style={{ marginTop: 4, fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>
            = {fmtFcfa(form.price_eur)}
          </div>
        </Field>

        <Field label="Origine *">
          <Select value={form.origin_country} onChange={v => setForm({ ...form, origin_country: v })} options={ORIGIN_OPTIONS} />
        </Field>

        <Field label="Disponibilité *">
          <div className="flex gap-2">
            <RadioBtn active={form.stock_mode === 'stock'}    onClick={() => setForm({ ...form, stock_mode: 'stock' })}>En stock</RadioBtn>
            <RadioBtn active={form.stock_mode === 'commande'} onClick={() => setForm({ ...form, stock_mode: 'commande' })}>Sous X jours</RadioBtn>
          </div>
        </Field>

        {form.stock_mode === 'commande' && (
          <Field label="Délai (jours)">
            <Input
              type="number"
              value={String(form.delivery_days)}
              onChange={v => setForm({ ...form, delivery_days: Math.max(1, Number(v) || 1) })}
            />
          </Field>
        )}

        <Field label="Image URL *">
          <Input value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} />
        </Field>

        <Field label="Vérifié">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 40, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.verified}
              onChange={e => setForm({ ...form, verified: e.target.checked })}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Testé par la communauté</span>
          </label>
        </Field>

        <Field label="Statut *">
          <div className="flex gap-2">
            <RadioBtn active={form.status === 'draft'}     onClick={() => setForm({ ...form, status: 'draft' })}>Draft</RadioBtn>
            <RadioBtn active={form.status === 'published'} onClick={() => setForm({ ...form, status: 'published' })}>Publié</RadioBtn>
          </div>
        </Field>

        <div className="flex flex-col gap-2 mt-5">
          <button
            onClick={onSubmit}
            style={{ background: '#1a1a1a', color: '#fff', height: 44, borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}
          >
            Enregistrer
          </button>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', height: 44, borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>
      <span style={{ display: 'block', color: 'hsl(var(--muted-foreground))', marginBottom: 6, fontSize: 12 }}>{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = 'text', mono = false }: { value: string; onChange: (v: string) => void; type?: string; mono?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', height: 40, minHeight: 44, padding: '0 12px', fontSize: 13,
        border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8,
        background: 'hsl(var(--background-primary))', color: 'hsl(var(--foreground))',
        fontFamily: mono ? '"DM Mono", monospace' : 'inherit',
      }}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', height: 44, padding: '0 12px', fontSize: 13,
        border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8,
        background: 'hsl(var(--background-primary))', color: 'hsl(var(--foreground))',
      }}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function RadioBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, minHeight: 44, padding: '0 14px', fontSize: 13,
        background: active ? '#1a1a1a' : 'transparent',
        color: active ? '#fff' : 'hsl(var(--muted-foreground))',
        border: active ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
        borderRadius: 8, cursor: 'pointer', fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}
