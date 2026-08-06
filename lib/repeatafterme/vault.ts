// ————————————————————————————————————————————————
// Zero-knowledge storage helpers. Ported near-verbatim from
// Health Dashboard/vitaldash-app/lib/vault.js — same contract, generalised (the PBKDF2
// salt is now a parameter, not a hardcoded "vitaldash-v1") so a future app in this
// monorepo can reuse this file directly instead of re-deriving it.
//
// The magic key never leaves the browser. We derive two independent things from it
// locally:
//   1. A one-way SHA-256 hash, used only as a lookup key on the server — the server
//      can't reverse this back into the magic key.
//   2. An AES-256-GCM key (via PBKDF2), used to encrypt/decrypt the payload before
//      it's ever sent over the network.
// The server therefore only ever sees an unreadable ciphertext blob plus a hash it
// can't invert. There is no password-reset flow by design: losing the key means
// losing the synced copy, for anyone, including us.
// ————————————————————————————————————————————————

const KEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L — avoids visual ambiguity

export function generateMagicKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < 5; g++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    let chars = "";
    for (let i = 0; i < 4; i++) chars += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
    groups.push(chars);
  }
  return groups.join("-");
}

export async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deriveAesKey(magicKey: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(magicKey), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const bufToB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64ToBuf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export interface EncryptedPayload {
  iv: string;
  data: string;
}

export async function encryptPayload(magicKey: string, obj: unknown, salt: string): Promise<EncryptedPayload> {
  const key = await deriveAesKey(magicKey, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { iv: bufToB64(iv.buffer as ArrayBuffer), data: bufToB64(cipher) };
}

export async function decryptPayload<T = unknown>(magicKey: string, payload: EncryptedPayload, salt: string): Promise<T> {
  const key = await deriveAesKey(magicKey, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBuf(payload.iv) }, key, b64ToBuf(payload.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
