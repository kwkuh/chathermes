# ChatHermes Design System (v0)

> Visual signature must do two jobs: feel obviously NOT-ChatGPT, and feel premium-trusted enough that "agent that runs while you sleep" reads as serious, not toy.

## Anti-patterns to avoid

- ChatGPT gray/blue clean-slate look (everyone copies this — looks like a wrapper)
- Generic shadcn-default landing page (zinc + violet button — AI slop tell)
- Cyberpunk neon "AI agent" cliché (too gimmicky for paid product)
- Stock illustrations of robots / brains / circuits

## Signature principles

1. **Warm-dark over cool-dark.** Default theme is charcoal-warm with paper-cream accents — feels like a leather-bound journal, not a server console. Light mode exists but dark is the canonical look.
2. **Editorial typography.** Serif display headline + grotesk body + monospaced "agent voice". Three families, each does ONE job. Never mix.
3. **Living interface.** Subtle motion everywhere — agent activity isn't a static log, it's a current. Cursor-blink on agent thinking, slow-pulse on background tasks, ambient particle drift on idle (low-key, not gamer).
4. **No glass-morphism, no gradients on text.** Solid surfaces, deliberate contrast, ink-and-paper restraint.
5. **Hermes branding nod.** Caduceus/winged-foot motif used minimally as marker glyph (NOT logo) — appears in agent avatar, loading state, empty state. Reference the Greek messenger god, don't cosplay.

## Color tokens

    --ink:        #0F0E0C    /* primary surface, dark mode */
    --ink-soft:   #1A1815
    --ink-line:   #2A2724    /* dividers, hairlines */
    --paper:      #F5EFE3    /* primary surface, light mode + accent text on dark */
    --paper-soft: #EBE3D3
    --amber:      #E8A547    /* primary action, agent presence */
    --amber-deep: #B07820    /* hover/active */
    --moss:       #5C7A4F    /* success, completion */
    --rust:       #B5421C    /* error, urgent */
    --plum:       #5E3A6E    /* memory/long-term marker */

Palette intent: **journal-with-gilt-edges**, not **app-with-brand-color**.

## Typography stack

    --font-display:  'Söhne Breit', 'Canela Deck', Georgia, serif    /* serif/grotesk display */
    --font-body:     'Söhne', 'Inter', system-ui, sans-serif
    --font-mono:     'Berkeley Mono', 'JetBrains Mono', monospace
    --font-agent:    'Söhne Mono', monospace                         /* agent's voice = monospaced */

Headlines: serif/display, 1.0 line-height, slightly tight tracking.
Body: grotesk, 1.5 line-height, never below 15px.
Agent messages: monospaced — readable as "the machine is speaking" without being intimidating.

## Hero pages — what to build

### 1. Landing (`/`)
- Above the fold: serif headline **"The chat that doesn't end when you close the tab."**
- Sub: one sentence, body grotesk: "ChatHermes is a chatbot that keeps working — running tasks, learning your taste, reaching you on Telegram while you're offline."
- CTA: amber button "Start chatting" (no signup gate; signup happens later, contextually).
- Scroll: 3 short scenes (PR review, newsletter draft, late-night idea → demo) — each a real terminal-style transcript, not an illustration.

### 2. Chat (`/c` or `/`)
- Full-bleed canvas, message column max 720px centered.
- Right panel (collapsible): **Live Activity** — swarm view showing subagent cards when agent spawns parallel work. Empty when nothing running. Never a sidebar bloated with menus.
- Left rail (slim, 56px): project switcher (avatar circles), each project = "room" with isolated memory.
- Top bar: project name + agent status dot (idle / thinking / running-bg-task / waiting-for-you).

### 3. Memory (`/m`)
- Horizontal **lifeline** — scrollable timeline of what agent knows about you, organized by topic chips at the top.
- Each memory = a card you can edit/delete (memory is reviewable, never opaque).
- Empty state: literal blank journal page, paper texture, monospaced cursor.

### 4. Skills (`/s`)
- App-store grid. 30 curated skills, each a card with icon + 1-line + "active" toggle.
- Hero featured row at top: 3 ChatHermes-original skills (Research / Content Drafter / Code Asst).

### 5. Onboarding wizard
- Single-screen, 3-step inline (no multi-page flow).
- Step 1: "What do you want help with?" — user types free text (becomes initial agent context).
- Step 2: "What should we call you?" — name only. Email only on save/connect.
- Step 3: "Want me to ping you on Telegram?" — skippable, becomes ambient prompt later if dismissed.
- Total onboarding time: <30 sec for the user who clicks through.

## Motion language

- Page transitions: 180ms ease-out, displacement 4px max. Never bouncy.
- Agent typing: monospaced caret blink, 530ms (not the boring 1000ms blink).
- Subagent spawn: card eases in from below thinking message, gentle.
- Memory write: amber underline sweeps under text where memory was extracted (subtle "noted" feedback).
- Idle ambient: very slow horizontal grain shift on background paper texture, 60s loop, almost imperceptible.

## Components — first 10 to build

1. `<ChatComposer>` — input + attachments + model picker
2. `<MessageStream>` — bubble-less, indented-by-role, monospaced for agent
3. `<SubagentCard>` — live activity panel item (status, current step, output preview)
4. `<ProjectAvatar>` — circular, monogram or emoji, status dot
5. `<MemoryCard>` — editable journal-style entry
6. `<SkillCard>` — app-store tile with toggle
7. `<MagicLinkInput>` — single-field email + send button
8. `<OnboardingPrompt>` — wizard step
9. `<AgentStatusDot>` — 4 states with color
10. `<EmptyState>` — paper-texture canvas + monospaced cursor

## Dev plan (UI revamp on top of hermes-workspace)

- Keep: SSE streaming, terminal/Monaco/file-manager (hide for normal users, expose under "Developer" toggle)
- Replace: theme system (introduce `chathermes` theme as default, hide upstream's 8 themes from non-power users)
- Add: landing page route, onboarding wizard, memory lifeline view, skill marketplace
- Modify: top nav IA — Projects > Sessions, not the other way around

## Open design questions

- Logomark: full caduceus too literal? Try abstract winged-glyph variant. Decide after first pass.
- Light theme: ship at v1 or v2? Lean v2 — dark is the demo-video look.
- Brand voice in copy: editorial-warm (think Are.na, Substack) — NOT enthusiastic-marketer. Already drafted above.
