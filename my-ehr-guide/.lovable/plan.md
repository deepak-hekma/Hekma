
# Hekma — Frontend Prototype Plan

A polished, frontend-only prototype of a patient-facing FHIR chatbot. Mocked FHIR records, simulated chatbot responses, warm/approachable visual tone. No backend, no Neo4j, no AI calls — everything runs locally so the UX is fully demoable.

## Scope (this iteration)
- Mocked FHIR record set bundled as JSON
- Three-pane layout: records sidebar (left) · record detail (center) · chatbot (right, always visible)
- Simulated chatbot with streaming-style typing, canned intent responses, "Ask about this record" handoff
- Empty / loading / error states
- Warm visual system (off-white #FBFAF7, sage/teal #2F8F83, deep ink #1F2A2E)
- No auth, no persistence beyond in-memory + localStorage for chat history

Out of scope: Neo4j, real LLM, HIPAA-grade auth, multi-patient, EHR write-back.

## Visual direction
- Palette: bg `#FBFAF7`, surface `#E8EFEA`, ink `#1F2A2E`, accent `#2F8F83`, muted accent for tags per category
- Typography: serif display for headings (e.g. Instrument Serif) + humanist sans for body (Work Sans / Inter) — warm but legible for health data
- Generous spacing, 12–16px radii, soft shadows, no hard clinical lines
- Motion: subtle fade/slide on message append, shimmer "thinking" indicator, smooth panel resize, category accordion ease — nothing flashy

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: Hekma logo · patient name · settings                │
├────────────┬──────────────────────────────┬──────────────────┤
│ Sidebar    │ Record detail               │ Chat panel       │
│ (records)  │ (selected record or         │ (always visible) │
│            │  overview dashboard)        │                  │
│ Search     │                             │ Messages         │
│ Sort ⇅     │                             │                  │
│ ▸ Labs     │                             │                  │
│ ▸ Meds     │                             │                  │
│ ▸ Cond.    │                             │ Composer         │
│ ▸ Enc.     │                             │                  │
│ ▸ Immun.   │                             │                  │
└────────────┴──────────────────────────────┴──────────────────┘
```

Responsive: under ~1024px the chat collapses to a right-edge drawer with a floating toggle; sidebar collapses to a hamburger sheet under ~768px.

## Records sidebar
- Grouped by FHIR category: Labs, Medications, Conditions, Encounters, Immunizations, Allergies
- Each group is a collapsible section with count badge
- Top controls: search input (fuzzy across name/code/notes) + sort toggle (Category ⇄ Date)
- Each row: icon · title · short subtitle (date / value) · status dot
- Selecting a row loads it in the center pane and emits a "context" pill into the chat composer ("About: HbA1c — Mar 2025")

## Record detail (center)
- Default view: patient overview dashboard — greeting, vitals snapshot cards, "recent activity" timeline, suggested questions chips that prefill the chat
- Selected record view: header (title, date, source provider), structured FHIR fields rendered in plain-language pairs, raw FHIR JSON behind a "View source" disclosure, "Ask Hekma about this" button → focuses chat with the record context pill attached

## Chat panel (right, always visible)
- Header: "Hekma" + small status ("Reading your records")
- Messages: user (filled sage bubble, right) · assistant (no bubble, plain ink on bg, left) with markdown
- Streaming simulation: token-by-token reveal with shimmer "Thinking…" before first token
- Composer: textarea + send; context pill chip above input when a record is attached, removable
- Suggested prompts on empty state: "What was my last lab result?", "Explain my medications", "When was my last visit?"
- Persistence: chat history in `localStorage` keyed `hekma.chat.v1`; "New conversation" button clears it
- Single conversation (no threads) — matches scope

## Simulated chatbot behavior
A small intent router in `src/lib/chatbot.ts`:
1. If a record context pill is attached → respond using that record's structured fields ("Your HbA1c on Mar 12 2025 was 6.4%. That's slightly above the 5.7% threshold…")
2. Keyword intents over mock data: last lab, medications list, next/last appointment, allergies, immunization status
3. Fallback: "I can only answer from records I can see. Try asking about your labs, medications, conditions, encounters, or immunizations." + 3 suggestion chips
4. Every assistant message ends with a "Sources" row listing the record IDs it referenced; clicking a source opens that record in the center pane

Guardrails: assistant always disclaims "Educational summary, not medical advice" on first message of a session; never invents values not present in mock data.

## Edge cases handled
- No records in a category → friendly empty card with illustration
- No records at all → onboarding overview only, chat suggests "I don't see any records yet"
- Unparseable query → fallback intent above
- Long record lists → virtualized list + search
- Reduced motion: respects `prefers-reduced-motion`

## Accessibility
- Single `<main>`, proper landmarks for the three panes (`aside`, `main`, `aside`)
- All icon-only buttons get `aria-label`
- Chat log is an `aria-live="polite"` region; new messages announced
- Focus management: send returns focus to textarea; opening a record moves focus to detail heading
- WCAG AA contrast verified on the chosen palette (sage on off-white tested for body and accents)
- Keyboard: ⌘/Ctrl+K focuses chat, Esc clears context pill, ↑ in empty composer recalls last prompt

## Tech & file structure
- Vite + React + TanStack Start (existing), Tailwind v4 + shadcn/ui, AI Elements for chat surface (Conversation, Message, MessageResponse, PromptInput, Shimmer, Tool)
- Custom Hekma logo image (generated) — not Sparkles
- Routes: single `/` route (one conversation, no threads)
- State: React state + `localStorage` for chat; Zustand not needed at this size

```text
src/
  routes/index.tsx                 # three-pane shell
  components/
    layout/TopBar.tsx
    records/RecordsSidebar.tsx
    records/RecordGroup.tsx
    records/RecordRow.tsx
    records/RecordDetail.tsx
    records/OverviewDashboard.tsx
    chat/ChatPanel.tsx
    chat/MessageList.tsx
    chat/Composer.tsx
    chat/ContextPill.tsx
  lib/
    mockFhir.ts                    # seeded patient + ~25 resources
    fhirFormat.ts                  # FHIR → plain-language pairs
    chatbot.ts                     # intent router + streaming simulator
    chatStorage.ts                 # localStorage helpers
  assets/hekma-logo.png
  styles.css                       # theme tokens, fonts
```

## Phased build
1. Theme tokens, fonts, logo, three-pane shell, top bar
2. Mock FHIR data + sidebar (groups, search, sort) + record detail + overview dashboard
3. Chat panel via AI Elements + simulated streaming + intent router + context pill handoff
4. Empty/loading/error states, a11y pass, reduced-motion pass, responsive collapse
5. Polish: micro-animations, suggested-prompts, sources row, "New conversation"

## Open questions (won't block; sensible defaults assumed)
- Patient persona name/age for the mock (default: "Amelia Chen, 42")?
- Should the overview dashboard show a vitals chart (line chart for HbA1c/BP trend) or stay card-only? Default: small sparkline cards.
- Light-only or include dark mode toggle? Default: light only for this iteration.

If those defaults are fine, I'll build straight through phases 1–5.
