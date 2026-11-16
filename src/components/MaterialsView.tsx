import React, { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  GraduationCap,
  Headphones,
  Link2,
  Loader2,
  LogOut,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { YouTubeBrandIcon, extractYouTubeId } from './VideosView';
import { BookReaderModal } from './BookReaderModal';
import { ContentOrganizerModal } from './ContentOrganizerModal';
import { useAuth } from '../contexts/AuthContext';
import {
  CAMPUS_LIBRARY_RECOMMENDATIONS,
  CAMPUS_ORGANIZATION_MATRIX,
  GERAL_DEFAULT_MATERIALS,
  GERAL_LIBRARY_CATEGORIES,
  isGeralMaterial,
} from '../data/alepaGeneralLibrary';
import {
  MEDIO_DEFAULT_MATERIALS,
  MEDIO_LIBRARY_CATEGORIES,
  MEDIO_PRIORITY_SOURCES,
} from '../data/alepaMedioLibrary';
import { isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import {
  LIBRARY_CATEGORIES,
  OFFICIAL_PORTAL_LINKS,
  RESOURCE_TYPE_META,
} from '../data/alepaQuestions';
import { getDisciplineShortName } from '../data/alepaSyllabus';
import {
  DRIVE_MIME,
  DriveItem,
  GoogleSlidePage,
  downloadDriveFileBuffer,
  exportGoogleWorkspaceFile,
  fetchGooglePresentation,
  fetchGoogleSpreadsheet,
  getDriveFileMetadata,
  getDriveItemTypeLabel,
  isPresentationDriveItem,
  isSpreadsheetDriveItem,
  listDriveFiles,
  parseGoogleWorkspaceUrl,
} from '../lib/googleWorkspace';
import { deleteLocalFile, getLocalFile, saveLocalFile } from '../lib/localFiles';
import {
  inferMaterialMimeType,
  inferStorageCategory,
  mapCloudStorageError,
  uploadFileToCloudStorage,
} from '../lib/storageService';
import { getMaterialProgressKey } from '../lib/pdfBookEngine';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import {
  describeMaterialForCatalog,
  isMaterialPendingDefinition,
  standardizeMaterialCatalog,
} from '../data/libraryCatalogUtils';
import {
  CampusLevel,
  LibraryCategoryId,
  LibraryScope,
  LinkStatus,
  MaterialFileType,
  MaterialRelevanceTier,
  ResourceType,
  StudyMaterial,
} from '../types';
import { VERIFIED_OFFICIAL_AND_ACADEMIC_SOURCES } from '../data/verifiedSources';
import { inferMaterialRelevance } from '../utils/mediaUrls';

const RESOURCE_LABELS: Record<ResourceType, string> = {
  pdf: 'PDF',
  livro_digital: 'Livro Digital',
  video: 'Vídeo',
  podcast: 'Podcast',
  legislacao: 'Legislação',
  curso: 'Curso',
  questoes: 'Questões',
  simulado: 'Simulado',
};

const FILE_TYPE_LABELS: Record<MaterialFileType, string> = {
  pdf: 'PDF',
  epub: 'EPUB (E-book)',
  html: 'Portal Oficial (HTML)',
  pptx: 'PowerPoint / Slides',
  xlsx: 'Planilha / Excel',
  drive: 'Google Drive',
  video: 'Vídeo / Portal',
};

const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  ativo: 'Link ativo',
  instavel: 'Instável',
  atualizacao: 'Em atualização',
};

function GoogleLogoSvg() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function getMaterialIcon(mat: StudyMaterial) {
  if (mat.fileType === 'pptx') return Presentation;
  if (mat.fileType === 'xlsx') return FileSpreadsheet;
  if (mat.fileType === 'drive') return FolderOpen;

  switch (mat.resourceType) {
    case 'livro_digital':
      return BookOpen;
    case 'video':
      return Video;
    case 'podcast':
      return Headphones;
    case 'legislacao':
      return Scale;
    case 'curso':
      return GraduationCap;
    case 'questoes':
    case 'simulado':
      return ClipboardCheck;
    default:
      return FileText;
  }
}

function getDriveItemIcon(item: DriveItem) {
  if (item.mimeType === DRIVE_MIME.FOLDER) return Folder;
  if (isSpreadsheetDriveItem(item)) return FileSpreadsheet;
  if (isPresentationDriveItem(item)) return Presentation;
  return FileText;
}

function inferMaterialTypesFromUrl(rawUrl: string): {
  fileType: MaterialFileType;
  resourceType: ResourceType;
} {
  const parsed = parseGoogleWorkspaceUrl(rawUrl);
  const lower = rawUrl.toLowerCase();
  if (
    lower.includes('open.spotify.com') ||
    lower.startsWith('spotify:') ||
    lower.includes('anchor.fm') ||
    lower.includes('soundcloud.com') ||
    /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(lower)
  ) {
    return { fileType: 'video', resourceType: 'podcast' };
  }
  if (parsed.kind === 'folder') return { fileType: 'drive', resourceType: 'pdf' };
  if (parsed.kind === 'spreadsheet' || /\.(xlsx?|csv)(\?|$)/i.test(lower)) {
    return { fileType: 'xlsx', resourceType: 'pdf' };
  }
  if (parsed.kind === 'presentation' || /\.(pptx?|odp)(\?|$)/i.test(lower)) {
    return { fileType: 'pptx', resourceType: 'pdf' };
  }
  if (parsed.kind === 'drive_file') return { fileType: 'drive', resourceType: 'pdf' };
  if (/\.epub(\?|$)/i.test(lower)) {
    return { fileType: 'epub', resourceType: 'livro_digital' };
  }
  if (/\.pdf(\?|$)/i.test(lower)) {
    return { fileType: 'pdf', resourceType: 'pdf' };
  }
  if (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('instagram.com') ||
    lower.includes('tiktok.com') ||
    lower.includes('vimeo.com')
  ) {
    return { fileType: 'video', resourceType: 'video' };
  }
  if (
    /\.(html?|aspx|php)(\?|$)/i.test(lower) ||
    /(planalto\.gov\.br|alepa\.pa\.gov\.br|cetapnet\.com\.br|senado\.leg\.br|camara\.leg\.br|enap\.gov\.br|scielo\.br)/i.test(
      lower
    )
  ) {
    return {
      fileType: 'html',
      resourceType:
        lower.includes('planalto.gov.br') || lower.includes('bancodeleis') ? 'legislacao' : 'curso',
    };
  }
  return { fileType: 'pdf', resourceType: 'pdf' };
}

function buildEmbedUrl(material: StudyMaterial): string | null {
  const url = material.url.trim();
  if (!url || url.startsWith('local://')) return null;

  const parsed = parseGoogleWorkspaceUrl(url);
  if (parsed.kind === 'drive_file' && parsed.id) {
    return `https://drive.google.com/file/d/${parsed.id}/preview`;
  }
  if (parsed.kind === 'spreadsheet' && parsed.id) {
    return `https://docs.google.com/spreadsheets/d/${parsed.id}/preview`;
  }
  if (parsed.kind === 'presentation' && parsed.id) {
    return `https://docs.google.com/presentation/d/${parsed.id}/preview`;
  }

  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) {
    return `https://docs.google.com/document/d/${docsMatch[1]}/preview`;
  }

  const ytWatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (ytWatch) {
    return `https://www.youtube.com/embed/${ytWatch[1]}`;
  }
  const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (ytShort) {
    return `https://www.youtube.com/embed/${ytShort[1]}`;
  }
  const ytShortsOrLive = url.match(/youtube\.com\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})/);
  if (ytShortsOrLive) {
    return `https://www.youtube.com/embed/${ytShortsOrLive[1]}`;
  }
  const igMatch = url.match(/instagram\.com\/(?:[^/]+\/)?(reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch) {
    const kind = igMatch[1].toLowerCase() === 'reels' ? 'reel' : igMatch[1].toLowerCase();
    return `https://www.instagram.com/${kind}/${igMatch[2]}/embed/`;
  }
  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i) || url.match(/tiktok\.com\/v\/(\d+)/i);
  if (ttMatch) {
    return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  const spotifyUrlMatch = url.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show|playlist|track|album)\/([a-zA-Z0-9]+)/i
  );
  if (spotifyUrlMatch) {
    return `https://open.spotify.com/embed/${spotifyUrlMatch[1].toLowerCase()}/${spotifyUrlMatch[2]}?utm_source=generator`;
  }
  const spotifyUriMatch = url.match(/^spotify:(episode|show|playlist|track|album):([a-zA-Z0-9]+)$/i);
  if (spotifyUriMatch) {
    return `https://open.spotify.com/embed/${spotifyUriMatch[1].toLowerCase()}/${spotifyUriMatch[2]}?utm_source=generator`;
  }

  if ((material.fileType === 'pptx' || material.fileType === 'xlsx') && /\.(pptx?|xlsx?)$/i.test(url)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }

  if (material.fileType === 'pdf' && (/\.pdf($|\?)/i.test(url) || url.startsWith('/assets/'))) {
    return url;
  }

  return null;
}

function driveItemToStudyMaterial(item: DriveItem): StudyMaterial {
  let fileType: MaterialFileType = 'drive';
  if (isSpreadsheetDriveItem(item)) fileType = 'xlsx';
  else if (isPresentationDriveItem(item)) fileType = 'pptx';
  else if (item.mimeType === DRIVE_MIME.PDF) fileType = 'pdf';

  let url = item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`;
  if (item.mimeType === DRIVE_MIME.FOLDER) {
    url = item.webViewLink || `https://drive.google.com/drive/folders/${item.id}`;
  } else if (item.mimeType === DRIVE_MIME.SHEET) {
    url = item.webViewLink || `https://docs.google.com/spreadsheets/d/${item.id}/edit`;
  } else if (item.mimeType === DRIVE_MIME.SLIDE) {
    url = item.webViewLink || `https://docs.google.com/presentation/d/${item.id}/edit`;
  }

  return {
    id: `drive_${item.id}`,
    ownerId: 'google_drive',
    title: item.name,
    disciplineId: 'processo_legislativo',
    fileType,
    institution: 'Google Drive do Estudante',
    url,
    isShared: false,
    isOfficialContent: false,
    fileName: item.name,
  };
}

