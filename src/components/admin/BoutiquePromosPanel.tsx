import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Copy } from 'lucide-react';

type Promo = {
  id: string;
  code: string;
  discount_type: 'percent' | 'amount_eur';
  discount_value: number;
  min_subtotal_eur: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

const empty = {
  code: '',
  discount_type: 'percent' as 'percent' | 'amount_eur',
  discount_value: 10,
  min_subtotal_eur: 0,
  max_uses: '' as string | '',
  expires_at: '' as string,
  active: true,
};

const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

export function BoutiquePromosPanel() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dekk_promo_codes' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setPromos(((data as any) || []) as Promo[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code) return toast.error('Code requis');
    if (form.discount_value <= 0) return toast.error('Valeur requise');
    if (form.discount_type === 'percent' && form.discount_value > 100) return toast.error('Max 100 %');

    const payload: any = {
      code,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_subtotal_eur: form.min_subtotal_eur || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: form.active,
    };

    const { error } = await supabase.from('dekk_promo_codes' as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Code créé');
    setShowForm(false);
    setForm({ ...empty });
    load();
  };

  const toggleActive = async (p: Promo) => {
    const { error } = await supabase.from('dekk_promo_codes' as any).update({ active: !p.active }).eq('id', p.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce code promo ?')) return;
    const { error } = await supabase.from('dekk_promo_codes' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Code supprimé');
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copié`);
  };

  const active = useMemo(() => promos.filter(p => p.active && (!p.expires_at || new Date(p.expires_at) > new Date())), [promos]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>
          {active.length} code{active.length > 1 ? 's' : ''} actif{active.length > 1 ? 's' : ''} · {promos.length} total
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: '#1a1a1a', color: '#fff', height: 36, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Nouveau code
        </button>
      </div>

      <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement…</div>
        ) : promos.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
            Aucun code promo. Créez-en un pour booster vos campagnes.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead style={{ background: 'hsl(var(--background-secondary))' }}>
                <tr>
                  {['Code', 'Réduction', 'Min achat', 'Usages', 'Expire', 'Statut', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promos.map(p => {
                  const expired = p.expires_at && new Date(p.expires_at) <= new Date();
                  const exhausted = p.max_uses && p.used_count >= p.max_uses;
                  const status = !p.active ? { label: 'Désactivé', bg: 'hsl(var(--background-secondary))', color: 'hsl(var(--muted-foreground))' }
                    : expired ? { label: 'Expiré', bg: '#FBE5E5', color: '#A32D2D' }
                    : exhausted ? { label: 'Épuisé', bg: '#F5E6D8', color: '#8B5220' }
                    : { label: 'Actif', bg: '#E1F5EE', color: '#085041' };
                  return (
                    <tr key={p.id} style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => copy(p.code)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"DM Mono", monospace', fontWeight: 500, fontSize: 13, color: 'hsl(var(--foreground))', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0 }}>
                          {p.code} <Copy size={12} style={{ opacity: 0.5 }} />
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace' }}>
                        {p.discount_type === 'percent' ? `-${p.discount_value} %` : `-${p.discount_value} €`}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace', color: 'hsl(var(--muted-foreground))' }}>
                        {p.min_subtotal_eur > 0 ? `${p.min_subtotal_eur} €` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace' }}>
                        {p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
                        {p.expires_at ? fmtDate(p.expires_at) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: status.bg, color: status.color, fontSize: 9, fontFamily: '"DM Mono", monospace', borderRadius: 20, padding: '3px 10px' }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => toggleActive(p)} style={{ background: 'transparent', border: 'none', padding: '5px 8px', fontSize: 12, cursor: 'pointer' }}>
                          {p.active ? 'Désactiver' : 'Activer'}
                        </button>
                        <button onClick={() => remove(p.id)} style={{ background: 'transparent', border: 'none', padding: '5px 8px', fontSize: 12, cursor: 'pointer', color: '#A32D2D' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'hsl(var(--background-primary))', width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Nouveau code promo</h3>

            <F label="Code *">
              <input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="DEKK10"
                style={inputStyle(true)}
              />
            </F>

            <F label="Type de réduction *">
              <div className="flex gap-2">
                <Radio active={form.discount_type === 'percent'} onClick={() => setForm({ ...form, discount_type: 'percent' })}>Pourcentage (%)</Radio>
                <Radio active={form.discount_type === 'amount_eur'} onClick={() => setForm({ ...form, discount_type: 'amount_eur' })}>Montant (€)</Radio>
              </div>
            </F>

            <F label={`Valeur * ${form.discount_type === 'percent' ? '(1-100 %)' : '(€)'}`}>
              <input
                type="number"
                value={form.discount_value || ''}
                onChange={e => setForm({ ...form, discount_value: Math.max(0, Number(e.target.value) || 0) })}
                style={inputStyle(true)}
              />
            </F>

            <F label="Minimum d'achat (€)">
              <input
                type="number"
                value={form.min_subtotal_eur || ''}
                onChange={e => setForm({ ...form, min_subtotal_eur: Math.max(0, Number(e.target.value) || 0) })}
                style={inputStyle(true)}
              />
            </F>

            <F label="Nombre max d'utilisations (vide = illimité)">
              <input
                type="number"
                value={form.max_uses}
                onChange={e => setForm({ ...form, max_uses: e.target.value })}
                style={inputStyle(true)}
              />
            </F>

            <F label="Date d'expiration (vide = pas d'expiration)">
              <input
                type="date"
                value={form.expires_at}
                onChange={e => setForm({ ...form, expires_at: e.target.value })}
                style={inputStyle()}
              />
            </F>

            <F label="Activer immédiatement">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Code actif</span>
              </label>
            </F>

            <div className="flex flex-col gap-2 mt-5">
              <button onClick={submit} style={{ background: '#1a1a1a', color: '#fff', height: 44, borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>Créer le code</button>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', height: 44, borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>
      <span style={{ display: 'block', color: 'hsl(var(--muted-foreground))', marginBottom: 6, fontSize: 12 }}>{label}</span>
      {children}
    </label>
  );
}

function inputStyle(mono = false): React.CSSProperties {
  return {
    width: '100%', height: 40, padding: '0 12px', fontSize: 13,
    border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8,
    background: 'hsl(var(--background-primary))', color: 'hsl(var(--foreground))',
    fontFamily: mono ? '"DM Mono", monospace' : 'inherit',
  };
}

function Radio({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, minHeight: 40, padding: '0 14px', fontSize: 13,
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
