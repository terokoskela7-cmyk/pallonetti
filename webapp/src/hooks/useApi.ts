// ============================================
// REACT HOOKS FOR API DATA
// ============================================
import { useState, useEffect, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Generic data fetch hook */
export function useApi<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/** Hook with auto-refresh interval */
export function useApiWithRefresh<T>(
  fetchFn: () => Promise<T>,
  refreshMs: number = 300000, // 5 min default
  deps: unknown[] = []
): UseApiState<T> {
  const state = useApi(fetchFn, deps);

  useEffect(() => {
    const interval = setInterval(() => {
      state.refetch();
    }, refreshMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, state.refetch]);

  return state;
}
