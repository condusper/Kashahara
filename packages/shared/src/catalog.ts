import { NETWORK_PREFIXES } from './phone';
import { DEFAULT_AIRTIME_FEE } from './fees';
import type {
  CablePackage,
  CableProvider,
  Catalog,
  DataPlan,
  ElectricityBiller,
  ExamProduct,
  Network,
  NetworkOption,
} from './types';

/**
 * Bundled product catalogue.
 *
 * The API serves the authoritative catalogue at runtime; this bundled copy
 * keeps the app usable when the device is offline. Items are marked with
 * `isDemo` internally so the server can tell bundled data from supplier data.
 */
export const CATALOG_VERSION = '2026.10.1';
export const CATALOG_NOTICE =
  'Products and prices are updated regularly. Availability and delivery times vary by network and provider.';

export const NETWORKS: readonly NetworkOption[] = [
  {
    id: 'MTN',
    name: 'MTN Nigeria',
    shortName: 'MTN',
    color: '#FFCB05',
    prefixes: NETWORK_PREFIXES.MTN,
    isDemo: true,
  },
  {
    id: 'GLO',
    name: 'Globacom',
    shortName: 'Glo',
    color: '#50B848',
    prefixes: NETWORK_PREFIXES.GLO,
    isDemo: true,
  },
  {
    id: 'AIRTEL',
    name: 'Airtel Nigeria',
    shortName: 'Airtel',
    color: '#E40000',
    prefixes: NETWORK_PREFIXES.AIRTEL,
    isDemo: true,
  },
  {
    id: '9MOBILE',
    name: '9mobile',
    shortName: '9mobile',
    color: '#006B53',
    prefixes: NETWORK_PREFIXES['9MOBILE'],
    isDemo: true,
  },
];

function dataPlan(
  network: Network,
  slug: string,
  name: string,
  allowance: string,
  validity: string,
  priceKobo: number,
  category: DataPlan['category'],
): DataPlan {
  return {
    id: `${network.toLowerCase()}-${slug}`,
    network,
    name,
    allowance,
    validity,
    priceKobo,
    category,
    isDemo: true,
  };
}

export const DATA_PLANS: readonly DataPlan[] = [
  dataPlan('MTN', '500mb-30d', '500MB Everyday', '500MB', '30 days', 35000, 'SME'),
  dataPlan('MTN', '1gb-30d', '1GB Everyday', '1GB', '30 days', 70000, 'SME'),
  dataPlan('MTN', '2gb-30d', '2GB Everyday', '2GB', '30 days', 140000, 'SME'),
  dataPlan('MTN', '3gb-30d', '3GB Everyday', '3GB', '30 days', 200000, 'Corporate'),
  dataPlan('MTN', '10gb-30d', '10GB Everyday', '10GB', '30 days', 500000, 'Corporate'),
  dataPlan('MTN', '20gb-30d', '20GB Everyday', '20GB', '30 days', 900000, 'Gifting'),

  dataPlan('GLO', '500mb-30d', '500MB Glo Lite', '500MB', '30 days', 30000, 'SME'),
  dataPlan('GLO', '1gb-30d', '1GB Glo Lite', '1GB', '30 days', 60000, 'SME'),
  dataPlan('GLO', '2gb-30d', '2GB Glo Lite', '2GB', '30 days', 120000, 'SME'),
  dataPlan('GLO', '3gb-30d', '3GB Glo Lite', '3GB', '30 days', 180000, 'Corporate'),
  dataPlan('GLO', '10gb-30d', '10GB Glo Lite', '10GB', '30 days', 450000, 'Corporate'),
  dataPlan('GLO', '20gb-30d', '20GB Glo Lite', '20GB', '30 days', 850000, 'Gifting'),

  dataPlan('AIRTEL', '500mb-30d', '500MB Smart', '500MB', '30 days', 40000, 'SME'),
  dataPlan('AIRTEL', '1gb-30d', '1GB Smart', '1GB', '30 days', 80000, 'SME'),
  dataPlan('AIRTEL', '2gb-30d', '2GB Smart', '2GB', '30 days', 150000, 'SME'),
  dataPlan('AIRTEL', '3gb-30d', '3GB Smart', '3GB', '30 days', 220000, 'Corporate'),
  dataPlan('AIRTEL', '10gb-30d', '10GB Smart', '10GB', '30 days', 550000, 'Corporate'),
  dataPlan('AIRTEL', '20gb-30d', '20GB Smart', '20GB', '30 days', 1000000, 'Gifting'),

  dataPlan('9MOBILE', '500mb-30d', '500MB Moreblaze', '500MB', '30 days', 35000, 'SME'),
  dataPlan('9MOBILE', '1gb-30d', '1GB Moreblaze', '1GB', '30 days', 70000, 'SME'),
  dataPlan('9MOBILE', '2gb-30d', '2GB Moreblaze', '2GB', '30 days', 130000, 'SME'),
  dataPlan('9MOBILE', '3gb-30d', '3GB Moreblaze', '3GB', '30 days', 190000, 'Corporate'),
  dataPlan('9MOBILE', '10gb-30d', '10GB Moreblaze', '10GB', '30 days', 480000, 'Corporate'),
  dataPlan('9MOBILE', '20gb-30d', '20GB Moreblaze', '20GB', '30 days', 920000, 'Gifting'),
];

