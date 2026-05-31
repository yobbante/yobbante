
DO $$
DECLARE keep_id uuid := '1710a540-074c-4f96-8380-fc263bec7492';
BEGIN
  -- Children of dossiers
  DELETE FROM public.dossier_messages WHERE dossier_id IS DISTINCT FROM keep_id;
  DELETE FROM public.dossier_events WHERE dossier_id IS DISTINCT FROM keep_id;
  DELETE FROM public.dossier_documents WHERE dossier_id IS DISTINCT FROM keep_id;
  DELETE FROM public.dossier_customs_documents WHERE dossier_id IS DISTINCT FROM keep_id;
  DELETE FROM public.weight_logs WHERE dossier_id IS DISTINCT FROM keep_id;
  DELETE FROM public.refund_requests;
  DELETE FROM public.matches;
  DELETE FROM public.shipment_events;
  DELETE FROM public.shipments;
  DELETE FROM public.packages;
  DELETE FROM public.reception_packages;
  DELETE FROM public.reception_orders;
  DELETE FROM public.notifications_log;
  DELETE FROM public.admin_notifications WHERE dossier_id IS DISTINCT FROM keep_id OR dossier_id IS NULL;
  DELETE FROM public.timeline_events;
  DELETE FROM public.whatsapp_outbound_messages WHERE dossier_id IS DISTINCT FROM keep_id OR dossier_id IS NULL;
  DELETE FROM public.whatsapp_inbound_messages;
  DELETE FROM public.manual_departures;
  DELETE FROM public.konnekt_departures;
  DELETE FROM public.konnekt_departures_cache;
  DELETE FROM public.konnekt_sync_log;
  DELETE FROM public.manual_quote_requests;
  DELETE FROM public.enterprise_quotes;
  DELETE FROM public.legacy_dossiers;
  DELETE FROM public.intake_drafts;
  DELETE FROM public.edit_tokens;
  DELETE FROM public.gp_bot_sessions;
  DELETE FROM public.gp_import_logs;
  DELETE FROM public.gp_unknown_contacts;
  DELETE FROM public.client_bot_sessions;
  DELETE FROM public.livreur_bot_sessions;
  DELETE FROM public.dekk_order_events;
  DELETE FROM public.dekk_orders;
  DELETE FROM public.dekk_promo_redemptions;
  DELETE FROM public.business_invoices;
  DELETE FROM public.business_invitations;
  -- Finally remove all dossiers except the one to keep
  DELETE FROM public.dossiers WHERE id <> keep_id;
END $$;
