import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendFax } from '../src/lib/telnyx';

describe('sendFax()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TELNYX_API_KEY = 'test-api-key';
    process.env.TELNYX_CONNECTION_ID = 'conn_123';
    process.env.TELNYX_FROM_NUMBER = '+15551234567';
  });

  it('sends fax successfully and returns id/status', async () => {
    const mockResponse = {
      data: { id: 'fax_123', status: 'queued' },
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response));

    const result = await sendFax({ mediaUrl: 'https://example.com/doc.pdf', webhookUrl: 'https://example.test/webhook' });
    expect(result).toEqual({ id: 'fax_123', status: 'queued' });
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0);
  });

  it('throws when Telnyx responds with non-OK', async () => {
    const mockErr = { error: 'bad request' };
    global.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => mockErr,
    } as unknown as Response));

    await expect(
      sendFax({ mediaUrl: 'https://example.com/doc.pdf', webhookUrl: 'https://example.test/webhook' })
    ).rejects.toThrow(/Telnyx fax send failed/);
  });
});