export function MaterialsView({
  campus,
  initialScope,
  onChangeCampus,
  onSummarizeWithGemini,
}: {
  campus: CampusLevel;
  initialScope?: LibraryScope;
  onChangeCampus?: (campus: CampusLevel) => void;
  onSummarizeWithGemini?: (target: {
    mode: 'video' | 'pdf';
    materialId?: string;
    url?: string;
    title?: string;
    disciplineId?: string;
  }) => void;
}) {
  const {
    materials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    registerStorageMetadata,
    updateStorageMetadataRecord,
    readingProgressMap,
    preferences,
    toggleFavoriteMaterial,
    user,
    isGuest,
    profile,
    isAdmin,
    canAccessTeacherPanel,
    canPublishShared,
    workspaceAccessToken,
    connectGoogleWorkspace,
    clearWorkspaceToken,
  } = useAuth();
  const canUploadFilesToCloud = Boolean(canAccessTeacherPanel && user && !isGuest && user.emailVerified);

  const isMedio = campus === 'medio';
  const [libraryScope, setLibraryScope] = useState<LibraryScope>(
    initialScope || (isMedio ? 'medio' : 'superior')
  );
  const [showOrgMatrix, setShowOrgMatrix] = useState<boolean>(false);
  const [showDriveTools, setShowDriveTools] = useState<boolean>(false);
  const [showOfficialSources, setShowOfficialSources] = useState<boolean>(false);

  const activeCategories =
    libraryScope === 'geral'
      ? GERAL_LIBRARY_CATEGORIES
      : libraryScope === 'medio'
        ? MEDIO_LIBRARY_CATEGORIES
        : LIBRARY_CATEGORIES;

  const [selectedCategory, setSelectedCategory] = useState<'all' | LibraryCategoryId>('all');
  const [resourceFilter, setResourceFilter] = useState<'all' | ResourceType>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'official' | 'complementary'>('all');
  const [relevanceFilter, setRelevanceFilter] = useState<'all' | MaterialRelevanceTier>('all');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceCategoryFilter, setSourceCategoryFilter] = useState<
    'all' | 'oficial_alepa' | 'legislacao_federal' | 'capacitacao_publica' | 'academica_cientifica'
  >('all');

  // Google Drive, Planilhas, PowerPoint & Pasta Browser State
  const [quickLinkInput, setQuickLinkInput] = useState('');
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveFilterKind, setDriveFilterKind] = useState<'all' | 'folders' | 'sheets' | 'slides' | 'pdfs'>('all');
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Meu Google Drive' },
  ]);
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);

  // Add Modal State (with all 11 metadata fields)
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [modalScope, setModalScope] = useState<LibraryScope>(libraryScope);
  const [categoryId, setCategoryId] = useState<LibraryCategoryId>(activeCategories[0].id);

  useEffect(() => {
    const targetScope: LibraryScope = initialScope || (isMedio ? 'medio' : 'superior');
    setLibraryScope(targetScope);
    setModalScope(targetScope);
    setSelectedCategory('all');
    setCategoryId(
      targetScope === 'geral'
        ? GERAL_LIBRARY_CATEGORIES[0].id
        : targetScope === 'medio'
          ? MEDIO_LIBRARY_CATEGORIES[0].id
          : LIBRARY_CATEGORIES[5].id
    );
  }, [isMedio, initialScope]);

  const modalCategories =
    modalScope === 'geral'
      ? GERAL_LIBRARY_CATEGORIES
      : modalScope === 'medio'
        ? MEDIO_LIBRARY_CATEGORIES
        : LIBRARY_CATEGORIES;

  const handleChangeScope = (nextScope: LibraryScope) => {
    setLibraryScope(nextScope);
    setModalScope(nextScope);
    setSelectedCategory('all');
    if (nextScope === 'geral') {
      setCategoryId(GERAL_LIBRARY_CATEGORIES[0].id);
    } else if (nextScope === 'medio') {
      setCategoryId(MEDIO_LIBRARY_CATEGORIES[0].id);
    } else {
      setCategoryId(LIBRARY_CATEGORIES[5].id);
    }
  };
  const [editalTopic, setEditalTopic] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('pdf');
  const [fileType, setFileType] = useState<MaterialFileType>('pdf');
  const [institution, setInstitution] = useState('');
  const [url, setUrl] = useState('');
  const [pricing, setPricing] = useState<'gratuito' | 'pago'>('gratuito');
  const [publishedAt, setPublishedAt] = useState('2026-11-13');
  const [lastVerifiedAt, setLastVerifiedAt] = useState('2026-11-13');
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('ativo');
  const [isOfficialContent, setIsOfficialContent] = useState(true);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [quickAddTab, setQuickAddTab] = useState<'closed' | 'pdf' | 'video' | 'podcast' | 'outros'>('closed');

  const applyQuickKind = (kind: 'pdf' | 'video' | 'podcast' | 'outros') => {
    setModalScope(libraryScope);
    const selectedCat =
      selectedCategory !== 'all'
        ? activeCategories.find((c) => c.id === selectedCategory)
        : undefined;
    setCategoryId(selectedCat ? selectedCat.id : activeCategories[0].id);
    setIsShared(canPublishShared);
    if (kind === 'pdf') {
      setResourceType('pdf');
      setFileType('pdf');
    } else if (kind === 'video') {
      setResourceType('video');
      setFileType('video');
    } else if (kind === 'podcast') {
      setResourceType('podcast');
      setFileType('video');
    } else {
      setResourceType('legislacao');
      setFileType('drive');
    }
  };

  // Integrated Book Reader + Organizer + File Viewer State
  const [bookReaderMaterial, setBookReaderMaterial] = useState<StudyMaterial | null>(null);
  const [bookReaderInitialPage, setBookReaderInitialPage] = useState<number | undefined>(undefined);
  const [bookReaderInitialChapterId, setBookReaderInitialChapterId] = useState<string | undefined>(undefined);
  const [organizingMaterial, setOrganizingMaterial] = useState<StudyMaterial | null>(null);
  const [viewerMaterial, setViewerMaterial] = useState<StudyMaterial | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState<string | null>(null);
  const [excelSheets, setExcelSheets] = useState<Array<{ name: string; rows: string[][] }>>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [googleSlides, setGoogleSlides] = useState<GoogleSlidePage[]>([]);
  const [slidesViewMode, setSlidesViewMode] = useState<'preview' | 'outline'>('preview');
  const [sheetViewMode, setSheetViewMode] = useState<'api' | 'preview'>('api');
  const [viewerFolderItems, setViewerFolderItems] = useState<DriveItem[]>([]);
  const [viewerFolderTrail, setViewerFolderTrail] = useState<Array<{ id: string; name: string }>>([]);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [remediatingMaterial, setRemediatingMaterial] = useState<StudyMaterial | null>(null);
  const [remediateUrl, setRemediateUrl] = useState('');
  const [remediateFile, setRemediateFile] = useState<File | null>(null);
  const [remediatingBusy, setRemediatingBusy] = useState(false);

  const currentFolder = driveBreadcrumbs[driveBreadcrumbs.length - 1];

  const loadDriveFolderContents = useCallback(
    async (
      folderId: string | null,
      tokenOverride?: string | null,
      filterOverride?: 'all' | 'folders' | 'sheets' | 'slides' | 'pdfs',
      searchOverride?: string
    ) => {
      const token = tokenOverride ?? workspaceAccessToken;
      if (!token) return;

      setDriveLoading(true);
      setDriveError(null);
      try {
        const files = await listDriveFiles({
          accessToken: token,
          folderId,
          searchQuery: searchOverride ?? driveSearch,
          filterKind: filterOverride ?? driveFilterKind,
        });
        setDriveItems(files);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar arquivos do Google Drive.';
        if (msg === 'AUTH_EXPIRED') {
          clearWorkspaceToken();
          setDriveError('A sessão do Google Drive expirou. Clique em "Conectar Google Drive" para renovar.');
        } else {
          setDriveError(msg);
        }
      } finally {
        setDriveLoading(false);
      }
    },
    [workspaceAccessToken, driveSearch, driveFilterKind, clearWorkspaceToken]
  );

  useEffect(() => {
    if (driveBrowserOpen && workspaceAccessToken) {
      void loadDriveFolderContents(currentFolder.id);
    }
  }, [driveBrowserOpen, workspaceAccessToken, currentFolder.id, driveFilterKind, loadDriveFolderContents]);

  const handleConnectDrive = async (): Promise<string | null> => {
    setDriveConnecting(true);
    setDriveError(null);
    try {
      const token = await connectGoogleWorkspace();
      if (token) {
        setDriveBrowserOpen(true);
        await loadDriveFolderContents(currentFolder.id, token);
      }
      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível conectar ao Google Drive.';
      setDriveError(msg);
      return null;
    } finally {
      setDriveConnecting(false);
    }
  };

  const openFolderInBrowser = async (folderId: string, fallbackName = 'Pasta do Drive', tokenOverride?: string | null) => {
    const token = tokenOverride ?? workspaceAccessToken;
    setDriveBrowserOpen(true);
    setDriveError(null);

    if (!token) {
      setDriveBreadcrumbs([
        { id: null, name: 'Meu Google Drive' },
        { id: folderId, name: fallbackName },
      ]);
      return;
    }

    let resolvedName = fallbackName;
    try {
      const meta = await getDriveFileMetadata(token, folderId);
      if (meta.name) resolvedName = meta.name;
    } catch {
      // Keep fallback name if folder metadata isn't readable
    }

    setDriveBreadcrumbs([
      { id: null, name: 'Meu Google Drive' },
      { id: folderId, name: resolvedName },
    ]);
    await loadDriveFolderContents(folderId, token);
  };

  const prefillModalFromUrlOrItem = async (targetUrl: string, presetTitle?: string, presetFileType?: MaterialFileType) => {
    const parsed = parseGoogleWorkspaceUrl(targetUrl);
    const inferred = inferMaterialTypesFromUrl(parsed.cleanUrl || targetUrl);
    setUrl(parsed.cleanUrl || targetUrl);
    setFileType(presetFileType || inferred.fileType);
    setResourceType(inferred.resourceType);
    setIsOfficialContent(false);
    setInstitution(
      parsed.kind === 'folder' || parsed.kind === 'drive_file'
        ? 'Google Drive do Estudante'
        : parsed.kind === 'spreadsheet'
          ? 'Google Planilhas'
          : parsed.kind === 'presentation'
            ? 'Google Slides / PowerPoint'
            : ''
    );

    if (presetTitle) {
      setTitle(presetTitle);
    } else if (parsed.id && workspaceAccessToken) {
      try {
        const meta = await getDriveFileMetadata(workspaceAccessToken, parsed.id);
        setTitle(meta.name);
      } catch {
        setTitle(parsed.kind === 'folder' ? 'Pasta de Estudos no Google Drive' : '');
      }
    } else if (parsed.kind === 'folder') {
      setTitle('Pasta de Estudos no Google Drive');
    }

    setSelectedFile(null);
    setModalScope(libraryScope);
    setIsShared(canPublishShared);
    setShowAddModal(true);
  };

  const handleOpenQuickLink = async () => {
    const raw = quickLinkInput.trim();
    if (!raw) return;
    const parsed = parseGoogleWorkspaceUrl(raw);

    if (parsed.kind === 'folder' && parsed.id) {
      if (!workspaceAccessToken) {
        const token = await handleConnectDrive();
        if (token) {
          await openFolderInBrowser(parsed.id, 'Pasta vinculada', token);
        } else {
          await openFolderInBrowser(parsed.id, 'Pasta vinculada', null);
        }
      } else {
        await openFolderInBrowser(parsed.id, 'Pasta vinculada');
      }
      return;
    }

    const inferred = inferMaterialTypesFromUrl(parsed.cleanUrl);
    const tempMat: StudyMaterial = {
      id: `quick_${Date.now()}`,
      ownerId: user?.uid || 'local',
      title:
        parsed.kind === 'spreadsheet'
          ? 'Planilha Google'
          : parsed.kind === 'presentation'
            ? 'Apresentação Google Slides / PowerPoint'
            : 'Material / Link do Google Drive',
      disciplineId: 'processo_legislativo',
      fileType: inferred.fileType,
      institution: 'Google Workspace',
      url: parsed.cleanUrl,
      isShared: false,
      isOfficialContent: false,
    };

    if (parsed.id && workspaceAccessToken) {
      try {
        const meta = await getDriveFileMetadata(workspaceAccessToken, parsed.id);
        tempMat.title = meta.name;
      } catch {
        // Keep friendly fallback title
      }
    }

    await openViewer(tempMat);
  };

  const geralMaterials = materials.filter((m) => m.campusLevel === 'geral' || isGeralMaterial(m));
  const medioMaterials = materials.filter((m) => {
    if (m.campusLevel === 'medio') return true;
    if (m.campusLevel === 'superior' || m.campusLevel === 'geral' || isGeralMaterial(m)) return false;
    return isMedioDisciplineId(m.disciplineId) || Boolean(m.libraryCategoryId?.startsWith('nm_cat_'));
  });
  const superiorMaterials = materials.filter((m) => {
    if (m.campusLevel === 'superior') return true;
    if (m.campusLevel === 'medio' || m.campusLevel === 'geral' || isGeralMaterial(m)) return false;
    return !isMedioDisciplineId(m.disciplineId) && !m.libraryCategoryId?.startsWith('nm_cat_');
  });

  const campusMaterials = standardizeMaterialCatalog(
    libraryScope === 'geral'
      ? geralMaterials
      : libraryScope === 'medio'
        ? medioMaterials
        : superiorMaterials
  );

  // Safeguard unused reference check
  void MEDIO_DEFAULT_MATERIALS;
  void GERAL_DEFAULT_MATERIALS;

  const favoriteMaterialIds = preferences.favoriteMaterialIds || [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = campusMaterials.filter((m) => {
    if (onlyFavorites && !favoriteMaterialIds.includes(m.id)) return false;
    if (selectedCategory !== 'all') {
      const cat = activeCategories.find((c) => c.id === selectedCategory);
      const matchesCat = m.libraryCategoryId
        ? m.libraryCategoryId === selectedCategory
        : cat
          ? m.disciplineId === cat.disciplineId
          : false;
      if (!matchesCat) return false;
    }
    if (resourceFilter !== 'all') {
      const matRes = m.resourceType || (m.fileType === 'video' ? 'video' : 'pdf');
      if (matRes !== resourceFilter) return false;
    }
    if (originFilter === 'official' && !m.isOfficialContent) return false;
    if (originFilter === 'complementary' && m.isOfficialContent) return false;
    if (relevanceFilter !== 'all' && inferMaterialRelevance(m) !== relevanceFilter) return false;
    if (normalizedQuery) {
      const haystack = `${m.title} ${m.description || ''} ${m.editalTopic || ''} ${m.institution || ''}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });

  const closeViewer = () => {
    if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
    setViewerMaterial(null);
    setViewerLoading(false);
    setViewerBlobUrl(null);
    setViewerFileName(null);
    setExcelSheets([]);
    setActiveSheetIdx(0);
    setGoogleSlides([]);
    setSlidesViewMode('preview');
    setSheetViewMode('api');
    setViewerFolderItems([]);
    setViewerFolderTrail([]);
    setViewerError(null);
  };

  const loadFolderInsideViewer = async (folderId: string, folderName: string, resetTrail = false) => {
    if (!workspaceAccessToken) return;
    setViewerLoading(true);
    setViewerError(null);
    try {
      const items = await listDriveFiles({
        accessToken: workspaceAccessToken,
        folderId,
      });
      setViewerFolderItems(items);
      setViewerFolderTrail((prev) =>
        resetTrail ? [{ id: folderId, name: folderName }] : [...prev, { id: folderId, name: folderName }]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar pasta do Google Drive.';
      if (msg === 'AUTH_EXPIRED') {
        clearWorkspaceToken();
        setViewerError('A autorização do Google Drive expirou. Clique em "Conectar Google Drive" para continuar.');
      } else {
        setViewerError(msg);
      }
    } finally {
      setViewerLoading(false);
    }
  };

  const openViewer = async (material: StudyMaterial) => {
    closeViewer();
    if (isMaterialPendingDefinition(material)) {
      setFeedback('Este item está reservado com definição pendente até esclarecimento.');
      return;
    }
    if (isInAppReadableMaterial(material)) {
      setBookReaderMaterial(material);
      return;
    }
    setViewerMaterial(material);

    if (material.url.startsWith('local://')) {
      const localKey = material.url.replace('local://', '');
      const record = await getLocalFile(localKey);
      if (!record) {
        setViewerError(
          'Este arquivo local foi salvo em outro dispositivo. Para abrir em qualquer aparelho, vincule um link ou pasta do Google Drive.'
        );
        return;
      }

      setViewerFileName(record.fileName);
      const blob = new Blob([record.buffer], { type: record.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      setViewerBlobUrl(blobUrl);

      if (material.fileType === 'xlsx' || /\.(xlsx|xls|csv)$/i.test(record.fileName)) {
        try {
          const wb = XLSX.read(record.buffer, { type: 'array' });
          const parsedSheets = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false }) as string[][];
            return { name, rows: rows.slice(0, 150) };
          });
          setExcelSheets(parsedSheets);
        } catch {
          setViewerError('Não foi possível ler as abas desta planilha Excel.');
        }
      }
      return;
    }

    const parsed = parseGoogleWorkspaceUrl(material.url);
    if (!parsed.id) return;

    // 1. Google Drive Folder
    if (parsed.kind === 'folder') {
      if (workspaceAccessToken) {
        await loadFolderInsideViewer(parsed.id, material.title, true);
      }
      return;
    }

    // 2. Google Sheets (read tabs + cells via Google Sheets API v4)
    if (parsed.kind === 'spreadsheet') {
      if (!workspaceAccessToken) {
        setSheetViewMode('preview');
        return;
      }
      setViewerLoading(true);
      try {
        const data = await fetchGoogleSpreadsheet(workspaceAccessToken, parsed.id);
        setExcelSheets(data.sheets);
        setSheetViewMode('api');
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'AUTH_EXPIRED') {
          clearWorkspaceToken();
        }
        setSheetViewMode('preview');
      } finally {
        setViewerLoading(false);
      }
      return;
    }

    // 3. Google Slides (fetch slide outline & speaker notes via Slides API v1, plus /preview iframe)
    if (parsed.kind === 'presentation') {
      if (!workspaceAccessToken) {
        setSlidesViewMode('preview');
        return;
      }
      setViewerLoading(true);
      try {
        const pres = await fetchGooglePresentation(workspaceAccessToken, parsed.id);
        setGoogleSlides(pres.slides);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'AUTH_EXPIRED') {
          clearWorkspaceToken();
        }
      } finally {
        setViewerLoading(false);
      }
      return;
    }

    // 4. Generic Google Drive File (.xlsx, .pptx, .pdf stored in Drive)
    if (parsed.kind === 'drive_file' && workspaceAccessToken) {
      setViewerLoading(true);
      try {
        const meta = await getDriveFileMetadata(workspaceAccessToken, parsed.id);
        setViewerFileName(meta.name);

        if (isSpreadsheetDriveItem(meta)) {
          const buffer = await downloadDriveFileBuffer(workspaceAccessToken, parsed.id);
          const blobUrl = URL.createObjectURL(new Blob([buffer], { type: meta.mimeType }));
          setViewerBlobUrl(blobUrl);
          const wb = XLSX.read(buffer, { type: 'array' });
          const parsedSheets = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false }) as string[][];
            return { name, rows: rows.slice(0, 150) };
          });
          setExcelSheets(parsedSheets);
          setSheetViewMode('api');
        } else if (meta.mimeType === DRIVE_MIME.PDF || meta.name.toLowerCase().endsWith('.pdf')) {
          const buffer = await downloadDriveFileBuffer(workspaceAccessToken, parsed.id);
          const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
          setViewerBlobUrl(blobUrl);
        } else if (isPresentationDriveItem(meta)) {
          const buffer = await downloadDriveFileBuffer(workspaceAccessToken, parsed.id);
          const blobUrl = URL.createObjectURL(new Blob([buffer], { type: meta.mimeType }));
          setViewerBlobUrl(blobUrl);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'AUTH_EXPIRED') {
          clearWorkspaceToken();
        }
        // Falls back cleanly to Drive /preview iframe
      } finally {
        setViewerLoading(false);
      }
    }
  };

  const handleDownloadWorkspaceExport = async (material: StudyMaterial, target: 'xlsx' | 'pptx') => {
    if (!workspaceAccessToken) return;
    const parsed = parseGoogleWorkspaceUrl(material.url);
    if (!parsed.id) return;
    setViewerLoading(true);
    try {
      const mime = target === 'xlsx' ? DRIVE_MIME.XLSX : DRIVE_MIME.PPTX;
      const buffer = await exportGoogleWorkspaceFile(workspaceAccessToken, parsed.id, mime);
      const blob = new Blob([buffer], { type: mime });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${material.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.${target}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : 'Não foi possível exportar este arquivo.');
    } finally {
      setViewerLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) {
      setFileType('pdf');
      setResourceType('pdf');
    } else if (lower.endsWith('.epub')) {
      setFileType('epub');
      setResourceType('livro_digital');
    } else if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
      setFileType('pptx');
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      setFileType('xlsx');
    }
  };

  const handleUrlInputChange = (nextUrl: string) => {
    setUrl(nextUrl);
    if (nextUrl.trim()) {
      const inferred = inferMaterialTypesFromUrl(nextUrl);
      setFileType(inferred.fileType);
      if (inferred.resourceType === 'video' || inferred.resourceType === 'podcast') {
        setResourceType(inferred.resourceType);
      }
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    setUploadProgress(null);
    try {
      let finalUrl = url.trim();
      let finalFileName = '';
      let storageProvider: StudyMaterial['storageProvider'] = 'external';
      let storagePath: string | undefined;
      let checksumSha256: string | undefined;
      let fileSizeBytes: number | undefined;
      let createdStorageMetaId: string | null = null;
      let savedInLocalBrowserOnly = false;

      if (selectedFile) {
        finalFileName = selectedFile.name;
        fileSizeBytes = selectedFile.size;
        if (canUploadFilesToCloud && user) {
          setUploadProgress(1);
          try {
            const uploaded = await uploadFileToCloudStorage({
              file: selectedFile,
              uploaderUid: user.uid,
              folder: 'campus-materials',
              onProgress: (pct) => setUploadProgress(pct),
            });
            finalUrl = uploaded.downloadUrl;
            storageProvider = 'firebase_storage';
            storagePath = uploaded.objectPath;
            checksumSha256 = uploaded.checksumSha256;
            createdStorageMetaId = await registerStorageMetadata({
              fileName: selectedFile.name,
              mimeType: uploaded.mimeType || inferMaterialMimeType(selectedFile),
              sizeBytes: uploaded.sizeBytes,
              checksumSha256: uploaded.checksumSha256,
              storageProvider: 'firebase_storage',
              bucket: uploaded.bucket,
              objectPath: uploaded.objectPath,
              downloadUrl: uploaded.downloadUrl,
              category: inferStorageCategory(uploaded.mimeType, selectedFile.name),
              campusLevel: modalScope,
              version: 1,
            });
          } catch (uploadErr) {
            throw new Error(mapCloudStorageError(uploadErr));
          } finally {
            setUploadProgress(null);
          }
        } else {
          const key = `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await saveLocalFile(key, selectedFile);
          finalUrl = `local://${key}`;
          storageProvider = 'local';
          savedInLocalBrowserOnly = true;
        }
      } else if (finalUrl.startsWith('local://')) {
        storageProvider = 'local';
        savedInLocalBrowserOnly = true;
      } else if (finalUrl.includes('drive.google.com') || finalUrl.includes('docs.google.com')) {
        storageProvider = 'google_drive';
      }

      if (!finalUrl) {
        throw new Error('Informe um link (Pasta do Google Drive, Planilha, PowerPoint, PDF) ou selecione um arquivo.');
      }

      const selectedCatObj = modalCategories.find((c) => c.id === categoryId) || modalCategories[0];
      const effectiveIsShared = !savedInLocalBrowserOnly && canPublishShared ? isShared : false;
      const effectiveStatus: StudyMaterial['status'] = savedInLocalBrowserOnly
        ? 'draft'
        : canPublishShared
          ? effectiveIsShared
            ? 'published'
            : 'draft'
          : canAccessTeacherPanel && selectedFile
            ? 'in_review'
            : 'draft';

      const createdMaterialId = await addMaterial({
        title,
        disciplineId: selectedCatObj.disciplineId,
        libraryCategoryId: selectedCatObj.id,
        editalTopic: editalTopic.trim() || selectedCatObj.title,
        resourceType,
        fileType,
        institution:
          institution.trim() ||
          (modalScope === 'geral'
            ? 'Biblioteca Geral (Comum aos 2 níveis)'
            : modalScope === 'medio'
              ? 'Acervo Nível Médio · Cargo 04 (PL.AL.060)'
              : 'Acervo Nível Superior · Cargo 03 (PL.AL.102)'),
        url: finalUrl,
        pricing,
        publishedAt,
        lastVerifiedAt,
        linkStatus,
        isOfficialContent,
        campusLevel: modalScope,
        storageProvider,
        storagePath,
        checksumSha256,
        fileSizeBytes,
        fileName: finalFileName,
        description,
        isShared: effectiveIsShared,
        status: effectiveStatus,
      });

      if (createdStorageMetaId && createdMaterialId) {
        await updateStorageMetadataRecord(createdStorageMetaId, {
          linkedMaterialId: createdMaterialId,
          campusLevel: modalScope,
        });
      }

      setShowAddModal(false);
      setQuickAddTab('closed');
      setTitle('');
      setEditalTopic('');
      setInstitution('');
      setUrl('');
      setDescription('');
      setSelectedFile(null);
      if (savedInLocalBrowserOnly) {
        setFeedback(
          'Arquivo salvo exclusivamente no armazenamento local deste dispositivo/navegador (não compartilhado com outros aparelhos).'
        );
      } else if (selectedFile && canUploadFilesToCloud) {
        setFeedback(
          effectiveIsShared
            ? 'Arquivo enviado ao Firebase Storage e publicado na nuvem para todos os dispositivos.'
            : canPublishShared
              ? 'Arquivo enviado ao Firebase Storage como rascunho na nuvem.'
              : 'Arquivo enviado ao Firebase Storage na nuvem e encaminhado para revisão editorial.'
        );
      } else {
        setFeedback('Material / link catalogado na biblioteca digital.');
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao salvar material.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleRemediateLocalMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remediatingMaterial) return;
    setRemediatingBusy(true);
    setFeedback(null);
    try {
      let nextUrl = remediateUrl.trim();
      let nextFileName = remediatingMaterial.fileName || '';
      let nextStorageProvider: StudyMaterial['storageProvider'] = 'external';
      let nextStoragePath: string | undefined;
      let nextChecksum: string | undefined;
      let nextSize: number | undefined;

      if (remediateFile) {
        if (!canUploadFilesToCloud || !user) {
          throw new Error(
            'Apenas contas de professor, editor ou administrador verificadas podem migrar arquivos diretamente para o Firebase Storage. Visitantes e estudantes devem vincular um link público ou do Google Drive.'
          );
        }
        const uploaded = await uploadFileToCloudStorage({
          file: remediateFile,
          uploaderUid: user.uid,
          folder: 'campus-materials',
        });
        nextUrl = uploaded.downloadUrl;
        nextFileName = remediateFile.name;
        nextStorageProvider = 'firebase_storage';
        nextStoragePath = uploaded.objectPath;
        nextChecksum = uploaded.checksumSha256;
        nextSize = uploaded.sizeBytes;
        await registerStorageMetadata({
          fileName: remediateFile.name,
          mimeType: uploaded.mimeType || inferMaterialMimeType(remediateFile),
          sizeBytes: uploaded.sizeBytes,
          checksumSha256: uploaded.checksumSha256,
          storageProvider: 'firebase_storage',
          bucket: uploaded.bucket,
          objectPath: uploaded.objectPath,
          downloadUrl: uploaded.downloadUrl,
          category: inferStorageCategory(uploaded.mimeType, remediateFile.name),
          campusLevel: remediatingMaterial.campusLevel || modalScope,
          linkedMaterialId: remediatingMaterial.id,
          version: (remediatingMaterial.version || 1) + 1,
        });
      } else {
        if (!nextUrl || (!nextUrl.startsWith('http://') && !nextUrl.startsWith('https://') && !nextUrl.startsWith('/assets/'))) {
          throw new Error('Informe uma URL pública válida (https://...) ou selecione o arquivo para enviar à nuvem.');
        }
        if (nextUrl.includes('drive.google.com') || nextUrl.includes('docs.google.com')) {
          nextStorageProvider = 'google_drive';
        }
      }

      await updateMaterial(remediatingMaterial.id, {
        url: nextUrl,
        fileName: nextFileName,
        storageProvider: nextStorageProvider,
        storagePath: nextStoragePath,
        checksumSha256: nextChecksum,
        fileSizeBytes: nextSize,
        version: (remediatingMaterial.version || 1) + 1,
        versionNote: 'Migrado de armazenamento local (local://) para nuvem sem perda do registro original.',
        ...(canPublishShared ? { status: 'published', isShared: true } : {}),
      });

      setRemediatingMaterial(null);
      setRemediateUrl('');
      setRemediateFile(null);
      setFeedback(
        'Registro local:// atualizado com segurança para acesso em nuvem, preservando o registro e o histórico originais.'
      );
    } catch (err) {
      setFeedback(err instanceof Error ? mapCloudStorageError(err) : 'Não foi possível migrar o material.');
    } finally {
      setRemediatingBusy(false);
    }
  };

  const handleDelete = async (material: StudyMaterial) => {
    if (material.url.startsWith('local://')) {
      await deleteLocalFile(material.url.replace('local://', ''));
    }
    await deleteMaterial(material.id);
  };

  const embedUrl = viewerMaterial ? buildEmbedUrl(viewerMaterial) : null;
  const viewerParsed = viewerMaterial ? parseGoogleWorkspaceUrl(viewerMaterial.url) : null;
  const isViewerFolder = viewerParsed?.kind === 'folder';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
            {libraryScope === 'geral'
              ? 'Aba Geral · Matérias comuns aos 2 níveis'
              : libraryScope === 'medio'
                ? 'Aba Conteúdo · Nível Médio (Cargo 04 · PL.AL.060)'
                : 'Aba Conteúdo · Nível Superior (Cargo 03 · PL.AL.102)'}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {libraryScope === 'geral'
              ? 'Geral · Disciplinas Comuns'
              : libraryScope === 'medio'
                ? 'Conteúdo · Nível Médio'
                : 'Conteúdo · Nível Superior'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowOfficialSources((v) => !v)}
            className={`min-h-[42px] px-3 py-2 border text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap ${
              showOfficialSources
                ? 'border-[#0B3321] bg-emerald-50 text-[#0B3321] dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Scale className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
            <span>Fontes</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDriveTools((v) => !v)}
            className={`min-h-[42px] px-3.5 py-2 border text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap ${
              showDriveTools
                ? 'border-[#0B3321] bg-emerald-50 text-[#0B3321] dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
            <span>{showDriveTools ? 'Ocultar Drive' : 'Google Drive'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalScope(libraryScope);
              const selectedCat =
                selectedCategory !== 'all'
                  ? activeCategories.find((c) => c.id === selectedCategory)
                  : undefined;
              setCategoryId(selectedCat ? selectedCat.id : activeCategories[0].id);
              setIsShared(canPublishShared);
              setShowAddModal(true);
            }}
            className="min-h-[42px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Incluir conteúdo</span>
          </button>
        </div>
      </div>

      {/* Abas Principais: Geral × Conteúdo (com escolha Superior / Médio dentro de Conteúdo) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleChangeScope('geral')}
            className={`min-h-[54px] px-3.5 py-2.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
              libraryScope === 'geral'
                ? 'border-[#0B3321] bg-[#0B3321] text-white'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 hover:border-slate-300 text-slate-900 dark:text-slate-100'
            }`}
          >
            <div className="min-w-0">
              <p className="font-display text-sm sm:text-base font-bold truncate">Geral</p>
              <p className={`text-[11px] truncate ${libraryScope === 'geral' ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'}`}>
                Matérias comuns ({geralMaterials.length})
              </p>
            </div>
            <span
              className={`font-mono text-xs font-bold shrink-0 ${
                libraryScope === 'geral' ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'
              }`}
            >
              {GERAL_LIBRARY_CATEGORIES.length} disc.
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleChangeScope(isMedio ? 'medio' : 'superior')}
            className={`min-h-[54px] px-3.5 py-2.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
              libraryScope !== 'geral'
                ? 'border-[#0B3321] bg-[#0B3321] text-white'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 hover:border-slate-300 text-slate-900 dark:text-slate-100'
            }`}
          >
            <div className="min-w-0">
              <p className="font-display text-sm sm:text-base font-bold truncate">Conteúdo</p>
              <p className={`text-[11px] truncate ${libraryScope !== 'geral' ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'}`}>
                {libraryScope === 'medio' || (libraryScope === 'geral' && isMedio)
                  ? `Nível Médio (${medioMaterials.length})`
                  : `Nível Superior (${superiorMaterials.length})`}
              </p>
            </div>
            <span
              className={`font-mono text-xs font-bold shrink-0 ${
                libraryScope !== 'geral' ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'
              }`}
            >
              {isMedio ? MEDIO_LIBRARY_CATEGORIES.length : LIBRARY_CATEGORIES.length} disc.
            </span>
          </button>
        </div>

        {/* Seletor rápido de Cargo dentro da Aba Conteúdo */}
        {libraryScope !== 'geral' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  handleChangeScope('superior');
                  onChangeCampus?.('superior');
                }}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  libraryScope === 'superior'
                    ? 'bg-white dark:bg-slate-900 text-[#0B3321] dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Superior · Cargo 03 ({superiorMaterials.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  handleChangeScope('medio');
                  onChangeCampus?.('medio');
                }}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  libraryScope === 'medio'
                    ? 'bg-white dark:bg-slate-900 text-[#0B3321] dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Médio · Cargo 04 ({medioMaterials.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowOrgMatrix((v) => !v)}
              className="text-xs font-semibold text-[#0B3321] dark:text-emerald-400 hover:underline"
            >
              {showOrgMatrix ? 'Ocultar matriz' : 'Ver matriz de compartilhamento'}
            </button>
          </div>
        )}
      </section>

      {/* Histórico & Continuar Leitura Digital */}
      {(() => {
        const recentReadings = Object.values(readingProgressMap)
          .filter((rp) => rp.totalPages > 0)
          .sort((a, b) => (b.lastReadAt || '').localeCompare(a.lastReadAt || ''))
          .slice(0, 4);
        if (recentReadings.length === 0) return null;
        return (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">Leitor Digital Integrado</p>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Continuar leitura de onde você parou
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {recentReadings.length} {recentReadings.length === 1 ? 'livro recente' : 'livros recentes'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentReadings.map((rp) => {
                const matchedMat =
                  materials.find(
                    (m) => m.id === rp.materialId || getMaterialProgressKey(m.id) === rp.materialId
                  ) ||
                  (rp.materialId.startsWith('drive_')
                    ? ({
                        id: rp.materialId,
                        ownerId: 'google_drive',
                        title: rp.materialTitle,
                        disciplineId: 'processo_legislativo',
                        fileType: 'pdf',
                        institution: 'Google Drive',
                        url: `https://drive.google.com/file/d/${rp.materialId.replace(/^drive_/, '')}/view`,
                        isShared: false,
                      } satisfies StudyMaterial)
                    : null);
                const formattedDate = rp.lastReadAt
                  ? new Date(rp.lastReadAt).toLocaleDateString('pt-BR')
                  : '';

                return (
                  <div
                    key={rp.materialId}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2">{rp.materialTitle}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                        Pág. {rp.lastPage}/{rp.totalPages} · {rp.progressPercent}%
                      </p>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-[#146C43] rounded-full"
                          style={{ width: `${Math.min(100, Math.max(2, rp.progressPercent))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {rp.bookmarks.length} marc. · {rp.highlights.length} dest. · {rp.annotations.length} notas
                        {formattedDate ? ` · ${formattedDate}` : ''}
                      </p>
                    </div>
                    {matchedMat ? (
                      <button
                        type="button"
                        onClick={() => void openViewer(matchedMat)}
                        className="min-h-[38px] w-full px-3 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Continuar leitura</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Material removido do acervo
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Aba dedicada para Adicionar PDF, Vídeo, Podcast e Outros */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">
              Cadastro rápido ·{' '}
              {libraryScope === 'geral'
                ? 'Geral (Comum)'
                : libraryScope === 'medio'
                  ? 'Nível Médio'
                  : 'Nível Superior (Cargo 03 · Analista Adm.)'}
            </p>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Aba para adicionar PDF, Vídeo, Podcast e Outros
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-fit">
            {(
              [
                { id: 'pdf', label: 'PDF', icon: FileText },
                { id: 'video', label: 'Vídeo', icon: Video },
                { id: 'podcast', label: 'Podcast', icon: Headphones },
                { id: 'outros', label: 'Outros', icon: FolderOpen },
              ] as const
            ).map((tab) => {
              const TabIcon = tab.icon;
              const active = quickAddTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (active) {
                      setQuickAddTab('closed');
                    } else {
                      applyQuickKind(tab.id);
                      setQuickAddTab(tab.id);
                    }
                  }}
                  className={`min-h-[44px] sm:min-h-[38px] px-3.5 py-2 sm:py-1.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    active ? 'bg-[#0B3321] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>+ {tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {quickAddTab !== 'closed' && (
          <form onSubmit={handleCreateMaterial} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {quickAddTab === 'pdf' && 'Título do PDF / EPUB / Apostila'}
                  {quickAddTab === 'video' && 'Título da Videoaula'}
                  {quickAddTab === 'podcast' && 'Título do Podcast / Episódio Spotify'}
                  {quickAddTab === 'outros' && 'Título do material, legislação, planilha ou pasta'}
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    quickAddTab === 'pdf'
                      ? 'Ex.: Apostila Administração PODC e PDCA (PDF/EPUB)'
                      : quickAddTab === 'video'
                        ? 'Ex.: Aula 01 – Processo Legislativo e Técnica Legislativa'
                        : quickAddTab === 'podcast'
                          ? 'Ex.: Episódio Spotify – Lei de Responsabilidade Fiscal'
                          : 'Ex.: Planilha de Controle / Legislação / Pasta Drive'
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Disciplina</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value as LibraryCategoryId)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {modalCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {String(c.order).padStart(2, '0')} · {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {quickAddTab === 'outros' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo / Formato</label>
                  <select
                    value={resourceType}
                    onChange={(e) => {
                      const next = e.target.value as ResourceType;
                      setResourceType(next);
                      if (next === 'legislacao' || next === 'livro_digital' || next === 'questoes' || next === 'simulado') {
                        setFileType('pdf');
                      }
                    }}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="legislacao">Legislação / Lei Seca</option>
                    <option value="livro_digital">Livro Digital</option>
                    <option value="curso">Curso / Slides / Planilha</option>
                    <option value="questoes">Banco de Questões / PCI</option>
                    <option value="simulado">Simulado</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Instituição / Fonte</label>
                  <input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder={
                      quickAddTab === 'podcast'
                        ? 'Ex.: Spotify / Rádio Senado'
                        : quickAddTab === 'video'
                          ? 'Ex.: YouTube / TV Senado'
                          : 'Ex.: ALEPA / ENAP / Próprio'
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className={quickAddTab === 'pdf' || quickAddTab === 'outros' ? 'lg:col-span-7' : 'lg:col-span-9'}>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {quickAddTab === 'pdf' && 'Link do PDF, EPUB ou Google Drive'}
                  {quickAddTab === 'video' && 'Link do Vídeo (YouTube, Vimeo, Reels, TikTok ou Drive)'}
                  {quickAddTab === 'podcast' && 'Link do Podcast (Spotify, Rádio Senado, SoundCloud ou MP3)'}
                  {quickAddTab === 'outros' && 'Link do recurso (Google Drive, Planilha, Slides, Planalto, PCI)'}
                </label>
                <input
                  type="url"
                  value={url}
                  disabled={Boolean(selectedFile)}
                  onChange={(e) => handleUrlInputChange(e.target.value)}
                  placeholder={
                    quickAddTab === 'pdf'
                      ? 'https://.../apostila.pdf ou https://.../ebook.epub'
                      : quickAddTab === 'video'
                        ? 'https://www.youtube.com/watch?v=...'
                        : quickAddTab === 'podcast'
                          ? 'https://open.spotify.com/episode/... ou https://open.spotify.com/show/...'
                          : 'https://drive.google.com/... ou https://www.pciconcursos.com.br/...'
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                />
              </div>

              {(quickAddTab === 'pdf' || quickAddTab === 'outros') && (
                <div className="lg:col-span-2">
                  <label className="min-h-[40px] px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#0B3321] dark:text-emerald-400" />
                    <span className="truncate">{selectedFile ? selectedFile.name : 'Anexar arquivo'}</span>
                    <input
                      type="file"
                      accept={quickAddTab === 'pdf' ? '.pdf,.epub' : '.pdf,.epub,.ppt,.pptx,.xls,.xlsx,.csv'}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div className="lg:col-span-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddTab('closed');
                    setSelectedFile(null);
                  }}
                  className="min-h-[40px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[40px] px-4 py-1.5 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-50 text-white text-xs font-semibold rounded-xl whitespace-nowrap"
                >
                  {submitting
                    ? 'Salvando...'
                    : `Salvar ${
                        quickAddTab === 'pdf'
                          ? 'PDF / E-book'
                          : quickAddTab === 'video'
                            ? 'Vídeo'
                            : quickAddTab === 'podcast'
                              ? 'Podcast'
                              : 'Material'
                      }`}
                </button>
              </div>
            </div>

            {canPublishShared && (!selectedFile || canUploadFilesToCloud) && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                />
                <span>Compartilhar com familiares e turma na nuvem (visível no celular e PC)</span>
              </label>
            )}
            {selectedFile && !canUploadFilesToCloud && (
              <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <strong>Somente neste dispositivo:</strong> no perfil estudante/visitante, arquivos anexados ficam salvos exclusivamente no armazenamento local deste navegador (não sincronizam nem ficam visíveis em outros aparelhos).
              </p>
            )}
            {selectedFile && canUploadFilesToCloud && (
              <p className="text-xs text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                {uploadProgress !== null
                  ? `Enviando arquivo para o Firebase Storage (${uploadProgress}%)...`
                  : canPublishShared
                    ? 'Envio em nuvem (Firebase Storage) ativado para este perfil: o PDF/EPUB poderá ser aberto em qualquer dispositivo.'
                    : 'Envio em nuvem (Firebase Storage) ativado: o arquivo será armazenado na nuvem e enviado para revisão editorial antes da publicação geral.'}
              </p>
            )}
          </form>
        )}

        {feedback && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium">
            {feedback}
          </div>
        )}
      </section>

      {/* Disciplinas DENTRO da Aba Geral ou DENTRO da Aba Conteúdo (visível imediatamente no celular) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">
              {libraryScope === 'geral'
                ? 'Disciplinas dentro de Geral (comum aos 2 níveis)'
                : libraryScope === 'medio'
                  ? 'Disciplinas dentro de Conteúdo · Nível Médio (PL.AL.060)'
                  : 'Disciplinas dentro de Conteúdo · Nível Superior (PL.AL.102)'}
            </p>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Escolha a Disciplina ({activeCategories.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {selectedCategory !== 'all' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModalScope(libraryScope);
                    setCategoryId(selectedCategory);
                    setIsShared(canPublishShared);
                    setShowAddModal(true);
                  }}
                  className="min-h-[34px] px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-300 text-xs font-semibold rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Incluir nesta disciplina</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline whitespace-nowrap"
                >
                  Ver todas
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {activeCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const countInCat = campusMaterials.filter((m) =>
              m.libraryCategoryId ? m.libraryCategoryId === cat.id : m.disciplineId === cat.disciplineId
            ).length;
            const sharingLabel = 'sharingLabel' in cat ? String((cat as { sharingLabel?: string }).sharingLabel) : null;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`text-left p-3 rounded-xl border transition-colors flex flex-col justify-between gap-1.5 min-h-[86px] ${
                  isSelected
                    ? 'border-[#0B3321] bg-[#0B3321] text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 font-mono text-[10px] tabular-nums">
                  <span className={isSelected ? 'text-emerald-200 font-bold' : 'text-[#0B3321] dark:text-emerald-400 font-bold'}>
                    {String(cat.order).padStart(2, '0')}
                  </span>
                  <span className={isSelected ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'}>
                    {countInCat} {countInCat === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold leading-snug line-clamp-2">{cat.title}</p>
                  {sharingLabel && (
                    <p className={`text-[10px] font-semibold mt-0.5 truncate ${isSelected ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'}`}>
                      {sharingLabel}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Google Drive, Planilhas, PowerPoint & Pasta de Acesso (visível quando ativado pelo usuário) */}
      {(showDriveTools || driveBrowserOpen) && (
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
              Google Workspace · Acesso direto a pastas, Planilhas Google, Excel (.xlsx), Google Slides e PowerPoint (.pptx)
            </p>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Google Drive, Planilhas, PowerPoint e Pastas de Acesso
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Cole o link de uma pasta do Google Drive, planilha ou apresentação para abrir aqui dentro ou salvar na
              sua biblioteca de estudo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!workspaceAccessToken ? (
              <button
                type="button"
                disabled={driveConnecting}
                onClick={handleConnectDrive}
                className="min-h-[44px] px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2.5 shadow-2xs whitespace-nowrap"
              >
                <GoogleLogoSvg />
                <span>{driveConnecting ? 'Conectando...' : 'Conectar Google Drive (Sign in with Google)'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setDriveBrowserOpen((v) => !v)}
                  className="min-h-[42px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>{driveBrowserOpen ? 'Ocultar meu Drive' : 'Explorar Meu Google Drive'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  title="Trocar conta ou atualizar permissão"
                  className="min-h-[42px] px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar conta</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearWorkspaceToken();
                    setDriveItems([]);
                    setDriveBrowserOpen(false);
                  }}
                  title="Desconectar Google Drive nesta sessão"
                  className="min-h-[42px] px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Colar link ou pasta do Google Drive */}
        <div className="flex flex-col md:flex-row gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={quickLinkInput}
              onChange={(e) => setQuickLinkInput(e.target.value)}
              placeholder="Cole aqui o link da pasta do Drive (drive.google.com/drive/folders/...), Planilha Google ou PowerPoint/Slides..."
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!quickLinkInput.trim()}
              onClick={handleOpenQuickLink}
              className="min-h-[44px] px-4 py-2 bg-[#146C43] hover:bg-[#0B3321] disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Abrir pasta / arquivo</span>
            </button>
            <button
              type="button"
              disabled={!quickLinkInput.trim()}
              onClick={() => prefillModalFromUrlOrItem(quickLinkInput)}
              className="min-h-[44px] px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Salvar na biblioteca</span>
            </button>
          </div>
        </div>

        {driveError && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 flex items-center justify-between gap-3">
            <span>{driveError}</span>
            <button
              type="button"
              onClick={handleConnectDrive}
              className="px-3 py-1.5 bg-[#0B3321] text-white font-semibold rounded-lg whitespace-nowrap"
            >
              Conectar Google
            </button>
          </div>
        )}

        {/* Embedded Google Drive Folder & Files Browser */}
        {driveBrowserOpen && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Breadcrumbs */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {driveBreadcrumbs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextTrail = driveBreadcrumbs.slice(0, -1);
                      setDriveBreadcrumbs(nextTrail);
                      const parent = nextTrail[nextTrail.length - 1];
                      if (workspaceAccessToken) {
                        void loadDriveFolderContents(parent.id);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    aria-label="Voltar pasta"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {driveBreadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={`${crumb.id ?? 'root'}_${idx}`}>
                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <button
                      type="button"
                      onClick={() => {
                        const nextTrail = driveBreadcrumbs.slice(0, idx + 1);
                        setDriveBreadcrumbs(nextTrail);
                        if (workspaceAccessToken) {
                          void loadDriveFolderContents(crumb.id);
                        }
                      }}
                      className={`px-2 py-1 rounded-lg font-medium ${
                        idx === driveBreadcrumbs.length - 1
                          ? 'bg-[#0B3321] text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900'
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {currentFolder.id && (
                <button
                  type="button"
                  onClick={() =>
                    prefillModalFromUrlOrItem(
                      `https://drive.google.com/drive/folders/${currentFolder.id}`,
                      currentFolder.name,
                      'drive'
                    )
                  }
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                  <span>Salvar esta pasta na biblioteca</span>
                </button>
              )}
            </div>

            {!workspaceAccessToken ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center space-y-3">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  Conecte sua conta Google para listar e abrir os arquivos desta pasta diretamente aqui.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleConnectDrive}
                    className="min-h-[42px] px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold rounded-xl inline-flex items-center gap-2"
                  >
                    <GoogleLogoSvg />
                    <span>Conectar Google Drive</span>
                  </button>
                  {currentFolder.id && (
                    <a
                      href={`https://drive.google.com/drive/folders/${currentFolder.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-4 py-2 bg-[#0B3321] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <span>Abrir pasta no Google Drive</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Drive filter & search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl w-full md:w-auto max-w-full">
                    {(
                      [
                        { id: 'all', label: 'Todos' },
                        { id: 'folders', label: 'Pastas' },
                        { id: 'sheets', label: 'Planilhas' },
                        { id: 'slides', label: 'PowerPoint / Slides' },
                        { id: 'pdfs', label: 'PDFs' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDriveFilterKind(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
                          driveFilterKind === tab.id
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={driveSearch}
                        onChange={(e) => setDriveSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void loadDriveFolderContents(currentFolder.id);
                          }
                        }}
                        placeholder="Buscar no Drive..."
                        className="min-h-[36px] pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadDriveFolderContents(currentFolder.id)}
                      className="min-h-[36px] px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-medium rounded-lg"
                    >
                      Buscar
                    </button>
                  </div>
                </div>

                {driveLoading ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0B3321] dark:text-emerald-400" />
                    <span>Carregando arquivos e pastas do Google Drive...</span>
                  </div>
                ) : driveItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    Nenhuma pasta, planilha, apresentação ou PDF encontrado nesta visualização.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {driveItems.map((item) => {
                      const ItemIcon = getDriveItemIcon(item);
                      const isFolder = item.mimeType === DRIVE_MIME.FOLDER;
                      const matPreview = driveItemToStudyMaterial(item);
                      const modDate = item.modifiedTime
                        ? new Date(item.modifiedTime).toLocaleDateString('pt-BR')
                        : null;

                      return (
                        <div
                          key={item.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <ItemIcon
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                isFolder ? 'text-[#146C43] dark:text-emerald-400' : 'text-[#0B3321] dark:text-emerald-300'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {getDriveItemTypeLabel(item)}
                                {modDate ? ` · Atualizado em ${modDate}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isFolder ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDriveBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
                                }}
                                className="min-h-[34px] px-2.5 py-1 bg-[#0B3321] text-white text-[11px] font-semibold rounded-lg whitespace-nowrap"
                              >
                                Abrir pasta
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openViewer(matPreview)}
                                className="min-h-[34px] px-2.5 py-1 bg-[#0B3321] text-white text-[11px] font-semibold rounded-lg whitespace-nowrap"
                              >
                                Abrir
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                prefillModalFromUrlOrItem(matPreview.url, item.name, matPreview.fileType)
                              }
                              title="Vincular à biblioteca da disciplina"
                              className="min-h-[34px] px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium rounded-lg whitespace-nowrap"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
      )}

      {/* Matriz de Organização quando solicitada */}
      {showOrgMatrix && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Matriz: O que compartilhar na Biblioteca Geral × Específicas
            </h2>
            <button
              type="button"
              onClick={() => setShowOrgMatrix(false)}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline"
            >
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {CAMPUS_LIBRARY_RECOMMENDATIONS.map((rec) => (
              <div key={rec.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <p className="text-xs font-bold text-[#0B3321] dark:text-emerald-300">{rec.title}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{rec.description}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                  <th className="py-2.5 px-3 font-semibold">Disciplina</th>
                  <th className="py-2.5 px-3 font-semibold">Compartilhamento</th>
                  <th className="py-2.5 px-3 font-semibold">Onde organizar</th>
                  <th className="py-2.5 px-3 font-semibold">Critério prático</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {CAMPUS_ORGANIZATION_MATRIX.map((row) => (
                  <tr key={row.discipline} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.discipline}</td>
                    <td
                      className={`py-2.5 px-3 font-semibold whitespace-nowrap ${
                        row.kind === 'sim'
                          ? 'text-[#146C43] dark:text-emerald-400'
                          : row.kind === 'parcial'
                            ? 'text-amber-800 dark:text-amber-300'
                            : 'text-red-800 dark:text-red-400'
                      }`}
                    >
                      {row.ruleLabel}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {row.libraryPlacement}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{row.guidance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Central Inteligente: Busca + Relevância + Favoritos + 8 Tipos + Origem */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, assunto do edital, instituição ou palavra-chave..."
              className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl border inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                onlyFavorites
                  ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-200'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
              <span>
                Favoritos ({campusMaterials.filter((m) => favoriteMaterialIds.includes(m.id)).length})
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full lg:w-auto">
              {(
                [
                  { id: 'all', label: 'Toda relevância' },
                  { id: 'essencial', label: 'Essencial' },
                  { id: 'complementar', label: 'Complementar' },
                  { id: 'aprofundamento', label: 'Aprofundamento' },
                ] as const
              ).map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => setRelevanceFilter(rel.id)}
                  className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    relevanceFilter === rel.id
                      ? 'bg-[#0B3321] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {rel.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full xl:w-auto max-w-full">
            <button
              type="button"
              onClick={() => setResourceFilter('all')}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                resourceFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos os 8 tipos
            </button>
            {RESOURCE_TYPE_META.map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() => setResourceFilter(rt.id)}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  resourceFilter === rt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full xl:w-auto shrink-0">
            {(
              [
                { id: 'all', label: 'Tudo' },
                { id: 'official', label: 'Conteúdo Oficial' },
                { id: 'complementary', label: 'Complementar / Treino' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOriginFilter(opt.id)}
                className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  originFilter === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl px-4 py-3 text-sm font-medium">
          {feedback}
        </div>
      )}

      {(() => {
        const localRecords = materials.filter((m) => m.url.startsWith('local://'));
        if (localRecords.length === 0) return null;
        return (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {localRecords.length}{' '}
                  {localRecords.length === 1
                    ? 'material salvo apenas neste dispositivo (local://)'
                    : 'materiais salvos apenas neste dispositivo (local://)'}
                </p>
                <p className="text-amber-900/90 dark:text-amber-300/90 mt-0.5">
                  Itens locais ficam disponíveis somente no navegador em que foram enviados e não abrem em outros celulares ou computadores. Nenhum registro original é apagado automaticamente; você pode migrá-los com segurança nos cartões abaixo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRemediatingMaterial(localRecords[0]);
                setRemediateUrl('');
                setRemediateFile(null);
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Corrigir 1º item local://
            </button>
          </div>
        );
      })()}

      {/* Cataloged Materials Grid with full 11 metadata attributes */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-600 dark:text-slate-300 space-y-2">
          <p className="font-medium text-slate-800 dark:text-slate-100">Nenhum material catalogado para essa combinação de filtros.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Você pode alterar os filtros acima ou clicar em "Incluir conteúdo" para cadastrar um novo recurso
            ou pasta do Google Drive nesta categoria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((mat) => {
            const Icon = getMaterialIcon(mat);
            const catalogDesc = describeMaterialForCatalog(mat);
            const isPendingDef = catalogDesc.isPendingDefinition;
            const isLocal = mat.url.startsWith('local://');
            const allowDownload = mat.allowDownload !== false;
            const isInAppBook = !isPendingDef && isInAppReadableMaterial(mat);
            const isFavorited = favoriteMaterialIds.includes(mat.id);
            const readingProgress =
              readingProgressMap[getMaterialProgressKey(mat.id)] || readingProgressMap[mat.id];
            const parsedUrl = parseGoogleWorkspaceUrl(mat.url);
            const ytId = extractYouTubeId(mat.url);
            const isVideoMat =
              Boolean(ytId) ||
              mat.fileType === 'video' ||
              mat.resourceType === 'video' ||
              /instagram\.com|tiktok\.com|vimeo\.com/i.test(mat.url);
            const uid = user?.uid || profile?.uid;
            const canDelete = !mat.isSystemDefault && (isAdmin || mat.ownerId === uid);
            const canOrganize = canPublishShared || (!mat.isSystemDefault && mat.ownerId === uid);
            const resLabel =
              ytId
                ? 'YouTube'
                : mat.fileType === 'drive' && parsedUrl.kind === 'folder'
                  ? 'Pasta do Google Drive'
                  : mat.resourceType
                    ? RESOURCE_LABELS[mat.resourceType]
                    : FILE_TYPE_LABELS[mat.fileType];
            const catTitle =
              activeCategories.find((c) => c.id === mat.libraryCategoryId)?.title ||
              getDisciplineShortName(mat.disciplineId);

            return (
              <article
                key={mat.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      {ytId ? (
                        <YouTubeBrandIcon className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4 text-[#0B3321] dark:text-emerald-400" />
                      )}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{resLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{catTitle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPendingDef ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-semibold text-[11px]">
                          Definição pendente
                        </span>
                      ) : (
                        <span className={mat.isOfficialContent ? 'font-semibold text-[#146C43] dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300 font-medium'}>
                          {inferMaterialRelevance(mat) === 'essencial'
                            ? 'Essencial'
                            : inferMaterialRelevance(mat) === 'aprofundamento'
                              ? 'Aprofundamento'
                              : 'Complementar'}{' '}
                          · {mat.isOfficialContent ? 'Oficial' : 'Treino'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void toggleFavoriteMaterial(mat.id)}
                        aria-label={isFavorited ? `Remover ${mat.title} dos favoritos` : `Salvar ${mat.title} nos favoritos`}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isFavorited
                            ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {ytId && (
                    <button
                      type="button"
                      onClick={() => openViewer(mat)}
                      aria-label={`Dar play em ${mat.title}`}
                      className="group relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 text-left"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={mat.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors" />
                      <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/95 text-slate-900 text-[11px] font-bold">
                        <YouTubeBrandIcon className="w-3.5 h-3.5" />
                        <span>YouTube</span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </button>
                  )}

                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{mat.title}</h2>
                  {mat.subtitle && (
                    <p className="text-xs font-medium text-[#146C43] dark:text-emerald-400">{mat.subtitle}</p>
                  )}
                  {mat.description && <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{mat.description}</p>}
                  {mat.chapters && mat.chapters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {mat.chapters.slice(0, 4).map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            if (isInAppBook) {
                              setBookReaderInitialPage(ch.startPage);
                              setBookReaderInitialChapterId(ch.id);
                              setBookReaderMaterial(mat);
                            } else {
                              void openViewer(mat);
                            }
                          }}
                          className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:border-[#146C43]"
                        >
                          {ch.title}
                          {ch.startPage ? ` (p. ${ch.startPage})` : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {isLocal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-semibold">
                        <Smartphone className="w-3 h-3" />
                        <span>Somente neste dispositivo (local)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-[#146C43] dark:text-emerald-300 font-semibold">
                        <Cloud className="w-3 h-3" />
                        <span>
                          {mat.storageProvider === 'firebase_storage'
                            ? 'Nuvem Firebase · Multi-dispositivo'
                            : 'Nuvem / Link · Multi-dispositivo'}
                        </span>
                      </span>
                    )}
                    {mat.status === 'in_review' && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                        Em revisão editorial
                      </span>
                    )}
                  </div>

                  {(readingProgress || mat.pageCount || mat.textLayerStatus || !allowDownload || mat.version) && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {readingProgress && (
                        <span className="font-semibold text-[#146C43] dark:text-emerald-400 font-mono tabular-nums">
                          Lido {readingProgress.progressPercent}% · pág. {readingProgress.lastPage}/{readingProgress.totalPages}
                        </span>
                      )}
                      {mat.pageCount && (
                        <span className="font-mono tabular-nums">{mat.pageCount} págs.</span>
                      )}
                      {mat.textLayerStatus === 'scanned' && (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">Digitalizado</span>
                      )}
                      {mat.version && (
                        <span className="font-mono">v{mat.version}</span>
                      )}
                      {!allowDownload && (
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Somente leitura (download restrito)</span>
                      )}
                    </div>
                  )}

                  {/* Structured Catalog Metadata */}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="col-span-2 truncate">
                      <dt className="inline font-semibold text-slate-700 dark:text-slate-200">Tópico do edital: </dt>
                      <dd className="inline">{mat.editalTopic || getDisciplineShortName(mat.disciplineId)}</dd>
                    </div>
                    <div className="truncate">
                      <dt className="inline font-semibold text-slate-700 dark:text-slate-200">Instituição: </dt>
                      <dd className="inline">{mat.institution || 'Institucional'}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-slate-700 dark:text-slate-200">Acesso: </dt>
                      <dd className="inline">
                        {mat.pricing === 'pago' ? 'Pago' : 'Gratuito'} · {LINK_STATUS_LABELS[mat.linkStatus || 'ativo']}
                      </dd>
                    </div>
                    <div className="font-mono tabular-nums">
                      <dt className="inline font-sans font-semibold text-slate-700 dark:text-slate-200">Publicado: </dt>
                      <dd className="inline">{mat.publishedAt || '2026-11-13'}</dd>
                    </div>
                    <div className="font-mono tabular-nums">
                      <dt className="inline font-sans font-semibold text-slate-700 dark:text-slate-200">Verificado: </dt>
                      <dd className="inline">{mat.lastVerifiedAt || '2026-11-13'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    {isPendingDef ? (
                      <span className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5">
                        Aguardando definição do acervo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setBookReaderInitialPage(undefined);
                          setBookReaderInitialChapterId(undefined);
                          void openViewer(mat);
                        }}
                        className="min-h-[40px] px-3.5 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {isVideoMat ? (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        ) : parsedUrl.kind === 'folder' ? (
                          <FolderOpen className="w-3.5 h-3.5" />
                        ) : isInAppBook ? (
                          <BookOpen className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isVideoMat
                            ? 'Dar Play'
                            : parsedUrl.kind === 'folder'
                              ? 'Abrir pasta'
                              : isInAppBook
                                ? readingProgress
                                  ? 'Continuar livro'
                                  : 'Ler como livro'
                                : 'Abrir no leitor'}
                        </span>
                      </button>
                    )}

                    {!isPendingDef && !isLocal && allowDownload && mat.url && (
                      <a
                        href={mat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span>Abrir link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {!isPendingDef &&
                      onSummarizeWithGemini &&
                      (isVideoMat ||
                        mat.fileType === 'pdf' ||
                        mat.fileType === 'epub' ||
                        mat.fileType === 'html' ||
                        mat.resourceType === 'pdf' ||
                        mat.resourceType === 'legislacao' ||
                        mat.resourceType === 'livro_digital') && (
                        <button
                          type="button"
                          onClick={() =>
                            onSummarizeWithGemini({
                              mode: isVideoMat ? 'video' : 'pdf',
                              materialId: mat.id,
                              url: mat.url,
                              title: mat.title,
                              disciplineId: mat.disciplineId,
                            })
                          }
                          className="min-h-[40px] px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#0B3321] dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:border-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                          <span>Resumo Gemini</span>
                        </button>
                      )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isLocal && !mat.isSystemDefault && (isAdmin || mat.ownerId === uid || canPublishShared) && (
                      <button
                        type="button"
                        onClick={() => {
                          setRemediatingMaterial(mat);
                          setRemediateUrl('');
                          setRemediateFile(null);
                        }}
                        className="min-h-[40px] px-2.5 flex items-center justify-center gap-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Migrar p/ Nuvem</span>
                      </button>
                    )}
                    {canOrganize && (
                      <button
                        type="button"
                        onClick={() => setOrganizingMaterial(mat)}
                        aria-label="Organizar conteúdo e capítulos"
                        className="min-h-[40px] px-2.5 flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B3321] dark:text-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Organizar</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(mat)}
                        aria-label="Excluir material"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Fontes Oficiais e Repositórios Verificados (sob demanda via botão Fontes) */}
      {showOfficialSources && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">Portais Oficiais, Escolas de Governo & Bases Acadêmicas</p>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Fontes Oficiais & Acadêmicas Verificadas ({VERIFIED_OFFICIAL_AND_ACADEMIC_SOURCES.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowOfficialSources(false)}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline self-start sm:self-auto"
            >
              Fechar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
            {(
              [
                { id: 'all', label: 'Todas as fontes' },
                { id: 'oficial_alepa', label: 'ALEPA & CETAP' },
                { id: 'legislacao_federal', label: 'Planalto / Leis' },
                { id: 'capacitacao_publica', label: 'ENAP / Senado / Câmara' },
                { id: 'academica_cientifica', label: 'SciELO / CAPES / IBICT' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceCategoryFilter(tab.id)}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${
                  sourceCategoryFilter === tab.id ? 'bg-[#0B3321] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {VERIFIED_OFFICIAL_AND_ACADEMIC_SOURCES.filter(
              (src) => sourceCategoryFilter === 'all' || src.category === sourceCategoryFilter
            ).map((src) => (
              <a
                key={src.id}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30 transition-colors flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-mono font-bold text-[#146C43] dark:text-emerald-400 truncate">{src.categoryLabel}</p>
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">{src.formatLabel}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">{src.title}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{src.description}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B3321] dark:text-emerald-400">
                  <span>{src.institution} · Abrir fonte oficial</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {libraryScope === 'medio'
                ? 'Referências diretas do Nível Médio (F01 a F05)'
                : 'Referências diretas do Nível Superior (Edital 001/2026)'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {libraryScope === 'medio'
                ? MEDIO_PRIORITY_SOURCES.map((source) => (
                    <a
                      key={source.code}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-white dark:bg-slate-800 flex flex-col justify-between gap-1.5"
                    >
                      <div>
                        <p className="text-[11px] font-mono font-bold text-[#146C43] dark:text-emerald-400">
                          {source.code} · {source.institution}
                        </p>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">{source.application}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B3321] dark:text-emerald-400">
                        <span>{source.actionLabel}</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>
                  ))
                : OFFICIAL_PORTAL_LINKS.map((portal) => (
                    <div
                      key={portal.code}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <p className="text-[11px] font-mono font-bold text-[#146C43] dark:text-emerald-400">
                          {portal.code} · {portal.institution}
                        </p>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">{portal.title}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {portal.links.map((lnk) => (
                          <a
                            key={lnk.url}
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B3321] dark:text-emerald-400 hover:underline"
                          >
                            <span>{lnk.label}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </section>
      )}

      {/* Integrated File, Google Drive Folder, Google Sheets & Google Slides / PowerPoint Viewer Modal */}
      {viewerMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {FILE_TYPE_LABELS[viewerMaterial.fileType]} ·{' '}
                  {viewerMaterial.institution || getDisciplineShortName(viewerMaterial.disciplineId)}
                </p>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{viewerMaterial.title}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {viewerParsed?.kind === 'spreadsheet' && workspaceAccessToken && (
                  <button
                    type="button"
                    onClick={() => handleDownloadWorkspaceExport(viewerMaterial, 'xlsx')}
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar .xlsx</span>
                  </button>
                )}

                {viewerParsed?.kind === 'presentation' && workspaceAccessToken && (
                  <button
                    type="button"
                    onClick={() => handleDownloadWorkspaceExport(viewerMaterial, 'pptx')}
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar .pptx</span>
                  </button>
                )}

                {viewerBlobUrl && viewerMaterial.allowDownload !== false && (
                  <a
                    href={viewerBlobUrl}
                    download={viewerFileName || viewerMaterial.fileName || 'material'}
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar arquivo</span>
                  </a>
                )}

                {!viewerMaterial.url.startsWith('local://') && viewerMaterial.allowDownload !== false && (
                  <a
                    href={viewerMaterial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] px-3.5 py-1.5 bg-[#0B3321] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <span>Abrir em nova aba</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeViewer}
                  aria-label="Fechar visualizador"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-auto p-4">
              {viewerLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0B3321] dark:text-emerald-400" />
                  <span>Carregando conteúdo do Google Workspace...</span>
                </div>
              ) : viewerError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <p className="text-sm text-slate-700 dark:text-slate-300 max-w-md">{viewerError}</p>
                  {!workspaceAccessToken && (
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      className="min-h-[42px] px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold rounded-xl inline-flex items-center gap-2"
                    >
                      <GoogleLogoSvg />
                      <span>Conectar Google Drive</span>
                    </button>
                  )}
                </div>
              ) : isViewerFolder ? (
                <div className="h-full flex flex-col space-y-4">
                  {!workspaceAccessToken ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                      <FolderOpen className="w-12 h-12 text-[#0B3321] dark:text-emerald-400" />
                      <div className="space-y-1 max-w-md">
                        <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">Pasta do Google Drive</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Conecte sua conta Google para listar e abrir os PDFs, planilhas e apresentações desta pasta
                          diretamente aqui, ou abra a pasta no Google Drive.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            const token = await handleConnectDrive();
                            if (token && viewerParsed?.id) {
                              const items = await listDriveFiles({
                                accessToken: token,
                                folderId: viewerParsed.id,
                              });
                              setViewerFolderItems(items);
                              setViewerFolderTrail([{ id: viewerParsed.id, name: viewerMaterial.title }]);
                            }
                          }}
                          className="min-h-[44px] px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold rounded-xl inline-flex items-center gap-2"
                        >
                          <GoogleLogoSvg />
                          <span>Conectar Google Drive</span>
                        </button>
                        <a
                          href={viewerMaterial.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] px-5 py-2.5 bg-[#0B3321] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2"
                        >
                          <span>Abrir pasta no Drive</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {viewerFolderTrail.map((crumb, idx) => (
                          <React.Fragment key={`${crumb.id}_${idx}`}>
                            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            <button
                              type="button"
                              onClick={() => {
                                setViewerFolderTrail(viewerFolderTrail.slice(0, idx));
                                void loadFolderInsideViewer(crumb.id, crumb.name);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-medium ${
                                idx === viewerFolderTrail.length - 1
                                  ? 'bg-[#0B3321] text-white'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {crumb.name}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>

                      {viewerFolderItems.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-300">
                          Esta pasta está vazia ou você ainda não possui permissão de leitura nos itens.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto">
                          {viewerFolderItems.map((item) => {
                            const ItemIcon = getDriveItemIcon(item);
                            const isSubfolder = item.mimeType === DRIVE_MIME.FOLDER;
                            return (
                              <div
                                key={item.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3"
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <ItemIcon className="w-4 h-4 text-[#0B3321] dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{getDriveItemTypeLabel(item)}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSubfolder) {
                                      void loadFolderInsideViewer(item.id, item.name);
                                    } else {
                                      void openViewer(driveItemToStudyMaterial(item));
                                    }
                                  }}
                                  className="min-h-[36px] px-3 py-1 bg-[#0B3321] text-white text-xs font-semibold rounded-lg shrink-0"
                                >
                                  {isSubfolder ? 'Abrir pasta' : 'Abrir arquivo'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : viewerParsed?.kind === 'spreadsheet' ? (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-fit">
                      {excelSheets.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSheetViewMode('api')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                            sheetViewMode === 'api' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Dados ao vivo (Planilhas)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSheetViewMode('preview')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                          sheetViewMode === 'preview' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Visualização Google Sheets
                      </button>
                    </div>

                    {!workspaceAccessToken && (
                      <button
                        type="button"
                        onClick={async () => {
                          const token = await handleConnectDrive();
                          if (token && viewerParsed.id) {
                            const data = await fetchGoogleSpreadsheet(token, viewerParsed.id);
                            setExcelSheets(data.sheets);
                            setSheetViewMode('api');
                          }
                        }}
                        className="min-h-[36px] px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <GoogleLogoSvg />
                        <span>Ler abas via Google Sheets</span>
                      </button>
                    )}
                  </div>

                  {sheetViewMode === 'api' && excelSheets.length > 0 ? (
                    <div className="space-y-3 flex-1 flex flex-col min-h-0">
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-fit">
                        {excelSheets.map((s, idx) => (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => setActiveSheetIdx(idx)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                              activeSheetIdx === idx ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <tbody>
                            {excelSheets[activeSheetIdx]?.rows.map((row, rIdx) => (
                              <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100' : 'border-t border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200'}>
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-3 py-2 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : embedUrl ? (
                    <iframe
                      title={viewerMaterial.title}
                      src={embedUrl}
                      allow="autoplay; fullscreen"
                      className="w-full flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
                    />
                  ) : null}
                </div>
              ) : viewerParsed?.kind === 'presentation' ? (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-fit">
                      <button
                        type="button"
                        onClick={() => setSlidesViewMode('preview')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                          slidesViewMode === 'preview' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Apresentação de Slides
                      </button>
                      {googleSlides.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSlidesViewMode('outline')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                            slidesViewMode === 'outline' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Roteiro de texto ({googleSlides.length} slides)
                        </button>
                      )}
                    </div>

                    {!workspaceAccessToken && (
                      <button
                        type="button"
                        onClick={async () => {
                          const token = await handleConnectDrive();
                          if (token && viewerParsed.id) {
                            const pres = await fetchGooglePresentation(token, viewerParsed.id);
                            setGoogleSlides(pres.slides);
                          }
                        }}
                        className="min-h-[36px] px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <GoogleLogoSvg />
                        <span>Extrair texto via Google Slides</span>
                      </button>
                    )}
                  </div>

                  {slidesViewMode === 'outline' && googleSlides.length > 0 ? (
                    <div className="flex-1 overflow-y-auto space-y-3">
                      {googleSlides.map((slide) => (
                        <div key={slide.objectId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
                          <p className="font-mono text-xs font-bold text-[#0B3321] dark:text-emerald-400">Slide {slide.index}</p>
                          {slide.texts.length > 0 ? (
                            <ul className="space-y-1 text-sm text-slate-800 dark:text-slate-200">
                              {slide.texts.map((txt, tIdx) => (
                                <li key={tIdx} className="whitespace-pre-line">
                                  {txt}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">Slide visual sem texto extraído.</p>
                          )}
                          {slide.notes && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-semibold">Anotações do apresentador: </span>
                              {slide.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : embedUrl ? (
                    <iframe
                      title={viewerMaterial.title}
                      src={embedUrl}
                      allow="autoplay; fullscreen"
                      className="w-full flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
                    />
                  ) : null}
                </div>
              ) : excelSheets.length > 0 ? (
                <div className="space-y-3 h-full flex flex-col">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-fit">
                    {excelSheets.map((s, idx) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => setActiveSheetIdx(idx)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                          activeSheetIdx === idx ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <tbody>
                        {excelSheets[activeSheetIdx]?.rows.map((row, rIdx) => (
                          <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100' : 'border-t border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200'}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : viewerBlobUrl && viewerMaterial.fileType === 'pdf' ? (
                <iframe
                  title={viewerMaterial.title}
                  src={viewerBlobUrl}
                  className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : viewerBlobUrl && viewerMaterial.fileType === 'pptx' && !embedUrl ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <Presentation className="w-12 h-12 text-[#0B3321] dark:text-emerald-400" />
                  <div className="space-y-1 max-w-md">
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                      Apresentação PowerPoint pronta ({viewerFileName})
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Arquivos .pptx locais podem ser baixados ou abertos diretamente no PowerPoint / Google Slides.
                    </p>
                  </div>
                  <a
                    href={viewerBlobUrl}
                    download={viewerFileName || 'apresentacao.pptx'}
                    className="min-h-[44px] px-5 py-2.5 bg-[#0B3321] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Abrir / Baixar {viewerFileName}</span>
                  </a>
                </div>
              ) : embedUrl ? (
                <iframe
                  title={viewerMaterial.title}
                  src={embedUrl}
                  allow="autoplay; fullscreen"
                  className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <ExternalLink className="w-10 h-10 text-[#0B3321] dark:text-emerald-400" />
                  <div className="space-y-1 max-w-md">
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">Portal / Link Externo</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Por segurança do portal de origem, este endereço abre em uma nova guia do navegador.
                    </p>
                  </div>
                  <a
                    href={viewerMaterial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-5 py-2.5 bg-[#0B3321] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2"
                  >
                    <span>Abrir {viewerMaterial.title}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal (with full catalog fields + Drive folder support) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                Catalogar Material ou Pasta na Biblioteca
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Fechar"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas rápidas no modal: PDF, Vídeo, Podcast, Outros */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(
                [
                  { id: 'pdf', label: 'PDF / E-book', isSelected: resourceType === 'pdf' && (fileType === 'pdf' || fileType === 'epub') },
                  { id: 'video', label: 'Vídeo', isSelected: resourceType === 'video' },
                  { id: 'podcast', label: 'Podcast', isSelected: resourceType === 'podcast' },
                  {
                    id: 'outros',
                    label: 'Outros',
                    isSelected:
                      resourceType !== 'video' &&
                      resourceType !== 'podcast' &&
                      !(resourceType === 'pdf' && (fileType === 'pdf' || fileType === 'epub')),
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => applyQuickKind(tab.id)}
                  className={`min-h-[36px] px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    tab.isSelected ? 'bg-[#0B3321] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Título do material ou pasta</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Pasta ALEPA 2026 no Google Drive / Apostila PDF ou EPUB"
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Destino na Biblioteca</label>
                <select
                  value={modalScope}
                  onChange={(e) => {
                    const next = e.target.value as LibraryScope;
                    setModalScope(next);
                    const nextList =
                      next === 'geral'
                        ? GERAL_LIBRARY_CATEGORIES
                        : next === 'medio'
                          ? MEDIO_LIBRARY_CATEGORIES
                          : LIBRARY_CATEGORIES;
                    setCategoryId(nextList[0].id);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                >
                  <option value="geral">Biblioteca Geral · Materiais comuns aos dois níveis</option>
                  <option value="superior">Biblioteca Nível Superior · Específico Cargo 03 (PL.AL.102)</option>
                  <option value="medio">Biblioteca Nível Médio · Específico Cargo 04 (PL.AL.060)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Categoria / Disciplina (
                    {modalScope === 'geral'
                      ? 'Geral · 1–8'
                      : modalScope === 'medio'
                        ? 'Nível Médio · 1–11'
                        : 'Nível Superior · 1–10'}
                    )
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value as LibraryCategoryId)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  >
                    {modalCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {String(c.order).padStart(2, '0')} · {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tópico do edital</label>
                  <input
                    value={editalTopic}
                    onChange={(e) => setEditalTopic(e.target.value)}
                    placeholder="Ex.: Espécies normativas e tramitação"
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de material (8 tipos)</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as ResourceType)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  >
                    {RESOURCE_TYPE_META.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Formato do arquivo / origem</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value as MaterialFileType)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  >
                    <option value="drive">Google Drive (Pasta ou Arquivo)</option>
                    <option value="pdf">PDF</option>
                    <option value="epub">EPUB (E-book Digital)</option>
                    <option value="html">Portal Oficial (HTML)</option>
                    <option value="xlsx">Planilha (Google Sheets / Excel .xlsx)</option>
                    <option value="pptx">Apresentação (PowerPoint .pptx / Slides)</option>
                    <option value="video">Videoaula / Áudio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Acesso</label>
                  <select
                    value={pricing}
                    onChange={(e) => setPricing(e.target.value as 'gratuito' | 'pago')}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  >
                    <option value="gratuito">Gratuito</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Instituição responsável</label>
                  <input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Ex.: Google Drive / ALEPA / CETAP / Senado"
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Situação do link</label>
                  <select
                    value={linkStatus}
                    onChange={(e) => setLinkStatus(e.target.value as LinkStatus)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="instavel">Instável</option>
                    <option value="atualizacao">Em atualização</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Data de publicação</label>
                  <input
                    type="date"
                    value={publishedAt}
                    onChange={(e) => setPublishedAt(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Data da última verificação</label>
                  <input
                    type="date"
                    value={lastVerifiedAt}
                    onChange={(e) => setLastVerifiedAt(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Link de acesso ou Pasta do Google Drive (Drive Folder, Planilha, Slides, PDF, EPUB ou Portal Oficial)
                </label>
                <input
                  type="url"
                  value={url}
                  disabled={Boolean(selectedFile)}
                  onChange={(e) => handleUrlInputChange(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... ou https://.../material.pdf"
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                />
              </div>

              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0B3321] dark:text-emerald-400" />
                  <span>
                    {selectedFile
                      ? `Selecionado: ${selectedFile.name}`
                      : 'Ou selecione arquivo do aparelho (.pdf, .epub, .pptx, .xlsx)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.epub,.ppt,.pptx,.xls,.xlsx,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição (opcional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                />
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOfficialContent}
                    onChange={(e) => setIsOfficialContent(e.target.checked)}
                  />
                  <span>Indicar como conteúdo oficial (órgão/banca/legislação)</span>
                </label>

                {canPublishShared && (!selectedFile || canUploadFilesToCloud) && (
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isShared}
                      onChange={(e) => setIsShared(e.target.checked)}
                    />
                    <span>Compartilhar com familiares e turma na nuvem (visível em todos os celulares)</span>
                  </label>
                )}
                {selectedFile && !canUploadFilesToCloud && (
                  <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    <strong>Somente neste dispositivo:</strong> no modo visitante ou estudante sem permissão institucional, o arquivo permanece armazenado apenas localmente neste navegador (isShared = falso). Para liberar em outros aparelhos, informe um link público ou do Google Drive acima.
                  </p>
                )}
                {selectedFile && canUploadFilesToCloud && (
                  <p className="text-xs text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                    {uploadProgress !== null
                      ? `Enviando arquivo para o Firebase Storage (${uploadProgress}%)...`
                      : 'Perfil autorizado: ao salvar, o arquivo será enviado ao Firebase Storage e ficará disponível na nuvem em qualquer dispositivo.'}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#134b32] text-white text-sm font-semibold"
                >
                  {submitting
                    ? uploadProgress !== null
                      ? `Enviando (${uploadProgress}%)...`
                      : 'Salvando...'
                    : 'Salvar material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {remediatingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Correção segura de material local://
                </p>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Migrar para acesso na nuvem
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Registro preservado: <strong className="text-slate-800 dark:text-slate-200">{remediatingMaterial.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRemediatingMaterial(null)}
                aria-label="Fechar modal de migração"
                className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRemediateLocalMaterial} className="space-y-4">
              {canUploadFilesToCloud && (
                <div className="p-3.5 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#0B3321] dark:text-emerald-300 cursor-pointer">
                    <Cloud className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {remediateFile
                        ? `Selecionado: ${remediateFile.name}`
                        : 'Enviar arquivo (.pdf / .epub) para o Firebase Storage'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.epub,.pptx,.xlsx"
                      onChange={(e) => setRemediateFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ou vincule uma URL pública / Google Drive para este mesmo registro
                </label>
                <input
                  type="url"
                  disabled={Boolean(remediateFile)}
                  value={remediateUrl}
                  onChange={(e) => setRemediateUrl(e.target.value)}
                  placeholder="https://drive.google.com/... ou https://.../apostila.pdf"
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl disabled:opacity-50"
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                O registro original, capítulos e progresso de leitura são mantidos intactos; apenas o endereço <code className="font-mono">local://</code> é substituído pela referência em nuvem.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRemediatingMaterial(null)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={remediatingBusy}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {remediatingBusy ? 'Atualizando...' : 'Salvar migração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bookReaderMaterial && (
        <BookReaderModal
          material={bookReaderMaterial}
          initialPage={bookReaderInitialPage}
          initialChapterId={bookReaderInitialChapterId}
          onClose={() => {
            setBookReaderMaterial(null);
            setBookReaderInitialPage(undefined);
            setBookReaderInitialChapterId(undefined);
          }}
          onSummarizeWithGemini={
            onSummarizeWithGemini
              ? (target) => onSummarizeWithGemini(target)
              : undefined
          }
        />
      )}

      {organizingMaterial && (
        <ContentOrganizerModal
          material={organizingMaterial}
          campus={campus}
          onClose={() => setOrganizingMaterial(null)}
          onSaved={() => setFeedback('Metadados e capítulos atualizados com sucesso.')}
        />
      )}
    </div>
  );
}
