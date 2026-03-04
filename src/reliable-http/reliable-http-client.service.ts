import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface ClientOverrides {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

interface ClientSettings {
  timeoutMs: number;
  maxRetries: number;
  baseDelayMs: number;
  failureThreshold: number;
  resetTimeoutMs: number;
}

type CircuitState = 'closed' | 'open' | 'half_open';

export class ReliableHttpError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export class CircuitOpenError extends ReliableHttpError {
  constructor() {
    super('Circuit is open.', true);
  }
}

@Injectable()
export class ReliableHttpClientService {
  private readonly http = axios.create();
  private readonly settings: ClientSettings = {
    timeoutMs: 100,
    maxRetries: 2,
    baseDelayMs: 25,
    failureThreshold: 2,
    resetTimeoutMs: 250,
  };
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private openedAt = 0;

  configure(overrides: Partial<ClientSettings>): void {
    Object.assign(this.settings, overrides);
  }

  async post<T>(
    operation: string,
    execute: () => Promise<T>,
    overrides: ClientOverrides = {},
  ): Promise<T> {
    const settings: ClientSettings = {
      ...this.settings,
      ...overrides,
      timeoutMs: overrides.timeoutMs ?? this.settings.timeoutMs,
      maxRetries: overrides.maxRetries ?? this.settings.maxRetries,
      baseDelayMs: overrides.baseDelayMs ?? this.settings.baseDelayMs,
    };
    let attempt = 0;

    while (attempt <= settings.maxRetries) {
      this.assertCircuitReady(settings.resetTimeoutMs);
      attempt += 1;
      this.log('request_started', { operation, attempt, circuit: this.circuitState });

      try {
        const result = await this.http
          .request<T>({
            method: 'POST',
            url: `https://mock-provider.local/${operation}`,
            adapter: async (config) => ({
              data: await this.runWithTimeout(execute, settings.timeoutMs),
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            }),
          })
          .then((response) => response.data);
        this.onSuccess();
        this.log('request_succeeded', { operation, attempt, circuit: this.circuitState });
        return result;
      } catch (error) {
        const classified = this.classify(error);
        if (!(classified instanceof CircuitOpenError)) {
          this.onFailure(settings.failureThreshold);
        }
        this.log('request_failed', {
          operation,
          attempt,
          retryable: classified.retryable,
          status: classified.status,
          code: classified.code,
          circuit: this.circuitState,
        });

        if (!classified.retryable || attempt > settings.maxRetries) {
          throw classified;
        }

        const delayMs = settings.baseDelayMs * 2 ** (attempt - 1);
        this.log('request_retrying', { operation, attempt, delayMs });
        await this.sleep(delayMs);
      }
    }

    throw new ReliableHttpError('Retry budget exhausted.', true);
  }

  private assertCircuitReady(resetTimeoutMs: number): void {
    if (this.circuitState !== 'open') {
      return;
    }
    if (Date.now() - this.openedAt >= resetTimeoutMs) {
      this.circuitState = 'half_open';
      return;
    }
    throw new CircuitOpenError();
  }

  private async runWithTimeout<T>(
    execute: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        execute(),
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new ReliableHttpError('Request timed out.', true, 408, 'ETIMEDOUT'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private classify(error: unknown): ReliableHttpError {
    if (error instanceof ReliableHttpError) {
      return error;
    }

    const status = this.getNumber(error, 'status');
    if (typeof status === 'number') {
      return new ReliableHttpError(
        `HTTP ${status} from external API.`,
        status >= 500 || status === 429,
        status,
      );
    }

    const code = this.getString(error, 'code');
    if (code === 'ETIMEDOUT') {
      return new ReliableHttpError('Request timed out.', true, 408, code);
    }

    return new ReliableHttpError('Transient external API failure.', true);
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.circuitState = 'closed';
    this.openedAt = 0;
  }

  private onFailure(failureThreshold: number): void {
    this.failureCount += 1;
    if (this.failureCount >= failureThreshold || this.circuitState === 'half_open') {
      this.circuitState = 'open';
      this.openedAt = Date.now();
    }
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private log(event: string, data: Record<string, unknown>): void {
    process.stdout.write(`${JSON.stringify({ event, ...data })}\n`);
  }

  private getNumber(source: unknown, key: string): number | undefined {
    if (typeof source === 'object' && source !== null && key in source) {
      const value = Reflect.get(source, key);
      return typeof value === 'number' ? value : undefined;
    }
    return undefined;
  }

  private getString(source: unknown, key: string): string | undefined {
    if (typeof source === 'object' && source !== null && key in source) {
      const value = Reflect.get(source, key);
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }
}
