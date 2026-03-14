# Security Policy

## Status

Pulse is currently a prototype application and is not yet deployed as a hardened production system. Some features still rely on mock data, client-managed state, and prototype-only integrations. Treat the repository accordingly when evaluating risk.

## Supported Versions

This repository does not currently publish versioned security support windows. Security fixes should be applied to the active working branch and carried forward before any public release.

## Reporting a Vulnerability

Please do not report security issues in public GitHub issues, pull requests, or discussions.

Instead, report vulnerabilities privately to the repository maintainers through your normal private channel for this project. Include:

- A short description of the issue and affected area
- The files, components, or endpoints involved
- Reproduction steps
- Any proof of concept or screenshots
- The expected impact
- Suggested mitigations if you have them

If this project is made public later, replace this section with a dedicated security contact before launch.

## Current Security Priorities

The most important security gaps in the current prototype are:

1. Authentication and authorization
There is not yet a production-grade auth and session boundary for user, admin, venue-owner, or developer surfaces.

2. Server-side secret handling
API key creation and webhook signing logic exist as library code today and must move behind trusted server routes before launch.

3. Client-side third-party calls
External services such as reverse geocoding should be proxied or mediated by server-side controls before production release.

4. Prototype persistence
Some app state is stored in client-managed layers and needs a clearer split between secure server state, local preferences, and offline cache.

5. Dependency hygiene
Dependencies should be audited regularly, and known vulnerabilities should be triaged before each release candidate.

## Secure Development Expectations

Before a production launch, this repository should have:

- Private vulnerability reporting and incident ownership
- Secret management outside the client bundle
- Rate limiting and abuse controls on public-facing endpoints
- Audit logs for privileged actions
- Error monitoring and alerting
- Dependency and supply-chain review
- A documented response plan for account abuse, privacy incidents, and service outages
