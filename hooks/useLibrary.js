import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { loadLibrary, deleteScan as removeScan } from '../services/library';

/**
 * Manages local scan library state for the Style Library screen.
 * Reloads automatically whenever the screen regains focus so newly-saved
 * scans appear without manual refresh.
 */
export function useLibrary() {
  const [scans, setScans]   = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      setLoading(true);
      loadLibrary().then(data => {
        if (live) {
          setScans(data);
          setLoading(false);
        }
      });
      return () => { live = false; };
    }, [])
  );

  const remove = useCallback(async (id) => {
    const ok = await removeScan(id);
    if (ok) setScans(prev => prev.filter(s => s.id !== id));
    return ok;
  }, []);

  return { scans, loading, remove };
}
