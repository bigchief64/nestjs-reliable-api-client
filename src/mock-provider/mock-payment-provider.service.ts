import { Injectable } from '@nestjs/common';
import type {
  PaymentRequest,
  PaymentResult,
} from '../payments/payment-integration.service';

class MockProviderError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

@Injectable()
export class MockPaymentProviderService {
  async process(request: PaymentRequest): Promise<PaymentResult> {
    const mode = request.mode === 'random' || !request.mode ? this.pickMode() : request.mode;
    if (mode === 'serverError') {
      throw new MockProviderError(500, 'Provider returned a server error.');
    }
    if (mode === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return {
      ok: true,
      status: 'processed',
      providerReference: `demo-${request.idempotencyKey}`,
      message: 'Payment processed by mock provider.',
    };
  }

  private pickMode(): 'success' | 'serverError' | 'timeout' {
    const value = Math.random();
    if (value < 0.34) {
      return 'serverError';
    }
    if (value < 0.67) {
      return 'timeout';
    }
    return 'success';
  }
}
