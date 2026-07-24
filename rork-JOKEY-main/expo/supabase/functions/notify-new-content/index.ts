// Supabase Edge Function: notify-new-content
// Deploy: supabase functions deploy notify-new-content --project-ref ybafpeuelshlofltoebe
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase).
//
// Accepts either:
// 1) Client invoke: { contentType: 'joke' | 'video' | 'image', contentId?: string }
// 2) Database webhook payload: { type: 'INSERT', table: 'jokes' | 'videos' | 'image_jokes', ... }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

type ContentType = 'joke' | 'video' | 'image';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function resolveContentType(body: Record<string, unknown>): ContentType | null {
  const direct = body.contentType ?? body.content_type;
  if (direct === 'joke' || direct === 'video' || direct === 'image') return direct;

  const table = typeof body.table === 'string' ? body.table : '';
  if (table === 'jokes') return 'joke';
  if (table === 'videos') return 'video';
  if (table === 'image_jokes') return 'image';
  return null;
}

function resolveContentId(body: Record<string, unknown>): string | null {
  if (typeof body.contentId === 'string') return body.contentId;
  if (typeof body.content_id === 'string') return body.content_id;
  const record = body.record as Record<string, unknown> | undefined;
  if (record && typeof record.id === 'string') return record.id;
  return null;
}

function notificationCopy(contentType: ContentType): { title: string; body: string } {
  if (contentType === 'image') {
    return { title: 'JOKEY', body: 'A new image was published!' };
  }
  return { title: 'JOKEY', body: 'A new joke was published!' };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const contentType = resolveContentType(body);
    if (!contentType) {
      return new Response(JSON.stringify({ error: 'Invalid contentType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentId = resolveContentId(body);
    const { title, body: message } = notificationCopy(contentType);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: devices, error: devicesError } = await admin
      .from('push_devices')
      .select('id, expo_push_token')
      .eq('enabled', true);

    if (devicesError) {
      console.error('[notify-new-content] devices query failed:', devicesError.message);
      return new Response(JSON.stringify({ error: devicesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokens = Array.from(
      new Set(
        (devices ?? [])
          .map((d) => d.expo_push_token)
          .filter((t): t is string => typeof t === 'string' && t.length > 0)
      )
    );

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_devices' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    const invalidTokens: string[] = [];

    for (const group of chunk(tokens, CHUNK_SIZE)) {
      const messages = group.map((to) => ({
        to,
        sound: 'default',
        title,
        body: message,
        channelId: 'jokey-content',
        priority: 'high',
        data: {
          contentType,
          contentId,
        },
      }));

      const pushRes = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!pushRes.ok) {
        const text = await pushRes.text();
        console.error('[notify-new-content] Expo Push HTTP error:', pushRes.status, text);
        continue;
      }

      const pushJson = await pushRes.json();
      const tickets = Array.isArray(pushJson?.data) ? pushJson.data : [pushJson?.data];

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (!ticket) continue;
        if (ticket.status === 'ok') {
          sent += 1;
        } else if (ticket.status === 'error') {
          const errCode = ticket.details?.error;
          console.warn('[notify-new-content] ticket error:', ticket.message, errCode);
          if (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials') {
            invalidTokens.push(group[i]);
          }
        }
      }
    }

    if (invalidTokens.length > 0) {
      const { error: cleanupError } = await admin
        .from('push_devices')
        .delete()
        .in('expo_push_token', invalidTokens);
      if (cleanupError) {
        console.warn('[notify-new-content] cleanup failed:', cleanupError.message);
      } else {
        console.log('[notify-new-content] removed invalid tokens:', invalidTokens.length);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        contentType,
        contentId,
        recipients: tokens.length,
        sent,
        removedInvalid: invalidTokens.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[notify-new-content] fatal:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
