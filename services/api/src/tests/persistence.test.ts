import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { newId } from '../crypto';
import { openPersistentMemoryStore } from '../store/memory';
import type { SessionRecord, UserRecord, WalletRecord } from '../types';

describe('file-backed development store', () => {
  it('keeps users, wallets, ledger entries, and sessions across a restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'kashahara-store-'));
    const snapshotPath = join(directory, 'store.json');
    const at = new Date('2026-10-31T18:08:50.000Z');

    try {
      const user: UserRecord = {
        id: newId(),
        fullName: 'Ibrahim Lawal',
        email: 'speakare1@example.test',
        phone: '08031234567',
        passwordHash: 'hash',
        transactionPinHash: null,
        emailVerified: true,
        phoneVerified: false,
        createdAt: at,
        updatedAt: at,
      };
      const wallet: WalletRecord = {
        id: newId(),
        userId: user.id,
        balanceKobo: 10_000,
        currency: 'NGN',
        updatedAt: at,
      };
      const session: SessionRecord = {
        id: newId(),
        userId: user.id,
        tokenHash: 'token-hash',
        expiresAt: new Date('2026-11-30T18:08:50.000Z'),
        revokedAt: null,
        userAgent: 'test',
        ip: null,
        createdAt: at,
      };

      const first = openPersistentMemoryStore(snapshotPath);
      await first.createUser(user);
      await first.createWallet(wallet);
      await first.createSession(session);
      await first.transaction(async (tx) => {
        await tx.appendLedgerEntry({
          id: newId(),
          walletId: wallet.id,
          userId: user.id,
          direction: 'credit',
          amountKobo: 10_000,
          balanceAfterKobo: 10_000,
          reference: 'paystack:KSHFUND-RESTART',
          kind: 'wallet_funding',
          transactionId: null,
          metadata: { fundingReference: 'KSHFUND-RESTART' },
          createdAt: at,
        });
        await tx.updateWalletBalance(wallet.id, 10_000, at);
      });

      const second = openPersistentMemoryStore(snapshotPath);
      const restoredUser = await second.findUserByEmail(user.email);
      assert.equal(restoredUser?.id, user.id);
      assert.equal(restoredUser?.createdAt instanceof Date, true);

      const restoredWallet = await second.getWalletByUserId(user.id);
      assert.equal(restoredWallet?.balanceKobo, 10_000);
      assert.equal(restoredWallet?.updatedAt instanceof Date, true);

      const restoredSession = await second.findSessionByTokenHash('token-hash');
      assert.equal(restoredSession?.userId, user.id);
      assert.equal(restoredSession?.expiresAt instanceof Date, true);

      const ledger = await second.listLedger(user.id, 10);
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0]?.reference, 'paystack:KSHFUND-RESTART');
      assert.equal(ledger[0]?.createdAt instanceof Date, true);
      assert.equal((await second.sumLedger(wallet.id)) ?? 0, 10_000);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
