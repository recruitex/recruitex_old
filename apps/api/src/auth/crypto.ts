import { Effect } from 'effect';

const BYTES = 32;

export class PKCEError extends Error {
  _tag = 'PKCE_ERROR';
}

const BASE64_URL_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function bytesToBase64Url(bytes: Uint8Array) {
  const len = bytes.length;
  let base64url = '';

  for (let i = 0; i < len; i += 3) {
    // @ts-ignore-next-line Safe
    const b1 = bytes[i] & 0xff;
    // @ts-ignore-next-line Safe
    const b2 = i + 1 < len ? bytes[i + 1] & 0xff : 0;
    // @ts-ignore-next-line Safe
    const b3 = i + 2 < len ? bytes[i + 2] & 0xff : 0;

    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 0x03) << 4) | (b2 >> 4);
    const enc3 = ((b2 & 0x0f) << 2) | (b3 >> 6);
    const enc4 = b3 & 0x3f;

    base64url += BASE64_URL_CHARS.charAt(enc1) + BASE64_URL_CHARS.charAt(enc2);
    if (i + 1 < len) {
      base64url += BASE64_URL_CHARS.charAt(enc3);
    }
    if (i + 2 < len) {
      base64url += BASE64_URL_CHARS.charAt(enc4);
    }
  }

  return base64url;
}

async function sha256(source: BufferSource | string) {
  const bytes =
    typeof source === 'string' ? new TextEncoder().encode(source) : source;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export const createVerifierChallengePair = Effect.tryPromise({
  async try() {
    const verifier = bytesToBase64Url(randomBytes(BYTES));
    const challenge = await sha256(verifier).then(bytesToBase64Url);

    return { verifier, challenge };
  },
  catch(error) {
    return new PKCEError("Couldn't generate PKCE challenge and verifier.", {
      cause: error,
    });
  },
});
