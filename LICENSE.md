# ChatHermes Open Source License

Version 1.0, dated 2026-05-03.
Copyright (c) 2026 Getid, Inc. and ChatHermes contributors.

ChatHermes is free software released under the GNU Affero General Public License, version 3 (AGPL-3.0), with the **Required Attribution Addendum**, **Trademark Reservation**, and **Cloud Carve-Out** described below. Together these constitute the "ChatHermes Open Source License" (the "License").

---

## 1. Base license

The full text of AGPL-3.0 applies. See https://www.gnu.org/licenses/agpl-3.0.txt.

This means:
- You may use, modify, and distribute ChatHermes for any purpose, including commercial, on your own infrastructure or as a hosted service.
- If you modify ChatHermes and let users interact with it over a network, you must release your modifications under this same License.

## 2. Required Attribution Addendum

In addition to AGPL-3.0, all distributions and deployments — including modified versions and hosted services derived from ChatHermes — MUST satisfy the following attribution requirements:

### 2.1 Visible attribution
Every page of the user interface that requires authentication, and every public-preview page, MUST display a visible "Powered by ChatHermes" link with `target="_blank" rel="noopener"` linking to `https://chathermes.com`.

### 2.2 Wire-level attribution
Every HTTP response from the orchestrator MUST include the header `X-Powered-By: ChatHermes/<version> (<repo-url>)`.

### 2.3 Source-level attribution
The file `orchestrator/src/_attribution.ts` MUST be present, unmodified in its identifying constants (CHATHERMES, POWERED_BY, ATTRIBUTION_HTML, FLOATING_BADGE_HTML), and imported by `orchestrator/src/index.ts` such that the runtime guard `attributionPresent()` is invoked at startup.

### 2.4 Code-of-origin
A `// Copyright (c) 2026 Getid, Inc. and ChatHermes contributors. Licensed under the ChatHermes Open Source License v1.0` header MUST appear at the top of every modified TypeScript file in `orchestrator/src/`.

If the runtime guard detects tampering with the attribution module, the orchestrator will refuse to start. This is by design.

## 3. Trademark Reservation

The names "ChatHermes" and "ChatHermes.dev", the ChatHermes mascot illustration, and the trade dress of chathermes.com are reserved trademarks of Getid, Inc. They MAY NOT be used for forks, derivative works, competing services, or any deployment that is not a verbatim distribution of an official ChatHermes release.

If you redistribute a modified version of ChatHermes, you MUST re-brand it (different name, different logo). The Required Attribution Addendum (linking back to chathermes.com) still applies.

## 4. Cloud Features Carve-Out

The operational infrastructure of chathermes.com — including but not limited to: pre-pooled LLM API keys, the Hetzner Cloud account used to provision private agents on our managed pool, our Stripe and Resend accounts, our backup infrastructure, our DNS and CDN configuration, and our status page — is NOT distributed under this License. These are cloud-only assets we operate.

This License grants you all rights to the SOURCE CODE in this repository. It does not grant you rights to chathermes.com's infrastructure, customer data, or operating practices.

## 5. Termination

If you violate Section 2 (Required Attribution) or Section 3 (Trademark Reservation), your rights under this License terminate automatically. To restore them: cure the violation within 30 days of notice, and the rights are reinstated.

## 6. Disclaimer

This software is provided "as is", without warranty of any kind. See AGPL-3.0 §15 for the full disclaimer.

---

For questions about commercial licensing or trademark exceptions, contact: hello@chathermes.com.
