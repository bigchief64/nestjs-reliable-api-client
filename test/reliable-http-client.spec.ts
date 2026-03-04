import {
  CircuitOpenError,
  ReliableHttpClientService,
  ReliableHttpError,
} from '../src/reliable-http/reliable-http-client.service';

describe('ReliableHttpClientService', () => {
  it('retries retryable failures until the request succeeds', async () => {
    const client = new ReliableHttpClientService();
    client.configure({ maxRetries: 2, baseDelayMs: 0, failureThreshold: 99 });
    let attempts = 0;

    const result = await client.post('retry-test', async () => {
      attempts += 1;
      if (attempts < 3) {
        throw { status: 500 };
      }
      return 'paid';
    });

    expect(result).toBe('paid');
    expect(attempts).toBe(3);
  });

  it('treats slow providers as timeout failures', async () => {
    const client = new ReliableHttpClientService();
    client.configure({ failureThreshold: 99 });

    await expect(
      client.post(
        'timeout-test',
        () => new Promise((resolve) => setTimeout(() => resolve('late'), 25)),
        { timeoutMs: 5, maxRetries: 0 },
      ),
    ).rejects.toMatchObject({
      code: 'ETIMEDOUT',
      retryable: true,
    });
  });

  it('opens the circuit after repeated failures and fails fast', async () => {
    const client = new ReliableHttpClientService();
    client.configure({
      maxRetries: 0,
      baseDelayMs: 0,
      failureThreshold: 1,
      resetTimeoutMs: 1000,
    });
    let attempts = 0;

    await expect(
      client.post('first-failure', async () => {
        attempts += 1;
        throw { status: 500 };
      }),
    ).rejects.toBeInstanceOf(ReliableHttpError);

    await expect(
      client.post('second-failure', async () => {
        attempts += 1;
        return 'never';
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);

    expect(attempts).toBe(1);
  });
});
