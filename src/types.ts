export type UserRole = 'student' | 'teacher' | 'editor' | 'admin' | 'dev';
export type NormalizedUserRole = 'student' | 'teacher' | 'editor' | 'admin' | 'dev';
export type PublicationStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export function normalizeUserRole(
  role?: string | null,
  isPrimaryAdmin = false
): NormalizedUserRole {
  if (isPrimaryAdmin) {
    return role === 'dev' ? 'dev' : 'admin';
  }
  if (
    role === 'admin' ||
    role === 'dev' ||
    role === 'editor' ||
    role === 'teacher' ||
    role === 'student'
  ) {
    return role;
  }
  return 'student';
}

export function isAdminOrDevRole(role?: string | null, isPrimaryAdmin = false): boolean {
  const normalized = normalizeUserRole(role, isPrimaryAdmin);
  return normalized === 'admin' || normalized === 'dev';
}

export function isEditorRole(role?: string | null, isPrimaryAdmin = false): boolean {
  const normalized = normalizeUserRole(role, isPrimaryAdmin);
  return normalized === 'editor' || isAdminOrDevRole(normalized, isPrimaryAdmin);
}

export function isTeacherRole(role?: string | null, isPrimaryAdmin = false): boolean {
  const normalized = normalizeUserRole(role, isPrimaryAdmin);
  return normalized === 'teacher';
}

export function canAccessAdminRole(role?: string | null, isPrimaryAdmin = false): boolean {
  return isEditorRole(role, isPrimaryAdmin);
}

export function canAccessTeacherRole(role?: string | null, isPrimaryAdmin = false): boolean {
  const normalized = normalizeUserRole(role, isPrimaryAdmin);
  return normalized === 'teacher' || isEditorRole(normalized, isPrimaryAdmin);
}

export function canPublishInstitutionalRole(role?: string | null, isPrimaryAdmin = false): boolean {
  return isEditorRole(role, isPrimaryAdmin);
}

export function isStaffRole(role?: string | null, isPrimaryAdmin = false): boolean {
  const normalized = normalizeUserRole(role, isPrimaryAdmin);
  return (
    normalized === 'admin' ||
    normalized === 'editor' ||
    normalized === 'teacher' ||
    normalized === 'dev'
  );
}

export function canManageUsersRole(role?: string | null, isPrimaryAdmin = false): boolean {
  return isAdminOrDevRole(role, isPrimaryAdmin);
}

export function formatRoleLabel(role?: string | null, isPrimaryAdmin = false): string {
  const normalized = normalizeUserRole(role, isPrimaryAdmin);
  switch (normalized) {
    case 'admin':
      return 'Administrador Principal';
    case 'editor':
      return 'Administrador de Conteúdo';
    case 'teacher':
      return 'Professor';
    case 'dev':
      return 'Desenvolvedor';
    default:
      return 'Estudante';
  }
}

export type CampusLevel = 'medio' | 'superior';
export type LibraryScope = 'geral' | 'superior' | 'medio';
export type MedioCargoGroup = 'cargo_01_04' | 'cargo_01' | 'cargo_02' | 'cargo_03';

export type NavSection =
  | 'dashboard'
  | 'classroom'
  | 'preparation'
  | 'disciplines'
  | 'study_room'
  | 'schedule'
  | 'simulados'
  | 'revisions'
  | 'podcasts'
  | 'videos'
  | 'gemini'
  | 'materials'
  | 'performance'
  | 'family'
  | 'requests'
  | 'settings'
  | 'teacher'
  | 'admin'
  | 'portuguese_repo';

export type BlockType = 'theory' | 'questions' | 'correction' | 'revision';

export type MaterialFileType = 'pdf' | 'epub' | 'html' | 'pptx' | 'xlsx' | 'drive' | 'video';

export type MaterialRelevanceTier = 'essencial' | 'complementar' | 'aprofundamento';

export type ResourceType =
  | 'pdf'
  | 'livro_digital'
  | 'video'
  | 'podcast'
  | 'legislacao'
  | 'curso'
  | 'questoes'
  | 'simulado';

export type SuperiorLibraryCategoryId =
  | 'cat_01_portugues'
  | 'cat_02_legislacao_etica'
  | 'cat_03_informatica'
  | 'cat_04_raciocinio_logico'
  | 'cat_05_constitucional_adm'
  | 'cat_06_processo_legislativo'
  | 'cat_07_administracao_geral'
  | 'cat_08_secretaria_redacao'
  | 'cat_09_arquivologia'
  | 'cat_10_recursos_materiais';

