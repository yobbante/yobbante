import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

interface Ctx {
  dossierId: string | null;
  open: (id: string) => void;
  close: () => void;
}

const DossierSheetCtx = createContext<Ctx | null>(null);

export function DossierSheetProvider({ children }: { children: ReactNode }) {
  const [sp, setSp] = useSearchParams();
  const urlId = sp.get('dossier');
  const [dossierId, setDossierId] = useState<string | null>(urlId);

  // Sync state -> URL (?dossier=...)
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (dossierId) next.set('dossier', dossierId);
    else next.delete('dossier');
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId]);

  // Sync URL -> state (back/forward navigation)
  useEffect(() => {
    if (urlId !== dossierId) setDossierId(urlId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlId]);

  const open = useCallback((id: string) => setDossierId(id), []);
  const close = useCallback(() => setDossierId(null), []);

  return (
    <DossierSheetCtx.Provider value={{ dossierId, open, close }}>
      {children}
    </DossierSheetCtx.Provider>
  );
}

export function useDossierSheet() {
  const ctx = useContext(DossierSheetCtx);
  // Soft fallback: if used outside provider, return a no-op so consumers
  // don't crash (e.g. when previewing components in isolation).
  if (!ctx) return { dossierId: null, open: () => {}, close: () => {} } as Ctx;
  return ctx;
}