export const ELECTRICITY_BILLERS: readonly ElectricityBiller[] = [
  {
    id: 'ikedc',
    name: 'Ikeja Electric',
    shortName: 'IKEDC',
    state: 'Lagos',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'ekedc',
    name: 'Eko Electricity Distribution',
    shortName: 'EKEDC',
    state: 'Lagos',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'aedc',
    name: 'Abuja Electricity Distribution',
    shortName: 'AEDC',
    state: 'FCT',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'phed',
    name: 'Port Harcourt Electricity Distribution',
    shortName: 'PHED',
    state: 'Rivers',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'kedco',
    name: 'Kano Electricity Distribution',
    shortName: 'KEDCO',
    state: 'Kano',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'jed',
    name: 'Jos Electricity Distribution',
    shortName: 'JED',
    state: 'Plateau',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'ibedc',
    name: 'Ibadan Electricity Distribution',
    shortName: 'IBEDC',
    state: 'Oyo',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'eedc',
    name: 'Enugu Electricity Distribution',
    shortName: 'EEDC',
    state: 'Enugu',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
  {
    id: 'bedc',
    name: 'Benin Electricity Distribution',
    shortName: 'BEDC',
    state: 'Edo',
    meterTypes: ['prepaid', 'postpaid'],
    isDemo: true,
  },
];

function cablePackage(
  id: string,
  name: string,
  priceKobo: number,
  validity: string,
  description: string,
): CablePackage {
  return { id, name, priceKobo, validity, description, isDemo: true };
}

export const CABLE_PROVIDERS: readonly CableProvider[] = [
  {
    id: 'dstv',
    name: 'DStv',
    shortName: 'DStv',
    isDemo: true,
    packages: [
      cablePackage('dstv-padi', 'DStv Padi', 440000, '1 month', 'Entry-level entertainment'),
      cablePackage('dstv-yanga', 'DStv Yanga', 600000, '1 month', 'Family entertainment'),
      cablePackage('dstv-confam', 'DStv Confam', 1100000, '1 month', 'More channels and sport'),
      cablePackage('dstv-compact', 'DStv Compact', 1900000, '1 month', 'Popular entertainment bundle'),
      cablePackage('dstv-compact-plus', 'DStv Compact Plus', 3000000, '1 month', 'Premium sport and entertainment'),
      cablePackage('dstv-premium', 'DStv Premium', 4450000, '1 month', 'Full premium lineup'),
    ],
  },
  {
    id: 'gotv',
    name: 'GOtv',
    shortName: 'GOtv',
    isDemo: true,
    packages: [
      cablePackage('gotv-smallie', 'GOtv Smallie', 190000, '1 month', 'Compact starter package'),
      cablePackage('gotv-jinja', 'GOtv Jinja', 390000, '1 month', 'Family package'),
      cablePackage('gotv-jolli', 'GOtv Jolli', 570000, '1 month', 'Entertainment and sport'),
      cablePackage('gotv-max', 'GOtv Max', 850000, '1 month', 'Expanded entertainment'),
      cablePackage('gotv-supa', 'GOtv Supa', 1150000, '1 month', 'Largest GOtv package'),
    ],
  },
  {
    id: 'startimes',
    name: 'StarTimes',
    shortName: 'StarTimes',
    isDemo: true,
    packages: [
      cablePackage('startimes-nova', 'Nova', 210000, '1 month', 'News and basic entertainment'),
      cablePackage('startimes-basic', 'Basic', 370000, '1 month', 'Family entertainment'),
      cablePackage('startimes-smart', 'Smart', 470000, '1 month', 'Entertainment and sport'),
      cablePackage('startimes-classic', 'Classic', 550000, '1 month', 'Expanded channel lineup'),
      cablePackage('startimes-super', 'Super', 900000, '1 month', 'Full StarTimes lineup'),
    ],
  },
  {
    id: 'showmax',
    name: 'Showmax',
    shortName: 'Showmax',
    isDemo: true,
    packages: [
      cablePackage('showmax-entertainment', 'Showmax Entertainment', 320000, '1 month', 'Series, movies, and originals'),
      cablePackage('showmax-premier-league', 'Showmax Premier League', 350000, '1 month', 'Live Premier League football'),
      cablePackage('showmax-full', 'Showmax Full', 650000, '1 month', 'Entertainment and Premier League'),
    ],
  },
];

export const EXAM_PRODUCTS: readonly ExamProduct[] = [
  {
    id: 'waec-result-checker',
    name: 'WAEC Result Checker',
    provider: 'WAEC',
    description: 'Result checker e-voucher with serial number and PIN.',
    priceKobo: 350000,
    isDemo: true,
  },
  {
    id: 'waec-registration',
    name: 'WAEC Registration PIN',
    provider: 'WAEC',
    description: 'Registration e-voucher for the West African Senior School Certificate Examination.',
    priceKobo: 3000000,
    isDemo: true,
  },
  {
    id: 'neco-result-checker',
    name: 'NECO Result Checker',
    provider: 'NECO',
    description: 'NECO result checker token for candidate results.',
    priceKobo: 300000,
    isDemo: true,
  },
  {
    id: 'nabteb-result-checker',
    name: 'NABTEB Result Checker',
    provider: 'NABTEB',
    description: 'NABTEB result checker e-voucher.',
    priceKobo: 300000,
    isDemo: true,
  },
  {
    id: 'jamb-epin',
    name: 'JAMB ePIN',
    provider: 'JAMB',
    description: 'UTME registration ePIN. Availability is subject to supplier support.',
    priceKobo: 770000,
    isDemo: true,
  },
];

export const CATALOG: Catalog = {
  version: CATALOG_VERSION,
  notice: CATALOG_NOTICE,
  networks: NETWORKS,
  dataPlans: DATA_PLANS,
  electricityBillers: ELECTRICITY_BILLERS,
  cableProviders: CABLE_PROVIDERS,
  examProducts: EXAM_PRODUCTS,
  airtimeFee: DEFAULT_AIRTIME_FEE,
  isDemo: true,
};

export function getDataPlan(network: Network, planId: string): DataPlan | undefined {
  return DATA_PLANS.find((plan) => plan.network === network && plan.id === planId);
}

export function getElectricityBiller(billerId: string): ElectricityBiller | undefined {
  return ELECTRICITY_BILLERS.find((biller) => biller.id === billerId);
}

export function getCableProvider(providerId: string): CableProvider | undefined {
  return CABLE_PROVIDERS.find((provider) => provider.id === providerId);
}

export function getCablePackage(
  providerId: string,
  packageId: string,
): CablePackage | undefined {
  return getCableProvider(providerId)?.packages.find((item) => item.id === packageId);
}

export function getExamProduct(productId: string): ExamProduct | undefined {
  return EXAM_PRODUCTS.find((product) => product.id === productId);
}

export function dataPlansForNetwork(network: Network): DataPlan[] {
  return DATA_PLANS.filter((plan) => plan.network === network);
}