export type MedioLibraryCategoryId =
  | 'nm_cat_01_portugues'
  | 'nm_cat_02_legislacao_etica'
  | 'nm_cat_03_informatica'
  | 'nm_cat_04_raciocinio_logico'
  | 'nm_cat_05_constitucional'
  | 'nm_cat_06_administrativo'
  | 'nm_cat_07_tecnica_legislativa'
  | 'nm_cat_08_administracao_publica'
  | 'nm_cat_09_secretaria'
  | 'nm_cat_10_arquivologia'
  | 'nm_cat_11_recursos_materiais';

export type GeralLibraryCategoryId =
  | 'geral_cat_01_portugues'
  | 'geral_cat_02_raciocinio_logico'
  | 'geral_cat_03_informatica'
  | 'geral_cat_04_constitucional'
  | 'geral_cat_05_administrativo'
  | 'geral_cat_06_legislacao_alepa'
  | 'geral_cat_07_etica'
  | 'geral_cat_08_tecnica_legislativa';

export type LibraryCategoryId =
  | SuperiorLibraryCategoryId
  | MedioLibraryCategoryId
  | GeralLibraryCategoryId;

export type LinkStatus = 'ativo' | 'instavel' | 'atualizacao';

export type QuestionOriginType =
  | 'official_cetap'
  | 'official_camara'
  | 'official_alepa'
  | 'training_platform'
  | 'ai_generated';

export type QuestionDifficulty = 'basico' | 'intermediario' | 'avancado';
export type QuestionFormat = 'objetiva' | 'discursiva';

export type ErrorReason = 'atencao' | 'teoria' | 'lei_seca' | 'banca_cetap';

export type ThemeModePreference = 'light' | 'dark' | 'auto';
export type AccentPalette = 'emerald' | 'indigo' | 'amber' | 'teal';
export type FontScalePreference = 'sm' | 'md' | 'lg';
export type DensityPreference = 'comfortable' | 'compact';

export type MediaPlaybackPreference = 'ask' | 'internal' | 'external';

export interface CustomShortcut {
  id: string;
  label: string;
  section: NavSection;
}

