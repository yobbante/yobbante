-- Transporteurs GP : l'agent terrain peut consulter et gérer les fiches (pas de suppression)
DROP POLICY IF EXISTS "Terrain agents blocked" ON public.transporteurs;
CREATE POLICY "Terrain agents cannot delete" ON public.transporteurs
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_agent_terrain(auth.uid()));

-- Départs GP : lecture seule pour l'agent terrain (historique des trajets)
DROP POLICY IF EXISTS "Terrain agents blocked" ON public.manual_departures;
CREATE POLICY "Terrain agents read only" ON public.manual_departures
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (NOT public.is_agent_terrain(auth.uid()));

-- Dossiers : l'agent terrain ne voit/modifie que les dossiers confiés à un GP
DROP POLICY IF EXISTS "Terrain agents blocked" ON public.dossiers;
CREATE POLICY "Terrain agents only GP dossiers" ON public.dossiers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_agent_terrain(auth.uid()) OR assigned_transporteur_ref IS NOT NULL)
  WITH CHECK (NOT public.is_agent_terrain(auth.uid()) OR assigned_transporteur_ref IS NOT NULL);
CREATE POLICY "Terrain agents cannot delete dossiers" ON public.dossiers
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_agent_terrain(auth.uid()));

-- Historique de statut des dossiers GP : lecture pour l'agent terrain
DROP POLICY IF EXISTS "Terrain agents blocked" ON public.dossier_events;
CREATE POLICY "Terrain agents cannot delete" ON public.dossier_events
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_agent_terrain(auth.uid()));