// Worker privado de notificaciones push. Llamar con Supabase Cron cada minuto:
// POST con la cabecera x-reparado-worker-secret. Nunca desde el navegador.
// Secretos (supabase secrets set): REPARADO_PUSH_WORKER_SECRET (>=32),
// FCM_SERVICE_ACCOUNT_JSON, APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID,
// APNS_TOPIC (com.ams.reparado) y APNS_ENV (production | sandbox).
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  apnsPayload, classifyApns, classifyFcm, fcmMessage, isHexToken, signJwt, type Outcome,
} from './lib.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
function constantTimeMatch(actual: string, expected: string): boolean {
  if (!expected || actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
const BATCH = 10;

let fcmAccess: { token: string; exp: number } | null = null;
async function fcmAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmAccess && fcmAccess.exp - 60 > now) return fcmAccess.token;
  const assertion = await signJwt('RS256', {}, {
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }, sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error('fcm_oauth_' + res.status);
  const data = await res.json();
  fcmAccess = { token: String(data.access_token), exp: now + Number(data.expires_in || 3600) };
  return fcmAccess.token;
}

let apnsJwt: { token: string; at: number } | null = null;
async function apnsToken(keyP8: string, keyId: string, teamId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Apple rechaza tokens de más de 60 min y limita renovaciones: reutilizar 40 min.
  if (apnsJwt && now - apnsJwt.at < 2400) return apnsJwt.token;
  const token = await signJwt('ES256', { kid: keyId }, { iss: teamId, iat: now }, keyP8);
  apnsJwt = { token, at: now };
  return token;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('REPARADO_PUSH_WORKER_SECRET') || '';
  if (secret.length < 32) return json({ error: 'worker_not_configured' }, 503);
  if (!constantTimeMatch(request.headers.get('x-reparado-worker-secret') || '', secret)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const url = Deno.env.get('SUPABASE_URL') || '';
  const roleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  let fcm: { client_email: string; private_key: string; project_id: string } | null = null;
  try { fcm = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') || 'null'); } catch { fcm = null; }
  const apnsKey = Deno.env.get('APNS_KEY_P8') || '';
  const apnsKeyId = Deno.env.get('APNS_KEY_ID') || '';
  const apnsTeam = Deno.env.get('APNS_TEAM_ID') || '';
  const apnsTopic = Deno.env.get('APNS_TOPIC') || 'com.ams.reparado';
  const apnsHost = (Deno.env.get('APNS_ENV') || 'production') === 'sandbox'
    ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const fcmReady = Boolean(fcm?.client_email && fcm?.private_key && fcm?.project_id);
  const apnsReady = Boolean(apnsKey && apnsKeyId && apnsTeam);
  if (!url || !roleKey || (!fcmReady && !apnsReady)) return json({ error: 'push_not_configured' }, 503);

  const db = createClient(url, roleKey, { auth: { persistSession: false } });
  let processed = 0, delivered = 0, removed = 0, failed = 0;

  for (let n = 0; n < BATCH; n++) {
    const claim = await db.rpc('reparado_claim_push');
    if (claim.error) return json({ error: 'claim_failed', processed }, 503);
    const item = claim.data?.[0];
    if (!item) break;
    processed++;
    const id = String(item.outbox_id), attempt = Number(item.try_number) || 1;
    const finish = (state: 'sent' | 'pending' | 'failed', reason: string | null) => db.from('push_outbox').update({
      state, claimed_at: null, last_error: reason ? reason.slice(0, 180) : null,
      ...(state === 'sent' ? { sent_at: new Date().toISOString() } : {}),
      ...(state === 'pending'
        ? { next_attempt_at: new Date(Date.now() + Math.min(attempt * attempt * 60000, 900000)).toISOString() } : {}),
    }).eq('id', id).eq('state', 'sending');

    const { data: tokens, error: tokenError } = await db.from('device_tokens')
      .select('token,platform').eq('user_id', String(item.target_user_id));
    if (tokenError) { await finish(attempt < 5 ? 'pending' : 'failed', 'tokens_unavailable'); failed++; continue; }
    if (!tokens?.length) { await finish('sent', 'no_devices'); continue; }

    let ok = 0, retry = 0, config = 0;
    for (const device of tokens) {
      let outcome: Outcome = 'retry';
      try {
        if (device.platform === 'android') {
          if (!fcmReady) { outcome = 'config'; }
          else {
            const res = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm!.project_id}/messages:send`, {
              method: 'POST',
              headers: { authorization: 'Bearer ' + await fcmAccessToken(fcm!), 'content-type': 'application/json' },
              body: JSON.stringify(fcmMessage(device.token, item.push_title, item.push_body)),
            });
            outcome = classifyFcm(res.status, await res.text());
          }
        } else if (device.platform === 'ios' && isHexToken(device.token)) {
          if (!apnsReady) { outcome = 'config'; }
          else {
            const res = await fetch(`${apnsHost}/3/device/${device.token}`, {
              method: 'POST',
              headers: {
                authorization: 'bearer ' + await apnsToken(apnsKey, apnsKeyId, apnsTeam),
                'apns-topic': apnsTopic, 'apns-push-type': 'alert', 'apns-priority': '10',
                'content-type': 'application/json',
              },
              body: JSON.stringify(apnsPayload(item.push_title, item.push_body)),
            });
            outcome = classifyApns(res.status, await res.text());
          }
        } else {
          outcome = 'invalid_token';
        }
      } catch { outcome = 'retry'; }
      if (outcome === 'ok') ok++;
      else if (outcome === 'invalid_token') {
        await db.from('device_tokens').delete().eq('token', device.token); removed++;
      } else if (outcome === 'config') config++;
      else retry++;
    }
    delivered += ok;
    if (retry > 0 && ok === 0) { await finish(attempt < 5 ? 'pending' : 'failed', 'provider_unavailable'); failed++; }
    else if (config > 0 && ok === 0) { await finish('failed', 'provider_not_configured'); failed++; }
    else await finish('sent', null);
  }
  return json({ processed, delivered, removed_tokens: removed, failed });
});
