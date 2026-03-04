import { Injectable } from '@nestjs/common';
import { MockPaymentProviderService } from '../mock-provider/mock-payment-provider.service';
import {
  CircuitOpenError,
  ReliableHttpClientService,
  ReliableHttpError,
} from '../reliable-http/reliable-http-client.service';

export type PaymentMode = 'success' | 'serverError' | 'timeout' | 'random';

export interface PaymentRequest {
  amount: number;
  idempotencyKey: string;
  mode?: PaymentMode;
}

export interface PaymentResult {
  ok: boolean;
  status: 'processed' | 'deferred';
  providerReference?: string;
  message: string;
  retryable?: boolean;
}

@Injectable()
export class PaymentIntegrationService {
  private readonly processedPayments = new Map<string, PaymentResult>();

  constructor(
    private readonly reliableHttpClient: ReliableHttpClientService,
    private readonly mockPaymentProvider: MockPaymentProviderService,
  ) {}

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const cached = this.processedPayments.get(request.idempotencyKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.reliableHttpClient.post(
        'payments.process',
        () => this.mockPaymentProvider.process(request),
        { timeoutMs: 80, maxRetries: 2, baseDelayMs: 10 },
      );
      this.processedPayments.set(request.idempotencyKey, result);
      return result;
    } catch (error) {
      const retryable =
        error instanceof CircuitOpenError
          ? true
          : error instanceof ReliableHttpError
            ? error.retryable
            : true;
      return {
        ok: false,
        status: 'deferred',
        message:
          'Payment provider unavailable. No charge was recorded; retry later with the same idempotency key.',
        retryable,
      };
    }
  }
}
