// Assign a transporteur (GP) to a dossier AND auto-send WhatsApp messages
// to both the GP and the client. Used by QuickAssignGpDialog and TransportTab.
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildGpAssignMessage } from '@/lib/clientTemplates';
import { sendGpMessage } from '@/lib/sendGpMessage';

interface AssignArgs {
  dossierId: string;
  transporteurRef: string;
  /** Skip auto-notification (used when detaching). */
  notify?: boolean;
}

export async function assignTransporteurAndNotify({
  dossierId,
  transporteurRef,
  notify = true,
}: AssignArgs): Promise<{ ok: boolean }> {
  // 1) Update assignment + auto-bump status to ASSIGNED when attaching a GP
  const updatePayload: { assigned_transporteur_ref: string | null; status?: any } = {
    assigned_transporteur_ref: transporteurRef || null,
  };
  if (transporteurRef) {
    // Read current status to avoid regressing further-along dossiers
    const { data: cur } = await supabase
      .from('dossiers')
      .select('status')
      .eq('id', dossierId)
      .maybeSingle();
    const earlyStatuses = ['SUBMITTED', 'AWAITING_CLIENT', 'IN_REVIEW', 'CONFIRMED', 'PROCURED'];
    if (cur?.status && earlyStatuses.includes(cur.status)) {
      updatePayload.status = 'ASSIGNED';
    }
  }
  const { error: upErr } = await supabase
    .from('dossiers')
    .update(updatePayload)
    .eq('id', dossierId);
  if (upErr) {
    toast.error(upErr.message || 'Echec assignation');
    return { ok: false };
  }

  if (!notify || !transporteurRef) return { ok: true };

  // 2) Load dossier + GP details
  const [{ data: dossier }, { data: gp }] = await Promise.all([
    supabase
      .from('dossiers')
      .select(
        'id, tracking_id, reference, sender_name, sender_phone, sender_address, recipient_name, recipient_phone, origin_country, destination_country, estimated_weight, pickup_date, contact_phone, buyer_name',
      )
      .eq('id', dossierId)
      .maybeSingle(),
    supabase
      .from('transporteurs' as any)
      .select('id, prenom, nom, telephone_1')
      .eq('reference', transporteurRef)
      .maybeSingle(),
  ]);

  if (!dossier) return { ok: true };
  const d: any = dossier;
  const g: any = gp;

  let gpOk = false;
  let clientOk = false;

  // 3) Notify GP
  if (g?.telephone_1) {
    const clientPhoneForGp =
      d.contact_phone || d.sender_phone || d.recipient_phone || null;
    const gpMsg = buildGpAssignMessage({
      gp_prenom: g.prenom,
      tracking_id: d.tracking_id,
      reference: d.reference,
      origin: d.origin_country,
      destination: d.destination_country,
      client_name: d.sender_name || d.recipient_name || d.buyer_name,
      client_phone: clientPhoneForGp,
      weight: d.estimated_weight,
      pickup_address: d.sender_address,
      pickup_date: d.pickup_date,
      departure_date: d.pickup_date,
    });

    const res = await sendGpMessage({
      phone: g.telephone_1,
      message: gpMsg,
      dossier_id: d.id,
      transporteur_id: g.id,
      trigger_type: 'gp_assignment_auto',
      silent: true,
    });
    gpOk = res.ok;
    if (gpOk) {
      await supabase
        .from('dossiers')
        .update({ gp_reminded_at: new Date().toISOString() })
        .eq('id', d.id);
    }
  }

  // 4) Notify client
  const clientPhone: string | null =
    d.contact_phone || d.sender_phone || d.recipient_phone || null;
  if (clientPhone) {
    const gpFull = g
      ? `${g.prenom ?? ''} ${g.nom ?? ''}`.trim() || transporteurRef
      : transporteurRef;
    const prenom = (d.sender_name || d.buyer_name || d.recipient_name || 'Client')
      .toString()
      .trim()
      .split(/\s+/)[0];
    const ref = d.tracking_id || d.reference || '';
    const clientMsg = [
      `Bonjour ${prenom},`,
      ``,
      `Votre dossier ${ref} a ete confie a notre transporteur ${gpFull}.`,
      `Route : ${d.origin_country || '-'} -> ${d.destination_country || '-'}`,
      g?.telephone_1 ? `Contact GP : ${g.telephone_1}` : null,
      ``,
      `Notre equipe passera collecter votre colis a votre adresse.`,
      `Suivi : yobbante.com/suivre/${ref}`,
      ``,
      `— Equipe Yobbante`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: clientPhone,
          recipient_type: 'client',
          message: clientMsg,
          dossier_id: d.id,
          trigger_type: 'client_gp_assigned',
        },
      });
      if (!error && (data as any)?.status === 'sent') clientOk = true;
    } catch {
      /* swallow */
    }
  }

  // 5) Feedback
  if (gpOk && clientOk) toast.success('Transporteur assigne, GP + client notifies sur WhatsApp');
  else if (gpOk) toast.success('Transporteur assigne, GP notifie (client non joignable)');
  else if (clientOk) toast.success('Transporteur assigne, client notifie (GP non joignable)');
  else toast.success('Transporteur assigne (notifications WhatsApp en file)');

  return { ok: true };
}
