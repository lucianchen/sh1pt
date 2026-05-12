import { defineSocial, oauthSetup } from '@profullstack/sh1pt-core';

// Mastodon — federated. Each instance is its own server; same API.
// POST /api/v1/statuses with access token scoped to 'write:statuses'.
interface Config {
  instance: string;            // e.g. 'mastodon.social' or 'fosstodon.org'
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
}

interface MastodonStatusResponse {
  id?: string;
  url?: string;
  uri?: string;
  created_at?: string;
  error?: string;
}

export default defineSocial<Config>({
  id: 'social-mastodon',
  label: 'Mastodon (Fediverse)',
  requires: { maxBodyChars: 500, maxHashtags: 20, hashtagsInBody: true },
  async connect(ctx, config) {
    if (!ctx.secret(`MASTODON_TOKEN_${config.instance.replace(/\./g, '_').toUpperCase()}`)) {
      throw new Error(`Mastodon token for ${config.instance} not in vault`);
    }
    return { accountId: config.instance };
  },
  async post(ctx, post, config) {
    const instance = normalizeInstance(config.instance);
    const token = ctx.secret(tokenSecretKey(instance));
    if (!token) throw new Error(`Mastodon token for ${instance} not in vault`);
    ctx.log(`mastodon post · ${config.instance} · ${post.body.length} chars`);
    if (ctx.dryRun) return { id: 'dry-run', url: `https://${config.instance}/`, platform: 'mastodon', publishedAt: new Date().toISOString() };

    const res = await fetch(`https://${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: formatStatus(post),
        visibility: config.visibility ?? 'public',
      }),
    });
    const data = await parseStatusResponse(res);
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    if (!data.id) throw new Error('Mastodon status response did not include a status id');
    return {
      id: data.id,
      url: data.url ?? data.uri ?? `https://${instance}/`,
      platform: 'mastodon',
      publishedAt: new Date(data.created_at ?? Date.now()).toISOString(),
    };
  },

  setup: oauthSetup({
    secretKey: "MASTODON_ACCESS_TOKEN",
    label: "Mastodon",
    vendorDocUrl: "https://docs.joinmastodon.org/client/token/",
    steps: [
      "Open your Mastodon instance \u2192 Preferences \u2192 Development \u2192 New Application",
      "Scopes: write:statuses write:media read:accounts",
      "Copy the access token shown after creation",
    ],
  }),
});

function tokenSecretKey(instance: string): string {
  return `MASTODON_TOKEN_${instance.replace(/\./g, '_').toUpperCase()}`;
}

function normalizeInstance(instance: string): string {
  return instance.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function formatStatus(post: { body: string; link?: string }): string {
  return post.link ? `${post.body}\n${post.link}` : post.body;
}

async function parseStatusResponse(res: Response): Promise<MastodonStatusResponse> {
  try {
    return await res.json() as MastodonStatusResponse;
  } catch {
    return { error: res.statusText };
  }
}
