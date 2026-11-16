import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  OperationType,
  FIREBASE_STORAGE_BUCKET,
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  isAdminEmail,
  testFirestoreConnection,
  toFamilyMemberDocId,
  workspaceAuthProvider,
} from '../lib/firebase';
import { ALEPA_DISCIPLINES, CONCURSO_PROFILE } from '../data/alepaSyllabus';
import { getMedioDisciplines } from '../data/alepaMedioSyllabus';
import { CETAP_QUESTIONS, DEFAULT_STUDY_MATERIALS } from '../data/alepaQuestions';
import { EXTRA_CURATED_QUESTIONS } from '../data/alepaExtraQuestions';
import { CARGO_04_BASICAS_QUESTIONS } from '../data/alepaCargo04BasicasQuestions';
import { CARGO_04_ESPECIFICAS_QUESTIONS } from '../data/alepaCargo04EspecificasQuestions';
import { GERAL_DEFAULT_MATERIALS } from '../data/alepaGeneralLibrary';
import { MEDIO_DEFAULT_MATERIALS, MEDIO_QUESTIONS } from '../data/alepaMedioLibrary';
import {
  AcademicRequest,
  AcademicRequestCategory,
  AcademicRequestMessage,
  AcademicRequestStatus,
  AccessSession,
  Activity,
  ActivitySubmission,
  AuditLogEntry,
  BlockType,
  CampusLevel,
  ClassEnrollment,
  Classroom,
  Discipline,
  DisciplineWeeklyGoal,
  ErrorEntry,
  ErrorReason,
  ExamConcurso,
  FamilyMember,
  Lesson,
  LibraryCategoryId,
  LibraryScope,
  LinkStatus,
  ManagedDiscipline,
  ManagedTopic,
  MaterialChapter,
  MaterialFileType,
  MaterialRelevanceTier,
  MediaPlaybackPreference,
  MediaProgressRecord,
  MedioCargoGroup,
  NormalizedUserRole,
  PlatformNotice,
  PublicationStatus,
  Question,
  QuestionDifficulty,
  QuestionFormat,
  QuestionOriginType,
  ReadingProgress,
  ResourceType,
  SimuladoAttempt,
  SimuladoList,
  StorageMetadataRecord,
  StorageObjectCategory,
  StorageProviderType,
  StudentPreferences,
  PdfVirtualSection,
  StudyMaterial,
  StudySession,
  SubmissionRevision,
  TopicProgress,
  UserNotification,
  UserProfile,
  UserRole,
  canAccessAdminRole,
  canAccessTeacherRole,
  canManageUsersRole,
  isEditorRole,
  isTeacherRole,
  normalizeUserRole,
} from '../types';

export type WorkspaceMode = 'student' | 'teacher' | 'admin';

export const DEFAULT_STUDENT_PREFERENCES: StudentPreferences = {
  theme: 'light',
  accentColor: 'emerald',
  fontScale: 'md',
  density: 'comfortable',
  hiddenDashboardCards: [],
  dashboardCardOrder: [
    'hero',
    'continue_reading',
    'study_today',
    'classroom_feed',
    'notices',
    'quick_actions',
    'disciplines_overview',
  ],
  favoriteMaterialIds: [],
  favoriteQuestionIds: [],
  favoriteTopicIds: [],
  customShortcuts: [],
  preferredCampus: 'superior',
  preferredMedioCargo: 'cargo_01_04',
  mediaPlaybackPreference: 'ask',
};

interface AuthContextValue {
  user: User | null;
  isGuest: boolean;
  profile: UserProfile | null;
  authLoading: boolean;
  syncError: string | null;
  clearSyncError: () => void;
  workspaceAccessToken: string | null;
  connectGoogleWorkspace: () => Promise<string | null>;
  clearWorkspaceToken: () => void;
  effectiveRole: NormalizedUserRole;
  isAdmin: boolean;
  isEditor: boolean;
  isTeacher: boolean;
  isDev: boolean;
  canAccessAdminPanel: boolean;
  canAccessTeacherPanel: boolean;
  canManageUsers: boolean;
  canPublishShared: boolean;
  activeWorkspaceMode: WorkspaceMode;
  setActiveWorkspaceMode: (mode: WorkspaceMode) => void;
  preferences: StudentPreferences;
  updateStudentPreferences: (patch: Partial<StudentPreferences>) => Promise<void>;
  toggleFavoriteMaterial: (materialId: string) => Promise<void>;
  toggleFavoriteQuestion: (questionId: string) => Promise<void>;
  toggleFavoriteTopic: (topicId: string) => Promise<void>;
  getIdToken: () => Promise<string | null>;
  myFamilyMembership: FamilyMember | null;
  familyMembers: FamilyMember[];
  accessSessions: AccessSession[];
  allUsers: UserProfile[];
  updateAccessPresenceContext: (tab: string, campus: CampusLevel) => void;
  inviteFamilyMember: (input: {
    name: string;
    email: string;
    relationship: string;
    canPublish: boolean;
  }) => Promise<void>;
  toggleFamilyMemberPublish: (memberId: string, canPublish: boolean) => Promise<void>;
  toggleFamilyMemberActive: (memberId: string, active: boolean) => Promise<void>;
  removeFamilyMember: (memberId: string) => Promise<void>;
  topicProgressMap: Record<string, TopicProgress>;
  disciplineGoalsMap: Record<string, DisciplineWeeklyGoal>;
  readingProgressMap: Record<string, ReadingProgress>;
  mediaProgressMap: Record<string, MediaProgressRecord>;
  academicRequests: AcademicRequest[];
  notifications: UserNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  recordStudyNotification: (message: string, title?: string) => Promise<void>;
  studySessions: StudySession[];
  simuladoAttempts: SimuladoAttempt[];
  errorNotebook: ErrorEntry[];
  materials: StudyMaterial[];
  allManagedMaterials: StudyMaterial[];
  questions: Question[];
  allManagedQuestions: Question[];
  managedDisciplines: ManagedDiscipline[];
  allManagedDisciplines: ManagedDiscipline[];
  managedTopics: ManagedTopic[];
  allManagedTopics: ManagedTopic[];
  simuladoLists: SimuladoList[];
  allManagedSimuladoLists: SimuladoList[];
  platformNotices: PlatformNotice[];
  allManagedNotices: PlatformNotice[];
  exams: ExamConcurso[];
  allManagedExams: ExamConcurso[];
  classes: Classroom[];
  allManagedClasses: Classroom[];
  enrollments: ClassEnrollment[];
  lessons: Lesson[];
  allManagedLessons: Lesson[];
  activities: Activity[];
  allManagedActivities: Activity[];
  submissions: ActivitySubmission[];
  storageMetadataRecords: StorageMetadataRecord[];
  auditLogs: AuditLogEntry[];
  getCampusDisciplines: (campus: CampusLevel, medioCargoGroup?: MedioCargoGroup) => Discipline[];
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string, preferredRole: UserRole) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  enterGuestMode: (guestName?: string) => void;
  exitGuestMode: () => void;
  resendVerification: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfileSettings: (patch: {
    displayName?: string;
    dailyGoalMinutes?: number;
    examDate?: string;
    targetCargo?: string;
  }) => Promise<void>;
  updateUserRole: (targetUid: string, nextRole: NormalizedUserRole) => Promise<void>;
  toggleUserActive: (targetUid: string, active: boolean) => Promise<void>;
  updateUserAssignments: (
    targetUid: string,
    patch: { assignedClassIds?: string[]; assignedDisciplineIds?: string[] }
  ) => Promise<void>;
  saveDisciplineWeeklyGoal: (disciplineId: string, weeklyGoalMinutes: number) => Promise<void>;
  saveTopicProgress: (
    topicId: string,
    disciplineId: string,
    patch: Partial<Pick<TopicProgress, 'theoryDone' | 'questionsDone' | 'revisionDone' | 'notes'>>
  ) => Promise<void>;
  saveReadingProgress: (
    materialId: string,
    patch: Partial<Omit<ReadingProgress, 'materialId' | 'userId' | 'updatedAt'>>
  ) => Promise<void>;
  deleteReadingProgress: (materialId: string) => Promise<void>;
  saveMediaProgress: (
    mediaId: string,
    patch: Partial<Omit<MediaProgressRecord, 'mediaId' | 'userId' | 'updatedAt'>> & {
      materialTitle: string;
      mediaType: 'video' | 'audio';
    }
  ) => Promise<void>;
  createAcademicRequest: (input: {
    category: AcademicRequestCategory;
    subject: string;
    description: string;
    disciplineId: string;
    topicTitle?: string;
    campusLevel?: LibraryScope;
  }) => Promise<string>;
  subscribeAcademicRequestMessages: (
    requestId: string,
    onUpdate: (messages: AcademicRequestMessage[]) => void,
    onError?: (err: Error) => void
  ) => () => void;
  sendAcademicRequestMessage: (requestId: string, body: string) => Promise<void>;
  updateAcademicRequestStatus: (requestId: string, status: AcademicRequestStatus) => Promise<void>;
  assignAcademicRequest: (
    requestId: string,
    assignee: { uid: string; displayName: string; role: 'teacher' | 'editor' | 'admin' }
  ) => Promise<void>;
  logStudySession: (input: {
    dateKey: string;
    disciplineId: string;
    topicTitle: string;
    blockType: BlockType;
    durationMinutes: number;
    notes?: string;
  }) => Promise<void>;
  saveSimuladoAttempt: (input: {
    title: string;
    mode: 'treino' | 'simulado';
    primaryDisciplineId: string;
    totalQuestions: number;
    correctCount: number;
    score: number;
    durationSeconds: number;
  }) => Promise<void>;
  addErrorEntry: (input: {
    questionId: string;
    disciplineId: string;
    topicTitle: string;
    questionStem: string;
    correctOption: string;
    selectedOption: string;
    errorReason: ErrorReason;
    improvementNote: string;
  }) => Promise<void>;
  updateErrorEntry: (
    entryId: string,
    patch: Partial<Pick<ErrorEntry, 'errorReason' | 'improvementNote' | 'nextReviewDate' | 'reviewCount' | 'status'>>
  ) => Promise<void>;
  deleteErrorEntry: (entryId: string) => Promise<void>;
  addMaterial: (input: {
    title: string;
    subtitle?: string;
    disciplineId: string;
    libraryCategoryId?: LibraryCategoryId;
    editalTopic?: string;
    resourceType?: ResourceType;
    fileType: MaterialFileType;
    institution?: string;
    url: string;
    pricing?: 'gratuito' | 'pago';
    publishedAt?: string;
    lastVerifiedAt?: string;
    linkStatus?: LinkStatus;
    isOfficialContent?: boolean;
    relevanceTier?: MaterialRelevanceTier;
    campusLevel?: LibraryScope;
    status?: PublicationStatus;
    classId?: string;
    keywords?: string[];
    author?: string;
    edition?: string;
    year?: number;
    checksumSha256?: string;
    storageProvider?: StorageProviderType;
    storagePath?: string;
    reviewNotes?: string;
    fileName?: string;
    description?: string;
    isShared?: boolean;
    allowDownload?: boolean;
    textLayerStatus?: StudyMaterial['textLayerStatus'];
    pageCount?: number;
    fileSizeBytes?: number;
    version?: number;
    versionNote?: string;
    chapters?: MaterialChapter[];
    studyRecommendations?: string[];
    sections?: StudyMaterial['sections'];
    parentMaterialId?: string;
    startPage?: number;
    endPage?: number;
    isVirtualSection?: boolean;
    organizedBy?: string;
    organizedAt?: string;
    catalogNumber?: number;
    pendingDefinition?: boolean;
    indexingStatus?: StudyMaterial['indexingStatus'];
  }) => Promise<string>;
  updateMaterial: (
    materialId: string,
    patch: Partial<Omit<StudyMaterial, 'id' | 'ownerId' | 'createdAt'>>
  ) => Promise<void>;
  updateMaterialStatus: (materialId: string, status: PublicationStatus) => Promise<void>;
  deleteMaterial: (materialId: string) => Promise<void>;
  addCustomQuestion: (input: {
    disciplineId: string;
    topicTitle: string;
    statement: string;
    options: [string, string, string, string, string];
    correctIndex: number;
    explanation: string;
    legalBasis?: string;
    source?: string;
    originType?: QuestionOriginType;
    difficulty?: QuestionDifficulty;
    questionFormat?: QuestionFormat;
    classId?: string;
    escolaridade?: CampusLevel;
    isOfficial?: boolean;
    isPublished?: boolean;
    status?: PublicationStatus;
    sourceMaterialId?: string;
    sourcePage?: number;
    sourceExcerpt?: string;
    needsReview?: boolean;
    reviewFlags?: string[];
  }) => Promise<void>;
  updateCustomQuestion: (
    questionId: string,
    patch: Partial<Omit<Question, 'id' | 'authorId'>>
  ) => Promise<void>;
  updateQuestionStatus: (questionId: string, status: PublicationStatus) => Promise<void>;
  deleteCustomQuestion: (questionId: string) => Promise<void>;
  saveManagedDiscipline: (input: {
    id?: string;
    name: string;
    shortName: string;
    campusLevel: CampusLevel;
    editalBlock: Discipline['editalBlock'];
    priorityRank: number;
    examQuestions: number;
    examPoints: number;
    tieBreakerOrder: number;
    recommendedMinutesPerCycle: number;
    status: PublicationStatus;
  }) => Promise<string>;
  updateManagedDisciplineStatus: (disciplineId: string, status: PublicationStatus) => Promise<void>;
  saveManagedTopic: (input: {
    topicId?: string;
    disciplineId: string;
    campusLevel: CampusLevel;
    title: string;
    subtopics: string[];
    highYield: boolean;
    order: number;
    status: PublicationStatus;
  }) => Promise<string>;
  updateManagedTopicStatus: (topicId: string, status: PublicationStatus) => Promise<void>;
  saveSimuladoList: (input: {
    listId?: string;
    title: string;
    description?: string;
    campusLevel: LibraryScope;
    durationMinutes: number;
    questionIds: string[];
    status: PublicationStatus;
  }) => Promise<string>;
  updateSimuladoListStatus: (listId: string, status: PublicationStatus) => Promise<void>;
  savePlatformNotice: (input: {
    noticeId?: string;
    title: string;
    body: string;
    campusLevel: LibraryScope;
    priority: 'normal' | 'importante' | 'urgente';
    eventDate?: string;
    status: PublicationStatus;
  }) => Promise<string>;
  updatePlatformNoticeStatus: (noticeId: string, status: PublicationStatus) => Promise<void>;
  saveExamConcurso: (input: {
    examId?: string;
    title: string;
    institution: string;
    code: string;
    year: number;
    levels: CampusLevel[];
    positions: string[];
    examDate?: string;
    status: PublicationStatus;
  }) => Promise<string>;
  updateExamStatus: (examId: string, status: PublicationStatus) => Promise<void>;
  saveClassroom: (input: {
    classId?: string;
    name: string;
    code: string;
    examId: string;
    campusLevel: CampusLevel;
    disciplineIds: string[];
    teacherIds: string[];
    description?: string;
    active: boolean;
    status: PublicationStatus;
  }) => Promise<string>;
  updateClassroomStatus: (classId: string, status: PublicationStatus) => Promise<void>;
  enrollStudentInClass: (input: {
    classId: string;
    studentId?: string;
    studentName?: string;
    studentEmail?: string;
    teacherId?: string;
  }) => Promise<string>;
  updateEnrollmentStatus: (enrollmentId: string, status: 'active' | 'inactive') => Promise<void>;
  removeEnrollment: (enrollmentId: string) => Promise<void>;
  saveLesson: (input: {
    lessonId?: string;
    classId: string;
    disciplineId: string;
    campusLevel: CampusLevel;
    title: string;
    summary: string;
    content: string;
    videoUrl?: string;
    materialIds: string[];
    order: number;
    status: PublicationStatus;
    reviewNotes?: string;
  }) => Promise<string>;
  updateLessonStatus: (lessonId: string, status: PublicationStatus) => Promise<void>;
  deleteLesson: (lessonId: string) => Promise<void>;
  saveActivity: (input: {
    activityId?: string;
    classId: string;
    disciplineId: string;
    campusLevel: CampusLevel;
    title: string;
    instructions: string;
    activityType: 'objetiva' | 'discursiva' | 'mista';
    dueDate?: string;
    maxScore: number;
    questionIds: string[];
    prompts: string[];
    status: PublicationStatus;
  }) => Promise<string>;
  updateActivityStatus: (activityId: string, status: PublicationStatus) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  submitActivity: (input: {
    submissionId?: string;
    activityId: string;
    classId: string;
    teacherId: string;
    objectiveAnswers: Record<string, number>;
    discursiveResponses: Record<string, string>;
    objectiveScore: number;
  }) => Promise<string>;
  gradeSubmission: (
    submissionId: string,
    patch: {
      manualScore: number;
      finalScore: number;
      feedback: string;
      status: 'graded' | 'returned';
    }
  ) => Promise<void>;
  registerStorageMetadata: (input: {
    fileId?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256?: string;
    storageProvider: StorageProviderType;
    bucket?: string;
    objectPath: string;
    downloadUrl: string;
    category: StorageObjectCategory;
    campusLevel: LibraryScope;
    linkedMaterialId?: string;
    version?: number;
  }) => Promise<string>;
  updateStorageMetadataRecord: (
    fileId: string,
    patch: Partial<Pick<StorageMetadataRecord, 'linkedMaterialId' | 'campusLevel' | 'archived' | 'version'>>
  ) => Promise<void>;
  deleteStorageMetadataRecord: (fileId: string) => Promise<void>;
  writeAuditLog: (input: {
    action: string;
    targetCollection: string;
    targetId: string;
    summary: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || `id_${Date.now()}`;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const GUEST_MODE_KEY = 'concurso_alepa_guest_mode';
const GUEST_DATA_KEY = 'concurso_alepa_guest_data_v1';
const LOCAL_PREFS_KEY = 'concurso_alepa_preferences_v1';
const DEVICE_ID_KEY = 'concurso_alepa_device_id_v1';
const GUEST_UID = 'guest_local';

function loadCachedPreferences(): StudentPreferences {
  try {
    const raw = localStorage.getItem(LOCAL_PREFS_KEY);
    if (!raw) return DEFAULT_STUDENT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<StudentPreferences>;
    return {
      ...DEFAULT_STUDENT_PREFERENCES,
      ...parsed,
      hiddenDashboardCards: Array.isArray(parsed.hiddenDashboardCards) ? parsed.hiddenDashboardCards : [],
      dashboardCardOrder:
        Array.isArray(parsed.dashboardCardOrder) && parsed.dashboardCardOrder.length > 0
          ? parsed.dashboardCardOrder
          : DEFAULT_STUDENT_PREFERENCES.dashboardCardOrder,
      favoriteMaterialIds: Array.isArray(parsed.favoriteMaterialIds) ? parsed.favoriteMaterialIds : [],
      favoriteQuestionIds: Array.isArray(parsed.favoriteQuestionIds) ? parsed.favoriteQuestionIds : [],
      favoriteTopicIds: Array.isArray(parsed.favoriteTopicIds) ? parsed.favoriteTopicIds : [],
      customShortcuts: Array.isArray(parsed.customShortcuts) ? parsed.customShortcuts : [],
    };
  } catch {
    return DEFAULT_STUDENT_PREFERENCES;
  }
}

function saveCachedPreferences(prefs: StudentPreferences): void {
  try {
    localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,80}$/.test(existing)) {
      return existing;
    }
    const created = sanitizeId(`dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`).slice(0, 80);
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return 'dev_browser';
  }
}

