# LeadsRadar Public-Release UX Plan

## Product direction

LeadsRadar is a **quiet operating system for evidence-first prospecting**: a focused workspace where provider-returned business records, user-owned workflow state, and clearly labeled planning guidance remain distinct. The interface should feel calm, precise, and trustworthy rather than decorative or promotional. The primary emotional response is confidence: users should understand what is known, what is missing, what is locally cached, and what requires a provider or server action.

## Visual grammar

| Role | Direction |
|---|---|
| Typography | Use the system UI stack for fast, native-feeling rendering. Use a restrained display scale, readable body text, compact metadata, and monospace only for IDs, statuses, and technical values. |
| Palette | Near-black blue-gray page background; layered graphite panels; warm orange for primary action and evidence signals; blue for information; emerald for confirmed state; amber for unavailable or pending state; rose for errors. Color is never the only status carrier. |
| Surfaces | Use glass selectively for the application shell, search controls, and elevated dialogs. Keep content cards mostly opaque enough for readable contrast. Borders are low-contrast hairlines with a stronger focus treatment. |
| Shape | Consistent medium radii for controls and cards; larger radii for dialogs and shell regions. Avoid pill-shaped controls except for compact status badges. |
| Iconography | Lucide icons paired with visible text or accessible names. Icons communicate category and state; they do not replace labels for critical actions. |
| Motion | Use transform and opacity only for non-essential motion. Short press and hover responses should acknowledge interaction immediately. Disclosure and dialog transitions should preserve spatial context. |

## Anti-generic constraints

The UI must not use a full-screen gradient as the main hierarchy, blur every card, rely on tiny gray text, use animation as the only loading or success cue, claim exact entitlement from browser counters, or present generated guidance as provider evidence. Heavy effects must remain bounded so readability and low-end performance win over novelty.

## Screen composition rules

The authentication screen prioritizes the product promise, the active sign-in method, and a clear distinction between anonymous session access and an account. The workspace header keeps identity, current view, and the primary action visible at every desktop width. The discovery panel places territory and category inputs before the scan action, with provider availability, loading, empty, error, and quota states close to the action. Lead cards prioritize provider identity, address, source link, missing-data markers, and workflow status. Analytics and audit surfaces remain secondary and lazy-loaded. Dialogs must have a visible heading, a close action, an Escape path, focus return, and a bounded scroll region.

## Responsive transformations

| Viewport | Composition |
|---|---|
| 320–479 px | Single-column shell; controls stack; icon-only actions require accessible labels and adequate touch targets; cards use full width; dialogs use nearly the full viewport with internal scrolling. |
| 480–767 px | Single-column content with compact two-column metadata where it remains readable; header actions may move into a menu; filters wrap without horizontal clipping. |
| 768–1023 px | Two-column lead grid where content remains legible; search controls may share a row; dialog widths remain bounded with safe side padding. |
| 1024 px and above | Wide shell with stable max width, two- or three-column lead grid, persistent navigation context, and no stretched text measures. |

## State and data UX matrix

| State | Preserve | Communicate | Offer |
|---|---|---|---|
| Initial loading | Shell, headings, current filters | Which provider-backed operation is loading | Wait without blanking the whole workspace |
| Refreshing | Existing leads and selection | Refreshing indicator near the affected region | Retry or continue reading |
| Provider success | Returned identity and provenance | Provider source and retrieval time | Save or inspect details |
| Provider empty | Query and filters | No matching provider records were returned | Adjust territory/category |
| Provider unavailable | Existing workspace data | Discovery is unavailable or unconfigured; no synthetic fallback | Retry or continue with saved records |
| Guest limit reached | Existing local session snapshot | Anonymous browser guard reached its advisory limit | Sign in or stop; never imply server entitlement |
| Billing unavailable | Pricing context | MoonPay is not configured on the server; no payment started | Close modal or return later |
| Persistence error | User-entered lead and known data | Firestore sync failed and local fallback status | Retry; never claim cloud persistence |
| Success mutation | Updated record | What changed and where | Undo only when rollback is explicit |

## Accessibility checklist

All controls use native buttons, links, inputs, and headings wherever possible. Every form control has a programmatic label and associated error or description. Tab interfaces expose `tablist`, `tab`, `tabpanel`, `aria-selected`, and keyboard activation semantics. Dialogs expose a name and description, move focus into the dialog, trap focus while open, close on Escape, and return focus to the trigger. Status and error regions use restrained live announcements. Focus-visible outlines remain visible against glass surfaces. The reduced-motion media query removes decorative travel and looping effects while keeping state and completion feedback understandable. Layouts are tested at 200% zoom and narrow widths without horizontal clipping.

## Motion tokens

| Token | Value | Use |
|---|---:|---|
| `--motion-fast` | 120 ms | Press, hover, focus-color response |
| `--motion-standard` | 180 ms | Surface and disclosure transitions |
| `--motion-slow` | 260 ms | Dialog and route-level entrance |
| Easing | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Enter and settle |
| Press scale | `0.985` maximum | Button acknowledgement only |
| Reduced motion | 0 ms travel; preserve opacity/color/state | System preference override |

## Performance budget and measurement

The initial authenticated shell should target less than 250 kB compressed JavaScript on the main route, a first meaningful shell within 2.5 seconds on a mid-range mobile simulation over fast 3G, and no avoidable layout shift from late fonts or images. The current build warning is approximately 200.7 kB gzip for the main bundle, so the first optimization target is route-level deferral and dependency inspection rather than visual removal. No Core Web Vitals claim is made until browser measurements are captured on representative viewport and network conditions.

## Validation matrix

The release pass must run typecheck, unit tests, Firestore rules tests where the emulator is available, production build, dependency audits, browser smoke at 320/768/1024/1440 widths, keyboard dialog and tab checks, reduced-motion verification, and a non-destructive provider-unavailable flow. Any live deployment check must be explicitly authorized at the point of action and must not expose or enter secret values.
