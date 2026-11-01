import { useCallback, useEffect, useRef, useState } from 'react';
import type { Transaction } from '@kashahara/shared';
import { errorMessage, isApiError, newIdempotencyKey, type PurchaseResponse } from '../lib/api';
import { useAuth } from '../providers/AuthProvider';
import { useToast } from '../providers/ToastProvider';

export type PurchaseRunner = (pin: string, idempotencyKey: string) => Promise<PurchaseResponse>;

export interface PurchaseSummaryRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface PurchaseConfirmation {
  /** Details shown before the PIN is entered, including fees and total debit. */
  summary?: readonly PurchaseSummaryRow[];
}

export interface PurchaseFlowOptions {
  onPinRequired?: () => void;
  onInsufficientFunds?: () => void;
}

export interface PurchaseFlow {
  pinVisible: boolean;
  pinError: string | null;
  submitting: boolean;
  result: Transaction | null;
  simulated: boolean;
  confirmation: PurchaseConfirmation | null;
  start: (runner: PurchaseRunner, confirmation?: PurchaseConfirmation) => void;
  confirm: (pin: string) => Promise<void>;
  closePin: () => void;
  closeResult: () => void;
  resetKey: () => void;
}

/**
 * Shared purchase orchestration for every service screen.
 *
 * The idempotency key is created once when the user starts a purchase and is
 * reused for retries of that same logical attempt. Changing the form resets the
 * key, so a new order can never replay an old response.
 */
export function usePurchaseFlow(options: PurchaseFlowOptions = {}): PurchaseFlow {
  const { setWallet } = useAuth();
  const toast = useToast();
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const runnerRef = useRef<PurchaseRunner | null>(null);
  const keyRef = useRef<string | null>(null);
  const [pinVisible, setPinVisible] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Transaction | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [confirmation, setConfirmation] = useState<PurchaseConfirmation | null>(null);

  const resetKey = useCallback(() => {
    keyRef.current = null;
  }, []);

  const start = useCallback((runner: PurchaseRunner, nextConfirmation?: PurchaseConfirmation) => {
    runnerRef.current = runner;
    keyRef.current = newIdempotencyKey('purchase');
    setPinError(null);
    setConfirmation(nextConfirmation ?? null);
    setPinVisible(true);
  }, []);

  const closePin = useCallback(() => {
    setPinVisible(false);
    setPinError(null);
    setConfirmation(null);
  }, []);

  const closeResult = useCallback(() => {
    setResult(null);
    setPinError(null);
    setConfirmation(null);
    keyRef.current = null;
  }, []);

  const confirm = useCallback(
    async (pin: string) => {
      const runner = runnerRef.current;
      if (!runner || submitting) return;
      const key = keyRef.current ?? newIdempotencyKey('purchase');
      keyRef.current = key;
      setSubmitting(true);
      setPinError(null);
      try {
        const response = await runner(pin, key);
        setWallet(response.wallet);
        setPinVisible(false);
        setResult(response.transaction);
        setSimulated(response.simulated);
        keyRef.current = null;
        if (response.transaction.status === 'successful') {
          toast.success('Purchase complete', 'Your receipt is ready.');
        } else if (response.transaction.status === 'uncertain') {
          toast.info(
            'Status uncertain',
            'We kept the debit in place to avoid a double charge. Check the receipt before retrying.',
          );
        } else if (response.transaction.status === 'refunded') {
          toast.info('Refunded to wallet', 'The supplier declined the order.');
        }
      } catch (error) {
        if (isApiError(error) && error.code === 'INVALID_PIN') {
          setPinError('Incorrect transaction PIN. Try again.');
        } else if (isApiError(error) && error.code === 'PIN_REQUIRED') {
          setPinVisible(false);
          toast.info('Set a transaction PIN', 'You need a PIN before making a purchase.');
          optionsRef.current.onPinRequired?.();
        } else if (isApiError(error) && error.code === 'INSUFFICIENT_FUNDS') {
          setPinVisible(false);
          toast.error('Insufficient balance', 'Add money to your wallet and try again.');
          optionsRef.current.onInsufficientFunds?.();
        } else if (
          isApiError(error) &&
          (error.code === 'NETWORK_TIMEOUT' || error.code === 'NETWORK_ERROR')
        ) {
          setPinError(
            `${error.message} Your request key is safe to reuse — tap confirm to check the same order again.`,
          );
        } else {
          setPinError(errorMessage(error));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [setWallet, submitting, toast],
  );

  return {
    pinVisible,
    pinError,
    submitting,
    result,
    simulated,
    confirmation,
    start,
    confirm,
    closePin,
    closeResult,
    resetKey,
  };
}
