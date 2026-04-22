import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Generic data-fetching hook.
 *
 * @param {() => Promise<any>} fetchFn  Async function that returns data.
 * @param {any[]}              deps     Re-fetch when these change (default []).
 *
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err.response?.data?.detail || err.message || "An error occurred",
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => {
      mountedRef.current = false;
    };
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

export default useApi;
