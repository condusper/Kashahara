import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { FundingAttempt, Transaction } from '@kashahara/shared';
import {
  fundingReceipt,
  transactionReceipt,
  type ReceiptFile,
  type ReceiptIdentity,
  type ReceiptModel,
} from '../lib/receipt';
import { ReceiptDocument, RECEIPT_WIDTH } from '../components/ReceiptDocument';

/** Pixel width of the exported PNG. 1080 keeps text crisp when shared. */
const OUTPUT_WIDTH = 1080;

interface ReceiptContextValue {
  downloadTransaction: (
    transaction: Transaction,
    identity?: ReceiptIdentity,
  ) => Promise<ReceiptFile>;
  downloadFunding: (
    attempt: FundingAttempt,
    identity?: ReceiptIdentity,
  ) => Promise<ReceiptFile>;
}

const ReceiptContext = createContext<ReceiptContextValue | null>(null);

export function ReceiptProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<ReceiptModel | null>(null);
  const viewRef = useRef<React.ComponentRef<typeof View>>(null);
  const heightRef = useRef(0);
  const layoutWaiter = useRef<(() => void) | null>(null);
  const busy = useRef(false);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) heightRef.current = height;
    const resolve = layoutWaiter.current;
    if (resolve) {
      layoutWaiter.current = null;
      resolve();
    }
  }, []);

  /**
   * Resolves once the hidden receipt has been laid out. Falls back to a short
   * timer because React Native only fires `onLayout` when the size changes.
   */
  const waitForLayout = useCallback(
    () =>
      new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (layoutWaiter.current === finish) layoutWaiter.current = null;
          resolve();
        };
        const timer = setTimeout(finish, 220);
        layoutWaiter.current = finish;
      }),
    [],
  );

  const capture = useCallback(async (next: ReceiptModel): Promise<ReceiptFile> => {
    if (busy.current) {
      throw new Error('A receipt is already being prepared. Please wait a moment.');
    }
    busy.current = true;

    try {
      heightRef.current = 0;
      setModel(next);
      await waitForLayout();
      // Give the native view one more frame to draw before capturing it.
      await new Promise<void>((resolve) => setTimeout(resolve, 40));

      const node = viewRef.current;
      if (!node) throw new Error('The receipt is still rendering. Please try again.');

      const logicalHeight = heightRef.current;
      if (!logicalHeight) {
        throw new Error('The receipt is still rendering. Please try again.');
      }

      const base64 = await captureRef(node, {
        format: 'png',
        quality: 1,
        result: 'base64',
        width: OUTPUT_WIDTH,
        height: Math.max(1, Math.round((logicalHeight * OUTPUT_WIDTH) / RECEIPT_WIDTH)),
      });

      if (!base64) throw new Error('The receipt image could not be created.');

      // `Paths.document` is inside the app's scoped storage, which Expo Go is
      // allowed to share. The view-shot tmpfile lives in the host cache and is
      // rejected by the scoped permission module, so we write it ourselves.
      const file = new File(Paths.document, next.filename);
      file.create({ overwrite: true, intermediates: true });
      await file.write(base64, { encoding: 'base64' });

      let shared = false;
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'image/png',
            UTI: 'public.png',
            dialogTitle: 'Save your receipt',
          });
          shared = true;
        }
      } catch {
        // The PNG is already saved; let the caller offer a "saved" message.
      }

      return { uri: file.uri, shared, saved: true };
    } finally {
      busy.current = false;
      setModel(null);
    }
  }, [waitForLayout]);

  const value = useMemo<ReceiptContextValue>(
    () => ({
      downloadTransaction: (transaction, identity) =>
        capture(transactionReceipt(transaction, identity)),
      downloadFunding: (attempt, identity) => capture(fundingReceipt(attempt, identity)),
    }),
    [capture],
  );

  return (
    <ReceiptContext.Provider value={value}>
      {children}
      <View
        ref={viewRef}
        collapsable={false}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={handleLayout}
        style={styles.hidden}
      >
        {model ? <ReceiptDocument model={model} /> : null}
      </View>
    </ReceiptContext.Provider>
  );
}

export function useReceipt(): ReceiptContextValue {
  const value = useContext(ReceiptContext);
  if (!value) throw new Error('useReceipt must be used inside ReceiptProvider');
  return value;
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: 0,
    left: -RECEIPT_WIDTH - 80,
    width: RECEIPT_WIDTH,
  },
});
