import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'yb_nudge_dismissed_v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type DismissMap = Record<string, number>;

function read(): DismissMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function write(map: DismissMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * Tracks dismissal of a contextual nudge for 7 days.
 * Returns `[visible, dismiss]`.
 */
export function useDismissibleNudge(id: string, enabled = true) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }
    const map = read();
    const ts = map[id];
    if (!ts || Date.now() - ts > SEVEN_DAYS_MS) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [id, enabled]);

  const dismiss = useCallback(() => {
    const map = read();
    map[id] = Date.now();
    write(map);
    setVisible(false);
  }, [id]);

  return [visible, dismiss] as const;
}
