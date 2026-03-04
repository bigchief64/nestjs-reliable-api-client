import { Module } from '@nestjs/common';
import { MockPaymentProviderService } from './mock-provider/mock-payment-provider.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentIntegrationService } from './payments/payment-integration.service';
import { ReliableHttpClientService } from './reliable-http/reliable-http-client.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    MockPaymentProviderService,
    PaymentIntegrationService,
    ReliableHttpClientService,
  ],
})
export class AppModule {}
