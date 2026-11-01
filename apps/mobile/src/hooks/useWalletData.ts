import { useCallback, useEffect, useState } from 'react';
import type { LedgerEntry, WalletSummary } from '@kashahara/shared';
import { errorMessage, walletApi } from '../lib/api';

export interface WalletData {
  wallet: WalletSummary;
  ledger: LedgerEntry[];
  reconciliation: {
    walletBalanceKobo: number;
    ledgerBalanceKobo: number;
    matches: boolean;
  };
}

export function useWalletData(onWallet?: (wallet: WalletSummary) => void) {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State that signals a request is in flight is set by the caller. The effect
  // below only updates state after the request resolves, which avoids a
  // synchronous cascading render on mount.
  const load = useCallback(async () => {
    try {
      const result = await walletApi.get();
      setData(result);
      setError(null);
      onWallet?.(result.wallet);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onWallet]);

  useEffect(() => {
    // State is only updated after the wallet request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    return load();
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload,
    refresh,
  };
}
