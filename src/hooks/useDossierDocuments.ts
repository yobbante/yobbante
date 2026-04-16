import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DocKind = 'invoice' | 'bl' | 'customs' | 'other';

export interface DossierDocument {
  id: string;
  dossier_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: DocKind;
  uploaded_by: string;
  created_at: string;
}

export function useDossierDocuments(dossierId: string | undefined) {
  const qc = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['dossier-documents', dossierId],
    enabled: !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossier_documents')
        .select('*')
        .eq('dossier_id', dossierId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DossierDocument[];
    },
  });

  const upload = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: DocKind }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !dossierId) throw new Error('Not authenticated');

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${dossierId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from('dossier-documents')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('dossier_documents').insert({
        dossier_id: dossierId,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        kind,
        uploaded_by: user.id,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossier-documents', dossierId] }),
  });

  const remove = useMutation({
    mutationFn: async (doc: DossierDocument) => {
      await supabase.storage.from('dossier-documents').remove([doc.file_path]);
      const { error } = await supabase.from('dossier_documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossier-documents', dossierId] }),
  });

  const getDownloadUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('dossier-documents')
      .createSignedUrl(path, 60 * 5);
    if (error) throw error;
    return data.signedUrl;
  };

  return { documents, isLoading, upload, remove, getDownloadUrl };
}

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  invoice: 'Facture',
  bl: 'Bon de livraison',
  customs: 'Déclaration douane',
  other: 'Autre',
};
