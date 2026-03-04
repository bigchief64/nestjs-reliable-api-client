# Failure Modes

Several failure scenarios are intentionally simulated in this project.

## External API Timeouts

The external service may fail to respond within a reasonable time window.
Requests are protected by timeouts to prevent thread exhaustion.

## Transient Failures

Temporary failures are retried using exponential backoff.

## Persistent Failures

Repeated failures open the circuit breaker to prevent overwhelming the external system.

## Duplicate Requests

Requests may be retried by clients or infrastructure.
Idempotent request handling ensures duplicate requests do not cause duplicate side effects.
