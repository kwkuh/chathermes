# Contributing to ChatHermes

Thanks for considering a contribution. ChatHermes is a small project — every PR matters.

## License agreement

By submitting a contribution (PR, issue, comment, code, docs, anything), you agree your work is licensed under the [ChatHermes Open Source License v1.0](./LICENSE.md). This includes the Required Attribution Addendum and Trademark Reservation.

If you're contributing on behalf of a company, please ensure you have authority to license the work under these terms.

## How to contribute

1. **File an issue first** for any non-trivial change. We want to align on direction before you spend time.
2. **Fork → branch → PR**. Keep PRs small and focused. One feature or fix per PR.
3. **Test your change**. The orchestrator has TypeScript strict mode — `cd orchestrator && bun run --bun tsc --noEmit` should pass. The web has `cd web && bun run build` for the final check.
4. **Follow the code style**. Tailwind 4, mono labels for kickers, amber for primary, ink-soft for surfaces. See `web/src/app/globals.css` for the design tokens.
5. **Don't strip attribution**. The runtime guard will refuse to start your orchestrator if you remove `_attribution.ts`. We don't make this easy to bypass — it's a feature, not a bug.

## What to work on

- **Bug fixes** — always welcome
- **New tools** for the agent (must be a real API, no mockups)
- **New skills** for `/app/skills` (must connect to an actual capability)
- **Documentation** — this repo's docs need love
- **Localization** — currently English-only
- **Performance** — orchestrator is fast but always room to improve

## What NOT to work on (without prior alignment)

- **Pricing logic / model rates** — these are env-driven; we don't merge hardcoded rates
- **Removing attribution** — see above
- **Re-branding** — fork it under a different name if you want to re-brand

## Code of conduct

Be kind. Be specific. Don't waste people's time.

## Questions?

Open an issue or reach hello@chathermes.com.
