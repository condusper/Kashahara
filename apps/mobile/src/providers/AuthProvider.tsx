import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { UserProfile, WalletSummary } from '@kashahara/shared';
import { authApi, isApiError, walletApi } from '../lib/api';
import { clearTokens, getRefreshToken, loadTokens, saveTokens } from '../lib/tokens';

export type AuthStatus = 'loading' | 'guest' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  wallet: WalletSummary | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  setWallet: (wallet: WalletSummary) => void;
  setUser: (user: UserProfile) => void;
  updateProfile: (input: {
    fullName?: string;
    email?: string;
    phone?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [wallet, setWalletState] = useState<WalletSummary | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const tokens = await loadTokens();
      if (!tokens.accessToken && !tokens.refreshToken) {
        if (active) setStatus('guest');
        return;
      }
      try {
        const me = await authApi.me();
        if (!active) return;
        setUserState(me.user);
        setWalletState(me.wallet);
        setStatus('authenticated');
      } catch (error) {
        if (!active) return;
        if (isApiError(error) && (error.status === 401 || error.code === 'UNAUTHORIZED')) {
          await clearTokens();
        }
        setStatus('guest');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const session = await authApi.login({ identifier, password });
    await saveTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    setUserState(session.user);
    setWalletState(session.wallet);
    setStatus('authenticated');
  }, []);

  const signUp = useCallback(
    async (input: { fullName: string; email: string; phone: string; password: string }) => {
      const session = await authApi.register(input);
      await saveTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
      setUserState(session.user);
      setWalletState(session.wallet);
      setStatus('authenticated');
    },
    [],
  );

  const clearLocalSession = useCallback(async () => {
    await clearTokens();
    setUserState(null);
    setWalletState(null);
    setStatus('guest');
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // The local session must still be cleared if the API is unreachable.
      }
    }
    await clearLocalSession();
  }, [clearLocalSession]);

  const signOutEverywhere = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } catch {
      // Clear locally even if the API call fails.
    }
    await clearLocalSession();
  }, [clearLocalSession]);

  const refresh = useCallback(async () => {
    const me = await authApi.me();
    setUserState(me.user);
    setWalletState(me.wallet);
    setStatus('authenticated');
  }, []);

  const refreshWallet = useCallback(async () => {
    const result = await walletApi.get();
    setWalletState(result.wallet);
  }, []);

  const setWallet = useCallback((next: WalletSummary) => {
    setWalletState(next);
  }, []);

  const setUser = useCallback((next: UserProfile) => {
    setUserState(next);
  }, []);

  const updateProfile = useCallback(
    async (input: { fullName?: string; email?: string; phone?: string }) => {
      const result = await authApi.updateProfile(input);
      setUserState(result.user);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      wallet,
      signIn,
      signUp,
      signOut,
      signOutEverywhere,
      refresh,
      refreshWallet,
      setWallet,
      setUser,
      updateProfile,
    }),
    [
      status,
      user,
      wallet,
      signIn,
      signUp,
      signOut,
      signOutEverywhere,
      refresh,
      refreshWallet,
      setWallet,
      setUser,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
