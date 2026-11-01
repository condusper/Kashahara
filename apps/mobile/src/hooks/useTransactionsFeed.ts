import { useCallback, useEffect, useRef, useState } from 'react';
import type { Transaction, TransactionType } from '@kashahara/shared';
import { errorMessage, transactionsApi } from '../lib/api';

export type TransactionFilter = TransactionType | 'all';

export function useTransactionsFeed(initialFilter: TransactionFilter = 'all') {
  const [filter, setFilterState] = useState<TransactionFilter>(initialFilter);
  const [items, setItems] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(
    async (mode: 'reset' | 'more') => {
      const request = ++requestRef.current;
      try {
        const page = await transactionsApi.list({
          type: filter === 'all' ? undefined : filter,
          limit: 20,
          cursor: mode === 'more' ? nextCursor : undefined,
        });
        if (request !== requestRef.current) return;
        setItems((current) => (mode === 'reset' ? page.items : [...current, ...page.items]));
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (loadError) {
        if (request !== requestRef.current) return;
        setError(errorMessage(loadError));
      } finally {
        if (request === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filter, nextCursor],
  );

  useEffect(() => {
    // State is only updated after the list request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load('reset');
    // Re-run whenever the filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const setFilter = useCallback(
    (nextFilter: TransactionFilter) => {
      if (filter === nextFilter) return;
      setLoading(true);
      setError(null);
      setFilterState(nextFilter);
    },
    [filter],
  );

  const loadMore = useCallback(() => {
    if (nextCursor && !loadingMore && !loading) {
      setLoadingMore(true);
      void load('more');
    }
  }, [nextCursor, loadingMore, loading, load]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return load('reset');
  }, [load]);

  const replaceTransaction = useCallback((updated: Transaction) => {
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }, []);

  return {
    filter,
    setFilter,
    items,
    nextCursor,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
    replaceTransaction,
  };
}
