import { useCallback, useEffect, useState } from 'react';
import { CATALOG, type Catalog } from '@kashahara/shared';
import { catalogApi } from '../lib/api';

export interface CatalogState {
  catalog: Catalog;
  provider: { name: string; simulated: boolean };
  notice: string;
  version: string;
  source: 'api' | 'bundled';
}

const bundled: CatalogState = {
  catalog: CATALOG,
  provider: { name: 'mock', simulated: true },
  notice: CATALOG.notice,
  version: CATALOG.version,
  source: 'bundled',
};

let cached: CatalogState | null = null;
let inflight: Promise<CatalogState> | null = null;

async function loadCatalog(): Promise<CatalogState> {
  if (cached) return cached;
  if (!inflight) {
    inflight = catalogApi
      .get()
      .then((result) => {
        const state: CatalogState = {
          catalog: result.catalog,
          provider: result.provider,
          notice: result.notice,
          version: result.version,
          source: 'api',
        };
        cached = state;
        return state;
      })
      .catch(() => {
        // The bundled catalogue keeps the UI usable when the API is offline.
        cached = bundled;
        return bundled;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useCatalog() {
  const [state, setState] = useState<CatalogState>(cached ?? bundled);
  const [loading, setLoading] = useState(!cached);

  const reload = useCallback(async () => {
    cached = null;
    setLoading(true);
    try {
      setState(await loadCatalog());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((result) => {
        if (active) setState(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...state, loading, reload };
}
