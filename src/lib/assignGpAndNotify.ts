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

/**
 * Assigner un dossier à un départ spécifique (manual_departures.id) :
 * - Met à jour assigned_departure_id + assigned_transporteur_ref via RPC SECURITY DEFINER.
 * - Décale la réservation entre l'ancien et le nouveau départ.
 * - Déclenche la notification WhatsApp GP enrichie (route, date, nb colis, total kg).
 */
export async function assignDossierToDeparture(args: {
  dossierId: string;
  departureId: string;
  transporteurRef: string;
  notify?: boolean;
}): Promise<{ ok: boolean }> {
  const { dossierId, departureId, transporteurRef, notify = true } = args;

  // 0) Snapshot AVANT mutation : pour notifier l'ancien GP / mentionner reschedule
  const { data: prev } = await supabase
    .from('dossiers')
    .select('assigned_departure_id, assigned_transporteur_ref, client_departure_decision, client_requested_pickup_date')
    .eq('id', dossierId)
    .maybeSingle();
  const prevDepartureId = (prev as any)?.assigned_departure_id ?? null;
  const prevTransporteurRef = (prev as any)?.assigned_transporteur_ref ?? null;
  const wasRescheduleRequested = (prev as any)?.client_departure_decision === 'reschedule_requested';

  // 1) RPC : assignation + capacité
  const { error: rpcErr } = await supabase.rpc('assign_dossier_to_departure' as any, {
    p_dossier_id: dossierId,
    p_departure_id: departureId,
    p_transporteur_ref: transporteurRef,
  });
  if (rpcErr) {
    toast.error(rpcErr.message || 'Échec assignation');
    return { ok: false };
  }

  if (!notify) return { ok: true };

  // 1bis) Notifier l'ancien GP si on a changé de transporteur
  if (
    prevTransporteurRef &&
    prevTransporteurRef !== transporteurRef &&
    prevDepartureId &&
    prevDepartureId !== departureId
  ) {
    try {
      const [{ data: oldGp }, { data: oldDep }, { data: dCur }] = await Promise.all([
        supabase
          .from('transporteurs' as any)
          .select('id, prenom, telephone_1')
          .eq('reference', prevTransporteurRef)
          .maybeSingle(),
        supabase
          .from('manual_departures')
          .select('id, origin_city, destination_city, departure_date')
          .eq('id', prevDepartureId)
          .maybeSingle(),
        supabase
          .from('dossiers')
          .select('tracking_id, reference')
          .eq('id', dossierId)
          .maybeSingle(),
      ]);
      const og: any = oldGp;
      const om: any = oldDep;
      const dc: any = dCur;
      if (og?.telephone_1) {
        const refLabel = dc?.tracking_id || dc?.reference || dossierId;
        const dateStr = om?.departure_date
          ? new Date(om.departure_date).toLocaleDateString('fr-FR')
          : '';
        const msg = [
          `Salam ${(og.prenom ?? '').split(/\s+/)[0] || ''},`,
          ``,
          `Le colis ${refLabel} a ete reassigne a un autre transporteur.`,
          om ? `Depart concerne : ${om.origin_city} -> ${om.destination_city}${dateStr ? ` du ${dateStr}` : ''}.` : null,
          ``,
          `Vous n'avez plus rien a faire sur ce colis.`,
          `Merci, equipe Yobbante.`,
        ].filter(Boolean).join('\n');
        await sendGpMessage({
          phone: og.telephone_1,
          message: msg,
          dossier_id: dossierId,
          transporteur_id: og.id,
          trigger_type: 'gp_departure_unassigned',
          silent: true,
        });
      }
    } catch { /* swallow */ }
  }


  // 2) Charger dossier + départ + GP + total colis sur ce départ
  const [{ data: dossier }, { data: dep }, { data: gp }, { data: peers }] = await Promise.all([
    supabase
      .from('dossiers')
      .select('id, tracking_id, reference, sender_name, sender_phone, sender_address, recipient_name, recipient_phone, origin_country, destination_country, estimated_weight, actual_weight_kg, pickup_date, contact_phone, buyer_name')
      .eq('id', dossierId)
      .maybeSingle(),
    supabase
      .from('manual_departures')
      .select('id, origin_city, destination_city, departure_date, short_ref, total_capacity_kg, available_capacity_kg, reserved_capacity_kg')
      .eq('id', departureId)
      .maybeSingle(),
    supabase
      .from('transporteurs' as any)
      .select('id, prenom, nom, telephone_1')
      .eq('reference', transporteurRef)
      .maybeSingle(),
    supabase
      .from('dossiers')
      .select('id, tracking_id, estimated_weight, actual_weight_kg')
      .eq('assigned_departure_id', departureId),
  ]);

  if (!dossier || !dep) return { ok: true };
  const d: any = dossier;
  const g: any = gp;
  const m: any = dep;
  const allPeers: any[] = peers ?? [];
  const totalCount = allPeers.length;
  const totalKg = allPeers.reduce(
    (s, p) => s + Number(p.actual_weight_kg ?? p.estimated_weight ?? 0),
    0,
  );

  // 3) Notif GP enrichie
  if (g?.telephone_1) {
    const dateStr = m.departure_date
      ? new Date(m.departure_date).toLocaleDateString('fr-FR')
      : 'a confirmer';
    const w = d.actual_weight_kg ?? d.estimated_weight;
    const msg = [
      `Salam ${(g.prenom ?? '').split(/\s+/)[0] || ''},`,
      ``,
      `Nouveau colis assigne a votre depart`,
      `${m.origin_city} -> ${m.destination_city} du ${dateStr}.`,
      ``,
      `Ref colis : ${d.tracking_id || d.reference}`,
      `Poids : ${w ? `${w}kg` : 'a confirmer'}`,
      `Client : ${d.sender_name || d.recipient_name || d.buyer_name || 'Non renseigne'}`,
      d.sender_address ? `Adresse collecte : ${d.sender_address}` : null,
      ``,
      `Total colis ce depart : ${totalCount}`,
      `Poids total : ${Math.round(totalKg * 10) / 10}kg`,
      `Capacite restante : ${m.available_capacity_kg}kg`,
      ``,
      `Confirmez reception : RECU ${d.tracking_id || d.reference}`,
    ].filter(Boolean).join('\n');

    const res = await sendGpMessage({
      phone: g.telephone_1,
      message: msg,
      dossier_id: d.id,
      transporteur_id: g.id,
      trigger_type: 'gp_departure_assignment',
      silent: true,
    });
    if (res.ok) {
      await supabase
        .from('dossiers')
        .update({ gp_reminded_at: new Date().toISOString() })
        .eq('id', d.id);
    }
  }

  // 4) Notif client (best-effort, message court)
  const clientPhone = d.contact_phone || d.sender_phone || d.recipient_phone;
  if (clientPhone) {
    const gpFull = g
      ? `${g.prenom ?? ''} ${g.nom ?? ''}`.trim() || transporteurRef
      : transporteurRef;
    const ref = d.tracking_id || d.reference || '';
    const dateStr = m.departure_date
      ? new Date(m.departure_date).toLocaleDateString('fr-FR')
      : null;
    const prenom = (d.sender_name || d.buyer_name || d.recipient_name || 'Client')
      .toString().trim().split(/\s+/)[0];
    const txt = [
      `Bonjour ${prenom},`,
      ``,
      wasRescheduleRequested
        ? `Bonne nouvelle : suite a votre demande, nous avons trouve un nouveau depart pour ${ref}.`
        : `Votre dossier ${ref} a ete confie a ${gpFull}.`,
      wasRescheduleRequested ? `Transporteur : ${gpFull}` : null,
      `Route : ${m.origin_city} -> ${m.destination_city}`,
      dateStr ? `Depart prevu le ${dateStr}` : null,
      ``,
      `Merci de confirmer ce nouveau depart depuis votre espace :`,
      `yobbante.com/app/dossier/${d.id}`,
      ``,
      `Suivi : yobbante.com/suivre/${ref}`,
      ``,
      `— Equipe Yobbante`,
    ].filter(Boolean).join('\n');
    try {
      await supabase.functions.invoke('send-whatsapp', {
        body: {
          recipient_phone: clientPhone,
          recipient_type: 'client',
          message: txt,
          dossier_id: d.id,
          trigger_type: 'client_departure_assigned',
        },
      });
    } catch { /* swallow */ }
  }

  return { ok: true };
}

/** Libérer la réservation d'un dossier sur son départ assigné. */
export async function releaseDossierDeparture(dossierId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.rpc('release_dossier_departure' as any, {
    p_dossier_id: dossierId,
  });
  if (error) {
    toast.error(error.message || 'Échec');
    return { ok: false };
  }
  return { ok: true };
}