export interface StudentPreferences {
  theme: ThemeModePreference;
  accentColor: AccentPalette;
  fontScale: FontScalePreference;
  density: DensityPreference;
  hiddenDashboardCards: string[];
  dashboardCardOrder: string[];
  favoriteMaterialIds: string[];
  favoriteQuestionIds: string[];
  favoriteTopicIds: string[];
  customShortcuts: CustomShortcut[];
  preferredCampus?: CampusLevel;
  preferredMedioCargo?: MedioCargoGroup;
  mediaPlaybackPreference?: MediaPlaybackPreference;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  role: UserRole;
  active?: boolean;
  assignedClassIds?: string[];
  assignedDisciplineIds?: string[];
  preferences?: StudentPreferences;
  dailyGoalMinutes: number;
  examDate: string;
  targetCargo: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SyllabusTopic {
  id: string;
  disciplineId: string;
  title: string;
  subtopics: string[];
  highYield: boolean;
}

export interface Discipline {
  id: string;
  name: string;
  shortName: string;
  editalBlock:
    | 'Conhecimentos Específicos'
    | 'Legislação e Ética'
    | 'Língua Portuguesa'
    | 'Raciocínio Lógico'
    | 'Noções de Informática';
  priorityRank: number;
  examQuestions: number;
  examPoints: number;
  tieBreakerOrder: number;
  recommendedMinutesPerCycle: number;
  topics: SyllabusTopic[];
}

export interface LibraryCategory {
  id: LibraryCategoryId;
  order: number;
  title: string;
  description: string;
  disciplineId: string;
}

export interface TopicProgress {
  topicId: string;
  userId: string;
  disciplineId: string;
  theoryDone: boolean;
  questionsDone: boolean;
  revisionDone: boolean;
  masteryLevel: number;
  notes?: string;
  updatedAt?: unknown;
}

export interface DisciplineWeeklyGoal {
  disciplineId: string;
  userId: string;
  weeklyGoalMinutes: number;
  updatedAt?: unknown;
}

export interface StudySession {
  id: string;
  userId: string;
  dateKey: string;
  disciplineId: string;
  topicTitle: string;
  blockType: BlockType;
  durationMinutes: number;
  notes?: string;
  createdAt?: unknown;
}

export interface Question {
  id: string;
  disciplineId: string;
  topicTitle: string;
  statement: string;
  options: [string, string, string, string, string];
  correctIndex: number;
  explanation: string;
  legalBasis?: string;
  source?: string;
  originType?: QuestionOriginType;
  isOfficial?: boolean;
  difficulty?: QuestionDifficulty;
  questionFormat?: QuestionFormat;
  classId?: string;
  reviewNotes?: string;
  year?: number;
  cargo?: string;
  escolaridade?: CampusLevel;
  authorId?: string;
  isPublished?: boolean;
  status?: PublicationStatus;
  sourceMaterialId?: string;
  sourcePage?: number;
  sourceExcerpt?: string;
  needsReview?: boolean;
  reviewFlags?: string[];
  updatedAt?: unknown;
}

export interface SimuladoAttempt {
  id: string;
  userId: string;
  title: string;
  mode: 'treino' | 'simulado';
  primaryDisciplineId: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  durationSeconds: number;
  createdAt?: unknown;
}

export interface ErrorEntry {
  id: string;
  userId: string;
  questionId: string;
  disciplineId: string;
  topicTitle: string;
  questionStem: string;
  correctOption: string;
  selectedOption: string;
  errorReason: ErrorReason;
  improvementNote: string;
  nextReviewDate: string;
  reviewCount: number;
  status: 'pending' | 'mastered';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type StorageProviderType = 'firebase_storage' | 'google_drive' | 'local' | 'external';

export interface PdfVirtualSection {
  id: string;
  disciplineId: string;
  disciplineName: string;
  title: string;
  startPage: number;
  endPage: number;
  topics?: string[];
  summary?: string;
  publishedToLibrary?: boolean;
}

export interface MaterialChapter {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  startPage?: number;
  endPage?: number;
  startSeconds?: number;
  endSeconds?: number;
  topics?: string[];
  notes?: string;
}

export interface StudyMaterial {
  id: string;
  ownerId: string;
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
  medioCargoGroup?: string;
  status?: PublicationStatus;
  updatedBy?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  classId?: string;
  keywords?: string[];
  author?: string;
  edition?: string;
  year?: number;
  checksumSha256?: string;
  storageProvider?: StorageProviderType;
  storagePath?: string;
  fileName?: string;
  description?: string;
  isShared: boolean;
  isSystemDefault?: boolean;
  localBlobKey?: string;
  allowDownload?: boolean;
  textLayerStatus?: 'selectable' | 'scanned' | 'mixed' | 'unknown';
  pageCount?: number;
  durationSeconds?: number;
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
  indexingStatus?: 'pending' | 'indexed' | 'partial' | 'error';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FamilyMember {
  id: string;
  memberId: string;
  name: string;
  email: string;
  relationship: string;
  canPublish: boolean;
  active: boolean;
  invitedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AccessSession {
  id: string;
  userId: string;
  deviceId: string;
  displayName: string;
  accessType: 'admin' | 'familiar' | 'estudante';
  deviceType: 'mobile' | 'desktop';
  currentTab: string;
  activeCampus: CampusLevel;
  isOnline: boolean;
  sessionStartedAt?: unknown;
  lastSeenAt?: unknown;
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  tip?: string;
}

export interface MindMapBranch {
  title: string;
  items: string[];
}

export interface MindMapData {
  centralTopic: string;
  branches: MindMapBranch[];
}

export interface LastStudiedContext {
  campus: CampusLevel;
  section: NavSection;
  disciplineId?: string;
  topicId?: string;
  topicTitle?: string;
  label: string;
  updatedAt: string;
}

export interface SpacedRepetitionConfig {
  preset: 'padrao' | 'intensivo' | 'estendido';
  intervals: [number, number, number, number];
}

export interface ManagedDiscipline {
  id: string;
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
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ManagedTopic {
  id: string;
  topicId: string;
  disciplineId: string;
  campusLevel: CampusLevel;
  title: string;
  subtopics: string[];
  highYield: boolean;
  order: number;
  status: PublicationStatus;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SimuladoList {
  id: string;
  listId: string;
  title: string;
  description?: string;
  campusLevel: LibraryScope;
  durationMinutes: number;
  questionIds: string[];
  status: PublicationStatus;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlatformNotice {
  id: string;
  noticeId: string;
  title: string;
  body: string;
  campusLevel: LibraryScope;
  priority: 'normal' | 'importante' | 'urgente';
  eventDate?: string;
  status: PublicationStatus;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type BookReaderMode = 'book' | 'reading' | 'original';
export type BookReaderTheme = 'paper' | 'sepia' | 'night';
export type HighlightColor = 'amber' | 'emerald' | 'sky' | 'rose';

export interface ReaderBookmark {
  id: string;
  page: number;
  label: string;
  createdAt: string;
}

export interface ReaderHighlight {
  id: string;
  page: number;
  quote: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export interface ReaderAnnotation {
  id: string;
  page: number;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  materialId: string;
  userId: string;
  materialTitle: string;
  lastPage: number;
  totalPages: number;
  progressPercent: number;
  readingMode: BookReaderMode;
  fontSize: number;
  lineHeight: number;
  maxWidthCh: number;
  theme: BookReaderTheme;
  bookmarks: ReaderBookmark[];
  highlights: ReaderHighlight[];
  annotations: ReaderAnnotation[];
  lastReadAt: string;
  updatedAt?: unknown;
}

export interface ExamConcurso {
  id: string;
  examId: string;
  title: string;
  institution: string;
  code: string;
  year: number;
  levels: CampusLevel[];
  positions: string[];
  examDate?: string;
  status: PublicationStatus;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Classroom {
  id: string;
  classId: string;
  name: string;
  code: string;
  examId: string;
  campusLevel: CampusLevel;
  disciplineIds: string[];
  teacherIds: string[];
  description?: string;
  active: boolean;
  status: PublicationStatus;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassEnrollment {
  id: string;
  enrollmentId: string;
  classId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  teacherId: string;
  status: 'active' | 'inactive';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Lesson {
  id: string;
  lessonId: string;
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
  authorId: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Activity {
  id: string;
  activityId: string;
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
  authorId: string;
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SubmissionRevision {
  gradedBy: string;
  score: number;
  feedback: string;
  gradedAt: string;
}

export interface ActivitySubmission {
  id: string;
  submissionId: string;
  activityId: string;
  classId: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  objectiveAnswers: Record<string, number>;
  discursiveResponses: Record<string, string>;
  objectiveScore: number;
  manualScore: number;
  finalScore: number;
  feedback?: string;
  status: 'submitted' | 'graded' | 'returned';
  gradedBy?: string;
  revisionHistory: SubmissionRevision[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type StorageObjectCategory = 'pdf' | 'video' | 'audio' | 'image' | 'other';

export interface StorageMetadataRecord {
  id: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
  storageProvider: StorageProviderType;
  bucket: string;
  objectPath: string;
  downloadUrl: string;
  category: StorageObjectCategory;
  campusLevel: LibraryScope;
  linkedMaterialId?: string;
  version: number;
  archived: boolean;
  uploadedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  logId: string;
  actorId: string;
  actorEmail?: string;
  actorRole: NormalizedUserRole;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt?: unknown;
}

export interface MediaProgressRecord {
  mediaId: string;
  userId: string;
  materialTitle: string;
  mediaType: 'video' | 'audio';
  currentTimeSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  playbackRate: number;
  preferredMode: MediaPlaybackPreference;
  lastChapterId?: string;
  openedExternallyAt?: string;
  lastPlayedAt: string;
  updatedAt?: unknown;
}

export type AcademicRequestCategory =
  | 'duvida_academica'
  | 'pedido_material'
  | 'pedido_video_podcast'
  | 'erro_conteudo'
  | 'sugestao'
  | 'suporte';

export type AcademicRequestStatus =
  | 'pendente'
  | 'em_analise'
  | 'aguardando_resposta'
  | 'respondida'
  | 'concluida';

export interface AcademicRequest {
  id: string;
  requestId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  category: AcademicRequestCategory;
  subject: string;
  description: string;
  disciplineId: string;
  topicTitle?: string;
  campusLevel?: LibraryScope;
  status: AcademicRequestStatus;
  assignedTeacherId?: string;
  assignedTeacherName?: string;
  assignedRole?: 'teacher' | 'editor' | 'admin';
  forwardedBy?: string;
  lastMessagePreview?: string;
  lastMessageByRole?: NormalizedUserRole;
  messageCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademicRequestMessage {
  id: string;
  messageId: string;
  requestId: string;
  studentId: string;
  assignedTeacherId?: string;
  senderId: string;
  senderName: string;
  senderRole: NormalizedUserRole;
  body: string;
  isSystemNote?: boolean;
  createdAt?: unknown;
}

export type NotificationCategory = 'notice' | 'request_update' | 'study_alert' | 'material_update' | 'system';
export type NotificationPriority = 'normal' | 'importante' | 'urgente';

export interface UserNotification {
  id: string;
  notificationId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  readAt?: string;
  targetTab?: NavSection;
  targetId?: string;
  priority?: NotificationPriority;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentIndexChunk {
  chunkId: string;
  materialId: string;
  materialTitle: string;
  disciplineId: string;
  campusLevel?: LibraryScope;
  sourceKind: 'pdf' | 'epub' | 'html_portal' | 'chapters';
  pageNumber?: number;
  chapterId?: string;
  chapterTitle?: string;
  sectionTitle?: string;
  text: string;
  normalizedText: string;
  tokens: string[];
}

export interface DocumentIndexMeta {
  materialId: string;
  materialTitle: string;
  disciplineId: string;
  campusLevel?: LibraryScope;
  sourceKind: 'pdf' | 'epub' | 'html_portal' | 'chapters';
  totalUnits: number;
  chunkCount: number;
  indexedAt: string;
  status: 'indexed' | 'partial' | 'error';
}

export interface DocumentSearchHit {
  chunk: DocumentIndexChunk;
  score: number;
  matchStage: 'exact' | 'synonym' | 'semantic';
  matchedTerms: string[];
  reason?: string;
}

