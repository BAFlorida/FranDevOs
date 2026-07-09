import crypto from "crypto";

// In-app password hashing using Node's built-in scrypt (no external deps, and
// bundles cleanly with esbuild). Stored format: `scrypt$<saltHex>$<hashHex>`.
// scrypt is a vetted, memory-hard KDF suitable for password storage.

const KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(plain, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  let derived: Buffer;
  try {
    derived = crypto.scryptSync(plain, salt, expected.length);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

// Minimum acceptable password length for newly set passwords.
export const MIN_PASSWORD_LENGTH = 8;
