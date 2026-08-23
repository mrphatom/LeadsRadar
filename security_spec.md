# Security Specification - LeadsRadar Security Verification

This specification lists the core invariant models, the threat scenarios ("Dirty Dozen" payloads), and rules targeting high-integrity, zero-trust storage in Firestore.

## 1. Data Invariants

1. **User Ownership**: A lead or search query history item cannot exist without a valid `ownerId` / `userId` matching `request.auth.uid`.
2. **Terminal State Locking**: Once a lead has a final status or outcome (e.g., `rejected` or `won`), only authorized admins or owners can proceed, adhering to strict business logic.
3. **Strict Validation**: Leads must contain valid, sanitized fields (no code injection or payload overflow blocks).
4. **Time Veracity**: Timestamps like `createdAt` and `timestamp` must match the server-trusted `request.time`.

## 2. The "Dirty Dozen" Threat Payloads

Here are 12 specific payloads attempting to spoof identity, bypass state transitions, or inject resource-exhaustion items:

### Payload 1: Spoofr (Identity Spoofing - Creating lead for another user)
```json
{
  "id": "lead_123",
  "ownerId": "victim_uid",
  "name": "Cozy Café",
  "country": "USA",
  "city": "Seattle",
  "category": "Cafe",
  "phone": "+123456789",
  "email": "contact@cozy.cafe",
  "status": "new",
  "createdAt": "2026-05-22T02:00:00Z"
}
```

### Payload 2: Ghost Field Injector (Bypassing strictly matching keys on create)
```json
{
  "id": "lead_123",
  "ownerId": "attacker_uid",
  "name": "Cozy Café",
  "country": "USA",
  "city": "Seattle",
  "category": "Cafe",
  "phone": "+123456789",
  "email": "contact@cozy.cafe",
  "status": "new",
  "createdAt": "2026-05-22T02:00:00Z",
  "isVerifiedByAdmin": true
}
```

### Payload 3: Privilege Escalation (User self-assigning Admin status in public/private node)
```json
{
  "uid": "attacker_uid",
  "email": "attacker@gmail.com",
  "isAdmin": true
}
```

### Payload 4: Invalid Enum Status Inject (Setting Lead status to rogue string)
```json
{
  "id": "lead_123",
  "ownerId": "attacker_uid",
  "name": "Cozy Café",
  "country": "USA",
  "city": "Seattle",
  "category": "Cafe",
  "phone": "+123456789",
  "email": "contact@cozy.cafe",
  "status": "super-won-hacked",
  "createdAt": "2026-05-22T02:00:00Z"
}
```

### Payload 5: Deny of Wallet String Overflow (Injecting a 2MB string as name)
```json
{
  "id": "lead_123",
  "ownerId": "attacker_uid",
  "name": "A...[2 Megabytes of junk text]...",
  "country": "USA",
  "city": "Seattle",
  "category": "Cafe",
  "phone": "+123456789",
  "email": "contact@cozy.cafe",
  "status": "new",
  "createdAt": "2026-05-22T02:00:00Z"
}
```

### Payload 6: Rogue Temporal Value (Injecting past/future client-controlled timestamp)
```json
{
  "id": "lead_123",
  "ownerId": "attacker_uid",
  "name": "Cozy Café",
  "country": "USA",
  "city": "Seattle",
  "category": "Cafe",
  "phone": "+123456789",
  "email": "contact@cozy.cafe",
  "status": "new",
  "createdAt": "1999-01-01T00:00:00Z"
}
```

### Payload 7: Lead Hijack (An authenticated user attempting to write or read someone else's lead)
```json
// PATCH request from attacker_uid targeting /leads/lead_shared_by_user_x
{
  "category": "Vandalized Category"
}
```

### Payload 8: History Scraper (Malicious user attempting blank scan collections read / query)
```json
// Query targeting /queries with no filter for userId
```

### Payload 9: Invalid ID Character Poisoning (Utilizing directory traversal format in document ID)
```json
// Attempting to write document to path: /leads/../../sys_configs
{
  "id": "poison"
}
```

### Payload 10: Immutable Key Violation (Attempting to shift ownerId on update)
```json
{
  "ownerId": "new_attacker_uid"
}
```

### Payload 11: Spoofed Email Verification Bypass (Auth verified check fail)
```json
// Write trigger when auth.token.email_verified == false
```

### Payload 12: Invalid Territory Region Enforcer (Rogue country selection)
```json
{
  "id": "lead_123",
  "ownerId": "attacker_uid",
  "name": "Cozy Café",
  "country": "Narnia",
  "city": "Seattle",
  "category": "Cafe",
  "phone": "+123456789",
  "email": "contact@cozy.cafe",
  "status": "new",
  "createdAt": "2026-05-22T02:00:00Z"
}
```

## 3. Test Runner Design

All security rules must enforce rejection of any payload violating these conditions by verifying `request.auth.uid` against the object structure and enforcing strict field/type checks.

## 4. Implemented Firestore Contract

The deployed rules must remain aligned with `firestore.rules`. User profile reads are owner-only; profile creates are restricted to a free, non-subscription state; client profile updates are limited to presentation and integration-status fields; and subscription, payment-reference, and credential fields are server-authoritative. Gmail encrypted material belongs under `users/{uid}/integrations/gmail`, which is an Admin SDK path and is not readable or writable by the browser client.

Lead documents are owner-only for reads, creates, updates, and deletes. Creates and updates enforce bounded fields, supported status values, immutable `ownerId`, `id`, and `createdAt`, and the provenance-aware fields `dataQuality`, `verificationSummary`, `sourcePlatform`, and `verificationScore`. Search history documents are owner-only, create-only, bounded, and require the authenticated `userId`.

## 5. Required Behavioral Rule Tests

Before production rules deployment, run authenticated and unauthenticated emulator tests covering owner-only profile reads, cross-user profile denial, rejection of client subscription-field changes, lead ownership and immutable-key enforcement, unknown-key rejection, timestamp immutability, query-history ownership, and synthetic/unverified provenance field acceptance. Syntax compilation alone is not sufficient evidence that these authorization invariants hold.

## 6. MoonPay payment schema and authorization

MoonPay checkout creates a server-owned `moonpayOrders/{orderId}` document with `provider: "moonpay"`, `uid`, `period`, `status: "pending"`, `externalTransactionId`, locked fiat and crypto currency settings, treasury wallet, environment, and timestamps. The Admin SDK alone may create, read, update, or complete these documents; the client has no access under the explicit deny rule.

The completion webhook may activate `users/{uid}` only after authenticating the MoonPay signature, validating a fresh timestamp, requiring `transaction_updated` with `data.status == "completed"`, matching the server-created `moonpay_{uuid}` order, and matching the configured treasury wallet. The fulfillment transaction marks the order completed and updates the existing server-owned subscription fields atomically. Client-created order IDs, browser redirects, and client profile writes are not payment authority.

The migration is additive for existing user documents: the legacy `lastPaymentReference`, `subscriptionId`, and `subscriptionSource` fields remain structurally compatible, while all new server writes use `subscriptionSource: "moonpay"`. Historical records from the retired payment provider must be reviewed and migrated by an authorized Admin SDK procedure before any destructive cleanup; no live migration is performed by this code change.
