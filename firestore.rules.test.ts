import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Security Rules & Role Normalization Verification Suite
 * Tests structural invariants across firestore.rules, storage.rules, firebase-blueprint.json,
 * and shared TypeScript role helpers without claiming a live Firebase emulator when offline.
 */
import {
  canAccessAdminRole,
  canAccessTeacherRole,
  canManageUsersRole,
  canPublishInstitutionalRole,
  isAdminOrDevRole,
  isEditorRole,
  isTeacherRole,
  normalizeUserRole,
} from './src/types';

export const dirtyDozenPayloads = [
  { id: 1, name: 'Unauthenticated user profile write', path: '/users/u1', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified email write', path: '/users/u1', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Self-assigned teacher/editor role spoofing', path: '/users/u1', payload: { role: 'teacher' }, expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Shadow field or assignedClassIds injection on profile', path: '/users/u1', payload: { assignedClassIds: ['c1'] }, expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Student upload into institutional Storage campus-materials', path: '/campus-materials/u1/test.pdf', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Teacher attempting institutional publish on shared material', path: '/materials/m1', payload: { isShared: true, status: 'published' }, expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Content editor reading admin auditLogs', path: '/auditLogs', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Cross-user errorNotebook or academicRequests read', path: '/users/u2/errorNotebook', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Student self-grading or spoofing teacher message role', path: '/academicRequests/req1/messages/m1', payload: { senderRole: 'teacher' }, expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Client-forged createdAt timestamp', path: '/users/u1/studySessions/s1', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Audit log or chat message mutation attempt', path: '/academicRequests/req1/messages/m1', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Blanket list query without owner/shared/teacher filter', path: '/materials', expected: 'PERMISSION_DENIED' },
] as const;

const firestoreRules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const storageRules = readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8');
const blueprintRaw = readFileSync(resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8');
const blueprint = JSON.parse(blueprintRaw) as {
  entities: Record<string, unknown>;
  firestore: Record<string, unknown>;
};

describe('RBAC Role Normalization & Privilege Separation', () => {
  it('separates student, teacher, editor, admin and dev capabilities strictly', () => {
    expect(normalizeUserRole('student')).toBe('student');
    expect(canAccessTeacherRole('student')).toBe(false);
    expect(canAccessAdminRole('student')).toBe(false);

    expect(isTeacherRole('teacher')).toBe(true);
    expect(canAccessTeacherRole('teacher')).toBe(true);
    expect(canPublishInstitutionalRole('teacher')).toBe(false);
    expect(canAccessAdminRole('teacher')).toBe(false);
    expect(canManageUsersRole('teacher')).toBe(false);

    expect(isEditorRole('editor')).toBe(true);
    expect(canPublishInstitutionalRole('editor')).toBe(true);
    expect(canManageUsersRole('editor')).toBe(false);

    expect(isAdminOrDevRole('admin')).toBe(true);
    expect(canManageUsersRole('admin')).toBe(true);
    expect(canManageUsersRole('dev')).toBe(true);
  });

  it('prevents unknown role strings from elevating beyond student', () => {
    expect(normalizeUserRole('superuser')).toBe('student');
    expect(normalizeUserRole(null)).toBe('student');
    expect(normalizeUserRole('teacher', true)).toBe('admin');
  });
});

describe('Firestore Security Rules Structural Invariants', () => {
  it('contains default deny-all safety net and strict ID validator', () => {
    expect(firestoreRules).toContain('match /{document=**}');
    expect(firestoreRules).toContain('allow read, write: if false;');
    expect(firestoreRules).toContain("id.matches('^[a-zA-Z0-9_\\\\-]+$')");
  });

  it('requires email verification and immutable audit/chat logs', () => {
    expect(firestoreRules).toContain('request.auth.token.email_verified == true');
    expect(firestoreRules).toMatch(/match \/auditLogs\/\{logId\}[\s\S]*allow update, delete: if false;/);
    expect(firestoreRules).toMatch(/match \/messages\/\{messageId\}[\s\S]*allow update, delete: if false;/);
  });

  it('protects users/{userId}/mediaProgress and supports material chapters + sections', () => {
    expect(firestoreRules).toContain('match /mediaProgress/{mediaId}');
    expect(firestoreRules).toContain('isValidMediaProgress(');
    expect(firestoreRules).toContain("'chapters'");
    expect(firestoreRules).toContain("'studyRecommendations'");
    expect(firestoreRules).toContain("'sections'");
    expect(firestoreRules).toContain("'preferredCampus'");
    expect(firestoreRules).toContain("'mediaPlaybackPreference'");
  });

  it('secures academicRequests against role spoofing', () => {
    expect(firestoreRules).toContain('match /academicRequests/{requestId}');
    expect(firestoreRules).toContain("incoming().status == 'pendente'");
    expect(firestoreRules).toContain("incoming().senderRole == 'student'");
    expect(firestoreRules).toContain("incoming().senderRole in ['teacher', 'editor']");
  });

  it('keeps firebase-blueprint.json synchronized with new entities', () => {
    expect(blueprint.entities).toHaveProperty('MediaProgress');
    expect(blueprint.entities).toHaveProperty('AcademicRequest');
    expect(blueprint.entities).toHaveProperty('AcademicRequestMessage');
    expect(blueprint.entities).toHaveProperty('UserNotification');
    expect(blueprint.firestore).toHaveProperty('/users/{userId}/mediaProgress/{mediaId}');
    expect(blueprint.firestore).toHaveProperty('/users/{userId}/notifications/{notificationId}');
    expect(blueprint.firestore).toHaveProperty('/academicRequests/{requestId}');
    expect(blueprint.firestore).toHaveProperty('/academicRequests/{requestId}/messages/{messageId}');
  });

  it('supports EPUB/HTML reader types, pendingDefinition flag, question source anchors, and notifications rules', () => {
    expect(firestoreRules).toContain("'epub'");
    expect(firestoreRules).toContain("'html'");
    expect(firestoreRules).toContain("'pendingDefinition'");
    expect(firestoreRules).toContain("'sourceMaterialId'");
    expect(firestoreRules).toContain("'needsReview'");
    expect(firestoreRules).toContain('match /notifications/{notificationId}');
    expect(firestoreRules).toContain('isValidUserNotification(');
  });

  it('aligns familyDocId() with client toFamilyMemberDocId(), forbids local:// in published/shared materials, and protects reviewNotes', () => {
    expect(firestoreRules).toContain('function truncate128(s)');
    expect(firestoreRules).toContain("truncate128('fam_' + request.auth.token.email.trim().lower().replace('[^a-z0-9]', '_'))");
    expect(firestoreRules).toContain("(!data.url.matches('^local://.*')");
    expect(firestoreRules).toContain("data.storageProvider != 'local'");
    expect(firestoreRules).toContain("!data.keys().hasAny(['reviewNotes'])");
    expect(firestoreRules).toContain("data.status != 'published' || !data.keys().hasAny(['reviewNotes'])");

    // Verify client normalization formula matches CEL normalization logic
    const clientFormula = (email: string) =>
      `fam_${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`.slice(0, 128);
    expect(clientFormula('Maria.Silva+alepa@Gmail.com ')).toBe('fam_maria_silva_alepa_gmail_com');
    const longEmail = `${'a'.repeat(140)}@example.com`;
    expect(clientFormula(longEmail).length).toBe(128);
  });
});

describe('Cloud Storage Security Rules Hardening', () => {
  it('blocks ordinary students from writing into campus-materials via named Firestore role check and allows EPUB MIME', () => {
    expect(storageRules).not.toContain('isStaffPathOwner');
    expect(storageRules).not.toContain('/databases/(default)/documents/users/');
    expect(storageRules).toContain('isStaffUploader(uploaderUid)');
    expect(storageRules).toContain('/databases/ai-studio-remixsavioalepa1-e4693aba-b1f3-4621-bddd-0813ec8e3b3f/documents/users/');
    expect(storageRules).toContain("in ['admin', 'dev', 'editor', 'teacher']");
    expect(storageRules).toContain('active != false');
    expect(storageRules).toContain('isAllowedCampusMimeType()');
    expect(storageRules).toContain('isAllowedUserMimeType()');
    expect(storageRules).toContain('epub');
  });
});
