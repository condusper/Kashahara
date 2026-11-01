import { useCallback, useEffect, useState } from 'react';
import type { Transaction, WalletSummary } from '@kashahara/shared';
import { errorMessage, transactionsApi } from '../lib/api';

export function useTransaction(id: string | undefined) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(id ? null : 'Transaction not found.');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await transactionsApi.get(id);
      setTransaction(result.transaction);
      setWallet(result.wallet);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Data is fetched in an effect, and state is only updated after the request
    // resolves. The rule cannot see across the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reload = useCallback(() => {
    if (!id) return Promise.resolve();
    setLoading(true);
    return load();
  }, [id, load]);

  const refresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const result = await transactionsApi.refresh(id);
      setTransaction(result.transaction);
      setWallet(result.wallet);
      setError(null);
      return result;
    } catch (refreshError) {
      setError(errorMessage(refreshError));
      throw refreshError;
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  return { transaction, wallet, loading, refreshing, error, refresh, reload };
}
