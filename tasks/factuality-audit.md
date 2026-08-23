# LeadsRadar factuality audit

## User-reported defect

The application can present plausible but fabricated businesses, contact details, activity history, and analysis as if they were real. The highest-risk paths are not limited to an AI model response: local seed data and server-side demo fallbacks directly create realistic records.

## Confirmed root causes

| Surface | Finding | Risk |
|---|---|---|
| `src/seedData.ts` | Five plausible local businesses contain invented addresses, phone numbers, `.local` emails, statuses, notes, and outreach/deposit histories. | New users receive fake CRM history before performing a search. |
| `src/components/AuthProvider.tsx` | First-time profile creation inserts every seed record; anonymous and shared demo sign-in also use this path. | Fake records are silently persisted to user workspaces and may look like prior customer activity. |
| `src/App.tsx` | A destructive reset deletes user leads and re-inserts the same seed records. Local-storage fallback caches are rehydrated as an instant source. | Deleted or stale synthetic data can reappear and be treated as durable. |
| `server.ts` discovery | `generateDynamicMockLeads` fabricates names, addresses, phone formats, notes, and realistic business narratives. It is returned when Gemini is absent or provider calls fail in development. | The primary lead acquisition route can return invented businesses. |
| `server.ts` enrichment | Development/provider-error paths return synthetic lead-shaped responses. | Enrichment failures can look like successful no-data results. |
| `server.ts` prompts | Gemini is asked to return many factual fields, but a model response is not itself proof of each field. Citation presence is currently checked only at response level. | Unsupported fields can pass through as factual-looking values. |
| `server.ts` pitch/analysis/chat | Canned fallback copy and AI outputs include unsupported claims such as revenue loss, rankings, reviews, competitors, and completed audits. | Generated sales content can assert facts not supported by a source. |
| `SearchScanner.tsx` | Input is embellished with ratings/newness claims and returned notes are appended with authoritative-sounding assertions. | UI amplifies unsupported search claims. |
| `LeadDetailsModal.tsx` | Canned scripts and SWOT copy include fixed metrics and imply audits or competitor evidence. | Presentation layer turns estimates into apparent facts. |
| `src/seedData.ts` and guest auth | Guest/demo mode creates a shared account and has no reliable factual-data boundary. | Multiple users can see fictional records and activity history. |

## Evidence-first contract to implement

1. No automatic seed leads, fake guest accounts, or synthetic records in the normal application path. A first-time user receives an empty workspace.
2. Discovery and enrichment fail closed when the provider is unavailable. They return a structured dependency error, not a lead-shaped fallback.
3. A lead may be labeled `verified` only when the specific record has provider evidence/citations and its values pass bounded normalization. A response-level citation is not sufficient to verify every field.
4. Missing fields remain explicit missing markers. The system never infers email, phone, social URL, owner, rating, revenue, traffic, competitor, or activity facts.
5. Provider output is retained with source URLs/citation metadata. If a field cannot be mapped to evidence, it is removed or labeled `unverified`.
6. AI-generated pitches, SWOT, and chat are labeled generated guidance and must not assert unsupported business facts. Provider failure returns unavailable, not canned factual claims.
7. Client localStorage may cache already persisted records for offline continuity, but it is never an authority or source of new lead facts; stale cache is cleared on snapshot errors or explicit sign-out.
8. User-created CRM records remain allowed, but they are labeled `provided` unless the user explicitly supplies a source URL or the backend verifies them.

## Required verification

Add tests for: no seed writes during profile initialization; no guest/shared-account fallback; discovery provider absence/failure returning structured `503`; enrichment provider absence/failure returning structured `503`; citation-free model output being unverified and stripped of unsupported contact/social fields; no fabricated fallback strings; client search input preservation; and generated analysis/pitch labels. Run unit tests, emulator rule tests, production build, clean HTTP smoke tests, and repository-wide scans for fake data markers.
