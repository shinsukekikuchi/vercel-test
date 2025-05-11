import { describe, it, expect, vi, afterEach } from 'vitest';
import { bybitClient, OptionOrderParams } from './bybit';

describe('createOptionOrder', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('sends correct request and returns response JSON on success', async () => {
    const mockResponse = { result: { orderId: '12345' } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    // @ts-ignore
    global.fetch = fetchMock;

    const params: OptionOrderParams = {
      symbol: 'BTC-31MAY24-60000-C',
      side: 'Buy',
      qty: '0.1',
      price: '1000',
      orderType: 'Limit',
      timeInForce: 'GTC',
    };

    const res = await bybitClient.createOptionOrder(params);

    expect(res).toEqual(mockResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v5/order/create');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({
      category: 'option',
      symbol: params.symbol,
      side: params.side,
      orderType: params.orderType,
      qty: String(params.qty),
      price: String(params.price!),
      timeInForce: params.timeInForce,
    }));
  });

  it('throws an error with status and message on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });
    // @ts-ignore
    global.fetch = fetchMock;

    const params: OptionOrderParams = {
      symbol: 'BTC-31MAY24-60000-C',
      side: 'Sell',
      qty: '0.2',
      orderType: 'Market',
      timeInForce: 'IOC',
    };

    await expect(bybitClient.createOptionOrder(params)).rejects.toThrow(/failed \(400\): Bad Request/);
  });
});
