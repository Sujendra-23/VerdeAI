import { describe, expect, it, vi } from 'vitest';
import { calendarDate, createMobileClient } from '../src/client';

describe('mobile API contract', () => {
  it('rejects insecure or credential-bearing API configuration', () => {
    for (const origin of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/api', 'https://example.com?token=x']) {
      expect(() => createMobileClient(origin)).toThrow();
    }
  });

  it('sends restaurant, date and language through GraphQL and decodes the insight', async () => {
    const insight = { restaurant: { restaurantId: 'R001', name: 'Test', location: 'Seattle' }, date: '2026-02-05', forecasts: [], wasteRisk: [], explanation: 'Prepare less.' };
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { insight } })));
    expect(await createMobileClient('https://example.com/', transport).insight('R001', '2026-02-05', 'kn')).toEqual(insight);
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('https://example.com/graphql');
    expect(JSON.parse(options?.body as string).variables).toEqual({ restaurantId: 'R001', date: '2026-02-05', locale: 'kn' });
  });

  it('rejects GraphQL and HTTP errors instead of showing an empty success', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: null, errors: [{ message: 'failed' }] })));
    await expect(createMobileClient('https://example.com', transport).insight('R001', '2026-02-05', 'en')).rejects.toThrow();
    transport.mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(createMobileClient('https://example.com', transport).restaurants()).rejects.toThrow('503');
  });

  it('sends the entire conversation with the selected language', async () => {
    const reply = { role: 'assistant', content: 'Prepare less.' };
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ reply, source: 'template' })));
    const history = [{ role: 'user' as const, content: 'Soup?' }, reply, { role: 'user' as const, content: 'Why?' }];
    await createMobileClient('https://example.com', transport).chat('R002', '2026-02-06', history as Parameters<ReturnType<typeof createMobileClient>['chat']>[2], 'fr');
    expect(JSON.parse(transport.mock.calls[0][1]?.body as string)).toEqual({ restaurantId: 'R002', date: '2026-02-06', messages: history, locale: 'fr' });
  });

  it('forwards cancellation to the network request', async () => {
    const controller = new AbortController();
    const transport = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      expect(options?.signal?.aborted).toBe(true);
      throw new DOMException('Aborted', 'AbortError');
    });
    controller.abort();
    await expect(createMobileClient('https://example.com', transport).restaurants(controller.signal)).rejects.toThrow('Aborted');
  });

  it('formats device calendar days without a UTC conversion', () => {
    expect(calendarDate(new Date(2026, 1, 5, 23, 30))).toBe('2026-02-05');
  });
});