function detectDeviceType(): 'mobile' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

interface GuestStoreData {
  profile: UserProfile;
  topicProgressMap: Record<string, TopicProgress>;
  disciplineGoalsMap: Record<string, DisciplineWeeklyGoal>;
  readingProgressMap: Record<string, ReadingProgress>;
  mediaProgressMap: Record<string, MediaProgressRecord>;
  notifications: UserNotification[];
  studySessions: StudySession[];
  simuladoAttempts: SimuladoAttempt[];
  errorNotebook: ErrorEntry[];
  myMaterials: StudyMaterial[];
  myQuestions: Question[];
}

function createDefaultGuestProfile(): UserProfile {
  return {
    uid: GUEST_UID,
    displayName: 'Visitante ALEPA',
    role: 'student',
    preferences: loadCachedPreferences(),
    dailyGoalMinutes: CONCURSO_PROFILE.dailyGoalMinutes,
    examDate: CONCURSO_PROFILE.examDate,
    targetCargo: 'Cargo 03 – Técnico Legislativo (PL.AL.102)',
  };
}

function loadGuestStore(): GuestStoreData {
  const fallback: GuestStoreData = {
    profile: createDefaultGuestProfile(),
    topicProgressMap: {},
    disciplineGoalsMap: {},
    readingProgressMap: {},
    mediaProgressMap: {},
    notifications: [],
    studySessions: [],
    simuladoAttempts: [],
    errorNotebook: [],
    myMaterials: [],
    myQuestions: [],
  };
  try {
    const raw = localStorage.getItem(GUEST_DATA_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<GuestStoreData>;
    return {
      profile: parsed.profile ? { ...createDefaultGuestProfile(), ...parsed.profile, uid: GUEST_UID } : fallback.profile,
      topicProgressMap: parsed.topicProgressMap || {},
      disciplineGoalsMap: parsed.disciplineGoalsMap || {},
      readingProgressMap: parsed.readingProgressMap || {},
      mediaProgressMap: parsed.mediaProgressMap || {},
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      studySessions: Array.isArray(parsed.studySessions) ? parsed.studySessions : [],
      simuladoAttempts: Array.isArray(parsed.simuladoAttempts) ? parsed.simuladoAttempts : [],
      errorNotebook: Array.isArray(parsed.errorNotebook) ? parsed.errorNotebook : [],
      myMaterials: Array.isArray(parsed.myMaterials) ? parsed.myMaterials : [],
      myQuestions: Array.isArray(parsed.myQuestions) ? parsed.myQuestions : [],
    };
  } catch {
    return fallback;
  }
}

function saveGuestStore(data: GuestStoreData): void {
  try {
    localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUEST_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [, setAuthRefreshTick] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [localPreferences, setLocalPreferences] = useState<StudentPreferences>(() => loadCachedPreferences());
  const [authLoading, setAuthLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  // In-memory only (never localStorage/sessionStorage) per Workspace security rules
  const [workspaceAccessToken, setWorkspaceAccessToken] = useState<string | null>(null);

  const [topicProgressMap, setTopicProgressMap] = useState<Record<string, TopicProgress>>({});
  const [disciplineGoalsMap, setDisciplineGoalsMap] = useState<Record<string, DisciplineWeeklyGoal>>({});
  const [readingProgressMap, setReadingProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [mediaProgressMap, setMediaProgressMap] = useState<Record<string, MediaProgressRecord>>({});
  const [storedNotifications, setStoredNotifications] = useState<UserNotification[]>([]);
  const [academicRequests, setAcademicRequests] = useState<AcademicRequest[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [simuladoAttempts, setSimuladoAttempts] = useState<SimuladoAttempt[]>([]);
  const [errorNotebook, setErrorNotebook] = useState<ErrorEntry[]>([]);
  const [sharedMaterials, setSharedMaterials] = useState<StudyMaterial[]>([]);
  const [myMaterials, setMyMaterials] = useState<StudyMaterial[]>([]);
  const [adminMaterials, setAdminMaterials] = useState<StudyMaterial[]>([]);
  const [publishedQuestions, setPublishedQuestions] = useState<Question[]>([]);
  const [myQuestions, setMyQuestions] = useState<Question[]>([]);
  const [adminQuestions, setAdminQuestions] = useState<Question[]>([]);
  const [publishedDisciplines, setPublishedDisciplines] = useState<ManagedDiscipline[]>([]);
  const [adminDisciplines, setAdminDisciplines] = useState<ManagedDiscipline[]>([]);
  const [publishedTopics, setPublishedTopics] = useState<ManagedTopic[]>([]);
  const [adminTopics, setAdminTopics] = useState<ManagedTopic[]>([]);
  const [publishedSimuladoLists, setPublishedSimuladoLists] = useState<SimuladoList[]>([]);
  const [adminSimuladoLists, setAdminSimuladoLists] = useState<SimuladoList[]>([]);
  const [publishedNotices, setPublishedNotices] = useState<PlatformNotice[]>([]);
  const [adminNotices, setAdminNotices] = useState<PlatformNotice[]>([]);
  const [publishedExams, setPublishedExams] = useState<ExamConcurso[]>([]);
  const [adminExams, setAdminExams] = useState<ExamConcurso[]>([]);
  const [activeClasses, setActiveClasses] = useState<Classroom[]>([]);
  const [adminClasses, setAdminClasses] = useState<Classroom[]>([]);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [publishedLessons, setPublishedLessons] = useState<Lesson[]>([]);
  const [myLessons, setMyLessons] = useState<Lesson[]>([]);
  const [adminLessons, setAdminLessons] = useState<Lesson[]>([]);
  const [publishedActivities, setPublishedActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [adminActivities, setAdminActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [storageMetadataRecords, setStorageMetadataRecords] = useState<StorageMetadataRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [myFamilyMembership, setMyFamilyMembership] = useState<FamilyMember | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [accessSessions, setAccessSessions] = useState<AccessSession[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeWorkspaceModeState, setActiveWorkspaceModeState] = useState<WorkspaceMode>('student');
  const presenceContextRef = useRef<{ tab: string; campus: CampusLevel }>({
    tab: 'dashboard',
    campus: 'superior',
  });
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  const isPrimaryAdmin = Boolean(user?.emailVerified && isAdminEmail(user?.email));
  const isVerifiedUser = Boolean(user?.emailVerified);
  const isUserActive = profile?.active !== false;
  const effectiveRole: NormalizedUserRole =
    isVerifiedUser && isUserActive ? normalizeUserRole(profile?.role, isPrimaryAdmin) : 'student';
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'dev';
  const isEditor = isEditorRole(effectiveRole, isPrimaryAdmin) && effectiveRole === 'editor';
  const isTeacher = isTeacherRole(effectiveRole, isPrimaryAdmin);
  const isDev = effectiveRole === 'dev';
  const canAccessAdminPanel = canAccessAdminRole(effectiveRole, isPrimaryAdmin) && isVerifiedUser && isUserActive;
  const canAccessTeacherPanel = canAccessTeacherRole(effectiveRole, isPrimaryAdmin) && isVerifiedUser && isUserActive;
  const canManageUsers = canManageUsersRole(effectiveRole, isPrimaryAdmin) && isVerifiedUser && isUserActive;
  const canPublishShared =
    canAccessAdminPanel || Boolean(user?.emailVerified && myFamilyMembership?.active && myFamilyMembership?.canPublish);

  useEffect(() => {
    if (activeWorkspaceModeState === 'admin' && !canAccessAdminPanel) {
      setActiveWorkspaceModeState('student');
    } else if (activeWorkspaceModeState === 'teacher' && !canAccessTeacherPanel) {
      setActiveWorkspaceModeState('student');
    }
  }, [canAccessAdminPanel, canAccessTeacherPanel, activeWorkspaceModeState]);

  const setActiveWorkspaceMode = useCallback(
    (mode: WorkspaceMode) => {
      if (mode === 'admin' && !canAccessAdminPanel) {
        setActiveWorkspaceModeState('student');
        return;
      }
      if (mode === 'teacher' && !canAccessTeacherPanel) {
        setActiveWorkspaceModeState('student');
        return;
      }
      setActiveWorkspaceModeState(mode);
    },
    [canAccessAdminPanel, canAccessTeacherPanel]
  );

  const preferences: StudentPreferences = React.useMemo(() => {
    const base = profile?.preferences || localPreferences;
    return {
      ...DEFAULT_STUDENT_PREFERENCES,
      ...base,
      hiddenDashboardCards: Array.isArray(base?.hiddenDashboardCards) ? base.hiddenDashboardCards : [],
      dashboardCardOrder:
        Array.isArray(base?.dashboardCardOrder) && base.dashboardCardOrder.length > 0
          ? base.dashboardCardOrder
          : DEFAULT_STUDENT_PREFERENCES.dashboardCardOrder,
      favoriteMaterialIds: Array.isArray(base?.favoriteMaterialIds) ? base.favoriteMaterialIds : [],
      favoriteQuestionIds: Array.isArray(base?.favoriteQuestionIds) ? base.favoriteQuestionIds : [],
      favoriteTopicIds: Array.isArray(base?.favoriteTopicIds) ? base.favoriteTopicIds : [],
      customShortcuts: Array.isArray(base?.customShortcuts) ? base.customShortcuts : [],
    };
  }, [profile?.preferences, localPreferences]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) return null;
    try {
      return await current.getIdToken();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  const hydrateGuestData = () => {
    const data = loadGuestStore();
    setProfile(data.profile);
    setTopicProgressMap(data.topicProgressMap);
    setDisciplineGoalsMap(data.disciplineGoalsMap);
    setReadingProgressMap(data.readingProgressMap);
    setMediaProgressMap(data.mediaProgressMap);
    setStoredNotifications(data.notifications);
    setAcademicRequests([]);
    setStudySessions(data.studySessions);
    setSimuladoAttempts(data.simuladoAttempts);
    setErrorNotebook(data.errorNotebook);
    setMyMaterials(data.myMaterials);
    setMyQuestions(data.myQuestions);
  };

  const persistGuestPatch = (updater: (prev: GuestStoreData) => GuestStoreData) => {
    const current = loadGuestStore();
    const next = updater(current);
    saveGuestStore(next);
    setProfile(next.profile);
    setTopicProgressMap(next.topicProgressMap);
    setDisciplineGoalsMap(next.disciplineGoalsMap);
    setReadingProgressMap(next.readingProgressMap);
    setMediaProgressMap(next.mediaProgressMap);
    setStoredNotifications(next.notifications);
    setStudySessions(next.studySessions);
    setSimuladoAttempts(next.simuladoAttempts);
    setErrorNotebook(next.errorNotebook);
    setMyMaterials(next.myMaterials);
    setMyQuestions(next.myQuestions);
  };

  const ensureSignedIn = (): User => {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Faça login para salvar seu progresso na nuvem.');
    }
    return current;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setWorkspaceAccessToken(null);
        let guestActive = false;
        try {
          guestActive = localStorage.getItem(GUEST_MODE_KEY) === 'true';
        } catch {
          guestActive = false;
        }
        setIsGuest(guestActive);
        if (guestActive) {
          hydrateGuestData();
        } else {
          setProfile(null);
          setTopicProgressMap({});
          setDisciplineGoalsMap({});
          setReadingProgressMap({});
          setMediaProgressMap({});
          setStoredNotifications([]);
          setAcademicRequests([]);
          setStudySessions([]);
          setSimuladoAttempts([]);
          setErrorNotebook([]);
          setMyMaterials([]);
          setMyQuestions([]);
          setMyFamilyMembership(null);
          setFamilyMembers([]);
          setAccessSessions([]);
        }
        setAuthLoading(false);
        return;
      }

      setIsGuest(false);
      try {
        localStorage.removeItem(GUEST_MODE_KEY);
      } catch {
        // ignore storage errors
      }

      const fallbackProfile: UserProfile = {
        uid: firebaseUser.uid,
        displayName: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Estudante ALEPA').slice(0, 120),
        role: 'student',
        dailyGoalMinutes: CONCURSO_PROFILE.dailyGoalMinutes,
        examDate: CONCURSO_PROFILE.examDate,
        targetCargo: 'Cargo 03 – Técnico Legislativo (PL.AL.102)',
      };
      setProfile((prev) => prev || fallbackProfile);

      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        let snap;
        try {
          snap = await getDoc(userRef);
        } catch (fetchErr) {
          console.warn('Offline mode or network issue while fetching user profile:', fetchErr);
          setAuthLoading(false);
          return;
        }
        const isPrimaryAdminAccount =
          Boolean(firebaseUser.emailVerified) && isAdminEmail(firebaseUser.email);
        const cleanEmail = (firebaseUser.email || '').trim().toLowerCase().slice(0, 160);
        if (!snap.exists()) {
          const newProfile: Record<string, unknown> = {
            uid: firebaseUser.uid,
            displayName: fallbackProfile.displayName,
            role: isPrimaryAdminAccount ? 'admin' : 'student',
            dailyGoalMinutes: CONCURSO_PROFILE.dailyGoalMinutes,
            examDate: CONCURSO_PROFILE.examDate,
            targetCargo: 'Cargo 03 – Técnico Legislativo (PL.AL.102)',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (cleanEmail) newProfile.email = cleanEmail;
          try {
            await setDoc(userRef, newProfile);
          } catch (writeErr) {
            console.warn('Offline write skipped for new profile:', writeErr);
          }
        } else {
          const existingData = snap.data() as Partial<UserProfile>;
          const updates: Record<string, unknown> = {};
          if (isPrimaryAdminAccount && existingData.role !== 'admin' && existingData.role !== 'dev') {
            updates.role = 'admin';
          }
          if (cleanEmail && !existingData.email) {
            updates.email = cleanEmail;
          }
          if (Object.keys(updates).length > 0) {
            updates.updatedAt = serverTimestamp();
            try {
              await updateDoc(userRef, updates);
            } catch (updateErr) {
              console.warn('Offline update skipped for profile updates:', updateErr);
            }
          }
        }
      } catch (err) {
        console.warn('Notice during profile initialization:', err);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const nextProfile = snap.data() as UserProfile;
            setProfile(nextProfile);
            if (nextProfile.preferences) {
              const mergedPrefs: StudentPreferences = {
                ...DEFAULT_STUDENT_PREFERENCES,
                ...nextProfile.preferences,
                hiddenDashboardCards: Array.isArray(nextProfile.preferences.hiddenDashboardCards)
                  ? nextProfile.preferences.hiddenDashboardCards
                  : [],
                dashboardCardOrder:
                  Array.isArray(nextProfile.preferences.dashboardCardOrder) &&
                  nextProfile.preferences.dashboardCardOrder.length > 0
                    ? nextProfile.preferences.dashboardCardOrder
                    : DEFAULT_STUDENT_PREFERENCES.dashboardCardOrder,
                favoriteMaterialIds: Array.isArray(nextProfile.preferences.favoriteMaterialIds)
                  ? nextProfile.preferences.favoriteMaterialIds
                  : [],
                favoriteQuestionIds: Array.isArray(nextProfile.preferences.favoriteQuestionIds)
                  ? nextProfile.preferences.favoriteQuestionIds
                  : [],
                favoriteTopicIds: Array.isArray(nextProfile.preferences.favoriteTopicIds)
                  ? nextProfile.preferences.favoriteTopicIds
                  : [],
                customShortcuts: Array.isArray(nextProfile.preferences.customShortcuts)
                  ? nextProfile.preferences.customShortcuts
                  : [],
              };
              setLocalPreferences(mergedPrefs);
              saveCachedPreferences(mergedPrefs);
            }
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'users', uid, 'topicProgress'),
        (snap) => {
          const next: Record<string, TopicProgress> = {};
          snap.forEach((docSnap) => {
            const data = docSnap.data() as TopicProgress;
            next[docSnap.id] = data;
          });
          setTopicProgressMap(next);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/topicProgress`)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'users', uid, 'disciplineGoals'),
        (snap) => {
          const next: Record<string, DisciplineWeeklyGoal> = {};
          snap.forEach((docSnap) => {
            next[docSnap.id] = docSnap.data() as DisciplineWeeklyGoal;
          });
          setDisciplineGoalsMap(next);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/disciplineGoals`)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'users', uid, 'readingProgress'),
        (snap) => {
          const next: Record<string, ReadingProgress> = {};
          snap.forEach((docSnap) => {
            next[docSnap.id] = docSnap.data() as ReadingProgress;
          });
          setReadingProgressMap(next);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/readingProgress`)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'users', uid, 'mediaProgress'),
        (snap) => {
          const next: Record<string, MediaProgressRecord> = {};
          snap.forEach((docSnap) => {
            next[docSnap.id] = docSnap.data() as MediaProgressRecord;
          });
          setMediaProgressMap(next);
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'notifications'), orderBy('updatedAt', 'desc'), limit(80)),
        (snap) => {
          setStoredNotifications(
            snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<UserNotification, 'id'>),
            }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        canAccessAdminPanel || canAccessTeacherPanel
          ? query(collection(db, 'academicRequests'), limit(150))
          : query(collection(db, 'academicRequests'), where('studentId', '==', uid), limit(100)),
        (snap) => {
          const items = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AcademicRequest, 'id'>),
          }));
          items.sort((a, b) => {
            const ta = (a.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setAcademicRequests(items);
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'studySessions'), orderBy('createdAt', 'desc')),
        (snap) => {
          const list: StudySession[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudySession, 'id'>) }));
          setStudySessions(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/studySessions`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'simuladoAttempts'), orderBy('createdAt', 'desc')),
        (snap) => {
          const list: SimuladoAttempt[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SimuladoAttempt, 'id'>),
          }));
          setSimuladoAttempts(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/simuladoAttempts`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'errorNotebook'), orderBy('updatedAt', 'desc')),
        (snap) => {
          const list: ErrorEntry[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ErrorEntry, 'id'>) }));
          setErrorNotebook(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/errorNotebook`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'materials'), where('ownerId', '==', uid)),
        (snap) => {
          setMyMaterials(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudyMaterial, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'materials')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'sharedQuestions'), where('authorId', '==', uid)),
        (snap) => {
          setMyQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Question, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'sharedQuestions')
      )
    );

    if (user.emailVerified && user.email) {
      const famId = toFamilyMemberDocId(user.email);
      unsubs.push(
        onSnapshot(
          doc(db, 'familyMembers', famId),
          (snap) => {
            if (snap.exists()) {
              setMyFamilyMembership({ id: snap.id, ...(snap.data() as Omit<FamilyMember, 'id'>) });
            } else {
              setMyFamilyMembership(null);
            }
          },
          () => {
            setMyFamilyMembership(null);
          }
        )
      );
    } else {
      setMyFamilyMembership(null);
    }

    if (canAccessTeacherPanel) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'exams'), limit(60)),
          (snap) => {
            setAdminExams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamConcurso, 'id'>) })));
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'lessons'), where('authorId', '==', uid), limit(200)),
          (snap) => {
            setMyLessons(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) })));
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'activities'), where('authorId', '==', uid), limit(200)),
          (snap) => {
            setMyActivities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) })));
          },
          () => {}
        )
      );
    } else {
      setAdminExams([]);
      setMyLessons([]);
      setMyActivities([]);
    }

    if (canAccessAdminPanel) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'materials'), limit(300)),
          (snap) => {
            setAdminMaterials(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudyMaterial, 'id'>) })));
          },
          (err) => console.warn('Erro ao sincronizar materiais administrativos:', err)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'sharedQuestions'), limit(300)),
          (snap) => {
            setAdminQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Question, 'id'>) })));
          },
          (err) => console.warn('Erro ao sincronizar questões administrativas:', err)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'managedDisciplines'), limit(150)),
          (snap) => {
            setAdminDisciplines(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ManagedDiscipline, 'id'>) })));
          },
          (err) => console.warn('Erro ao sincronizar disciplinas administrativas:', err)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'managedTopics'), limit(300)),
          (snap) => {
            setAdminTopics(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ManagedTopic, 'id'>) })));
          },
          (err) => console.warn('Erro ao sincronizar tópicos administrativos:', err)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'simuladoLists'), limit(150)),
          (snap) => {
            setAdminSimuladoLists(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SimuladoList, 'id'>) })));
          },
          (err) => console.warn('Erro ao sincronizar listas de simulados:', err)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'platformNotices'), limit(150)),
          (snap) => {
            setAdminNotices(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlatformNotice, 'id'>) })));
          },
          (err) => console.warn('Erro ao sincronizar avisos administrativos:', err)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'classes'), limit(150)),
          (snap) => {
            setAdminClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Classroom, 'id'>) })));
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'lessons'), limit(250)),
          (snap) => {
            setAdminLessons(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) })));
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'activities'), limit(250)),
          (snap) => {
            setAdminActivities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) })));
          },
          () => {}
        )
      );
    } else {
      setAdminMaterials([]);
      setAdminQuestions([]);
      setAdminDisciplines([]);
      setAdminTopics([]);
      setAdminSimuladoLists([]);
      setAdminNotices([]);
      setAdminClasses([]);
      setAdminLessons([]);
      setAdminActivities([]);
    }

    if (canManageUsers) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users'), limit(200)),
          (snap) => {
            setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
          },
          (err) => console.warn('Erro ao listar usuários:', err)
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'familyMembers'),
          (snap) => {
            setFamilyMembers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyMember, 'id'>) })));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'familyMembers')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'accessSessions'), limit(200)),
          (snap) => {
            setAccessSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccessSession, 'id'>) })));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'accessSessions')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'enrollments'), limit(300)),
          (snap) => {
            setEnrollments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassEnrollment, 'id'>) })));
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'submissions'), limit(300)),
          (snap) => {
            setSubmissions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivitySubmission, 'id'>) })));
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'storageMetadata'), limit(300)),
          (snap) => {
            setStorageMetadataRecords(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StorageMetadataRecord, 'id'>) }))
            );
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(200)),
          (snap) => {
            setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) })));
          },
          () => {}
        )
      );
    } else {
      setAllUsers([]);
      setFamilyMembers([]);
      setAuditLogs([]);
      unsubs.push(
        onSnapshot(
          query(collection(db, 'accessSessions'), where('userId', '==', uid)),
          (snap) => {
            setAccessSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccessSession, 'id'>) })));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'accessSessions')
        )
      );

      if (canAccessTeacherPanel) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'enrollments'), where('teacherId', '==', uid), limit(250)),
            (snap) => {
              setEnrollments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassEnrollment, 'id'>) })));
            },
            () => {}
          )
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'submissions'), where('teacherId', '==', uid), limit(250)),
            (snap) => {
              setSubmissions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivitySubmission, 'id'>) })));
            },
            () => {}
          )
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'storageMetadata'), where('uploadedBy', '==', uid), limit(200)),
            (snap) => {
              setStorageMetadataRecords(
                snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StorageMetadataRecord, 'id'>) }))
              );
            },
            () => {}
          )
        );
      } else {
        setStorageMetadataRecords([]);
        unsubs.push(
          onSnapshot(
            query(collection(db, 'enrollments'), where('studentId', '==', uid), limit(100)),
            (snap) => {
              setEnrollments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassEnrollment, 'id'>) })));
            },
            () => {}
          )
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'submissions'), where('studentId', '==', uid), limit(150)),
            (snap) => {
              setSubmissions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivitySubmission, 'id'>) })));
            },
            () => {}
          )
        );
      }
    }

    unsubs.push(
      onSnapshot(
        query(collection(db, 'classes'), where('active', '==', true), limit(100)),
        (snap) => {
          setActiveClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Classroom, 'id'>) })));
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'lessons'), where('status', '==', 'published'), limit(200)),
        (snap) => {
          setPublishedLessons(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) })));
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'activities'), where('status', '==', 'published'), limit(200)),
        (snap) => {
          setPublishedActivities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) })));
        },
        () => {}
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, canAccessAdminPanel, canAccessTeacherPanel, canManageUsers]);

  useEffect(() => {
    const unsubSharedMaterials = onSnapshot(
      query(collection(db, 'materials'), where('isShared', '==', true), limit(250)),
      (snap) => {
        setSharedMaterials(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudyMaterial, 'id'>) })));
      },
      (err) => {
        console.warn('Falha ao sincronizar materiais compartilhados:', err);
      }
    );

    const unsubPublishedQuestions = onSnapshot(
      query(collection(db, 'sharedQuestions'), where('isPublished', '==', true), limit(250)),
      (snap) => {
        setPublishedQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Question, 'id'>) })));
      },
      (err) => {
        console.warn('Falha ao sincronizar questões publicadas:', err);
      }
    );

    const unsubDisciplines = onSnapshot(
      query(collection(db, 'managedDisciplines'), where('status', '==', 'published'), limit(100)),
      (snap) => {
        setPublishedDisciplines(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ManagedDiscipline, 'id'>) })));
      },
      () => {}
    );

    const unsubTopics = onSnapshot(
      query(collection(db, 'managedTopics'), where('status', '==', 'published'), limit(250)),
      (snap) => {
        setPublishedTopics(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ManagedTopic, 'id'>) })));
      },
      () => {}
    );

    const unsubSimuladoLists = onSnapshot(
      query(collection(db, 'simuladoLists'), where('status', '==', 'published'), limit(100)),
      (snap) => {
        setPublishedSimuladoLists(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SimuladoList, 'id'>) })));
      },
      () => {}
    );

    const unsubNotices = onSnapshot(
      query(collection(db, 'platformNotices'), where('status', '==', 'published'), limit(100)),
      (snap) => {
        setPublishedNotices(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlatformNotice, 'id'>) })));
      },
      () => {}
    );

    const unsubExams = onSnapshot(
      query(collection(db, 'exams'), where('status', '==', 'published'), limit(50)),
      (snap) => {
        setPublishedExams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamConcurso, 'id'>) })));
      },
      () => {}
    );

    return () => {
      unsubSharedMaterials();
      unsubPublishedQuestions();
      unsubDisciplines();
      unsubTopics();
      unsubSimuladoLists();
      unsubNotices();
      unsubExams();
    };
  }, []);

  const syncAccessPresence = useCallback(
    async (online: boolean) => {
      const current = auth.currentUser;
      if (!current) return;
      const devId = deviceIdRef.current;
      const sessionId = sanitizeId(`${current.uid}_${devId}`);
      const ref = doc(db, 'accessSessions', sessionId);
      const staffMember = canAccessAdminPanel || Boolean(current.emailVerified && isAdminEmail(current.email));
      const accessType: AccessSession['accessType'] = staffMember
        ? 'admin'
        : myFamilyMembership?.active
          ? 'familiar'
          : 'estudante';
      const displayName = (
        profile?.displayName ||
        current.displayName ||
        current.email?.split('@')[0] ||
        'Visitante'
      ).slice(0, 120);
      const deviceType = detectDeviceType();
      const currentTab = (presenceContextRef.current.tab || 'dashboard').slice(0, 40);
      const activeCampus: CampusLevel = presenceContextRef.current.campus === 'medio' ? 'medio' : 'superior';

      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            userId: current.uid,
            deviceId: devId,
            displayName,
            accessType,
            deviceType,
            currentTab,
            activeCampus,
            isOnline: online,
            sessionStartedAt: serverTimestamp(),
            lastSeenAt: serverTimestamp(),
          });
        } else {
          await updateDoc(ref, {
            displayName,
            accessType,
            deviceType,
            currentTab,
            activeCampus,
            isOnline: online,
            lastSeenAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-blocking heartbeat error
      }
    },
    [profile?.displayName, myFamilyMembership?.active, canAccessAdminPanel]
  );

  const updateAccessPresenceContext = useCallback(
    (tab: string, campus: CampusLevel) => {
      const prev = presenceContextRef.current;
      if (prev.tab === tab && prev.campus === campus) return;
      presenceContextRef.current = { tab, campus };
      if (auth.currentUser) {
        void syncAccessPresence(true);
      }
    },
    [syncAccessPresence]
  );

  useEffect(() => {
    if (!user) return;
    void syncAccessPresence(true);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncAccessPresence(true);
      }
    }, 45000);

    const onVisibility = () => {
      void syncAccessPresence(document.visibilityState === 'visible');
    };
    const onPageHide = () => {
      void syncAccessPresence(false);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [user, syncAccessPresence]);

  const materials = React.useMemo(() => {
    const merged = new Map<string, StudyMaterial>();
    GERAL_DEFAULT_MATERIALS.forEach((m) => merged.set(m.id, m));
    DEFAULT_STUDY_MATERIALS.forEach((m) => merged.set(m.id, m));
    MEDIO_DEFAULT_MATERIALS.forEach((m) => merged.set(m.id, m));
    sharedMaterials.forEach((m) => {
      if (!m.status || m.status === 'published') {
        merged.set(m.id, m);
      }
    });
    myMaterials.forEach((m) => {
      if (m.status === 'archived') return;
      if (m.status === 'draft' && m.isShared) return;
      merged.set(m.id, m);
    });
    return Array.from(merged.values());
  }, [sharedMaterials, myMaterials]);

  const allManagedMaterials = React.useMemo(() => {
    const merged = new Map<string, StudyMaterial>();
    GERAL_DEFAULT_MATERIALS.forEach((m) => merged.set(m.id, { ...m, status: 'published' }));
    DEFAULT_STUDY_MATERIALS.forEach((m) => merged.set(m.id, { ...m, status: 'published' }));
    MEDIO_DEFAULT_MATERIALS.forEach((m) => merged.set(m.id, { ...m, status: 'published' }));
    adminMaterials.forEach((m) => merged.set(m.id, m));
    myMaterials.forEach((m) => {
      if (!merged.has(m.id)) merged.set(m.id, m);
    });
    return Array.from(merged.values());
  }, [adminMaterials, myMaterials]);

  const questions = React.useMemo(() => {
    const merged = new Map<string, Question>();
    CETAP_QUESTIONS.forEach((q) => merged.set(q.id, q));
    MEDIO_QUESTIONS.forEach((q) => merged.set(q.id, q));
    EXTRA_CURATED_QUESTIONS.forEach((q) => merged.set(q.id, q));
    CARGO_04_BASICAS_QUESTIONS.forEach((q) => merged.set(q.id, q));
    CARGO_04_ESPECIFICAS_QUESTIONS.forEach((q) => merged.set(q.id, q));
    publishedQuestions.forEach((q) => {
      if (!q.status || q.status === 'published') {
        merged.set(q.id, q);
      }
    });
    myQuestions.forEach((q) => {
      if (q.status === 'archived') return;
      if (q.status === 'draft' && q.isPublished) return;
      merged.set(q.id, q);
    });
    return Array.from(merged.values());
  }, [publishedQuestions, myQuestions]);

  const allManagedQuestions = React.useMemo(() => {
    const merged = new Map<string, Question>();
    adminQuestions.forEach((q) => merged.set(q.id, q));
    myQuestions.forEach((q) => {
      if (!merged.has(q.id)) merged.set(q.id, q);
    });
    return Array.from(merged.values());
  }, [adminQuestions, myQuestions]);

  const managedDisciplines = React.useMemo(
    () => publishedDisciplines.filter((d) => d.status === 'published'),
    [publishedDisciplines]
  );

  const allManagedDisciplines = React.useMemo(
    () => [...adminDisciplines].sort((a, b) => a.priorityRank - b.priorityRank),
    [adminDisciplines]
  );

  const managedTopics = React.useMemo(
    () => publishedTopics.filter((t) => t.status === 'published').sort((a, b) => a.order - b.order),
    [publishedTopics]
  );

  const allManagedTopics = React.useMemo(
    () => [...adminTopics].sort((a, b) => a.order - b.order),
    [adminTopics]
  );

  const simuladoLists = React.useMemo(
    () => publishedSimuladoLists.filter((s) => s.status === 'published'),
    [publishedSimuladoLists]
  );

  const allManagedSimuladoLists = React.useMemo(() => adminSimuladoLists, [adminSimuladoLists]);

  const platformNotices = React.useMemo(
    () => publishedNotices.filter((n) => n.status === 'published'),
    [publishedNotices]
  );

  const allManagedNotices = React.useMemo(() => adminNotices, [adminNotices]);

  const defaultAlepaExam: ExamConcurso = React.useMemo(
    () => ({
      id: 'exam_alepa_2026',
      examId: 'exam_alepa_2026',
      title: 'Concurso Público ALEPA 2026',
      institution: 'Assembleia Legislativa do Estado do Pará · Banca Fundação CETAP',
      code: 'ALEPA-2026',
      year: 2026,
      levels: ['superior', 'medio'],
      positions: [
        'Cargo 03 – Técnico Legislativo / Assessoramento Legislativo (PL.AL.102)',
        'Cargo 04 – Assistente Legislativo / Assistência Administrativa (PL.AL.060)',
      ],
      examDate: CONCURSO_PROFILE.examDate,
      status: 'published',
      authorId: 'system_default',
    }),
    []
  );

  const exams = React.useMemo(() => {
    const map = new Map<string, ExamConcurso>([[defaultAlepaExam.id, defaultAlepaExam]]);
    publishedExams.forEach((ex) => {
      if (ex.status === 'published') map.set(ex.id, ex);
    });
    return Array.from(map.values());
  }, [defaultAlepaExam, publishedExams]);

  const allManagedExams = React.useMemo(() => {
    const map = new Map<string, ExamConcurso>([[defaultAlepaExam.id, defaultAlepaExam]]);
    adminExams.forEach((ex) => map.set(ex.id, ex));
    return Array.from(map.values());
  }, [defaultAlepaExam, adminExams]);

  const classes = React.useMemo(
    () => activeClasses.filter((c) => c.active && c.status === 'published'),
    [activeClasses]
  );

  const allManagedClasses = React.useMemo(() => {
    const map = new Map<string, Classroom>();
    activeClasses.forEach((c) => map.set(c.id, c));
    adminClasses.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [activeClasses, adminClasses]);

  const lessons = React.useMemo(() => {
    const map = new Map<string, Lesson>();
    publishedLessons.forEach((l) => map.set(l.id, l));
    myLessons.forEach((l) => {
      if (l.status !== 'archived') map.set(l.id, l);
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [publishedLessons, myLessons]);

  const allManagedLessons = React.useMemo(() => {
    const map = new Map<string, Lesson>();
    adminLessons.forEach((l) => map.set(l.id, l));
    myLessons.forEach((l) => {
      if (!map.has(l.id)) map.set(l.id, l);
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [adminLessons, myLessons]);

  const activities = React.useMemo(() => {
    const map = new Map<string, Activity>();
    publishedActivities.forEach((a) => map.set(a.id, a));
    myActivities.forEach((a) => {
      if (a.status !== 'archived') map.set(a.id, a);
    });
    return Array.from(map.values());
  }, [publishedActivities, myActivities]);

  const allManagedActivities = React.useMemo(() => {
    const map = new Map<string, Activity>();
    adminActivities.forEach((a) => map.set(a.id, a));
    myActivities.forEach((a) => {
      if (!map.has(a.id)) map.set(a.id, a);
    });
    return Array.from(map.values());
  }, [adminActivities, myActivities]);

  const getCampusDisciplines = useCallback(
    (campus: CampusLevel, medioCargoGroup: MedioCargoGroup = 'cargo_01_04'): Discipline[] => {
      const base = campus === 'medio' ? getMedioDisciplines(medioCargoGroup) : ALEPA_DISCIPLINES;
      const customForCampus = managedDisciplines.filter((d) => d.campusLevel === campus);
      const customTopicsForCampus = managedTopics.filter((t) => t.campusLevel === campus);

      const disciplineMap = new Map<string, Discipline>();
      base.forEach((d) => {
        const extraTopics = customTopicsForCampus
          .filter((t) => t.disciplineId === d.id)
          .map((t) => ({
            id: t.topicId || t.id,
            disciplineId: t.disciplineId,
            title: t.title,
            subtopics: t.subtopics,
            highYield: t.highYield,
          }));

        const topicMap = new Map(d.topics.map((t) => [t.id, t]));
        extraTopics.forEach((et) => topicMap.set(et.id, et));

        disciplineMap.set(d.id, {
          ...d,
          topics: Array.from(topicMap.values()),
        });
      });

      customForCampus.forEach((cd) => {
        const existing = disciplineMap.get(cd.id);
        const matchingTopics = customTopicsForCampus
          .filter((t) => t.disciplineId === cd.id)
          .map((t) => ({
            id: t.topicId || t.id,
            disciplineId: t.disciplineId,
            title: t.title,
            subtopics: t.subtopics,
            highYield: t.highYield,
          }));
        if (existing) {
          const topicMap = new Map(existing.topics.map((t) => [t.id, t]));
          matchingTopics.forEach((mt) => topicMap.set(mt.id, mt));
          disciplineMap.set(cd.id, {
            ...existing,
            name: cd.name,
            shortName: cd.shortName,
            editalBlock: cd.editalBlock,
            priorityRank: cd.priorityRank,
            examQuestions: cd.examQuestions,
            examPoints: cd.examPoints,
            tieBreakerOrder: cd.tieBreakerOrder,
            recommendedMinutesPerCycle: cd.recommendedMinutesPerCycle,
            topics: Array.from(topicMap.values()),
          });
        } else {
          disciplineMap.set(cd.id, {
            id: cd.id,
            name: cd.name,
            shortName: cd.shortName,
            editalBlock: cd.editalBlock,
            priorityRank: cd.priorityRank,
            examQuestions: cd.examQuestions,
            examPoints: cd.examPoints,
            tieBreakerOrder: cd.tieBreakerOrder,
            recommendedMinutesPerCycle: cd.recommendedMinutesPerCycle,
            topics: matchingTopics,
          });
        }
      });

      return Array.from(disciplineMap.values()).sort((a, b) => a.priorityRank - b.priorityRank);
    },
    [managedDisciplines, managedTopics]
  );

  const loginWithEmail = async (email: string, password: string) => {
    setIsGuest(false);
    try {
      localStorage.removeItem(GUEST_MODE_KEY);
    } catch {
      // ignore
    }
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    _preferredRole: UserRole
  ) => {
    setIsGuest(false);
    try {
      localStorage.removeItem(GUEST_MODE_KEY);
    } catch {
      // ignore
    }
    const cleanName = displayName.trim().slice(0, 120);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: cleanName });
    try {
      const userRef = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: cred.user.uid,
          displayName: cleanName || cred.user.email?.split('@')[0] || 'Estudante ALEPA',
          role: 'student',
          dailyGoalMinutes: CONCURSO_PROFILE.dailyGoalMinutes,
          examDate: CONCURSO_PROFILE.examDate,
          targetCargo: 'Cargo 03 – Técnico Legislativo (PL.AL.102)',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Erro ao criar perfil inicial:', err);
    }
    // Optional non-blocking verification email
    void sendEmailVerification(cred.user).catch(() => {});
  };

  const loginWithGoogle = async () => {
    setIsGuest(false);
    try {
      localStorage.removeItem(GUEST_MODE_KEY);
    } catch {
      // ignore
    }
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setWorkspaceAccessToken(credential.accessToken);
    }
  };

  const enterGuestMode = (guestName?: string) => {
    const cleanGuestName = (guestName || '').trim().slice(0, 120);
    if (cleanGuestName) {
      const store = loadGuestStore();
      saveGuestStore({
        ...store,
        profile: {
          ...store.profile,
          uid: GUEST_UID,
          displayName: cleanGuestName,
        },
      });
    }
    try {
      localStorage.setItem(GUEST_MODE_KEY, 'true');
    } catch {
      // ignore
    }
    setIsGuest(true);
    setSyncError(null);
    hydrateGuestData();
  };

  const exitGuestMode = () => {
    try {
      localStorage.removeItem(GUEST_MODE_KEY);
    } catch {
      // ignore
    }
    setIsGuest(false);
  };

  const connectGoogleWorkspace = async (): Promise<string | null> => {
    const current = auth.currentUser;
    const hasGoogleLinked = current?.providerData.some((p) => p.providerId === 'google.com');

    workspaceAuthProvider.setCustomParameters({ prompt: 'consent select_account' });
    try {
      let result;
      if (current && hasGoogleLinked) {
        result = await reauthenticateWithPopup(current, workspaceAuthProvider);
      } else if (current) {
        try {
          result = await linkWithPopup(current, workspaceAuthProvider);
        } catch (linkErr: unknown) {
          const code = (linkErr as { code?: string })?.code || '';
          if (code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') {
            result = await signInWithPopup(auth, workspaceAuthProvider);
          } else {
            throw linkErr;
          }
        }
      } else {
        result = await signInWithPopup(auth, workspaceAuthProvider);
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (!token) {
        throw new Error('Não foi possível obter a autorização da sua conta Google Workspace.');
      }
      setWorkspaceAccessToken(token);
      return token;
    } finally {
      workspaceAuthProvider.setCustomParameters({});
    }
  };

  const clearWorkspaceToken = () => {
    setWorkspaceAccessToken(null);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshAuthState = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser(auth.currentUser);
      setAuthRefreshTick((t) => t + 1);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const snap = await getDoc(userRef);
      const isPrimaryAdminAccount =
        Boolean(auth.currentUser.emailVerified) && isAdminEmail(auth.currentUser.email);
      const cleanEmail = (auth.currentUser.email || '').trim().toLowerCase().slice(0, 160);
      if (!snap.exists()) {
        const payload: Record<string, unknown> = {
          uid: auth.currentUser.uid,
          displayName: (
            auth.currentUser.displayName ||
            auth.currentUser.email?.split('@')[0] ||
            'Estudante ALEPA'
          ).slice(0, 120),
          role: isPrimaryAdminAccount ? 'admin' : 'student',
          dailyGoalMinutes: CONCURSO_PROFILE.dailyGoalMinutes,
          examDate: CONCURSO_PROFILE.examDate,
          targetCargo: 'Cargo 03 – Técnico Legislativo (PL.AL.102)',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (cleanEmail) payload.email = cleanEmail;
        await setDoc(userRef, payload);
      } else {
        const existingData = snap.data() as Partial<UserProfile>;
        const updates: Record<string, unknown> = {};
        if (isPrimaryAdminAccount && existingData.role !== 'admin' && existingData.role !== 'dev') {
          updates.role = 'admin';
        }
        if (cleanEmail && !existingData.email) {
          updates.email = cleanEmail;
        }
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = serverTimestamp();
          await updateDoc(userRef, updates);
        }
      }
    }
  };

  const logout = async () => {
    setWorkspaceAccessToken(null);
    if (isGuest && !auth.currentUser) {
      exitGuestMode();
      return;
    }
    if (auth.currentUser) {
      await syncAccessPresence(false);
    }
    await signOut(auth);
  };

  const updateProfileSettings = async (patch: {
    displayName?: string;
    dailyGoalMinutes?: number;
    examDate?: string;
    targetCargo?: string;
  }) => {
    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          displayName:
            patch.displayName !== undefined ? patch.displayName.trim().slice(0, 120) : prev.profile.displayName,
          dailyGoalMinutes:
            patch.dailyGoalMinutes !== undefined
              ? Math.max(15, Math.min(720, Math.round(patch.dailyGoalMinutes)))
              : prev.profile.dailyGoalMinutes,
          examDate:
            patch.examDate !== undefined && patch.examDate.trim().length >= 8
              ? patch.examDate.trim().slice(0, 20)
              : prev.profile.examDate,
          targetCargo:
            patch.targetCargo !== undefined && patch.targetCargo.trim().length >= 1
              ? patch.targetCargo.trim().slice(0, 120)
              : prev.profile.targetCargo,
        },
      }));
      return;
    }
    const current = ensureSignedIn();
    const path = `users/${current.uid}`;
    try {
      const ref = doc(db, 'users', current.uid);
      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.displayName !== undefined) updates.displayName = patch.displayName.trim().slice(0, 120);
      if (patch.dailyGoalMinutes !== undefined) {
        updates.dailyGoalMinutes = Math.max(15, Math.min(720, Math.round(patch.dailyGoalMinutes)));
      }
      if (patch.examDate !== undefined && patch.examDate.trim().length >= 8) {
        updates.examDate = patch.examDate.trim().slice(0, 20);
      }
      if (patch.targetCargo !== undefined && patch.targetCargo.trim().length >= 1) {
        updates.targetCargo = patch.targetCargo.trim().slice(0, 120);
      }
      await updateDoc(ref, updates);
    } catch (err) {
      setSyncError('Não foi possível atualizar seu perfil agora.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveDisciplineWeeklyGoal = async (disciplineId: string, weeklyGoalMinutes: number) => {
    const safeDiscId = sanitizeId(disciplineId).slice(0, 80);
    const clampedMinutes = Math.max(15, Math.min(2520, Math.round(weeklyGoalMinutes)));

    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        disciplineGoalsMap: {
          ...prev.disciplineGoalsMap,
          [safeDiscId]: {
            userId: GUEST_UID,
            disciplineId: safeDiscId,
            weeklyGoalMinutes: clampedMinutes,
          },
        },
      }));
      return;
    }

    const current = ensureSignedIn();
    const existing = disciplineGoalsMap[safeDiscId];
    const path = `users/${current.uid}/disciplineGoals/${safeDiscId}`;
    try {
      const ref = doc(db, 'users', current.uid, 'disciplineGoals', safeDiscId);
      if (existing) {
        await updateDoc(ref, {
          weeklyGoalMinutes: clampedMinutes,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          userId: current.uid,
          disciplineId: safeDiscId,
          weeklyGoalMinutes: clampedMinutes,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setSyncError('Erro ao salvar meta semanal da disciplina.');
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const saveTopicProgress = async (
    topicId: string,
    disciplineId: string,
    patch: Partial<Pick<TopicProgress, 'theoryDone' | 'questionsDone' | 'revisionDone' | 'notes'>>
  ) => {
    const safeTopicId = sanitizeId(topicId);
    const existing = topicProgressMap[safeTopicId];
    const theoryDone = patch.theoryDone ?? existing?.theoryDone ?? false;
    const questionsDone = patch.questionsDone ?? existing?.questionsDone ?? false;
    const revisionDone = patch.revisionDone ?? existing?.revisionDone ?? false;
    const notes = (patch.notes ?? existing?.notes ?? '').slice(0, 2000);
    const masteryLevel = Math.round(
      ((theoryDone ? 40 : 0) + (questionsDone ? 40 : 0) + (revisionDone ? 20 : 0))
    );

    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        topicProgressMap: {
          ...prev.topicProgressMap,
          [safeTopicId]: {
            userId: GUEST_UID,
            topicId: safeTopicId,
            disciplineId: disciplineId.slice(0, 80),
            theoryDone,
            questionsDone,
            revisionDone,
            masteryLevel,
            notes,
          },
        },
      }));
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/topicProgress/${safeTopicId}`;
    try {
      const ref = doc(db, 'users', current.uid, 'topicProgress', safeTopicId);
      if (existing) {
        await updateDoc(ref, {
          theoryDone,
          questionsDone,
          revisionDone,
          masteryLevel,
          notes,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          userId: current.uid,
          topicId: safeTopicId,
          disciplineId: disciplineId.slice(0, 80),
          theoryDone,
          questionsDone,
          revisionDone,
          masteryLevel,
          notes,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setSyncError('Erro ao salvar progresso do tópico.');
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const saveReadingProgress = async (
    materialId: string,
    patch: Partial<Omit<ReadingProgress, 'materialId' | 'userId' | 'updatedAt'>>
  ) => {
    const safeMaterialId = sanitizeId(materialId);
    const existing = readingProgressMap[safeMaterialId];

    const totalPages = Math.max(1, Math.min(20000, Math.round(patch.totalPages ?? existing?.totalPages ?? 1)));
    const lastPage = Math.max(1, Math.min(totalPages, Math.round(patch.lastPage ?? existing?.lastPage ?? 1)));
    const progressPercent = Math.max(
      0,
      Math.min(100, Math.round(patch.progressPercent ?? Math.round((lastPage / totalPages) * 100)))
    );
    const readingMode = patch.readingMode ?? existing?.readingMode ?? 'book';
    const fontSize = Math.max(12, Math.min(32, Math.round(patch.fontSize ?? existing?.fontSize ?? 17)));
    const lineHeight = Math.max(1.1, Math.min(2.6, Number((patch.lineHeight ?? existing?.lineHeight ?? 1.65).toFixed(2))));
    const maxWidthCh = Math.max(40, Math.min(110, Math.round(patch.maxWidthCh ?? existing?.maxWidthCh ?? 68)));
    const theme = patch.theme ?? existing?.theme ?? 'paper';
    const materialTitle = (patch.materialTitle ?? existing?.materialTitle ?? 'Documento PDF').trim().slice(0, 200) || 'Documento PDF';
    const bookmarks = (patch.bookmarks ?? existing?.bookmarks ?? []).slice(0, 100);
    const highlights = (patch.highlights ?? existing?.highlights ?? []).slice(0, 150);
    const annotations = (patch.annotations ?? existing?.annotations ?? []).slice(0, 150);
    const lastReadAt = (patch.lastReadAt ?? new Date().toISOString()).slice(0, 40);

    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        readingProgressMap: {
          ...prev.readingProgressMap,
          [safeMaterialId]: {
            userId: GUEST_UID,
            materialId: safeMaterialId,
            materialTitle,
            lastPage,
            totalPages,
            progressPercent,
            readingMode,
            fontSize,
            lineHeight,
            maxWidthCh,
            theme,
            bookmarks,
            highlights,
            annotations,
            lastReadAt,
          },
        },
      }));
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/readingProgress/${safeMaterialId}`;
    try {
      const ref = doc(db, 'users', current.uid, 'readingProgress', safeMaterialId);
      const docPayload = {
        materialTitle,
        lastPage,
        totalPages,
        progressPercent,
        readingMode,
        fontSize,
        lineHeight,
        maxWidthCh,
        theme,
        bookmarks,
        highlights,
        annotations,
        lastReadAt,
        updatedAt: serverTimestamp(),
      };
      if (existing) {
        await updateDoc(ref, docPayload);
      } else {
        await setDoc(ref, {
          userId: current.uid,
          materialId: safeMaterialId,
          ...docPayload,
        });
      }
    } catch (err) {
      setSyncError('Erro ao sincronizar histórico de leitura.');
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteReadingProgress = async (materialId: string) => {
    const safeMaterialId = sanitizeId(materialId);
    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => {
        const nextMap = { ...prev.readingProgressMap };
        delete nextMap[safeMaterialId];
        return { ...prev, readingProgressMap: nextMap };
      });
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/readingProgress/${safeMaterialId}`;
    try {
      await deleteDoc(doc(db, 'users', current.uid, 'readingProgress', safeMaterialId));
    } catch (err) {
      setSyncError('Erro ao remover registro de leitura.');
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const logStudySession = async (input: {
    dateKey: string;
    disciplineId: string;
    topicTitle: string;
    blockType: BlockType;
    durationMinutes: number;
    notes?: string;
  }) => {
    const sessionId = sanitizeId(`ses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    if (isGuest && !auth.currentUser) {
      const newSession: StudySession = {
        id: sessionId,
        userId: GUEST_UID,
        dateKey: input.dateKey.slice(0, 20),
        disciplineId: input.disciplineId.slice(0, 80),
        topicTitle: input.topicTitle.trim().slice(0, 200) || 'Sessão de estudo',
        blockType: input.blockType,
        durationMinutes: Math.max(1, Math.min(600, Math.round(input.durationMinutes))),
        notes: (input.notes || '').slice(0, 1000),
      };
      persistGuestPatch((prev) => ({
        ...prev,
        studySessions: [newSession, ...prev.studySessions],
      }));
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/studySessions/${sessionId}`;
    try {
      await setDoc(doc(db, 'users', current.uid, 'studySessions', sessionId), {
        userId: current.uid,
        dateKey: input.dateKey.slice(0, 20),
        disciplineId: input.disciplineId.slice(0, 80),
        topicTitle: input.topicTitle.trim().slice(0, 200) || 'Sessão de estudo',
        blockType: input.blockType,
        durationMinutes: Math.max(1, Math.min(600, Math.round(input.durationMinutes))),
        notes: (input.notes || '').slice(0, 1000),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao registrar sessão de estudo.');
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const saveSimuladoAttempt = async (input: {
    title: string;
    mode: 'treino' | 'simulado';
    primaryDisciplineId: string;
    totalQuestions: number;
    correctCount: number;
    score: number;
    durationSeconds: number;
  }) => {
    const attemptId = sanitizeId(`sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    if (isGuest && !auth.currentUser) {
      const attempt: SimuladoAttempt = {
        id: attemptId,
        userId: GUEST_UID,
        title: input.title.trim().slice(0, 160),
        mode: input.mode,
        primaryDisciplineId: input.primaryDisciplineId.slice(0, 80),
        totalQuestions: Math.max(1, Math.min(200, Math.round(input.totalQuestions))),
        correctCount: Math.max(0, Math.min(input.totalQuestions, Math.round(input.correctCount))),
        score: Math.max(0, Math.min(10, Number(input.score.toFixed(2)))),
        durationSeconds: Math.max(0, Math.min(36000, Math.round(input.durationSeconds))),
      };
      persistGuestPatch((prev) => ({
        ...prev,
        simuladoAttempts: [attempt, ...prev.simuladoAttempts],
      }));
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/simuladoAttempts/${attemptId}`;
    try {
      await setDoc(doc(db, 'users', current.uid, 'simuladoAttempts', attemptId), {
        userId: current.uid,
        title: input.title.trim().slice(0, 160),
        mode: input.mode,
        primaryDisciplineId: input.primaryDisciplineId.slice(0, 80),
        totalQuestions: Math.max(1, Math.min(200, Math.round(input.totalQuestions))),
        correctCount: Math.max(0, Math.min(input.totalQuestions, Math.round(input.correctCount))),
        score: Math.max(0, Math.min(10, Number(input.score.toFixed(2)))),
        durationSeconds: Math.max(0, Math.min(36000, Math.round(input.durationSeconds))),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao salvar resultado do simulado.');
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const addErrorEntry = async (input: {
    questionId: string;
    disciplineId: string;
    topicTitle: string;
    questionStem: string;
    correctOption: string;
    selectedOption: string;
    errorReason: ErrorReason;
    improvementNote: string;
  }) => {
    const safeQuestionId = sanitizeId(input.questionId);
    const entryId = sanitizeId(`err_${safeQuestionId}`);

    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => {
        const existingIdx = prev.errorNotebook.findIndex((e) => e.id === entryId);
        if (existingIdx >= 0) {
          const updated = [...prev.errorNotebook];
          updated[existingIdx] = {
            ...updated[existingIdx],
            errorReason: input.errorReason,
            improvementNote: input.improvementNote.slice(0, 2000),
            nextReviewDate: addDaysIso(1),
            reviewCount: updated[existingIdx].reviewCount + 1,
            status: 'pending',
          };
          return { ...prev, errorNotebook: updated };
        }
        const entry: ErrorEntry = {
          id: entryId,
          userId: GUEST_UID,
          questionId: safeQuestionId,
          disciplineId: input.disciplineId.slice(0, 80),
          topicTitle: input.topicTitle.slice(0, 200),
          questionStem: input.questionStem.slice(0, 2000),
          correctOption: input.correctOption.slice(0, 500),
          selectedOption: input.selectedOption.slice(0, 500),
          errorReason: input.errorReason,
          improvementNote: input.improvementNote.slice(0, 2000),
          nextReviewDate: addDaysIso(1),
          reviewCount: 0,
          status: 'pending',
        };
        return { ...prev, errorNotebook: [entry, ...prev.errorNotebook] };
      });
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/errorNotebook/${entryId}`;
    const existing = errorNotebook.find((e) => e.id === entryId);
    try {
      if (existing) {
        await updateDoc(doc(db, 'users', current.uid, 'errorNotebook', entryId), {
          errorReason: input.errorReason,
          improvementNote: input.improvementNote.slice(0, 2000),
          nextReviewDate: addDaysIso(1),
          reviewCount: existing.reviewCount + 1,
          status: 'pending',
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'users', current.uid, 'errorNotebook', entryId), {
          userId: current.uid,
          questionId: safeQuestionId,
          disciplineId: input.disciplineId.slice(0, 80),
          topicTitle: input.topicTitle.slice(0, 200),
          questionStem: input.questionStem.slice(0, 2000),
          correctOption: input.correctOption.slice(0, 500),
          selectedOption: input.selectedOption.slice(0, 500),
          errorReason: input.errorReason,
          improvementNote: input.improvementNote.slice(0, 2000),
          nextReviewDate: addDaysIso(1),
          reviewCount: 0,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setSyncError('Erro ao salvar no Caderno de Erros.');
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const updateErrorEntry = async (
    entryId: string,
    patch: Partial<Pick<ErrorEntry, 'errorReason' | 'improvementNote' | 'nextReviewDate' | 'reviewCount' | 'status'>>
  ) => {
    const safeId = sanitizeId(entryId);
    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        errorNotebook: prev.errorNotebook.map((item) =>
          item.id === safeId
            ? {
                ...item,
                errorReason: patch.errorReason ?? item.errorReason,
                improvementNote: (patch.improvementNote ?? item.improvementNote).slice(0, 2000),
                nextReviewDate: (patch.nextReviewDate ?? item.nextReviewDate).slice(0, 20),
                reviewCount: patch.reviewCount ?? item.reviewCount,
                status: patch.status ?? item.status,
              }
            : item
        ),
      }));
      return;
    }

    const current = ensureSignedIn();
    const existing = errorNotebook.find((e) => e.id === safeId);
    if (!existing) return;
    const path = `users/${current.uid}/errorNotebook/${safeId}`;
    try {
      await updateDoc(doc(db, 'users', current.uid, 'errorNotebook', safeId), {
        errorReason: patch.errorReason ?? existing.errorReason,
        improvementNote: (patch.improvementNote ?? existing.improvementNote).slice(0, 2000),
        nextReviewDate: (patch.nextReviewDate ?? existing.nextReviewDate).slice(0, 20),
        reviewCount: patch.reviewCount ?? existing.reviewCount,
        status: patch.status ?? existing.status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao atualizar revisão.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteErrorEntry = async (entryId: string) => {
    const safeId = sanitizeId(entryId);
    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        errorNotebook: prev.errorNotebook.filter((item) => item.id !== safeId),
      }));
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/errorNotebook/${safeId}`;
    try {
      await deleteDoc(doc(db, 'users', current.uid, 'errorNotebook', safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const writeAuditLog = useCallback(
    async (input: {
      action: string;
      targetCollection: string;
      targetId: string;
      summary: string;
    }) => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified) return;
      const logId = sanitizeId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      try {
        await setDoc(doc(db, 'auditLogs', logId), {
          logId,
          actorId: current.uid,
          actorEmail: (current.email || '').trim().toLowerCase().slice(0, 160),
          actorRole: effectiveRole,
          action: input.action.trim().slice(0, 80),
          targetCollection: input.targetCollection.trim().slice(0, 80),
          targetId: input.targetId.trim().slice(0, 128),
          summary: input.summary.trim().slice(0, 400),
          createdAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking audit log write
      }
    },
    [effectiveRole]
  );

  const updateStudentPreferences = async (patch: Partial<StudentPreferences>) => {
    const nextPrefs: StudentPreferences = {
      ...preferences,
      ...patch,
      hiddenDashboardCards: (patch.hiddenDashboardCards ?? preferences.hiddenDashboardCards).slice(0, 20),
      dashboardCardOrder: (patch.dashboardCardOrder ?? preferences.dashboardCardOrder).slice(0, 20),
      favoriteMaterialIds: (patch.favoriteMaterialIds ?? preferences.favoriteMaterialIds).slice(0, 100),
      favoriteQuestionIds: (patch.favoriteQuestionIds ?? preferences.favoriteQuestionIds).slice(0, 100),
      favoriteTopicIds: (patch.favoriteTopicIds ?? preferences.favoriteTopicIds).slice(0, 100),
      customShortcuts: (patch.customShortcuts ?? preferences.customShortcuts).slice(0, 10),
    };
    setLocalPreferences(nextPrefs);
    saveCachedPreferences(nextPrefs);
    setProfile((prev) => (prev ? { ...prev, preferences: nextPrefs } : prev));

    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          preferences: nextPrefs,
        },
      }));
      return;
    }

    const current = auth.currentUser;
    if (!current) return;
    try {
      await updateDoc(doc(db, 'users', current.uid), {
        preferences: nextPrefs,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao sincronizar suas preferências.');
      handleFirestoreError(err, OperationType.UPDATE, `users/${current.uid}`);
    }
  };

  const toggleFavoriteMaterial = async (materialId: string) => {
    const exists = preferences.favoriteMaterialIds.includes(materialId);
    const next = exists
      ? preferences.favoriteMaterialIds.filter((id) => id !== materialId)
      : [materialId, ...preferences.favoriteMaterialIds].slice(0, 100);
    await updateStudentPreferences({ favoriteMaterialIds: next });
  };

  const toggleFavoriteQuestion = async (questionId: string) => {
    const exists = preferences.favoriteQuestionIds.includes(questionId);
    const next = exists
      ? preferences.favoriteQuestionIds.filter((id) => id !== questionId)
      : [questionId, ...preferences.favoriteQuestionIds].slice(0, 100);
    await updateStudentPreferences({ favoriteQuestionIds: next });
  };

  const toggleFavoriteTopic = async (topicId: string) => {
    const exists = preferences.favoriteTopicIds.includes(topicId);
    const next = exists
      ? preferences.favoriteTopicIds.filter((id) => id !== topicId)
      : [topicId, ...preferences.favoriteTopicIds].slice(0, 100);
    await updateStudentPreferences({ favoriteTopicIds: next });
  };

  const updateUserRole = async (targetUid: string, nextRole: NormalizedUserRole) => {
    if (!canManageUsers) {
      throw new Error('Apenas Administrador ou Desenvolvedor pode alterar permissões.');
    }
    const safeUid = sanitizeId(targetUid);
    const path = `users/${safeUid}`;
    try {
      await updateDoc(doc(db, 'users', safeUid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        action: 'update_user_role',
        targetCollection: 'users',
        targetId: safeUid,
        summary: `Perfil de acesso alterado para ${nextRole}.`,
      });
    } catch (err) {
      setSyncError('Erro ao atualizar perfil de acesso do usuário.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const toggleUserActive = async (targetUid: string, active: boolean) => {
    if (!canManageUsers) {
      throw new Error('Apenas Administrador Principal pode ativar ou desativar usuários.');
    }
    const safeUid = sanitizeId(targetUid);
    const path = `users/${safeUid}`;
    try {
      await updateDoc(doc(db, 'users', safeUid), {
        active: Boolean(active),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        action: active ? 'activate_user' : 'deactivate_user',
        targetCollection: 'users',
        targetId: safeUid,
        summary: active ? 'Usuário reativado.' : 'Usuário desativado (dados preservados).',
      });
    } catch (err) {
      setSyncError('Erro ao alterar status da conta do usuário.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const updateUserAssignments = async (
    targetUid: string,
    patch: { assignedClassIds?: string[]; assignedDisciplineIds?: string[] }
  ) => {
    if (!canManageUsers) {
      throw new Error('Apenas Administrador Principal pode vincular turmas e disciplinas.');
    }
    const safeUid = sanitizeId(targetUid);
    const path = `users/${safeUid}`;
    try {
      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.assignedClassIds !== undefined) {
        updates.assignedClassIds = patch.assignedClassIds.slice(0, 50);
      }
      if (patch.assignedDisciplineIds !== undefined) {
        updates.assignedDisciplineIds = patch.assignedDisciplineIds.slice(0, 50);
      }
      await updateDoc(doc(db, 'users', safeUid), updates);
      await writeAuditLog({
        action: 'update_user_assignments',
        targetCollection: 'users',
        targetId: safeUid,
        summary: 'Vínculos de turmas e disciplinas atualizados.',
      });
    } catch (err) {
      setSyncError('Erro ao vincular turmas/disciplinas.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const addMaterial = async (input: {
    title: string;
    subtitle?: string;
    disciplineId: string;
    libraryCategoryId?: LibraryCategoryId;
    editalTopic?: string;
    resourceType?: ResourceType;
    fileType: MaterialFileType;
    institution?: string;
    url: string;
    pricing?: 'gratuito' | 'pago';
    publishedAt?: string;
    lastVerifiedAt?: string;
    linkStatus?: LinkStatus;
    isOfficialContent?: boolean;
    relevanceTier?: MaterialRelevanceTier;
    campusLevel?: LibraryScope;
    status?: PublicationStatus;
    classId?: string;
    keywords?: string[];
    author?: string;
    edition?: string;
    year?: number;
    checksumSha256?: string;
    storageProvider?: StorageProviderType;
    storagePath?: string;
    reviewNotes?: string;
    fileName?: string;
    description?: string;
    isShared?: boolean;
    allowDownload?: boolean;
    textLayerStatus?: StudyMaterial['textLayerStatus'];
    pageCount?: number;
    fileSizeBytes?: number;
    version?: number;
    versionNote?: string;
    chapters?: MaterialChapter[];
    studyRecommendations?: string[];
    sections?: PdfVirtualSection[];
    parentMaterialId?: string;
    startPage?: number;
    endPage?: number;
    isVirtualSection?: boolean;
    organizedBy?: string;
    organizedAt?: string;
    catalogNumber?: number;
    pendingDefinition?: boolean;
    indexingStatus?: StudyMaterial['indexingStatus'];
  }) => {
    const materialId = sanitizeId(`mat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const todayIso = addDaysIso(0);
    const trimmedUrl = input.url.trim().slice(0, 2000);
    const isLocalUrl = trimmedUrl.startsWith('local://');

    if (isGuest && !auth.currentUser) {
      const newMat: StudyMaterial = {
        id: materialId,
        ownerId: GUEST_UID,
        title: input.title.trim().slice(0, 200),
        subtitle: input.subtitle?.trim().slice(0, 300),
        disciplineId: input.disciplineId.slice(0, 80),
        libraryCategoryId: input.libraryCategoryId,
        editalTopic: input.editalTopic?.trim().slice(0, 240),
        resourceType: input.resourceType,
        fileType: input.fileType,
        institution: input.institution?.trim().slice(0, 160),
        url: trimmedUrl,
        pricing: input.pricing,
        publishedAt: (input.publishedAt || todayIso).slice(0, 20),
        lastVerifiedAt: (input.lastVerifiedAt || todayIso).slice(0, 20),
        linkStatus: input.linkStatus,
        isOfficialContent: input.isOfficialContent,
        relevanceTier: input.relevanceTier,
        campusLevel: input.campusLevel,
        storageProvider: isLocalUrl ? 'local' : input.storageProvider,
        status: 'draft',
        fileName: (input.fileName || '').slice(0, 240),
        description: (input.description || '').slice(0, 2000),
        allowDownload: input.allowDownload ?? true,
        textLayerStatus: input.textLayerStatus,
        pageCount: input.pageCount,
        fileSizeBytes: input.fileSizeBytes,
        version: input.version ?? 1,
        versionNote: input.versionNote?.slice(0, 300),
        chapters: input.chapters,
        studyRecommendations: input.studyRecommendations,
        sections: input.sections,
        parentMaterialId: input.parentMaterialId,
        startPage: input.startPage,
        endPage: input.endPage,
        isVirtualSection: input.isVirtualSection,
        organizedBy: input.organizedBy,
        organizedAt: input.organizedAt,
        catalogNumber: input.catalogNumber,
        pendingDefinition: input.pendingDefinition,
        indexingStatus: input.indexingStatus,
        isShared: false,
      };
      persistGuestPatch((prev) => ({
        ...prev,
        myMaterials: [newMat, ...prev.myMaterials],
      }));
      return materialId;
    }

    const current = ensureSignedIn();
    const requestedStatus: PublicationStatus = canPublishShared
      ? input.status || (input.isShared ? 'published' : 'draft')
      : isTeacher && input.status === 'in_review'
        ? 'in_review'
        : 'draft';
    const resolvedStatus: PublicationStatus = isLocalUrl
      ? requestedStatus === 'in_review' && isTeacher
        ? 'in_review'
        : 'draft'
      : requestedStatus;
    const canShare = Boolean(
      !isLocalUrl && canPublishShared && resolvedStatus === 'published' && input.isShared !== false
    );
    const path = `materials/${materialId}`;
    try {
      const payload: Record<string, unknown> = {
        ownerId: current.uid,
        title: input.title.trim().slice(0, 200),
        disciplineId: input.disciplineId.slice(0, 80),
        fileType: input.fileType,
        url: trimmedUrl,
        fileName: (input.fileName || '').slice(0, 240),
        description: (input.description || '').slice(0, 2000),
        isShared: canShare,
        status: resolvedStatus,
        updatedBy: current.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.subtitle) payload.subtitle = input.subtitle.trim().slice(0, 300);
      if (input.libraryCategoryId) payload.libraryCategoryId = input.libraryCategoryId.slice(0, 80);
      if (input.editalTopic) payload.editalTopic = input.editalTopic.trim().slice(0, 240);
      if (input.resourceType) payload.resourceType = input.resourceType;
      if (input.institution) payload.institution = input.institution.trim().slice(0, 160);
      if (input.pricing) payload.pricing = input.pricing;
      if (input.relevanceTier) payload.relevanceTier = input.relevanceTier;
      if (input.campusLevel) payload.campusLevel = input.campusLevel;
      if (input.classId) payload.classId = sanitizeId(input.classId);
      if (input.keywords?.length) {
        payload.keywords = input.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 20);
      }
      if (input.author) payload.author = input.author.trim().slice(0, 160);
      if (input.edition) payload.edition = input.edition.trim().slice(0, 80);
      if (input.year) payload.year = Math.max(1900, Math.min(2100, Math.round(input.year)));
      if (input.checksumSha256) payload.checksumSha256 = input.checksumSha256.trim().slice(0, 128);
      if (isLocalUrl) {
        payload.storageProvider = 'local';
      } else if (input.storageProvider) {
        payload.storageProvider = input.storageProvider;
      }
      if (!isLocalUrl && input.storagePath) payload.storagePath = input.storagePath.trim().slice(0, 500);
      if (input.reviewNotes && !canShare && resolvedStatus !== 'published') {
        payload.reviewNotes = input.reviewNotes.trim().slice(0, 600);
      }
      if (input.chapters?.length) payload.chapters = input.chapters.slice(0, 120);
      if (input.studyRecommendations?.length) {
        payload.studyRecommendations = input.studyRecommendations.map((s) => s.trim()).filter(Boolean).slice(0, 30);
      }
      if (input.sections?.length) payload.sections = input.sections.slice(0, 40);
      if (input.parentMaterialId) payload.parentMaterialId = input.parentMaterialId;
      if (input.startPage !== undefined) payload.startPage = input.startPage;
      if (input.endPage !== undefined) payload.endPage = input.endPage;
      if (input.isVirtualSection !== undefined) payload.isVirtualSection = Boolean(input.isVirtualSection);
      if (input.organizedBy) payload.organizedBy = input.organizedBy.slice(0, 128);
      if (input.organizedAt) payload.organizedAt = input.organizedAt.slice(0, 40);
      if (input.catalogNumber !== undefined) payload.catalogNumber = Math.max(1, Math.min(500, Math.round(input.catalogNumber)));
      if (input.pendingDefinition !== undefined) payload.pendingDefinition = Boolean(input.pendingDefinition);
      if (input.indexingStatus) payload.indexingStatus = input.indexingStatus;
      payload.publishedAt = (input.publishedAt || todayIso).slice(0, 20);
      payload.lastVerifiedAt = (input.lastVerifiedAt || todayIso).slice(0, 20);
      if (input.linkStatus) payload.linkStatus = input.linkStatus;
      if (input.isOfficialContent !== undefined) payload.isOfficialContent = Boolean(input.isOfficialContent);
      if (input.allowDownload !== undefined) payload.allowDownload = Boolean(input.allowDownload);
      if (input.textLayerStatus) payload.textLayerStatus = input.textLayerStatus;
      if (input.pageCount !== undefined) payload.pageCount = Math.max(0, Math.min(20000, Math.round(input.pageCount)));
      if (input.fileSizeBytes !== undefined) payload.fileSizeBytes = Math.max(0, Math.min(500000000, Math.round(input.fileSizeBytes)));
      if (input.version !== undefined) payload.version = Math.max(1, Math.min(1000, Math.round(input.version)));
      if (input.versionNote) payload.versionNote = input.versionNote.trim().slice(0, 300);

      await setDoc(doc(db, 'materials', materialId), payload);
      if (canAccessTeacherPanel) {
        await writeAuditLog({
          action: 'create_material',
          targetCollection: 'materials',
          targetId: materialId,
          summary: `Material cadastrado (${resolvedStatus}): ${input.title.trim().slice(0, 100)}`,
        });
      }
      return materialId;
    } catch (err) {
      setSyncError('Erro ao salvar material.');
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateMaterial = async (
    materialId: string,
    patch: Partial<Omit<StudyMaterial, 'id' | 'ownerId' | 'createdAt'>>
  ) => {
    const safeId = sanitizeId(materialId);
    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        myMaterials: prev.myMaterials.map((m) => (m.id === safeId ? { ...m, ...patch } : m)),
      }));
      return;
    }

    const current = ensureSignedIn();
    const path = `materials/${safeId}`;
    try {
      const updates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (canAccessAdminPanel) updates.updatedBy = current.uid;
      if (patch.title !== undefined) updates.title = patch.title.trim().slice(0, 200);
      if (patch.subtitle !== undefined) updates.subtitle = patch.subtitle.trim().slice(0, 300);
      if (patch.disciplineId !== undefined) updates.disciplineId = patch.disciplineId.slice(0, 80);
      if (patch.libraryCategoryId !== undefined) updates.libraryCategoryId = patch.libraryCategoryId;
      if (patch.editalTopic !== undefined) updates.editalTopic = patch.editalTopic.trim().slice(0, 240);
      if (patch.resourceType !== undefined) updates.resourceType = patch.resourceType;
      if (patch.fileType !== undefined) updates.fileType = patch.fileType;
      if (patch.institution !== undefined) updates.institution = patch.institution.trim().slice(0, 160);
      const nextUrl = patch.url !== undefined ? patch.url.trim().slice(0, 2000) : undefined;
      const nextIsLocal = nextUrl !== undefined ? nextUrl.startsWith('local://') : false;
      if (nextUrl !== undefined) {
        updates.url = nextUrl;
        if (nextIsLocal) {
          updates.storageProvider = 'local';
          updates.isShared = false;
          updates.status = 'draft';
        }
      }
      if (patch.pricing !== undefined) updates.pricing = patch.pricing;
      if (patch.linkStatus !== undefined) updates.linkStatus = patch.linkStatus;
      if (patch.isOfficialContent !== undefined) updates.isOfficialContent = Boolean(patch.isOfficialContent);
      if (patch.relevanceTier !== undefined) updates.relevanceTier = patch.relevanceTier;
      if (patch.campusLevel !== undefined) updates.campusLevel = patch.campusLevel;
      if (patch.classId !== undefined) updates.classId = patch.classId.slice(0, 128);
      if (patch.keywords !== undefined) updates.keywords = patch.keywords.slice(0, 20);
      if (patch.author !== undefined) updates.author = patch.author.trim().slice(0, 160);
      if (patch.edition !== undefined) updates.edition = patch.edition.trim().slice(0, 80);
      if (patch.year !== undefined) updates.year = Math.max(1900, Math.min(2100, Math.round(patch.year)));
      if (patch.checksumSha256 !== undefined) updates.checksumSha256 = patch.checksumSha256.trim().slice(0, 128);
      if (patch.storageProvider !== undefined && !nextIsLocal) updates.storageProvider = patch.storageProvider;
      if (patch.storagePath !== undefined) updates.storagePath = patch.storagePath.trim().slice(0, 500);
      if (patch.reviewNotes !== undefined && canAccessAdminPanel) updates.reviewNotes = patch.reviewNotes.trim().slice(0, 600);
      if (patch.description !== undefined) updates.description = patch.description.slice(0, 2000);
      if (patch.fileName !== undefined) updates.fileName = patch.fileName.slice(0, 240);
      if (patch.allowDownload !== undefined) updates.allowDownload = Boolean(patch.allowDownload);
      if (patch.textLayerStatus !== undefined) updates.textLayerStatus = patch.textLayerStatus;
      if (patch.pageCount !== undefined) updates.pageCount = Math.max(0, Math.min(20000, Math.round(patch.pageCount)));
      if (patch.fileSizeBytes !== undefined) updates.fileSizeBytes = Math.max(0, Math.min(500000000, Math.round(patch.fileSizeBytes)));
      if (patch.version !== undefined) updates.version = Math.max(1, Math.min(1000, Math.round(patch.version)));
      if (patch.versionNote !== undefined) updates.versionNote = patch.versionNote.trim().slice(0, 300);
      if (patch.chapters !== undefined) updates.chapters = patch.chapters.slice(0, 120);
      if (patch.studyRecommendations !== undefined) {
        updates.studyRecommendations = patch.studyRecommendations.map((s) => s.trim()).filter(Boolean).slice(0, 30);
      }
      if (patch.sections !== undefined) updates.sections = patch.sections.slice(0, 40);
      if (patch.parentMaterialId !== undefined) updates.parentMaterialId = patch.parentMaterialId.slice(0, 128);
      if (patch.startPage !== undefined) updates.startPage = Math.max(1, Math.min(20000, Math.round(patch.startPage)));
      if (patch.endPage !== undefined) updates.endPage = Math.max(1, Math.min(20000, Math.round(patch.endPage)));
      if (patch.isVirtualSection !== undefined) updates.isVirtualSection = Boolean(patch.isVirtualSection);
      if (patch.organizedBy !== undefined) updates.organizedBy = patch.organizedBy.slice(0, 128);
      if (patch.organizedAt !== undefined) updates.organizedAt = patch.organizedAt.slice(0, 40);
      if (patch.catalogNumber !== undefined) updates.catalogNumber = Math.max(1, Math.min(500, Math.round(patch.catalogNumber)));
      if (patch.pendingDefinition !== undefined) updates.pendingDefinition = Boolean(patch.pendingDefinition);
      if (patch.indexingStatus !== undefined) updates.indexingStatus = patch.indexingStatus;
      if (!nextIsLocal && canPublishShared && patch.status !== undefined) {
        updates.status = patch.status;
        updates.isShared = patch.status === 'published';
        if (patch.status === 'approved' || patch.status === 'published') {
          updates.reviewedBy = current.uid;
        }
        if (patch.status === 'published') {
          updates.reviewNotes = deleteField();
        }
      } else if (!nextIsLocal && canPublishShared && patch.isShared !== undefined) {
        updates.isShared = Boolean(patch.isShared);
        updates.status = patch.isShared ? 'published' : 'draft';
        if (patch.isShared) {
          updates.reviewNotes = deleteField();
        }
      } else if (!nextIsLocal && isTeacher && (patch.status === 'draft' || patch.status === 'in_review')) {
        updates.status = patch.status;
      }

      await updateDoc(doc(db, 'materials', safeId), updates);
    } catch (err) {
      setSyncError('Erro ao atualizar material.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const updateMaterialStatus = async (materialId: string, status: PublicationStatus) => {
    if (!canPublishShared) {
      throw new Error('Você não tem permissão para alterar o status de publicação.');
    }
    const safeId = sanitizeId(materialId);
    const current = ensureSignedIn();
    const path = `materials/${safeId}`;
    try {
      const targetMat = allManagedMaterials.find((m) => m.id === safeId);
      if (status === 'published' && targetMat?.url.startsWith('local://')) {
        throw new Error('Material salvo com local:// não pode ser publicado para outros dispositivos. Migre para Firebase Storage ou URL pública antes de publicar.');
      }
      const updates: Record<string, unknown> = {
        status,
        isShared: status === 'published',
        reviewedBy: current.uid,
        updatedBy: current.uid,
        updatedAt: serverTimestamp(),
      };
      if (status === 'published') {
        updates.reviewNotes = deleteField();
      }
      await updateDoc(doc(db, 'materials', safeId), updates);
      await writeAuditLog({
        action: 'update_material_status',
        targetCollection: 'materials',
        targetId: safeId,
        summary: `Status do material alterado para ${status}.`,
      });
    } catch (err) {
      setSyncError('Erro ao alterar status de publicação do material.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteMaterial = async (materialId: string) => {
    const safeId = sanitizeId(materialId);
    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        myMaterials: prev.myMaterials.filter((m) => m.id !== safeId),
      }));
      return;
    }

    ensureSignedIn();
    const path = `materials/${safeId}`;
    try {
      await deleteDoc(doc(db, 'materials', safeId));
      if (canAccessAdminPanel) {
        await writeAuditLog({
          action: 'delete_material',
          targetCollection: 'materials',
          targetId: safeId,
          summary: `Material removido do catálogo: ${safeId}.`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const addCustomQuestion = async (input: {
    disciplineId: string;
    topicTitle: string;
    statement: string;
    options: [string, string, string, string, string];
    correctIndex: number;
    explanation: string;
    legalBasis?: string;
    source?: string;
    originType?: QuestionOriginType;
    difficulty?: QuestionDifficulty;
    questionFormat?: QuestionFormat;
    classId?: string;
    escolaridade?: CampusLevel;
    isOfficial?: boolean;
    isPublished?: boolean;
    status?: PublicationStatus;
    sourceMaterialId?: string;
    sourcePage?: number;
    sourceExcerpt?: string;
    needsReview?: boolean;
    reviewFlags?: string[];
  }) => {
    const questionId = sanitizeId(`q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const originType: QuestionOriginType = input.originType || 'training_platform';
    const isOfficial = input.isOfficial ?? (originType !== 'training_platform' && originType !== 'ai_generated');

    if (isGuest && !auth.currentUser) {
      const newQuestion: Question = {
        id: questionId,
        authorId: GUEST_UID,
        disciplineId: input.disciplineId.slice(0, 80),
        topicTitle: input.topicTitle.trim().slice(0, 200),
        statement: input.statement.trim().slice(0, 2500),
        options: input.options.map((o) => o.trim().slice(0, 500)) as [string, string, string, string, string],
        correctIndex: Math.max(0, Math.min(4, Math.round(input.correctIndex))),
        explanation: input.explanation.trim().slice(0, 2000),
        legalBasis: (input.legalBasis || '').slice(0, 400),
        source: (
          input.source || (isOfficial ? 'Prova / Fonte Oficial' : 'Treinamento Complementar (Não Oficial)')
        ).slice(0, 160),
        originType,
        difficulty: input.difficulty,
        questionFormat: input.questionFormat,
        escolaridade: input.escolaridade,
        sourceMaterialId: input.sourceMaterialId,
        sourcePage: input.sourcePage,
        sourceExcerpt: input.sourceExcerpt,
        needsReview: input.needsReview,
        reviewFlags: input.reviewFlags,
        isOfficial,
        isPublished: false,
        status: 'draft',
      };
      persistGuestPatch((prev) => ({
        ...prev,
        myQuestions: [newQuestion, ...prev.myQuestions],
      }));
      return;
    }

    const current = ensureSignedIn();
    const resolvedStatus: PublicationStatus = canPublishShared
      ? input.status || (input.isPublished ? 'published' : 'draft')
      : isTeacher && input.status === 'in_review'
        ? 'in_review'
        : 'draft';
    const canPublish = Boolean(canPublishShared && resolvedStatus === 'published' && input.isPublished !== false);
    const path = `sharedQuestions/${questionId}`;
    try {
      const payload: Record<string, unknown> = {
        authorId: current.uid,
        disciplineId: input.disciplineId.slice(0, 80),
        topicTitle: input.topicTitle.trim().slice(0, 200),
        statement: input.statement.trim().slice(0, 2500),
        options: input.options.map((o) => o.trim().slice(0, 500)),
        correctIndex: Math.max(0, Math.min(4, Math.round(input.correctIndex))),
        explanation: input.explanation.trim().slice(0, 2000),
        legalBasis: (input.legalBasis || '').slice(0, 400),
        source: (
          input.source || (isOfficial ? 'Prova / Fonte Oficial' : 'Treinamento Complementar (Não Oficial)')
        ).slice(0, 160),
        originType,
        isOfficial,
        isPublished: canPublish,
        status: resolvedStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.difficulty) payload.difficulty = input.difficulty;
      if (input.questionFormat) payload.questionFormat = input.questionFormat;
      if (input.classId) payload.classId = sanitizeId(input.classId);
      if (input.escolaridade) payload.escolaridade = input.escolaridade;
      if (input.sourceMaterialId) payload.sourceMaterialId = input.sourceMaterialId.slice(0, 128);
      if (input.sourcePage !== undefined && input.sourcePage >= 1) payload.sourcePage = Math.round(input.sourcePage);
      if (input.sourceExcerpt) payload.sourceExcerpt = input.sourceExcerpt.slice(0, 600);
      if (input.needsReview !== undefined) payload.needsReview = Boolean(input.needsReview);
      if (input.reviewFlags?.length) payload.reviewFlags = input.reviewFlags.slice(0, 12);
      await setDoc(doc(db, 'sharedQuestions', questionId), payload);
    } catch (err) {
      setSyncError('Erro ao salvar questão.');
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateCustomQuestion = async (
    questionId: string,
    patch: Partial<Omit<Question, 'id' | 'authorId'>>
  ) => {
    const safeId = sanitizeId(questionId);
    ensureSignedIn();
    const path = `sharedQuestions/${safeId}`;
    try {
      const updates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (patch.disciplineId !== undefined) updates.disciplineId = patch.disciplineId.slice(0, 80);
      if (patch.topicTitle !== undefined) updates.topicTitle = patch.topicTitle.trim().slice(0, 200);
      if (patch.statement !== undefined) updates.statement = patch.statement.trim().slice(0, 2500);
      if (patch.options !== undefined) updates.options = patch.options.slice(0, 5).map((o) => o.trim().slice(0, 500));
      if (patch.correctIndex !== undefined) updates.correctIndex = Math.max(0, Math.min(4, Math.round(patch.correctIndex)));
      if (patch.explanation !== undefined) updates.explanation = patch.explanation.trim().slice(0, 2000);
      if (patch.legalBasis !== undefined) updates.legalBasis = patch.legalBasis.slice(0, 400);
      if (patch.source !== undefined) updates.source = patch.source.slice(0, 160);
      if (patch.originType !== undefined) updates.originType = patch.originType;
      if (patch.difficulty !== undefined) updates.difficulty = patch.difficulty;
      if (patch.questionFormat !== undefined) updates.questionFormat = patch.questionFormat;
      if (patch.classId !== undefined) updates.classId = patch.classId.slice(0, 128);
      if (patch.escolaridade !== undefined) updates.escolaridade = patch.escolaridade;
      if (patch.isOfficial !== undefined) updates.isOfficial = Boolean(patch.isOfficial);
      if (patch.sourceMaterialId !== undefined) updates.sourceMaterialId = patch.sourceMaterialId.slice(0, 128);
      if (patch.sourcePage !== undefined && patch.sourcePage >= 1) updates.sourcePage = Math.round(patch.sourcePage);
      if (patch.sourceExcerpt !== undefined) updates.sourceExcerpt = patch.sourceExcerpt.slice(0, 600);
      if (patch.needsReview !== undefined) updates.needsReview = Boolean(patch.needsReview);
      if (patch.reviewFlags !== undefined) updates.reviewFlags = patch.reviewFlags.slice(0, 12);
      if (canPublishShared && patch.status !== undefined) {
        updates.status = patch.status;
        updates.isPublished = patch.status === 'published';
        if (patch.status === 'published') {
          updates.reviewNotes = deleteField();
        }
      } else if (canPublishShared && patch.isPublished !== undefined) {
        updates.isPublished = Boolean(patch.isPublished);
        updates.status = patch.isPublished ? 'published' : 'draft';
        if (patch.isPublished) {
          updates.reviewNotes = deleteField();
        }
      } else if (isTeacher && (patch.status === 'draft' || patch.status === 'in_review')) {
        updates.status = patch.status;
      }
      await updateDoc(doc(db, 'sharedQuestions', safeId), updates);
    } catch (err) {
      setSyncError('Erro ao atualizar questão.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const updateQuestionStatus = async (questionId: string, status: PublicationStatus) => {
    if (!canPublishShared) {
      throw new Error('Apenas perfis autorizados podem publicar ou arquivar questões.');
    }
    const safeId = sanitizeId(questionId);
    ensureSignedIn();
    const path = `sharedQuestions/${safeId}`;
    try {
      const updates: Record<string, unknown> = {
        status,
        isPublished: status === 'published',
        updatedAt: serverTimestamp(),
      };
      if (status === 'published') {
        updates.reviewNotes = deleteField();
      }
      await updateDoc(doc(db, 'sharedQuestions', safeId), updates);
    } catch (err) {
      setSyncError('Erro ao atualizar status da questão.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteCustomQuestion = async (questionId: string) => {
    const safeId = sanitizeId(questionId);
    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => ({
        ...prev,
        myQuestions: prev.myQuestions.filter((q) => q.id !== safeId),
      }));
      return;
    }
    ensureSignedIn();
    const path = `sharedQuestions/${safeId}`;
    try {
      await deleteDoc(doc(db, 'sharedQuestions', safeId));
    } catch (err) {
      setSyncError('Erro ao excluir questão.');
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const saveManagedDiscipline = async (input: {
    id?: string;
    name: string;
    shortName: string;
    campusLevel: CampusLevel;
    editalBlock: Discipline['editalBlock'];
    priorityRank: number;
    examQuestions: number;
    examPoints: number;
    tieBreakerOrder: number;
    recommendedMinutesPerCycle: number;
    status: PublicationStatus;
  }): Promise<string> => {
    if (!canAccessAdminPanel) {
      throw new Error('Acesso restrito a administradores e editores.');
    }
    const current = ensureSignedIn();
    const id = sanitizeId(input.id || `disc_${input.campusLevel}_${Date.now().toString(36)}`);
    const path = `managedDisciplines/${id}`;
    try {
      const ref = doc(db, 'managedDisciplines', id);
      const snap = await getDoc(ref);
      const commonFields = {
        name: input.name.trim().slice(0, 160),
        shortName: input.shortName.trim().slice(0, 60),
        campusLevel: input.campusLevel,
        editalBlock: input.editalBlock,
        priorityRank: Math.max(1, Math.min(100, Math.round(input.priorityRank))),
        examQuestions: Math.max(0, Math.min(200, Math.round(input.examQuestions))),
        examPoints: Math.max(0, Math.min(200, Number(input.examPoints))),
        tieBreakerOrder: Math.max(1, Math.min(100, Math.round(input.tieBreakerOrder))),
        recommendedMinutesPerCycle: Math.max(10, Math.min(360, Math.round(input.recommendedMinutesPerCycle))),
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (snap.exists()) {
        await updateDoc(ref, commonFields);
      } else {
        await setDoc(ref, {
          id,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      return id;
    } catch (err) {
      setSyncError('Erro ao salvar disciplina.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return id;
    }
  };

  const updateManagedDisciplineStatus = async (disciplineId: string, status: PublicationStatus) => {
    if (!canAccessAdminPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(disciplineId);
    const path = `managedDisciplines/${safeId}`;
    try {
      await updateDoc(doc(db, 'managedDisciplines', safeId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao atualizar status da disciplina.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveManagedTopic = async (input: {
    topicId?: string;
    disciplineId: string;
    campusLevel: CampusLevel;
    title: string;
    subtopics: string[];
    highYield: boolean;
    order: number;
    status: PublicationStatus;
  }): Promise<string> => {
    if (!canAccessAdminPanel) {
      throw new Error('Acesso restrito a administradores e editores.');
    }
    const current = ensureSignedIn();
    const topicId = sanitizeId(input.topicId || `topic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`);
    const path = `managedTopics/${topicId}`;
    try {
      const ref = doc(db, 'managedTopics', topicId);
      const snap = await getDoc(ref);
      const commonFields = {
        disciplineId: sanitizeId(input.disciplineId).slice(0, 80),
        campusLevel: input.campusLevel,
        title: input.title.trim().slice(0, 240),
        subtopics: input.subtopics.map((s) => s.trim()).filter(Boolean).slice(0, 30),
        highYield: Boolean(input.highYield),
        order: Math.max(0, Math.min(500, Math.round(input.order))),
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (snap.exists()) {
        await updateDoc(ref, commonFields);
      } else {
        await setDoc(ref, {
          topicId,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      return topicId;
    } catch (err) {
      setSyncError('Erro ao salvar tópico do edital.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return topicId;
    }
  };

  const updateManagedTopicStatus = async (topicId: string, status: PublicationStatus) => {
    if (!canAccessAdminPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(topicId);
    const path = `managedTopics/${safeId}`;
    try {
      await updateDoc(doc(db, 'managedTopics', safeId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao atualizar status do tópico.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveSimuladoList = async (input: {
    listId?: string;
    title: string;
    description?: string;
    campusLevel: LibraryScope;
    durationMinutes: number;
    questionIds: string[];
    status: PublicationStatus;
  }): Promise<string> => {
    if (!canAccessAdminPanel) {
      throw new Error('Acesso restrito a administradores e editores.');
    }
    const current = ensureSignedIn();
    const listId = sanitizeId(input.listId || `simlist_${Date.now().toString(36)}`);
    const path = `simuladoLists/${listId}`;
    try {
      const ref = doc(db, 'simuladoLists', listId);
      const snap = await getDoc(ref);
      const commonFields = {
        title: input.title.trim().slice(0, 180),
        description: (input.description || '').trim().slice(0, 800),
        campusLevel: input.campusLevel,
        durationMinutes: Math.max(5, Math.min(360, Math.round(input.durationMinutes))),
        questionIds: input.questionIds.slice(0, 100),
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (snap.exists()) {
        await updateDoc(ref, commonFields);
      } else {
        await setDoc(ref, {
          listId,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      return listId;
    } catch (err) {
      setSyncError('Erro ao salvar lista de simulado.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return listId;
    }
  };

  const updateSimuladoListStatus = async (listId: string, status: PublicationStatus) => {
    if (!canAccessAdminPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(listId);
    const path = `simuladoLists/${safeId}`;
    try {
      await updateDoc(doc(db, 'simuladoLists', safeId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao atualizar status do simulado.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const savePlatformNotice = async (input: {
    noticeId?: string;
    title: string;
    body: string;
    campusLevel: LibraryScope;
    priority: 'normal' | 'importante' | 'urgente';
    eventDate?: string;
    status: PublicationStatus;
  }): Promise<string> => {
    if (!canAccessAdminPanel) {
      throw new Error('Acesso restrito a administradores e editores.');
    }
    const current = ensureSignedIn();
    const noticeId = sanitizeId(input.noticeId || `notice_${Date.now().toString(36)}`);
    const path = `platformNotices/${noticeId}`;
    try {
      const ref = doc(db, 'platformNotices', noticeId);
      const snap = await getDoc(ref);
      const commonFields: Record<string, unknown> = {
        title: input.title.trim().slice(0, 180),
        body: input.body.trim().slice(0, 2000),
        campusLevel: input.campusLevel,
        priority: input.priority,
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (input.eventDate?.trim()) {
        commonFields.eventDate = input.eventDate.trim().slice(0, 20);
      }
      if (snap.exists()) {
        await updateDoc(ref, commonFields);
      } else {
        await setDoc(ref, {
          noticeId,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      return noticeId;
    } catch (err) {
      setSyncError('Erro ao salvar aviso.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return noticeId;
    }
  };

  const updatePlatformNoticeStatus = async (noticeId: string, status: PublicationStatus) => {
    if (!canAccessAdminPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(noticeId);
    const path = `platformNotices/${safeId}`;
    try {
      await updateDoc(doc(db, 'platformNotices', safeId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao atualizar status do aviso.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveExamConcurso = async (input: {
    examId?: string;
    title: string;
    institution: string;
    code: string;
    year: number;
    levels: CampusLevel[];
    positions: string[];
    examDate?: string;
    status: PublicationStatus;
  }): Promise<string> => {
    if (!canManageUsers) {
      throw new Error('Apenas Administrador Principal pode cadastrar concursos e editais.');
    }
    const current = ensureSignedIn();
    const examId = sanitizeId(input.examId || `exam_${Date.now().toString(36)}`);
    const path = `exams/${examId}`;
    try {
      const ref = doc(db, 'exams', examId);
      const snap = await getDoc(ref);
      const commonFields: Record<string, unknown> = {
        title: input.title.trim().slice(0, 180),
        institution: input.institution.trim().slice(0, 160),
        code: input.code.trim().slice(0, 60),
        year: Math.max(2000, Math.min(2100, Math.round(input.year))),
        levels: input.levels.length ? input.levels.slice(0, 10) : ['superior'],
        positions: input.positions.map((p) => p.trim()).filter(Boolean).slice(0, 25),
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (input.examDate?.trim()) commonFields.examDate = input.examDate.trim().slice(0, 20);
      if (snap.exists()) {
        await updateDoc(ref, commonFields);
      } else {
        await setDoc(ref, {
          examId,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      await writeAuditLog({
        action: snap.exists() ? 'update_exam' : 'create_exam',
        targetCollection: 'exams',
        targetId: examId,
        summary: `Concurso ${input.title.trim().slice(0, 100)} (${input.status})`,
      });
      return examId;
    } catch (err) {
      setSyncError('Erro ao salvar concurso.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return examId;
    }
  };

  const updateExamStatus = async (examId: string, status: PublicationStatus) => {
    if (!canManageUsers) throw new Error('Acesso restrito ao Administrador Principal.');
    const safeId = sanitizeId(examId);
    const path = `exams/${safeId}`;
    try {
      await updateDoc(doc(db, 'exams', safeId), { status, updatedAt: serverTimestamp() });
    } catch (err) {
      setSyncError('Erro ao atualizar status do concurso.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveClassroom = async (input: {
    classId?: string;
    name: string;
    code: string;
    examId: string;
    campusLevel: CampusLevel;
    disciplineIds: string[];
    teacherIds: string[];
    description?: string;
    active: boolean;
    status: PublicationStatus;
  }): Promise<string> => {
    if (!canAccessTeacherPanel) {
      throw new Error('Acesso restrito.');
    }
    const current = ensureSignedIn();
    const classId = sanitizeId(input.classId || `cls_${Date.now().toString(36)}`);
    const path = `classes/${classId}`;
    try {
      const ref = doc(db, 'classes', classId);
      const snap = await getDoc(ref);
      const commonFields: Record<string, unknown> = {
        name: input.name.trim().slice(0, 160),
        code: input.code.trim().slice(0, 40),
        examId: sanitizeId(input.examId || 'exam_alepa_2026'),
        campusLevel: input.campusLevel,
        disciplineIds: input.disciplineIds.slice(0, 30),
        teacherIds: input.teacherIds.slice(0, 20),
        description: (input.description || '').trim().slice(0, 800),
        active: Boolean(input.active),
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (snap.exists()) {
        await updateDoc(ref, commonFields);
      } else {
        if (!canManageUsers) {
          throw new Error('Apenas Administrador Principal pode criar novas turmas.');
        }
        await setDoc(ref, {
          classId,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      await writeAuditLog({
        action: snap.exists() ? 'update_classroom' : 'create_classroom',
        targetCollection: 'classes',
        targetId: classId,
        summary: `Turma ${input.name.trim().slice(0, 100)} (${input.code})`,
      });
      return classId;
    } catch (err) {
      setSyncError('Erro ao salvar turma.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return classId;
    }
  };

  const updateClassroomStatus = async (classId: string, status: PublicationStatus) => {
    if (!canManageUsers) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(classId);
    try {
      await updateDoc(doc(db, 'classes', safeId), { status, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${safeId}`);
    }
  };

  const enrollStudentInClass = async (input: {
    classId: string;
    studentId?: string;
    studentName?: string;
    studentEmail?: string;
    teacherId?: string;
  }): Promise<string> => {
    const current = ensureSignedIn();
    const safeClassId = sanitizeId(input.classId);
    const studentId = sanitizeId(input.studentId || current.uid);
    const enrollmentId = sanitizeId(`enr_${safeClassId}_${studentId}`);
    const path = `enrollments/${enrollmentId}`;
    try {
      const targetClass = allManagedClasses.find((c) => c.id === safeClassId);
      const teacherId = sanitizeId(input.teacherId || targetClass?.teacherIds[0] || current.uid);
      const ref = doc(db, 'enrollments', enrollmentId);
      const snap = await getDoc(ref);
      const payload: Record<string, unknown> = {
        enrollmentId,
        classId: safeClassId,
        studentId,
        studentName: (input.studentName || profile?.displayName || current.displayName || 'Estudante').trim().slice(0, 120),
        teacherId,
        status: 'active',
        updatedAt: serverTimestamp(),
      };
      if (input.studentEmail?.trim()) {
        payload.studentEmail = input.studentEmail.trim().toLowerCase().slice(0, 160);
      }
      if (snap.exists()) {
        await updateDoc(ref, { status: 'active', updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
      }
      return enrollmentId;
    } catch (err) {
      setSyncError('Erro ao realizar matrícula na turma.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return enrollmentId;
    }
  };

  const updateEnrollmentStatus = async (enrollmentId: string, status: 'active' | 'inactive') => {
    ensureSignedIn();
    const safeId = sanitizeId(enrollmentId);
    try {
      await updateDoc(doc(db, 'enrollments', safeId), { status, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `enrollments/${safeId}`);
    }
  };

  const removeEnrollment = async (enrollmentId: string) => {
    ensureSignedIn();
    const safeId = sanitizeId(enrollmentId);
    try {
      await deleteDoc(doc(db, 'enrollments', safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `enrollments/${safeId}`);
    }
  };

  const saveLesson = async (input: {
    lessonId?: string;
    classId: string;
    disciplineId: string;
    campusLevel: CampusLevel;
    title: string;
    summary: string;
    content: string;
    videoUrl?: string;
    materialIds: string[];
    order: number;
    status: PublicationStatus;
    reviewNotes?: string;
  }): Promise<string> => {
    if (!canAccessTeacherPanel) {
      throw new Error('Acesso restrito a professores, editores e administradores.');
    }
    const current = ensureSignedIn();
    const lessonId = sanitizeId(input.lessonId || `les_${Date.now().toString(36)}`);
    const path = `lessons/${lessonId}`;
    try {
      const ref = doc(db, 'lessons', lessonId);
      const snap = await getDoc(ref);
      const commonFields: Record<string, unknown> = {
        classId: sanitizeId(input.classId),
        disciplineId: input.disciplineId.trim().slice(0, 80),
        campusLevel: input.campusLevel,
        title: input.title.trim().slice(0, 200),
        summary: input.summary.trim().slice(0, 1000),
        content: input.content.trim().slice(0, 12000),
        materialIds: input.materialIds.slice(0, 20),
        order: Math.max(0, Math.min(500, Math.round(input.order))),
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (input.videoUrl?.trim()) commonFields.videoUrl = input.videoUrl.trim().slice(0, 1000);
      if (canAccessAdminPanel && input.reviewNotes?.trim() && input.status !== 'published') {
        commonFields.reviewNotes = input.reviewNotes.trim().slice(0, 600);
        commonFields.reviewedBy = current.uid;
      }
      if (snap.exists()) {
        if (input.status === 'published') {
          commonFields.reviewNotes = deleteField();
        }
        await updateDoc(ref, commonFields);
      } else {
        await setDoc(ref, {
          lessonId,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      await writeAuditLog({
        action: snap.exists() ? 'update_lesson' : 'create_lesson',
        targetCollection: 'lessons',
        targetId: lessonId,
        summary: `Aula "${input.title.trim().slice(0, 90)}" (${input.status})`,
      });
      return lessonId;
    } catch (err) {
      setSyncError('Erro ao salvar aula.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return lessonId;
    }
  };

  const updateLessonStatus = async (lessonId: string, status: PublicationStatus) => {
    if (!canAccessTeacherPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(lessonId);
    try {
      const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
      if (status === 'published') {
        updates.reviewNotes = deleteField();
      }
      await updateDoc(doc(db, 'lessons', safeId), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `lessons/${safeId}`);
    }
  };

  const deleteLesson = async (lessonId: string) => {
    if (!canAccessTeacherPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(lessonId);
    try {
      await deleteDoc(doc(db, 'lessons', safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `lessons/${safeId}`);
    }
  };

  const saveActivity = async (input: {
    activityId?: string;
    classId: string;
    disciplineId: string;
    campusLevel: CampusLevel;
    title: string;
    instructions: string;
    activityType: 'objetiva' | 'discursiva' | 'mista';
    dueDate?: string;
    maxScore: number;
    questionIds: string[];
    prompts: string[];
    status: PublicationStatus;
  }): Promise<string> => {
    if (!canAccessTeacherPanel) {
      throw new Error('Acesso restrito a professores, editores e administradores.');
    }
    const current = ensureSignedIn();
    const activityId = sanitizeId(input.activityId || `act_${Date.now().toString(36)}`);
    const path = `activities/${activityId}`;
    try {
      const ref = doc(db, 'activities', activityId);
      const snap = await getDoc(ref);
      const commonFields: Record<string, unknown> = {
        classId: sanitizeId(input.classId),
        disciplineId: input.disciplineId.trim().slice(0, 80),
        campusLevel: input.campusLevel,
        title: input.title.trim().slice(0, 200),
        instructions: input.instructions.trim().slice(0, 3000),
        activityType: input.activityType,
        maxScore: Math.max(0, Math.min(1000, Number(input.maxScore))),
        questionIds: input.questionIds.slice(0, 100),
        prompts: input.prompts.map((p) => p.trim()).filter(Boolean).slice(0, 10),
        status: input.status,
        updatedAt: serverTimestamp(),
      };
      if (input.dueDate?.trim()) commonFields.dueDate = input.dueDate.trim().slice(0, 20);
      if (snap.exists()) {
        await updateDoc(ref, commonFields);
      } else {
        await setDoc(ref, {
          activityId,
          ...commonFields,
          authorId: current.uid,
          createdAt: serverTimestamp(),
        });
      }
      await writeAuditLog({
        action: snap.exists() ? 'update_activity' : 'create_activity',
        targetCollection: 'activities',
        targetId: activityId,
        summary: `Atividade "${input.title.trim().slice(0, 90)}" (${input.status})`,
      });
      return activityId;
    } catch (err) {
      setSyncError('Erro ao salvar atividade.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return activityId;
    }
  };

  const updateActivityStatus = async (activityId: string, status: PublicationStatus) => {
    if (!canAccessTeacherPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(activityId);
    try {
      await updateDoc(doc(db, 'activities', safeId), { status, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `activities/${safeId}`);
    }
  };

  const deleteActivity = async (activityId: string) => {
    if (!canAccessTeacherPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(activityId);
    try {
      await deleteDoc(doc(db, 'activities', safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `activities/${safeId}`);
    }
  };

  const submitActivity = async (input: {
    submissionId?: string;
    activityId: string;
    classId: string;
    teacherId: string;
    objectiveAnswers: Record<string, number>;
    discursiveResponses: Record<string, string>;
    objectiveScore: number;
  }): Promise<string> => {
    const current = ensureSignedIn();
    const safeActivityId = sanitizeId(input.activityId);
    const submissionId = sanitizeId(input.submissionId || `sub_${safeActivityId}_${current.uid}`);
    const path = `submissions/${submissionId}`;
    try {
      const ref = doc(db, 'submissions', submissionId);
      const snap = await getDoc(ref);
      const objectiveScore = Math.max(0, Math.min(1000, Number(input.objectiveScore) || 0));
      if (snap.exists()) {
        await updateDoc(ref, {
          objectiveAnswers: input.objectiveAnswers,
          discursiveResponses: input.discursiveResponses,
          objectiveScore,
          finalScore: objectiveScore,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          submissionId,
          activityId: safeActivityId,
          classId: sanitizeId(input.classId),
          studentId: current.uid,
          studentName: (profile?.displayName || current.displayName || 'Estudante').trim().slice(0, 120),
          teacherId: sanitizeId(input.teacherId || current.uid),
          objectiveAnswers: input.objectiveAnswers,
          discursiveResponses: input.discursiveResponses,
          objectiveScore,
          manualScore: 0,
          finalScore: objectiveScore,
          status: 'submitted',
          revisionHistory: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return submissionId;
    } catch (err) {
      setSyncError('Erro ao enviar atividade.');
      handleFirestoreError(err, OperationType.WRITE, path);
      return submissionId;
    }
  };

  const gradeSubmission = async (
    submissionId: string,
    patch: {
      manualScore: number;
      finalScore: number;
      feedback: string;
      status: 'graded' | 'returned';
    }
  ) => {
    if (!canAccessTeacherPanel) {
      throw new Error('Apenas professores ou administradores podem corrigir entregas.');
    }
    const current = ensureSignedIn();
    const safeId = sanitizeId(submissionId);
    const path = `submissions/${safeId}`;
    try {
      const existing = submissions.find((s) => s.id === safeId);
      const historyItem: SubmissionRevision = {
        gradedBy: current.uid,
        score: Math.max(0, Math.min(1000, Number(patch.finalScore))),
        feedback: patch.feedback.trim().slice(0, 500),
        gradedAt: new Date().toISOString(),
      };
      const nextHistory = [...(existing?.revisionHistory || []), historyItem].slice(-20);
      await updateDoc(doc(db, 'submissions', safeId), {
        manualScore: Math.max(0, Math.min(1000, Number(patch.manualScore))),
        finalScore: Math.max(0, Math.min(1000, Number(patch.finalScore))),
        feedback: patch.feedback.trim().slice(0, 4000),
        status: patch.status,
        gradedBy: current.uid,
        revisionHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        action: 'grade_submission',
        targetCollection: 'submissions',
        targetId: safeId,
        summary: `Entrega avaliada com nota ${patch.finalScore} (${patch.status}).`,
      });
    } catch (err) {
      setSyncError('Erro ao salvar correção da atividade.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const registerStorageMetadata = async (input: {
    fileId?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256?: string;
    storageProvider: StorageProviderType;
    bucket?: string;
    objectPath: string;
    downloadUrl: string;
    category: StorageObjectCategory;
    campusLevel: LibraryScope;
    linkedMaterialId?: string;
    version?: number;
  }): Promise<string> => {
    if (!canAccessTeacherPanel) throw new Error('Acesso restrito.');
    const current = ensureSignedIn();
    const fileId = sanitizeId(input.fileId || `file_${Date.now().toString(36)}`);
    const path = `storageMetadata/${fileId}`;
    try {
      const payload: Record<string, unknown> = {
        fileId,
        fileName: input.fileName.trim().slice(0, 240),
        mimeType: input.mimeType.trim().slice(0, 120),
        sizeBytes: Math.max(0, Math.min(500000000, Math.round(input.sizeBytes))),
        storageProvider: input.storageProvider,
        bucket: (input.bucket || FIREBASE_STORAGE_BUCKET || '').slice(0, 160),
        objectPath: input.objectPath.trim().slice(0, 500),
        downloadUrl: input.downloadUrl.trim().slice(0, 2000),
        category: input.category,
        campusLevel: input.campusLevel,
        version: Math.max(1, Math.min(1000, Math.round(input.version ?? 1))),
        archived: false,
        uploadedBy: current.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.checksumSha256) payload.checksumSha256 = input.checksumSha256.trim().slice(0, 128);
      if (input.linkedMaterialId) payload.linkedMaterialId = sanitizeId(input.linkedMaterialId);
      await setDoc(doc(db, 'storageMetadata', fileId), payload);
      await writeAuditLog({
        action: 'register_storage_file',
        targetCollection: 'storageMetadata',
        targetId: fileId,
        summary: `Arquivo registrado (${input.storageProvider}): ${input.fileName.trim().slice(0, 90)}`,
      });
      return fileId;
    } catch (err) {
      setSyncError('Erro ao registrar metadados do arquivo.');
      handleFirestoreError(err, OperationType.CREATE, path);
      return fileId;
    }
  };

  const updateStorageMetadataRecord = async (
    fileId: string,
    patch: Partial<Pick<StorageMetadataRecord, 'linkedMaterialId' | 'campusLevel' | 'archived' | 'version'>>
  ) => {
    if (!canAccessTeacherPanel) throw new Error('Acesso restrito.');
    const safeId = sanitizeId(fileId);
    const path = `storageMetadata/${safeId}`;
    try {
      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.linkedMaterialId !== undefined) updates.linkedMaterialId = patch.linkedMaterialId.slice(0, 128);
      if (patch.campusLevel !== undefined) updates.campusLevel = patch.campusLevel;
      if (patch.archived !== undefined) updates.archived = Boolean(patch.archived);
      if (patch.version !== undefined) updates.version = Math.max(1, Math.min(1000, Math.round(patch.version)));
      await updateDoc(doc(db, 'storageMetadata', safeId), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteStorageMetadataRecord = async (fileId: string) => {
    if (!canManageUsers) throw new Error('Apenas Administrador Principal pode remover registros de armazenamento.');
    const safeId = sanitizeId(fileId);
    try {
      await deleteDoc(doc(db, 'storageMetadata', safeId));
      await writeAuditLog({
        action: 'delete_storage_metadata',
        targetCollection: 'storageMetadata',
        targetId: safeId,
        summary: `Registro de armazenamento removido: ${safeId}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `storageMetadata/${safeId}`);
    }
  };

  const inviteFamilyMember = async (input: {
    name: string;
    email: string;
    relationship: string;
    canPublish: boolean;
  }) => {
    const current = ensureSignedIn();
    const cleanEmail = input.email.trim().toLowerCase().slice(0, 160);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um e-mail válido do familiar.');
    }
    const memberId = toFamilyMemberDocId(cleanEmail);
    const path = `familyMembers/${memberId}`;
    try {
      const ref = doc(db, 'familyMembers', memberId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          name: input.name.trim().slice(0, 120) || cleanEmail.split('@')[0],
          relationship: input.relationship.trim().slice(0, 60) || 'Familiar',
          canPublish: Boolean(input.canPublish),
          active: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          memberId,
          name: input.name.trim().slice(0, 120) || cleanEmail.split('@')[0],
          email: cleanEmail,
          relationship: input.relationship.trim().slice(0, 60) || 'Familiar',
          canPublish: Boolean(input.canPublish),
          active: true,
          invitedByUid: current.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setSyncError('Erro ao salvar autorização do familiar.');
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const toggleFamilyMemberPublish = async (memberId: string, canPublish: boolean) => {
    ensureSignedIn();
    const safeId = sanitizeId(memberId);
    const path = `familyMembers/${safeId}`;
    try {
      await updateDoc(doc(db, 'familyMembers', safeId), {
        canPublish: Boolean(canPublish),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao atualizar permissão do familiar.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const toggleFamilyMemberActive = async (memberId: string, active: boolean) => {
    ensureSignedIn();
    const safeId = sanitizeId(memberId);
    const path = `familyMembers/${safeId}`;
    try {
      await updateDoc(doc(db, 'familyMembers', safeId), {
        active: Boolean(active),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setSyncError('Erro ao atualizar status do familiar.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const removeFamilyMember = async (memberId: string) => {
    ensureSignedIn();
    const safeId = sanitizeId(memberId);
    const path = `familyMembers/${safeId}`;
    try {
      await deleteDoc(doc(db, 'familyMembers', safeId));
    } catch (err) {
      setSyncError('Erro ao remover familiar.');
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const saveMediaProgress = async (
    mediaId: string,
    patch: Partial<Omit<MediaProgressRecord, 'mediaId' | 'userId' | 'updatedAt'>> & {
      materialTitle: string;
      mediaType: 'video' | 'audio';
    }
  ) => {
    const safeId = sanitizeId(mediaId);
    const existing = mediaProgressMap[safeId];
    const currentTimeSeconds = Math.max(0, Math.min(86400, Number(patch.currentTimeSeconds ?? existing?.currentTimeSeconds ?? 0)));
    const durationSeconds = Math.max(0, Math.min(86400, Number(patch.durationSeconds ?? existing?.durationSeconds ?? 0)));
    const progressPercent =
      patch.progressPercent !== undefined
        ? Math.max(0, Math.min(100, Math.round(patch.progressPercent)))
        : durationSeconds > 0
          ? Math.max(0, Math.min(100, Math.round((currentTimeSeconds / durationSeconds) * 100)))
          : existing?.progressPercent ?? 0;
    const playbackRate = Math.max(0.5, Math.min(3.0, Number(patch.playbackRate ?? existing?.playbackRate ?? 1)));
    const preferredMode: MediaPlaybackPreference = patch.preferredMode ?? existing?.preferredMode ?? preferences.mediaPlaybackPreference ?? 'ask';
    const lastPlayedAt = (patch.lastPlayedAt ?? new Date().toISOString()).slice(0, 40);

    if (isGuest && !auth.currentUser) {
      const record: MediaProgressRecord = {
        userId: GUEST_UID,
        mediaId: safeId,
        materialTitle: patch.materialTitle.trim().slice(0, 200) || 'Mídia ALEPA',
        mediaType: patch.mediaType,
        currentTimeSeconds,
        durationSeconds,
        progressPercent,
        playbackRate,
        preferredMode,
        lastChapterId: patch.lastChapterId ?? existing?.lastChapterId,
        openedExternallyAt: patch.openedExternallyAt ?? existing?.openedExternallyAt,
        lastPlayedAt,
      };
      persistGuestPatch((prev) => ({
        ...prev,
        mediaProgressMap: { ...prev.mediaProgressMap, [safeId]: record },
      }));
      return;
    }

    const current = ensureSignedIn();
    const path = `users/${current.uid}/mediaProgress/${safeId}`;
    const payload: Record<string, unknown> = {
      userId: current.uid,
      mediaId: safeId,
      materialTitle: patch.materialTitle.trim().slice(0, 200) || 'Mídia ALEPA',
      mediaType: patch.mediaType,
      currentTimeSeconds,
      durationSeconds,
      progressPercent,
      playbackRate,
      preferredMode,
      lastPlayedAt,
      updatedAt: serverTimestamp(),
    };
    const nextChapterId = patch.lastChapterId ?? existing?.lastChapterId;
    if (nextChapterId) payload.lastChapterId = nextChapterId.slice(0, 128);
    const nextExt = patch.openedExternallyAt ?? existing?.openedExternallyAt;
    if (nextExt) payload.openedExternallyAt = nextExt.slice(0, 40);

    try {
      await setDoc(doc(db, 'users', current.uid, 'mediaProgress', safeId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const createAcademicRequest = async (input: {
    category: AcademicRequestCategory;
    subject: string;
    description: string;
    disciplineId: string;
    topicTitle?: string;
    campusLevel?: LibraryScope;
  }): Promise<string> => {
    const current = ensureSignedIn();
    const requestId = sanitizeId(`req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const path = `academicRequests/${requestId}`;
    const payload: Record<string, unknown> = {
      requestId,
      studentId: current.uid,
      studentName: (profile?.displayName || current.displayName || 'Estudante ALEPA').trim().slice(0, 120),
      category: input.category,
      subject: input.subject.trim().slice(0, 200),
      description: input.description.trim().slice(0, 4000),
      disciplineId: input.disciplineId.trim().slice(0, 80) || 'geral',
      status: 'pendente',
      lastMessagePreview: input.description.trim().slice(0, 300),
      lastMessageByRole: 'student',
      messageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (current.email) payload.studentEmail = current.email.trim().toLowerCase().slice(0, 160);
    if (input.topicTitle?.trim()) payload.topicTitle = input.topicTitle.trim().slice(0, 240);
    if (input.campusLevel) payload.campusLevel = input.campusLevel;
    try {
      await setDoc(doc(db, 'academicRequests', requestId), payload);
      return requestId;
    } catch (err) {
      setSyncError('Erro ao enviar solicitação acadêmica.');
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const subscribeAcademicRequestMessages = useCallback(
    (
      requestId: string,
      onUpdate: (messages: AcademicRequestMessage[]) => void,
      onError?: (err: Error) => void
    ) => {
      const safeId = sanitizeId(requestId);
      const q = query(
        collection(db, 'academicRequests', safeId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(300)
      );
      return onSnapshot(
        q,
        (snap) => {
          onUpdate(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AcademicRequestMessage, 'id'>),
            }))
          );
        },
        (err) => {
          if (onError) onError(err);
        }
      );
    },
    []
  );

  const sendAcademicRequestMessage = async (requestId: string, body: string) => {
    const current = ensureSignedIn();
    const safeReqId = sanitizeId(requestId);
    const trimmed = body.trim().slice(0, 4000);
    if (!trimmed) return;

    const reqSnap = await getDoc(doc(db, 'academicRequests', safeReqId));
    if (!reqSnap.exists()) {
      throw new Error('Solicitação não encontrada.');
    }
    const reqData = reqSnap.data() as AcademicRequest;
    const messageId = sanitizeId(`msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const senderRole: NormalizedUserRole = isAdmin
      ? effectiveRole
      : canAccessTeacherPanel
        ? 'teacher'
        : 'student';

    const msgPayload: Record<string, unknown> = {
      messageId,
      requestId: safeReqId,
      studentId: reqData.studentId,
      senderId: current.uid,
      senderName: (profile?.displayName || current.displayName || 'Participante').trim().slice(0, 120),
      senderRole,
      body: trimmed,
      createdAt: serverTimestamp(),
    };
    if (reqData.assignedTeacherId) msgPayload.assignedTeacherId = reqData.assignedTeacherId;

    await setDoc(doc(db, 'academicRequests', safeReqId, 'messages', messageId), msgPayload);

    const nextStatus: AcademicRequestStatus =
      senderRole === 'student'
        ? reqData.status === 'concluida'
          ? 'aguardando_resposta'
          : reqData.status === 'respondida'
            ? 'aguardando_resposta'
            : reqData.status
        : reqData.status === 'concluida'
          ? 'concluida'
          : 'respondida';

    await updateDoc(doc(db, 'academicRequests', safeReqId), {
      status: nextStatus,
      lastMessagePreview: trimmed.slice(0, 300),
      lastMessageByRole: senderRole,
      messageCount: (reqData.messageCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  };

  const updateAcademicRequestStatus = async (requestId: string, status: AcademicRequestStatus) => {
    ensureSignedIn();
    const safeReqId = sanitizeId(requestId);
    await updateDoc(doc(db, 'academicRequests', safeReqId), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const assignAcademicRequest = async (
    requestId: string,
    assignee: { uid: string; displayName: string; role: 'teacher' | 'editor' | 'admin' }
  ) => {
    const current = ensureSignedIn();
    if (!isAdmin && !canAccessAdminPanel) {
      throw new Error('Apenas Administradores podem encaminhar solicitações.');
    }
    const safeReqId = sanitizeId(requestId);
    await updateDoc(doc(db, 'academicRequests', safeReqId), {
      assignedTeacherId: sanitizeId(assignee.uid),
      assignedTeacherName: assignee.displayName.trim().slice(0, 120),
      assignedRole: assignee.role,
      forwardedBy: current.uid,
      status: 'em_analise',
      updatedAt: serverTimestamp(),
    });
  };

  // Unified Notifications Center (Firestore persisted per user + synthesized notices & academic request updates)
  const notifications = React.useMemo<UserNotification[]>(() => {
    const uid = user?.uid || GUEST_UID;
    const storedMap = new Map<string, UserNotification>();
    storedNotifications.forEach((n) => storedMap.set(n.notificationId || n.id, n));

    const combined = new Map<string, UserNotification>();
    storedNotifications.forEach((n) => {
      combined.set(n.notificationId || n.id, { ...n, id: n.notificationId || n.id });
    });

    // Published platform notices
    platformNotices.slice(0, 20).forEach((notice) => {
      const nid = sanitizeId(`notice_${notice.noticeId || notice.id}`);
      const existing = storedMap.get(nid);
      combined.set(nid, {
        id: nid,
        notificationId: nid,
        userId: uid,
        category: 'notice',
        title: notice.title,
        body: notice.body,
        read: existing ? Boolean(existing.read) : false,
        readAt: existing?.readAt,
        targetTab: 'dashboard',
        targetId: notice.id,
        priority: notice.priority,
        createdAt: existing?.createdAt || notice.createdAt || notice.eventDate,
        updatedAt: existing?.updatedAt || notice.updatedAt || notice.createdAt,
      });
    });

    // Academic requests updates for owner
    academicRequests
      .filter((req) => req.studentId === uid && (req.status !== 'pendente' || req.lastMessageByRole !== 'student'))
      .slice(0, 15)
      .forEach((req) => {
        const nid = sanitizeId(`req_${req.requestId || req.id}_m${req.messageCount || 0}`);
        const existing = storedMap.get(nid);
        combined.set(nid, {
          id: nid,
          notificationId: nid,
          userId: uid,
          category: 'request_update',
          title: `Solicitação (${req.status.replace('_', ' ')}): ${req.subject}`,
          body: req.lastMessagePreview || req.description,
          read: existing ? Boolean(existing.read) : false,
          readAt: existing?.readAt,
          targetTab: 'requests',
          targetId: req.id,
          priority: req.status === 'respondida' ? 'importante' : 'normal',
          createdAt: existing?.createdAt || req.updatedAt || req.createdAt,
          updatedAt: existing?.updatedAt || req.updatedAt,
        });
      });

    return Array.from(combined.values()).sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      const toMs = (v: unknown) => {
        if (!v) return 0;
        if (typeof v === 'string') return Date.parse(v) || 0;
        if (typeof (v as { toMillis?: () => number })?.toMillis === 'function') {
          return (v as { toMillis: () => number }).toMillis();
        }
        return 0;
      };
      return toMs(b.createdAt) - toMs(a.createdAt);
    });
  }, [user?.uid, storedNotifications, platformNotices, academicRequests]);

  const unreadNotificationCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const upsertUserNotification = async (item: UserNotification) => {
    const safeId = sanitizeId(item.notificationId || item.id);
    const readAtIso = item.read ? item.readAt || new Date().toISOString() : undefined;

    if (isGuest && !auth.currentUser) {
      persistGuestPatch((prev) => {
        const filtered = prev.notifications.filter((n) => (n.notificationId || n.id) !== safeId);
        return {
          ...prev,
          notifications: [
            {
              ...item,
              id: safeId,
              notificationId: safeId,
              readAt: readAtIso,
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...filtered,
          ].slice(0, 80),
        };
      });
      return;
    }

    const current = auth.currentUser;
    if (!current) return;
    const ref = doc(db, 'users', current.uid, 'notifications', safeId);
    const alreadyStored = storedNotifications.some((n) => (n.notificationId || n.id) === safeId);
    try {
      if (alreadyStored) {
        await updateDoc(ref, {
          read: Boolean(item.read),
          ...(readAtIso ? { readAt: readAtIso } : {}),
          title: item.title.slice(0, 200),
          body: item.body.slice(0, 1000),
          priority: item.priority || 'normal',
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          notificationId: safeId,
          userId: current.uid,
          category: item.category,
          title: item.title.slice(0, 200),
          body: item.body.slice(0, 1000),
          read: Boolean(item.read),
          ...(readAtIso ? { readAt: readAtIso } : {}),
          ...(item.targetTab ? { targetTab: item.targetTab } : {}),
          ...(item.targetId ? { targetId: item.targetId.slice(0, 128) } : {}),
          priority: item.priority || 'normal',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-blocking notification persistence error
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    const target = notifications.find((n) => (n.notificationId || n.id) === notificationId);
    if (!target) return;
    await upsertUserNotification({
      ...target,
      read: true,
      readAt: new Date().toISOString(),
    });
  };

  const markAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        upsertUserNotification({
          ...n,
          read: true,
          readAt: new Date().toISOString(),
        })
      )
    );
  };

  const recordStudyNotification = async (message: string, title = 'Lembrete de Estudos ALEPA 2026') => {
    const uid = auth.currentUser?.uid || GUEST_UID;
    const safeId = sanitizeId(`study_alert_${addDaysIso(0)}`);
    await upsertUserNotification({
      id: safeId,
      notificationId: safeId,
      userId: uid,
      category: 'study_alert',
      title,
      body: message,
      read: false,
      targetTab: 'schedule',
      priority: 'importante',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest,
        profile,
        authLoading,
        syncError,
        clearSyncError: () => setSyncError(null),
        workspaceAccessToken,
        connectGoogleWorkspace,
        clearWorkspaceToken,
        effectiveRole,
        isAdmin,
        isEditor,
        isTeacher,
        isDev,
        canAccessAdminPanel,
        canAccessTeacherPanel,
        canManageUsers,
        canPublishShared,
        activeWorkspaceMode: activeWorkspaceModeState,
        setActiveWorkspaceMode,
        preferences,
        updateStudentPreferences,
        toggleFavoriteMaterial,
        toggleFavoriteQuestion,
        toggleFavoriteTopic,
        getIdToken,
        myFamilyMembership,
        familyMembers,
        accessSessions,
        allUsers,
        updateAccessPresenceContext,
        inviteFamilyMember,
        toggleFamilyMemberPublish,
        toggleFamilyMemberActive,
        removeFamilyMember,
        topicProgressMap,
        disciplineGoalsMap,
        readingProgressMap,
        mediaProgressMap,
        academicRequests,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
        recordStudyNotification,
        studySessions,
        simuladoAttempts,
        errorNotebook,
        materials,
        allManagedMaterials,
        questions,
        allManagedQuestions,
        managedDisciplines,
        allManagedDisciplines,
        managedTopics,
        allManagedTopics,
        simuladoLists,
        allManagedSimuladoLists,
        platformNotices,
        allManagedNotices,
        exams,
        allManagedExams,
        classes,
        allManagedClasses,
        enrollments,
        lessons,
        allManagedLessons,
        activities,
        allManagedActivities,
        submissions,
        storageMetadataRecords,
        auditLogs,
        getCampusDisciplines,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        enterGuestMode,
        exitGuestMode,
        resendVerification,
        refreshAuthState,
        logout,
        updateProfileSettings,
        updateUserRole,
        toggleUserActive,
        updateUserAssignments,
        saveDisciplineWeeklyGoal,
        saveTopicProgress,
        saveReadingProgress,
        deleteReadingProgress,
        saveMediaProgress,
        createAcademicRequest,
        subscribeAcademicRequestMessages,
        sendAcademicRequestMessage,
        updateAcademicRequestStatus,
        assignAcademicRequest,
        logStudySession,
        saveSimuladoAttempt,
        addErrorEntry,
        updateErrorEntry,
        deleteErrorEntry,
        addMaterial,
        updateMaterial,
        updateMaterialStatus,
        deleteMaterial,
        addCustomQuestion,
        updateCustomQuestion,
        updateQuestionStatus,
        deleteCustomQuestion,
        saveManagedDiscipline,
        updateManagedDisciplineStatus,
        saveManagedTopic,
        updateManagedTopicStatus,
        saveSimuladoList,
        updateSimuladoListStatus,
        savePlatformNotice,
        updatePlatformNoticeStatus,
        saveExamConcurso,
        updateExamStatus,
        saveClassroom,
        updateClassroomStatus,
        enrollStudentInClass,
        updateEnrollmentStatus,
        removeEnrollment,
        saveLesson,
        updateLessonStatus,
        deleteLesson,
        saveActivity,
        updateActivityStatus,
        deleteActivity,
        submitActivity,
        gradeSubmission,
        registerStorageMetadata,
        updateStorageMetadataRecord,
        deleteStorageMetadataRecord,
        writeAuditLog,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  return ctx;
}
