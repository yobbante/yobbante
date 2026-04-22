import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Package, PackageStatus } from '@/lib/types';
import { canTransitionPackage, InvalidPackageTransitionError } from '@/lib/packageStatus';
import { toast } from 'sonner';

export function usePackages() {
  const queryClient = useQueryClient();

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Package[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PackageStatus }) => {
      // Frontend guard — fail fast before hitting the network.
      const current = packages.find(p => p.id === id);
      if (current && !canTransitionPackage(current.status, status)) {
        throw new InvalidPackageTransitionError(current.status, status);
      }
      const { error } = await supabase
        .from('packages')
        .update({ status })
        .eq('id', id);
      if (error) {
        // Backend trigger raises check_violation (23514) with our French message.
        const msg = (error as { message?: string }).message ?? '';
        if (msg.includes('Transition invalide')) {
          throw new InvalidPackageTransitionError(current?.status ?? 'CREATED', status);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
    onError: (err) => {
      if (err instanceof InvalidPackageTransitionError) {
        toast.error(err.message);
      } else {
        toast.error('Impossible de mettre à jour le statut du colis');
      }
    },
  });

  const createPackage = useMutation({
    mutationFn: async (pkg: { warehouse_country: 'FR' | 'CN' | 'US'; description?: string; weight?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('packages')
        .insert({ ...pkg, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
    },
  });

  const idlePackages = packages.filter(p => {
    if (p.status !== 'IN_STORAGE') return false;
    const hoursInStorage = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
    return hoursInStorage > 48;
  });

  const consolidationGroups = packages
    .filter(p => ['RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP'].includes(p.status) && !p.shipment_id)
    .reduce((groups, pkg) => {
      const key = pkg.warehouse_country;
      if (!groups[key]) groups[key] = [];
      groups[key].push(pkg);
      return groups;
    }, {} as Record<string, Package[]>);

  return { packages, isLoading, updateStatus, createPackage, idlePackages, consolidationGroups };
}
