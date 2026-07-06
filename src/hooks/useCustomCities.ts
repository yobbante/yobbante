import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CityOption } from '@/components/flows/FlowPrimitives';

interface CustomCityRow {
  id: string;
  city: string;
  country_code: string;
  country_label: string;
  flag: string;
  active: boolean;
}

export interface CustomCityAdmin extends CityOption {
  rowId: string;
  active: boolean;
}

const STATE: { list: CityOption[]; loaded: boolean; listeners: Set<() => void> } = {
  list: [],
  loaded: false,
  listeners: new Set(),
};

function rowToOption(r: CustomCityRow): CityOption {
  return {
    id: `${r.country_code}-${r.city}`,
    city: r.city,
    country: r.country_code,
    countryLabel: r.country_label,
    flag: r.flag || '🏳️',
  };
}

async function refresh() {
  const { data, error } = await supabase
    .from('custom_cities')
    .select('id, city, country_code, country_label, flag, active')
    .eq('active', true)
    .order('city', { ascending: true });
  if (error) {
    console.error('[useCustomCities] load error', error);
    return;
  }
  STATE.list = (data ?? []).map(rowToOption);
  STATE.loaded = true;
  STATE.listeners.forEach((fn) => fn());
}

/**
 * Hook returning the list of admin-added custom cities (merged into the global
 * 36-city catalog wherever a city picker is rendered).
 */
export function useCustomCities() {
  const [, force] = useState(0);

  useEffect(() => {
    const cb = () => force((n) => n + 1);
    STATE.listeners.add(cb);
    if (!STATE.loaded) refresh();
    return () => {
      STATE.listeners.delete(cb);
    };
  }, []);

  const addCustomCity = useCallback(
    async (opts: { city: string; country_code: string; country_label: string; flag?: string }) => {
      const payload = {
        city: opts.city.trim(),
        country_code: opts.country_code.trim().toUpperCase().slice(0, 2),
        country_label: opts.country_label.trim(),
        flag: opts.flag?.trim() || '🏳️',
        active: true,
      };
      if (!payload.city || !payload.country_code || !payload.country_label) {
        throw new Error('Ville, code pays et libellé pays sont obligatoires');
      }
      const { data, error } = await supabase
        .from('custom_cities')
        .upsert(payload, { onConflict: 'country_code,city' })
        .select('id, city, country_code, country_label, flag, active')
        .single();
      if (error) throw error;
      await refresh();
      return { ...rowToOption(data as CustomCityRow), rowId: (data as CustomCityRow).id };
    },
    [],
  );

  const deleteCustomCity = useCallback(async (rowId: string) => {
    // Soft delete → keeps historical departures referencing the label safe.
    const { error } = await supabase
      .from('custom_cities')
      .update({ active: false })
      .eq('id', rowId);
    if (error) throw error;
    await refresh();
  }, []);

  const listAll = useCallback(async (): Promise<CustomCityAdmin[]> => {
    const { data, error } = await supabase
      .from('custom_cities')
      .select('id, city, country_code, country_label, flag, active')
      .order('active', { ascending: false })
      .order('city', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      ...rowToOption(r as CustomCityRow),
      rowId: (r as CustomCityRow).id,
      active: (r as CustomCityRow).active,
    }));
  }, []);

  return { cities: STATE.list, loaded: STATE.loaded, addCustomCity, deleteCustomCity, listAll, refresh };
}

/** Lookup helper that searches both the static 36-city list and the custom list. */
export function findCityInLists(
  staticList: CityOption[],
  customList: CityOption[],
  predicate: (c: CityOption) => boolean,
): CityOption | undefined {
  return staticList.find(predicate) ?? customList.find(predicate);
}
