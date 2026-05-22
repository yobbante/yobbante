import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type TokenInfo = {
  valid: boolean;
  reason?: string;
  entity_type?: string;
  entity_id?: string;
  fields_allowed?: string[];
  label?: string;
  current?: Record<string, any>;
  expires_at?: string;
};

const FIELD_LABELS: Record<string, string> = {
  sender_name: "Nom expéditeur",
  sender_phone: "Téléphone expéditeur",
  sender_address: "Adresse de collecte",
  pickup_date: "Date de collecte",
  recipient_name: "Nom destinataire",
  recipient_phone: "Téléphone destinataire",
  recipient_address: "Adresse de livraison",
  telephone_1: "Téléphone principal",
  adresse_collecte_dakar: "Adresse de collecte (Dakar)",
  adresses_remise: "Adresses de remise (JSON)",
  full_name: "Nom complet",
  phone: "Téléphone",
  email: "Email",
};

const MULTILINE = new Set(["sender_address", "recipient_address", "adresse_collecte_dakar", "adresses_remise"]);

export default function ModifierPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc("get_edit_token", { p_token: token });
      if (error) {
        setInfo({ valid: false, reason: "error" });
      } else {
        const d = data as unknown as TokenInfo;
        setInfo(d);
        if (d?.valid && d.fields_allowed) {
          const initial: Record<string, string> = {};
          for (const f of d.fields_allowed) {
            const v = d.current?.[f];
            initial[f] = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2);
          }
          setValues(initial);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  const errorMessage = useMemo(() => {
    if (!info || info.valid) return null;
    switch (info.reason) {
      case "used":
        return "Ce lien a déjà été utilisé.";
      case "expired":
        return "Ce lien a expiré.";
      case "not_found":
        return "Lien introuvable.";
      case "entity_not_found":
        return "Dossier introuvable.";
      default:
        return "Lien invalide.";
    }
  }, [info]);

  const handleSubmit = async () => {
    if (!token || !info?.valid) return;
    setSaving(true);
    const payload: Record<string, any> = {};
    for (const f of info.fields_allowed || []) {
      if (f === "adresses_remise") {
        try {
          payload[f] = values[f] ? JSON.parse(values[f]) : null;
        } catch {
          toast.error("Format JSON invalide pour les adresses de remise.");
          setSaving(false);
          return;
        }
      } else {
        payload[f] = values[f] ?? "";
      }
    }
    const { data, error } = await supabase.rpc("apply_edit_token", { p_token: token, p_payload: payload });
    setSaving(false);
    if (error || !(data as any)?.ok) {
      toast.error("Erreur lors de la mise à jour. Réessayez ou contactez-nous.");
      return;
    }
    toast.success("Informations mises à jour");
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/60 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            YOBBANTÉ<span style={{ color: "#F5C518" }}>.</span>
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && info && !info.valid && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
              <AlertTriangle className="h-10 w-10 mx-auto" style={{ color: "#F5C518" }} />
              <h1 className="text-xl font-semibold">Lien expiré ou invalide</h1>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <p className="text-sm">
                Contactez-nous : <a href="tel:+221786078080" className="underline font-medium">+221 78 607 80 80</a>
              </p>
            </div>
          )}

          {!loading && info?.valid && done && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
              <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "#F5C518" }} />
              <h1 className="text-xl font-semibold">Merci !</h1>
              <p className="text-sm text-muted-foreground">
                Vos informations ont été mises à jour. Notre équipe en a été notifiée.
              </p>
            </div>
          )}

          {!loading && info?.valid && !done && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">Modifier vos informations</h1>
                {info.label && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {info.entity_type?.startsWith("dossier") ? `Dossier ${info.label}` : info.label}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {(info.fields_allowed || []).map((f) => (
                  <div key={f} className="space-y-2">
                    <Label htmlFor={f} className="text-sm">
                      {FIELD_LABELS[f] || f}
                    </Label>
                    {MULTILINE.has(f) ? (
                      <Textarea
                        id={f}
                        value={values[f] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                        rows={f === "adresses_remise" ? 6 : 3}
                        className="text-base"
                      />
                    ) : (
                      <Input
                        id={f}
                        type={f === "pickup_date" ? "date" : f === "email" ? "email" : f.includes("phone") || f === "telephone_1" ? "tel" : "text"}
                        value={values[f] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                        className="text-base"
                      />
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full h-12 text-base font-medium"
                style={{ backgroundColor: "#F5C518", color: "#0A0E1A" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Lien à usage unique, valide 24h.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
