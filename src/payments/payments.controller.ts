import { Body, Controller, Post } from '@nestjs/common';
import {
  PaymentIntegrationService,
  PaymentRequest,
  PaymentResult,
} from './payment-integration.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentIntegrationService: PaymentIntegrationService,
  ) {}

  @Post('process')
  process(@Body() request: PaymentRequest): Promise<PaymentResult> {
    return this.paymentIntegrationService.processPayment(request);
  }
}
