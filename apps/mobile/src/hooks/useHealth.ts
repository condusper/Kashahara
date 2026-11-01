import { useCallback, useEffect, useState } from 'react';
import { healthApi } from '../lib/api';

export type HealthState = Awaited<ReturnType<typeof healthApi.get>>;

let cached: HealthState | null = null;
let inflight: Promise<HealthState> | null = null;

async function loadHealth(): Promise<HealthState> {
  if (cached) return cached;
  if (!inflight) {
    inflight = healthApi
      .get()
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useHealth() {
  const [health, setHealth] = useState<HealthState | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);

  const reload = useCallback(async () => {
    cached = null;
    setLoading(true);
    try {
      const result = await loadHealth();
      setHealth(result);
      setError(null);
    } catch {
      setError('Could not reach the Kashahara API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadHealth()
      .then((result) => {
        if (active) {
          setHealth(result);
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Could not reach the Kashahara API.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { health, error, loading, reload };
}
