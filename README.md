# NestJS Reliable API Client Example

This example shows a small NestJS payment flow that treats third-party APIs as unreliable by default. A naive integration often assumes every call is fast, successful, and safe to repeat; in production that causes duplicate charges, stuck requests, noisy logs, and cascading failures when a provider is slow or down.

## What It Demonstrates

- `POST /payments/process` calls a mock payment provider through a layered path: controller -> integration service -> reliable HTTP client.
- The `ReliableHttpClientService` adds request timeouts, retry with exponential backoff, a circuit breaker, structured JSON logging, and retryable vs non-retryable error classification.
- The `PaymentIntegrationService` adds idempotent handling with an `idempotencyKey` cache and returns a safe deferred response when the provider is unavailable.
- The mock provider intentionally succeeds, returns HTTP 500-style failures, or stalls long enough to trigger a timeout.

## Why Naive Integrations Fail

Common failure modes include timeouts, transient server errors, upstream rate limits, and partial failures where your system does not know whether the remote action completed. Without defensive patterns, services can hang request threads, retry unsafe actions, or amplify provider outages across the rest of the platform.

## Why Retry and Circuit Breakers Help

Retries help recover from short-lived faults such as brief 5xx errors or temporary network latency. Exponential backoff reduces pressure on the provider between attempts. A circuit breaker stops repeated calls once failures cross a threshold, which protects your service from wasting resources on a dependency that is already unhealthy.

## When Retries Should Not Be Used

Do not blindly retry non-idempotent actions unless you have a reliable idempotency key or another deduplication guarantee. Client-side validation errors, authentication failures, and permanent 4xx business rejections are usually non-retryable and should fail fast instead of being retried.

## Test Coverage

The unit tests cover retry recovery, timeout classification, and circuit-breaker fast-fail behavior. Delays are intentionally kept small so the suite stays deterministic and cheap to run.
