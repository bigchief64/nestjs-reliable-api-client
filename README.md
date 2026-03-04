# NestJS Reliable API Client Example

This repository demonstrates reliability patterns commonly used in production backend systems.

This example shows a small NestJS payment flow that treats third-party APIs as unreliable by default. A naive integration often assumes every call is fast, successful, and safe to repeat; in production that causes duplicate charges, stuck requests, noisy logs, and cascading failures when a provider is slow or down.

## What It Demonstrates

- `POST /payments/process` calls a mock payment provider through a layered path: controller -> integration service -> reliable HTTP client.
- The `ReliableHttpClientService` adds request timeouts, retry with exponential backoff, a circuit breaker, structured JSON logging, and retryable vs non-retryable error classification.
- The `PaymentIntegrationService` adds idempotent handling with an `idempotencyKey` cache and returns a safe deferred response when the provider is unavailable.
- The mock provider intentionally succeeds, returns HTTP 500-style failures, or stalls long enough to trigger a timeout.

## Why Naive Integrations Fail

Common failure modes include timeouts, transient server errors, upstream rate limits, and partial failures where your system does not know whether the remote action completed. Without defensive patterns, services can hang request threads, retry unsafe actions, or amplify provider outages across the rest of the platform.

## Failure Modes This Architecture Protects Against

- Slow or hung upstream calls: timeouts prevent a single provider request from tying up your worker indefinitely.
- Brief transient outages: retry with exponential backoff gives short-lived 5xx or network failures a chance to recover without hammering the provider.
- Retry storms during provider incidents: the circuit breaker stops repeated calls once the dependency is clearly unhealthy, which limits wasted work and protects your own service capacity.
- Duplicate side effects after uncertain outcomes: idempotent handling ensures the same `idempotencyKey` does not create multiple payment attempts when clients retry.
- Ambiguous partial failures: when the provider cannot be trusted, the integration returns a deferred response instead of pretending the payment succeeded.
- Misclassified errors: retryable vs non-retryable classification avoids re-sending requests that should fail fast, such as permanent 4xx-style business errors.
- Poor incident visibility: structured JSON logs make it easier to trace attempts, retries, circuit state, and failure reasons in production logs.

## Why Retry and Circuit Breakers Help

Retries help recover from short-lived faults such as brief 5xx errors or temporary network latency. Exponential backoff reduces pressure on the provider between attempts. A circuit breaker stops repeated calls once failures cross a threshold, which protects your service from wasting resources on a dependency that is already unhealthy.

## When Retries Should Not Be Used

Do not blindly retry non-idempotent actions unless you have a reliable idempotency key or another deduplication guarantee. Client-side validation errors, authentication failures, and permanent 4xx business rejections are usually non-retryable and should fail fast instead of being retried.

## Test Coverage

The unit tests cover retry recovery, timeout classification, and circuit-breaker fast-fail behavior. Delays are intentionally kept small so the suite stays deterministic and cheap to run.
