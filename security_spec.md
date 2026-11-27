# MITRA KITA — Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Verified Identity Ownership**: Every document in `users`, `schoolProfiles`, `partners`, `programs`, `activities`, `evidences`, `evaluations`, and `supervisorNotes` MUST have `ownerUid == request.auth.uid`, and every write/read requires `request.auth != null && request.auth.token.email_verified == true`.
2. **PII Isolation**: User profiles (`users/{userId}` containing email) and partner contacts (`partners/{partnerDocId}` containing phone/address) can ONLY be read (`get`/`list`) by their verified owner (`existing().ownerUid == request.auth.uid`). No blanket reads are allowed. `users` and `schoolProfiles` forbid `list` queries entirely.
3. **Referential Integrity (No Orphaned Records)**:
   - An `activity` cannot be created unless its `programId` references an existing document in `/programs/{programId}` owned by `request.auth.uid`.
   - An `evidence` cannot be created unless its `programId` references an existing document in `/programs/{programId}` owned by `request.auth.uid`.
   - An `evaluation` with a non-empty `programId` cannot be created unless that program exists and is owned by `request.auth.uid`.
   - A `supervisorNote` targeting `'PROGRAM'` or `'EVALUASI'` with a non-empty `targetId` cannot be created unless the target document exists and is owned by `request.auth.uid`.
4. **Immutable Ownership & Temporal Integrity**:
   - `ownerUid`, `id`, and `createdAt` are immutable after creation.
   - `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
5. **Terminal State Locking**:
   - A `PartnershipProgram` with `status == 'Dibatalkan'` cannot be updated further.
   - A `PartnershipActivity` with `status == 'Selesai'` cannot be updated further.
6. **Strict Schema & Bounds**:
   - All single-document path IDs must satisfy `^[a-zA-Z0-9_\-]+$` and length `1..128`.
   - Every string field has an explicit `.size()` cap; `partnerIds` arrays are capped at `<= 50` entries with type validation; `scores` map requires exact keys `ind_1`..`ind_10` with integers `1..4`.
   - No shadow/ghost keys permitted on create (`hasAll` + `hasOnly`) or update (`affectedKeys().hasOnly(...)`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create `/partners/uid1__MTR-001`.
2. **Identity Spoofing**: User A (`uidA`) attempts to create a partner with `ownerUid: "uidB"`.
3. **Cross-Tenant PII Read**: User B (`uidB`) attempts `get` on `/users/uidA` or `/partners/uidA__MTR-001`.
4. **Unscoped List Query**: User A executes `list` on `/partners` without `where('ownerUid', '==', 'uidA')`.
5. **Shadow / Ghost Field Injection (Create)**: User A creates a program with an extra `"isAdmin": true` ghost field.
6. **Shadow Field Injection (Update)**: User A updates `/partners/uidA__MTR-001` adding `"isVerified": true`.
7. **Immutable Field Tampering**: User A attempts to change `ownerUid` or `createdAt` on an existing program.
8. **Client-Forged Timestamp**: User A attempts to create a partner with a backdated `createdAt` instead of `request.time`.
9. **Orphaned Activity Creation**: User A attempts to create an activity with `programId: "nonexistent_prg"` or a program owned by User B.
10. **Terminal State Violation**: User A attempts to update an activity whose existing `status` is `'Selesai'`, or a program whose existing `status` is `'Dibatalkan'`.
11. **Path ID Poisoning**: User A attempts to create `/programs/` with a 200-char ID or invalid characters (`prg$evil!`).
12. **Value / Resource Poisoning**: User A attempts to write a 500-char `namaProgram` (exceeds 200), an out-of-range monitoring score (`ind_1: 99`), or a `partnerIds` array with 51 elements.
