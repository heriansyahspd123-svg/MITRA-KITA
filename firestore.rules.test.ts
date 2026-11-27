/**
 * Phase 0 Security TDD Specification for MITRA KITA Firestore Rules.
 * Verifies that all 12 "Dirty Dozen" adversarial payloads are rejected
 * with PERMISSION_DENIED when run against the Firebase Emulator Suite
 * using @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  actor: { uid: string; email: string; email_verified: boolean } | null;
  operation: 'create' | 'update' | 'get' | 'list';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unverified Email Write',
    actor: { uid: 'uidA', email: 'unverified@example.com', email_verified: false },
    operation: 'create',
    path: 'partners/uidA__MTR-001',
    payload: { ownerUid: 'uidA', id: 'MTR-001', namaSekolah: 'SDN 1', nama: 'Mitra A' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Create',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: 'partners/uidB__MTR-001',
    payload: { ownerUid: 'uidB', id: 'MTR-001', namaSekolah: 'SDN 1', nama: 'Mitra Palsu' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-Tenant PII Read',
    actor: { uid: 'uidB', email: 'b@example.com', email_verified: true },
    operation: 'get',
    path: 'users/uidA',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unscoped List Query on Partners',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'list',
    path: 'partners',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Ghost Field on Create',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: 'programs/prg_shadow_1',
    payload: { ownerUid: 'uidA', id: 'prg_shadow_1', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field on Update',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'update',
    path: 'partners/uidA__MTR-001',
    payload: { isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immutable ownerUid Tampering',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'update',
    path: 'programs/prg_1',
    payload: { ownerUid: 'uidB' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-Forged Backdated Timestamp',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: 'partners/uidA__MTR-002',
    payload: { ownerUid: 'uidA', id: 'MTR-002', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Activity Without Valid Owned Program',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: 'activities/act_orphan_1',
    payload: { ownerUid: 'uidA', id: 'act_orphan_1', programId: 'prg_does_not_exist' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Update on Completed Activity',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'update',
    path: 'activities/act_completed_1',
    payload: { status: 'Terjadwal' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Path ID Poisoning (Invalid Chars / Oversized ID)',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: 'programs/' + 'a'.repeat(200),
    payload: { ownerUid: 'uidA' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Value & Resource Poisoning (Invalid Score / Oversized Array)',
    actor: { uid: 'uidA', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: 'evaluations/eval_poison_1',
    payload: {
      ownerUid: 'uidA',
      id: 'eval_poison_1',
      scores: { ind_1: 99 },
      totalSkorPerolehan: 999,
    },
    expected: 'PERMISSION_DENIED',
  },
];
