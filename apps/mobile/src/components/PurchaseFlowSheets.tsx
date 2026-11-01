import React from 'react';
import { useRouter, type Href } from 'expo-router';
import type { PurchaseFlow } from '../hooks/usePurchaseFlow';
import { PinSheet } from './PinSheet';
import { PurchaseResultSheet } from './PurchaseResultSheet';

export interface PurchaseFlowSheetsProps {
  flow: PurchaseFlow;
  onForgotPin?: () => void;
}

export function PurchaseFlowSheets({ flow, onForgotPin }: PurchaseFlowSheetsProps) {
  const router = useRouter();

  return (
    <>
      <PinSheet
        visible={flow.pinVisible}
        onClose={flow.closePin}
        onConfirm={(pin) => void flow.confirm(pin)}
        onForgot={onForgotPin}
        summary={flow.confirmation?.summary}
        error={flow.pinError}
        loading={flow.submitting}
      />
      <PurchaseResultSheet
        visible={Boolean(flow.result)}
        transaction={flow.result}
        onClose={flow.closeResult}
        onViewReceipt={(id) => {
          flow.closeResult();
          router.push(`/transaction/${id}` as Href);
        }}
      />
    </>
  );
}
