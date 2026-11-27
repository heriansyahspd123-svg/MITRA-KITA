import {
  handleArkasParse,
  handlePartnershipAnalysis,
} from '../shared/aiBackend';

interface CloudflareAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface WorkerEnv {
  GEMINI_API_KEY?: string;
  MITRAKITA_AI_KEY?: string;
  ASSETS?: CloudflareAssetsBinding;
}

function resolveWorkerApiKey(env: WorkerEnv): string | undefined {
  const primary = typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY.trim() : '';
  if (primary) return primary;
  const fallback =
    typeof env.MITRAKITA_AI_KEY === 'string' ? env.MITRAKITA_AI_KEY.trim() : '';
  return fallback || undefined;
}

const MAX_REQUEST_BYTES = 28 * 1024 * 1024;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function parseJsonBody(
  request: Request
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const length = Number(contentLengthHeader);
    if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
      return {
        ok: false,
        response: jsonResponse(
          { error: 'Ukuran permintaan terlalu besar (maksimal 20 MB).' },
          413
        ),
      };
    }
  }

  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: jsonResponse(
        { error: 'Format data permintaan tidak valid (harus JSON).' },
        400
      ),
    };
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/health') {
      if (request.method !== 'GET') {
        return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);
      }
      return jsonResponse({ ok: true, runtime: 'cloudflare-workers' }, 200);
    }

    if (pathname === '/api/arkas/parse') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);
      }
      const parsed = await parseJsonBody(request);
      if (!parsed.ok) return parsed.response;

      const result = await handleArkasParse(
        parsed.data,
        resolveWorkerApiKey(env)
      );
      return jsonResponse(result.body, result.status);
    }

    if (pathname === '/api/ai/partnership-analysis') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);
      }
      const parsed = await parseJsonBody(request);
      if (!parsed.ok) return parsed.response;

      const result = await handlePartnershipAnalysis(
        parsed.data,
        resolveWorkerApiKey(env)
      );
      return jsonResponse(result.body, result.status);
    }

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Endpoint API tidak ditemukan.' }, 404);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
