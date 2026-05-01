import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BusinessMemberRole = 'admin' | 'operator' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessMemberRole;
  joined_at: string;
  profile?: { full_name: string | null; email: string | null; phone: string | null } | null;
}

export interface BusinessInvitation {
  id: string;
  business_id: string;
  email: string;
  role: BusinessMemberRole;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export function useBusinessMembers(businessId: string | undefined) {
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [invitations, setInvitations] = useState<BusinessInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!businessId) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [m, i] = await Promise.all([
      supabase.from('business_members').select('*').eq('business_id', businessId).order('joined_at', { ascending: true }),
      supabase.from('business_invitations').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    ]);

    // enrich with profiles
    const userIds = (m.data ?? []).map((x: any) => x.user_id);
    let profilesMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);
      (profs ?? []).forEach((p: any) => profilesMap.set(p.user_id, p));
    }

    setMembers(((m.data as any[]) ?? []).map(row => ({
      ...row,
      profile: profilesMap.get(row.user_id) ?? null,
    })));
    setInvitations((i.data as BusinessInvitation[]) ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { members, invitations, loading, refresh };
}
