import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

type EntityType = "dossier_client" | "dossier_destinataire" | "transporteur" | "client";

interface FieldOption {
  key: string;
  label: string;
  fields: string[];
}

const PRESETS: Record<EntityType, FieldOption[]> = {
  dossier_client: [
    { key: "sender", label: "Infos expéditeur (nom + téléphone)", fields: ["sender_name", "sender_phone"] },
    { key: "sender_addr", label: "Adresse de collecte", fields: ["sender_address"] },
    { key: "pickup_date", label: "Date de collecte", fields: ["pickup_date"] },
  ],
  dossier_destinataire: [
    { key: "recipient", label: "Infos destinataire (nom + téléphone)", fields: ["recipient_name", "recipient_phone"] },
    { key: "recipient_addr", label: "Adresse de livraison", fields: ["recipient_address"] },
  ],
  transporteur: [
    { key: "phone", label: "Téléphone principal", fields: ["telephone_1"] },
    { key: "addr_dkr", label: "Adresse de collecte (Dakar)", fields: ["adresse_collecte_dakar", "adresse_dakar_2"] },
    { key: "addr_remise", label: "Adresses de remise", fields: ["adresses_remise"] },
    { key: "navettes", label: "Navettes (villes desservies)", fields: ["navettes"] },
  ],
  client: [
    { key: "identity", label: "Nom + téléphone + email", fields: ["full_name", "phone", "email"] },
  ],
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: EntityType;
  entityId: string;
  recipientPhone: string | null | undefined;
  recipientFirstName?: string | null;
  trackingLabel?: string | null;
}

export function SendEditLinkDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  recipientPhone,
  recipientFirstName,
  trackingLabel,
}: Props) {
  const presets = PRESETS[entityType];
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(presets.map((p) => [p.key, true])),
  );
  const [sending, setSending] = useState(false);

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const handleSend = async () => {
    const fields = presets.filter((p) => selected[p.key]).flatMap((p) => p.fields);
    if (fields.length === 0) {
      toast.error("Sélectionnez au moins un champ à autoriser.");
      return;
    }
    if (!recipientPhone) {
      toast.error("Aucun numéro WhatsApp pour le destinataire.");
      return;
    }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: tokenRow, error: tokenErr } = await supabase
        .from("edit_tokens")
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          fields_allowed: fields,
          created_by: user?.id ?? null,
        })
        .select("token")
        .single();

      if (tokenErr || !tokenRow) throw tokenErr || new Error("Token non créé");

      const link = `https://yobbante.com/modifier/${tokenRow.token}`;
      const prenom = recipientFirstName || "bonjour";
      const refTxt = trackingLabel ? ` pour ${trackingLabel}` : "";
      const message =
        `Bonjour ${prenom},\n\n` +
        `Vous pouvez modifier vos informations${refTxt} ici :\n${link}\n\n` +
        `Lien valide 24h.`;

      const { error: waErr } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          recipient_phone: recipientPhone,
          recipient_type: entityType === "transporteur" ? "transporteur" : "client",
          message,
          trigger_type: "edit_link",
        },
      });
      if (waErr) throw waErr;

      toast.success("Lien envoyé via WhatsApp");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erreur lors de l'envoi : " + (e?.message || "inconnu"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer un lien de modification</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Que voulez-vous permettre de modifier ?
          </p>
          {presets.map((p) => (
            <label key={p.key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={!!selected[p.key]} onCheckedChange={() => toggle(p.key)} />
              <Label className="text-sm cursor-pointer">{p.label}</Label>
            </label>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            Le lien sera envoyé via WhatsApp à <span className="font-mono">{recipientPhone || "—"}</span> et expire dans 24h.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !recipientPhone}
            style={{ backgroundColor: "#F5C518", color: "#0A0E1A" }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Envoyer</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
