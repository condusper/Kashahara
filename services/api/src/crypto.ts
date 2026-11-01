import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
}

/** Hashes a password or transaction PIN with scrypt and a per-secret salt. */
export async function hashSecret(secret: string): Promise<string> {
  if (secret.length < 4 || secret.length > 128) {
    throw new Error('Secret length is not supported');
  }
  const salt = randomBytes(16);
  const derived = await derive(secret, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  try {
    const [algorithm, n, r, p, saltHex, hashHex] = stored.split('$');
    if (algorithm !== 'scrypt' || !n || !r || !p || !saltHex || !hashHex) {
      return false;
    }
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scryptAsync(secret, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, value: string | Buffer): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function hmacSha512Hex(secret: string, value: string | Buffer): string {
  return createHmac('sha512', secret).update(value).digest('hex');
}

export function constantTimeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomDigits(length = 6): string {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += String(randomInt(0, 10));
  }
  return output;
}

export function newId(): string {
  return randomUUID();
}

export function newReference(prefix: string): string {
  const safePrefix = prefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(6).toString('hex').toUpperCase();
  return `${safePrefix}-${timestamp}-${random}`;
}

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  iss: 'kashahara';
  aud: 'kashahara-mobile';
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signAccessToken(
  userId: string,
  secret: string,
  ttlSeconds: number,
  now: Date = new Date(),
): { token: string; expiresAt: Date; payload: AccessTokenPayload } {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: AccessTokenPayload = {
    sub: userId,
    jti: randomUUID(),
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    iss: 'kashahara',
    aud: 'kashahara-mobile',
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000),
    payload,
  };
}

export function verifyAccessToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): AccessTokenPayload | null {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) return null;

    const expectedSignature = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    if (!constantTimeEqualString(signature, expectedSignature)) return null;

    const header = JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf8'),
    ) as { alg?: string; typ?: string };
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<AccessTokenPayload>;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number' ||
      payload.iss !== 'kashahara' ||
      payload.aud !== 'kashahara-mobile'
    ) {
      return null;
    }
    if (payload.exp <= Math.floor(now.getTime() / 1000)) return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}
