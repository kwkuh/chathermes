# ChatHermes Open Source License

Version 1.0, dated 2026-05-03.
Copyright (c) 2026 Getid, Inc. and ChatHermes contributors.

ChatHermes is free software released under the GNU Affero General Public
License, version 3 (AGPL-3.0), with the **Required Attribution Addendum**
described below. Together these constitute the "ChatHermes Open Source License".

---

## 1. Base license

The full text of AGPL-3.0 applies. See the file `LICENSE-AGPL` in this
repository, or https://www.gnu.org/licenses/agpl-3.0.txt.

This means:
- You may use, modify, and distribute ChatHermes for any purpose, including
  commercial, on your own infrastructure or as a hosted service.
- If you modify ChatHermes and let users interact with it over a network,
  you must release your modifications under this same license.

## 2. Required Attribution Addendum

In addition to AGPL-3.0, all distributions and deployments — including
modified versions and hosted services derived from ChatHermes — MUST satisfy
the following attribution requirements:

### 2.1 Visible attribution
Every page of the user interface that requires authentication, and every
landing page, must display a visible "Powered by ChatHermes" link pointing
to https://chathermes.com. The link must:
- Be readable on the rendered page (no `display:none`, no zero opacity, no
  `color: transparent`, no covering element).
- Be a clickable hyperlink to https://chathermes.com.
- Use the text "ChatHermes" or include the ChatHermes wordmark.

A reference implementation is `web/src/app/_components/powered-by.tsx`. You
may restyle it to match your visual identity but you may not remove it.

### 2.2 Wire-level attribution
Every HTTP response from the orchestrator MUST include the header
`X-Powered-By: ChatHermes` (the version suffix is optional). Removal or
modification of this header constitutes license breach.

### 2.3 Source-level attribution
Every distribution of ChatHermes source code or binary build MUST retain:
- This `LICENSE.md` file
- The `NOTICE.md` file
- All copyright headers in source files
- The `<meta name="generator" content="ChatHermes …">` tag in HTML output

### 2.4 Code-of-origin acknowledgement
Forks may rename the product but the rebranded product's documentation
must include, in a place a reasonable user would find ("About", footer,
README), the sentence:

> "Built on ChatHermes — https://chathermes.com (ChatHermes Open Source License)."

## 3. Trademark Reservation

The names "ChatHermes" and "ChatHermes Cloud", the ChatHermes wordmark,
mascot illustrations, and the chathermes.com domain are trademarks of
Getid, Inc. They are NOT licensed by this agreement. You may NOT:
- Use "ChatHermes" or any confusingly similar name as the product name
  for a fork or derivative work.
- Reproduce, redistribute, or modify the ChatHermes mascot or wordmark.
- Use ChatHermes branding in a way that suggests official endorsement.

You ARE permitted to use the name "ChatHermes" in factual statements such
as "Built on ChatHermes" or "Forked from ChatHermes".

## 4. Cloud Features Carve-Out

Some features are operated only at https://chathermes.com and are NOT
included in this open-source distribution. These include but are not
limited to: model pricing intelligence, marketplace plugin registry,
public discovery gallery, aggregate-memory machine learning, vector
memory, real-time multiplayer collaboration, smart model routing,
auto-scaling tenant orchestration, AI concierge onboarding, and
compliance reporting tooling. The source code for these is owned by
Getid, Inc. and is not subject to AGPL-3.0 or this license.

See `docs/CLOUD_FEATURES.md` for the full split.

## 5. Termination

Failure to comply with section 2 (Required Attribution) or section 3
(Trademark Reservation) automatically terminates your rights under this
license. Termination does not affect users of products you previously
shipped in compliance, but you may not ship new versions until the
breach is cured.

## 6. Disclaimer

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED. SEE AGPL-3.0 FOR THE FULL DISCLAIMER.

---

## TL;DR for builders

- ✅ Fork it. Modify it. Run it commercially.
- ✅ Sell hosting based on it.
- ✅ Build your own product on top of it.
- ❌ Strip the "Powered by ChatHermes" link from the UI.
- ❌ Remove the `X-Powered-By: ChatHermes` HTTP header.
- ❌ Use the ChatHermes name or mascot for your fork.
- ❌ Reuse our `cloud/` features (they're not in this repo anyway).

We want you to build with ChatHermes. We just want everyone to know
where it came from.

— Getid, Inc.
