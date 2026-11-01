import { Pool } from 'pg';
import { loadConfig } from './config';
import { poolConfig } from './database';
import { hashSecret, newId } from './crypto';
import { logger } from './logger';
import { PaystackClient } from './paystack';
import { PostgresStore } from './store/postgres';
import { WalletService } from './services/wallet';
import type { TransactionRecord } from './types';

const DEMO_EMAIL = 'demo@kashahara.test';
const DEMO_PHONE = '08031234567';
const DEMO_PASSWORD = 'DemoPass123!';
const DEMO_PIN = '1234';

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.env === 'production') {
    throw new Error('Refusing to seed demo data in production.');
  }
  if (!config.databaseUrl) {
    throw new Error(
      'DATABASE_URL is required to seed PostgreSQL. Start PostgreSQL, run migrations, then retry.',
    );
  }

  const pool = new Pool(poolConfig(config.databaseUrl, 2));
  const store = new PostgresStore(pool);
  const paystack = new PaystackClient({
    secretKey: null,
    baseUrl: config.paystackBaseUrl,
  });
  const wallet = new WalletService(store, config, paystack);
  const at = new Date();

  try {
    let user = await store.findUserByEmail(DEMO_EMAIL);
    if (!user) {
      const passwordHash = await hashSecret(DEMO_PASSWORD);
      const pinHash = await hashSecret(DEMO_PIN);
      user = await store.transaction(async (tx) => {
        const created = await tx.createUser({
          id: newId(),
          fullName: 'Ada Okafor',
          email: DEMO_EMAIL,
          phone: DEMO_PHONE,
          passwordHash,
          transactionPinHash: pinHash,
          emailVerified: true,
          phoneVerified: true,
          createdAt: at,
          updatedAt: at,
        });
        await tx.createWallet({
          id: newId(),
          userId: created.id,
          balanceKobo: 0,
          currency: 'NGN',
          updatedAt: at,
        });
        return created;
      });
      logger.info('Created demo user', { email: DEMO_EMAIL });
    }
    if (!user) throw new Error('Could not create or load the demo user');
    const userId = user.id;

    await store.transaction(async (tx) => {
      await wallet.credit(tx, {
        userId,
        amountKobo: 2_500_000,
        reference: 'seed:opening-balance',
        kind: 'seed_opening',
        metadata: { simulated: true, seed: true },
      });
    });

    const samples: Array<{
      type: TransactionRecord['type'];
      reference: string;
      amountKobo: number;
      recipient: Record<string, unknown>;
      details: Record<string, unknown>;
      daysAgo: number;
    }> = [
      {
        type: 'airtime',
        reference: 'DEMO-AIRTIME-0001',
        amountKobo: 100_000,
        recipient: { phone: '08031234567', network: 'MTN' },
        details: {
          network: 'MTN',
          phone: '08031234567',
          providerMessage: 'Airtime delivered successfully.',
          simulated: true,
        },
        daysAgo: 1,
      },
      {
        type: 'data',
        reference: 'DEMO-DATA-0001',
        amountKobo: 140_000,
        recipient: { phone: '08121234890', network: 'MTN' },
        details: {
          network: 'MTN',
          phone: '08121234890',
          planId: 'mtn-2gb-30d',
          planName: '2GB Everyday',
          allowance: '2GB',
          validity: '30 days',
          providerMessage: 'Data bundle activated successfully.',
          simulated: true,
        },
        daysAgo: 3,
      },
      {
        type: 'electricity',
        reference: 'DEMO-ELECTRICITY-0001',
        amountKobo: 500_000,
        recipient: {
          billerId: 'ikedc',
          meterNumber: '04123456789',
          meterType: 'prepaid',
          name: 'Adaeze Okafor',
        },
        details: {
          billerId: 'ikedc',
          meterNumber: '04123456789',
          meterType: 'prepaid',
          customerName: 'Adaeze Okafor',
          token: '4512 9037 6618 2045 7739',
          units: '80.6 kWh',
          providerMessage: 'Electricity units loaded successfully.',
          simulated: true,
        },
        daysAgo: 7,
      },
    ];

    for (const sample of samples) {
      const existing = await store.getTransactionByReference(sample.reference);
      if (existing) continue;
      const createdAt = new Date(at.getTime() - sample.daysAgo * 24 * 60 * 60 * 1000);
      const id = newId();
      await store.transaction(async (tx) => {
        await tx.createTransaction({
          id,
          userId,
          reference: sample.reference,
          type: sample.type,
          status: 'successful',
          amountKobo: sample.amountKobo,
          feeKobo: 0,
          currency: 'NGN',
          recipient: sample.recipient,
          details: sample.details,
          providerReference: `SP-${sample.reference.slice(-6).padStart(10, '0')}`,
          failureReason: null,
          simulated: true,
          createdAt,
          updatedAt: createdAt,
          completedAt: createdAt,
        });
        await wallet.debit(tx, {
          userId,
          amountKobo: sample.amountKobo,
          reference: `purchase:${sample.reference}`,
          kind: sample.type,
          transactionId: id,
          metadata: { seed: true, simulated: true },
        });
      });
    }

    logger.info('Demo seed complete (fictional data, development only)', {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      pin: DEMO_PIN,
      openingBalanceKobo: 2_500_000,
      sampleTransactions: samples.length,
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Seed failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
