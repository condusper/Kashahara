import { randomDigits } from '../crypto';
import type {
  CableVerification,
  MeterVerification,
  ProviderPurchaseResult,
  ProviderStatusResult,
} from '../types';
import {
  ProviderRejectedError,
  ProviderTimeoutError,
  type AirtimeRequest,
  type CablePurchaseRequest,
  type CableVerifyRequest,
  type DataRequest,
  type ElectricityRequest,
  type ExamRequest,
  type MeterRequest,
  type VtuProvider,
} from './types';

function inspectIdentifier(value: string): 'success' | 'declined' | 'timeout' {
  const digits = value.replace(/\D/g, '');
  if (digits.endsWith('0000')) return 'declined';
  if (digits.endsWith('9999')) return 'timeout';
  return 'success';
}

function assertNotSimulatedFailure(identifier: string): void {
  const outcome = inspectIdentifier(identifier);
  if (outcome === 'declined') {
    throw new ProviderRejectedError(
      'The provider declined this request. Check the number and try again.',
      { raw: { simulated: true, outcome } },
    );
  }
  if (outcome === 'timeout') {
    throw new ProviderTimeoutError(
      'The provider did not respond in time. The debit is held pending reconciliation.',
      { raw: { simulated: true, outcome } },
    );
  }
}

const customerNames = [
  'Adaeze Okafor',
  'Chinedu Balogun',
  'Fatima Bello',
  'Emeka Nwosu',
  'Aisha Lawal',
  'Tunde Adeyemi',
  'Ngozi Eze',
  'Ibrahim Musa',
];

const customerAddresses = [
  '12 Adeola Odeku Street, Victoria Island, Lagos',
  '48 Ozumba Mbadiwe Avenue, Ikoyi, Lagos',
  '7 Ademola Adetokunbo Crescent, Wuse II, Abuja',
  '23 Rumuola Road, Port Harcourt, Rivers',
  '16 Awolowo Road, Ikoyi, Lagos',
];

function pick<T>(items: readonly T[], seed: string): T {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1_000_003;
  }
  return items[hash % items.length]!;
}

/**
 * Local supplier adapter for development and automated tests. It never
 * contacts an external supplier, but every response is shaped exactly like a
 * live adapter so the rest of the system exercises the real code paths.
 */
export class MockVtuProvider implements VtuProvider {
  readonly name = 'mock';
  readonly isSimulated = true;

  private success(reference: string, message: string): ProviderPurchaseResult {
    return {
      providerReference: `SP-${randomDigits(10)}`,
      message,
      raw: { simulated: true, reference },
      simulated: true,
    };
  }

  async purchaseAirtime(request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    assertNotSimulatedFailure(request.phone);
    return this.success(
      request.reference,
      `Airtime delivered to ${request.phone} on ${request.network}.`,
    );
  }

  async purchaseData(request: DataRequest): Promise<ProviderPurchaseResult> {
    assertNotSimulatedFailure(request.phone);
    return this.success(
      request.reference,
      `${request.planName} data bundle activated on ${request.phone}.`,
    );
  }

  async verifyMeter(request: MeterRequest): Promise<MeterVerification> {
    assertNotSimulatedFailure(request.meterNumber);
    return {
      customerName: pick(customerNames, request.meterNumber),
      customerAddress: pick(customerAddresses, request.meterNumber),
      meterNumber: request.meterNumber,
      meterType: request.meterType,
      billerId: request.billerId,
      isDemo: true,
    };
  }

  async purchaseElectricity(request: ElectricityRequest): Promise<ProviderPurchaseResult> {
    assertNotSimulatedFailure(request.meterNumber);
    const token = randomDigits(20);
    return {
      ...this.success(request.reference, 'Electricity units have been loaded on your meter.'),
      token,
      units: `${(request.amountKobo / 62_000).toFixed(1)} kWh`,
    };
  }

  async verifyCable(request: CableVerifyRequest): Promise<CableVerification> {
    assertNotSimulatedFailure(request.smartcardNumber);
    return {
      customerName: pick(customerNames, request.smartcardNumber),
      smartcardNumber: request.smartcardNumber,
      providerId: request.providerId,
      currentPackage: null,
      isDemo: true,
    };
  }

  async purchaseCable(request: CablePurchaseRequest): Promise<ProviderPurchaseResult> {
    assertNotSimulatedFailure(request.smartcardNumber);
    return this.success(
      request.reference,
      `${request.packageName} subscription renewed successfully.`,
    );
  }

  async purchaseExam(request: ExamRequest): Promise<ProviderPurchaseResult> {
    const vouchers = Array.from({ length: request.quantity }, () => ({
      pin: randomDigits(12),
      serial: randomDigits(10),
    }));
    return {
      ...this.success(
        request.reference,
        `${request.quantity === 1 ? 'Voucher' : 'Vouchers'} issued successfully.`,
      ),
      vouchers,
    };
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    if (providerReference.toUpperCase().includes('FAIL')) {
      return {
        state: 'failed',
        providerReference,
        message: 'The supplier reports that the order failed.',
      };
    }
    return {
      state: 'successful',
      providerReference,
      message: 'The supplier reports that the order succeeded.',
    };
  }
}
