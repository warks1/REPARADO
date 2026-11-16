// Funciones puras del worker de notificaciones (sin Deno ni red), para poder
// probarlas con Node. FCM HTTP v1 para Android y APNs con clave .p8 para iOS.

export function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// RS256 (cuenta de servicio de Google) o ES256 (clave .p8 de Apple).
// ECDSA de WebCrypto devuelve r||s, el formato que exige JWT.
export async function signJwt(
  alg: 'RS256' | 'ES256',
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const algorithm = alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: 'P-256' };
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(privateKeyPem), algorithm, false, ['sign']);
  const unsigned = b64url(JSON.stringify({ alg, typ: 'JWT', ...header })) + '.' + b64url(JSON.stringify(claims));
  const signature = new Uint8Array(await crypto.subtle.sign(
    alg === 'RS256' ? 'RSASSA-PKCS1-v1_5' : { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  ));
  return unsigned + '.' + b64url(signature);
}

export function clip(text: unknown, max: number): string {
  const value = String(text ?? '').trim();
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

export function fcmMessage(token: string, title: string, body: string) {
  return {
    message: {
      token,
      notification: { title: clip(title, 80), body: clip(body, 200) },
      android: { priority: 'HIGH', notification: { sound: 'default' } },
    },
  };
}

export function apnsPayload(title: string, body: string) {
  return { aps: { alert: { title: clip(title, 80), body: clip(body, 200) }, sound: 'default' } };
}

export type Outcome = 'ok' | 'invalid_token' | 'retry' | 'config';

// Decide qué hacer con la respuesta del proveedor.
export function classifyFcm(status: number, bodyText: string): Outcome {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 404 || /UNREGISTERED|registration-token-not-registered/.test(bodyText)) return 'invalid_token';
  if (status === 400 && /INVALID_ARGUMENT/.test(bodyText) && /token/i.test(bodyText)) return 'invalid_token';
  if (status === 401 || status === 403) return 'config';
  return 'retry';
}

export function classifyApns(status: number, bodyText: string): Outcome {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 410 || /Unregistered|BadDeviceToken|DeviceTokenNotForTopic/.test(bodyText)) return 'invalid_token';
  if (status === 403 || /InvalidProviderToken|ExpiredProviderToken|MissingTopic|BadTopic/.test(bodyText)) return 'config';
  return 'retry';
}

export function isHexToken(token: string): boolean {
  return /^[0-9a-fA-F]{64,200}$/.test(token);
}
