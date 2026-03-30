# Design System — Collective Memory

## Product Context
- **What this is:** A bilingual graph-based interface for exploring a living archive of projects, profile, and cross-project connections. It helps a researcher or knowledge-heavy builder see how their work relates over time, not just store notes.
- **Who it's for:** Primarily an individual researcher, writer, or builder with a large body of active and archival work. Secondarily a small knowledge-heavy team that needs orientation across projects.
- **Space/industry:** Personal knowledge management, research graph, digital archive, knowledge navigation.
- **Project type:** Web app / dashboard.

## Aesthetic Direction
- **Direction:** Editorial atlas
- **Decoration level:** Intentional
- **Mood:** Calm, literate, navigational, and slightly archival. It should feel like an atlas, finding aid, or research instrument, not a blank startup dashboard.
- **Reference sites:** https://capacities.io/, https://heptabase.com/, https://milanote.com/, https://obsidian.md/

## Typography
- **Display/Hero:** `Fraunces` — adds authorship, gravity, and a strong editorial identity that fits memory and knowledge work.
- **Body:** `Instrument Sans` — clear in both English and Spanish, modern without feeling generic.
- **UI/Labels:** `Instrument Sans` — keep controls, nav, and drawers legible and consistent.
- **Data/Tables:** `IBM Plex Mono` — strong fit for metadata, tags, file paths, timestamps, and graph diagnostics. Use tabular numerals where available.
- **Code:** `IBM Plex Mono`
- **Loading:** Google Fonts for prototype and preview. For product code, self-host if bundle and privacy requirements justify it later.
- **Scale:** xs `12px`, sm `14px`, base `16px`, md `18px`, lg `24px`, xl `32px`, 2xl `48px`, 3xl `64px`

## Color
- **Approach:** Restrained
- **Primary:** `#171717` — ink. Main text, anchors, strong UI controls.
- **Secondary:** `#C65A3D` — terracotta. Accent, selected states, active connections, and moments of emphasis.
- **Neutrals:** `#FCFAF6`, `#F4EFE6`, `#DDD5C8`, `#B8B1A3`, `#5F625F`, `#171717`
- **Semantic:** success `#6E7D68`, warning `#B89446`, error `#C65A3D`, info `#32424A`
- **Dark mode:** Keep the same hierarchy but invert surfaces. Use deep olive-charcoal surfaces instead of flat black, reduce accent saturation slightly, and preserve warm neutrals so the product still feels archival rather than neon-tech.

## Spacing
- **Base unit:** `8px`
- **Density:** Comfortable-compact
- **Scale:** 2xs(`4`), xs(`8`), sm(`12`), md(`16`), lg(`24`), xl(`32`), 2xl(`48`), 3xl(`64`)

## Layout
- **Approach:** Hybrid
- **Grid:** App shell uses disciplined columns. Desktop: `12` columns. Tablet: `8`. Mobile: `4`. Graph and inspector layouts should prioritize stable alignment over novelty.
- **Max content width:** `1200px` for marketing and settings surfaces, full-bleed for graph canvas.
- **Border radius:** xs `6px`, sm `10px`, md `14px`, lg `20px`, full `9999px`

## Motion
- **Approach:** Intentional
- **Easing:** enter(`cubic-bezier(0.16, 1, 0.3, 1)`), exit(`ease-in`), move(`ease-in-out`)
- **Duration:** micro(`80-120ms`), short(`140-220ms`), medium(`240-360ms`), long(`400-600ms`)

## Safe Choices
- Strong legibility and disciplined contrast for all graph-adjacent UI.
- Grid-first app layout so dense information remains navigable.
- Modest motion that guides attention without glamorizing the interface.

## Risks
- Serif display typography in a graph product. This gives the app an editorial, authored identity instead of generic SaaS polish.
- Warm paper and terracotta palette instead of white-purple or cold grayscale defaults. This makes the archive metaphor believable and distinct.
- Provenance-forward mono styling for metadata and commands. This leans into research credibility and system literacy.

## Implementation Notes
- Do not use purple gradients, soft blob backgrounds, or default SaaS feature-card aesthetics.
- The graph itself is already visually busy. Keep surrounding chrome quieter than the node field.
- Use terracotta sparingly. If everything is accented, nothing is accented.
- Keep bilingual copy comfortable. Spanish labels will often run longer than English ones, so avoid brittle widths.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-30 | Initial design system created | Created by `/design-consultation` based on repo context plus research across Capacities, Heptabase, Milanote, and Obsidian. |
| 2026-03-30 | Chose editorial atlas over brutalist productivity | The product's primary job is orientation across a body of work, not generic note capture. |
