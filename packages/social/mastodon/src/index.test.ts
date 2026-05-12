import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractTestSocial, fakeConnectContext } from '@profullstack/sh1pt-core/testing';
import adapter from './index.js';

contractTestSocial(adapter, {
  sampleConfig: { instance: 'mastodon.social' },
  samplePost: { body: 'hello from sh1pt contract tests' },
  requiredSecrets: ['MASTODON_TOKEN_MASTODON_SOCIAL'],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('social-mastodon posting', () => {
  it('creates statuses on the selected Mastodon instance', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: '109876',
        url: 'https://mastodon.social/@sh1pt/109876',
        created_at: '2026-05-12T16:40:00Z',
      }),
    } as any);

    const ctx = {
      ...fakeConnectContext({ MASTODON_TOKEN_MASTODON_SOCIAL: 'mastodon-token' }),
      dryRun: false,
    };

    const result = await adapter.post(ctx as any, {
      body: 'Release shipped',
      link: 'https://sh1pt.com',
    }, {
      instance: 'mastodon.social',
      visibility: 'unlisted',
    });

    expect(result).toEqual({
      id: '109876',
      url: 'https://mastodon.social/@sh1pt/109876',
      platform: 'mastodon',
      publishedAt: '2026-05-12T16:40:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://mastodon.social/api/v1/statuses');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      authorization: 'Bearer mastodon-token',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      status: 'Release shipped\nhttps://sh1pt.com',
      visibility: 'unlisted',
    });
  });

  it('surfaces Mastodon API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: "Validation failed: Text can't be blank" }),
    } as any);

    const ctx = {
      ...fakeConnectContext({ MASTODON_TOKEN_MASTODON_SOCIAL: 'mastodon-token' }),
      dryRun: false,
    };

    await expect(adapter.post(ctx as any, {
      body: 'Release shipped',
    }, {
      instance: 'mastodon.social',
    })).rejects.toThrow('Validation failed');
  });
});
