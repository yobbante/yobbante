import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WA_TEMPLATES_CLIENT, getTemplate, type WaTemplateKey } from '@/lib/whatsappTemplates';
import { TEMPLATE_CATEGORIES, buildAutoFill, type AutoFillDossier } from '@/lib/whatsappTemplateHelpers';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const DOSSIER_FIELDS =
  'id, reference, tracking_id, status, origin_country, destination_country, estimated_weight, estimated_delivery_date, buyer_name, sender_name, recipient_name, recipient_address, sender_address, final_amount_xof, actual_weight_kg';

export function NewMessageDialog({ open, onOpenChange }: Props) {
  const [phone, setPhone] = useState('+221');
  const [dossiers, setDossiers] = useState<AutoFillDossier[]>([]);
  const [dossierId, setDossierId] = useState<string>('');
  const [tplKey, setTplKey] = useState<WaTemplateKey>('ORDER_CONFIRMATION');
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const tpl = getTemplate(tplKey);

  // Search active dossiers when phone has at least 6 digits
  useEffect(() => {
    if (!open) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) { setDossiers([]); setDossierId(''); return; }
    const tail = digits.slice(-9);
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('dossiers')
        .select(DOSSIER_FIELDS)
        .or(`contact_phone.ilike.%${tail}%,sender_phone.ilike.%${tail}%,recipient_phone.ilike.%${tail}%`)
        .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED,CLOSED)')
        .order('created_at', { ascending: false })
        .limit(10);
      const list = (data ?? []) as AutoFillDossier[];
      setDossiers(list);
      if (list.length > 0 && !dossierId) setDossierId(list[0].id);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [phone, open]); // eslint-disable-line

  useEffect(() => {
    if (!open) {
      setPhone('+221'); setDossiers([]); setDossierId(''); setParams({});
      setTplKey('ORDER_CONFIRMATION');
    }
  }, [open]);

  const selectedDossier = useMemo(
    () => dossiers.find((d) => d.id === dossierId) ?? null,
    [dossiers, dossierId],
  );

  // Auto-fill params from selected dossier
  useEffect(() => {
    const fill = buildAutoFill(selectedDossier);
    const next: Record<string, string> = {};
    tpl.params.forEach((p) => { if (fill[p]) next[p] = fill[p]; });
    setParams(next);
  }, [tplKey, selectedDossier]); // eslint-disable-line

  const preview = `[${tpl.label}]\n${tpl.params.map((p) => `${p}: ${params[p] || '—'}`).join('\n')}`;

  async function handleSend() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) { toast.error('Numéro invalide'); return; }
    setSending(true);
    try {
      const orderedParams = tpl.params.map((p) => params[p] || '');
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: phone,
          recipient_type: 'client',
          template_name: tpl.name,
          template_params: orderedParams,
          trigger_type: 'admin_new_message',
        },
      });
      if (error) throw error;
      toast.success('Message envoyé');
      onOpenChange(false);
    } catch (e) {
      toast.error('Échec envoi', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-[#F5C518]" /> Nouveau message client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Numéro WhatsApp</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 123 45 67"
              className="h-9 text-xs mt-1"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Package className="w-3 h-3" /> Dossier
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            </label>
            {dossiers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground mt-1 italic">
                {phone.replace(/\D/g, '').length < 6 ? 'Saisissez un numéro pour rechercher.' : 'Aucun dossier actif pour ce numéro.'}
              </p>
            ) : (
              <select
                value={dossierId}
                onChange={(e) => setDossierId(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground mt-1"
              >
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.tracking_id || d.reference} · {d.origin_country} → {d.destination_country} · {d.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Template</label>
            <select
              value={tplKey}
              onChange={(e) => setTplKey(e.target.value as WaTemplateKey)}
              className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground mt-1"
            >
              {TEMPLATE_CATEGORIES.map((cat) => (
                <optgroup key={cat.label} label={cat.label}>
                  {cat.keys.map((k) => {
                    const t = WA_TEMPLATES_CLIENT.find((x) => x.key === k);
                    if (!t) return null;
                    return <option key={k} value={k}>{t.label}</option>;
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {tpl.params.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {tpl.params.map((p) => (
                <Input
                  key={p}
                  value={params[p] || ''}
                  onChange={(e) => setParams((prev) => ({ ...prev, [p]: e.target.value }))}
                  placeholder={p}
                  className="h-8 text-xs"
                />
              ))}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
            {preview}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending} size="sm" className="bg-[#F5C518] text-zinc-950 hover:bg-[#F5C518]/90">
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
