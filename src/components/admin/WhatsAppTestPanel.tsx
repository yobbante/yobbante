import { useState } from 'react';
import { MessageCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function WhatsAppTestPanel() {
  const [phone, setPhone] = useState('+221786078080');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string; raw?: unknown } | null>(null);

  async function handleTest() {
    setLoading(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          client_name: 'Test Admin',
          service_type: 'Test',
          origin: 'Dakar',
          destination: 'Paris',
          weight: '1.5',
          recipient_phone: phone,
        },
      });
      if (error) {
        setStatus({ ok: false, message: error.message ?? 'Échec de l’envoi', raw: error });
      } else {
        setStatus({ ok: true, message: 'Requête envoyée avec succès', raw: data });
      }
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : 'Erreur inconnue' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Test WhatsApp</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Envoie un message de test via l’edge function <code>send-whatsapp</code>.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="wa-phone" className="text-xs">Numéro destinataire</Label>
        <Input
          id="wa-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+221786078080"
          className="text-sm"
        />
      </div>
      <Button onClick={handleTest} disabled={loading || !phone} size="sm" className="w-full">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
        Envoyer un test
      </Button>
      {status && (
        <div
          className={`text-xs rounded-lg p-3 border ${
            status.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            {status.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {status.message}
          </div>
          {status.raw !== undefined && (
            <pre className="mt-2 text-[10px] whitespace-pre-wrap break-all opacity-80 max-h-40 overflow-auto">
              {JSON.stringify(status.raw, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
