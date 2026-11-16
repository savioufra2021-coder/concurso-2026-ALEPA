export const DRIVE_MIME = {
  FOLDER: 'application/vnd.google-apps.folder',
  SHEET: 'application/vnd.google-apps.spreadsheet',
  SLIDE: 'application/vnd.google-apps.presentation',
  DOC: 'application/vnd.google-apps.document',
  PDF: 'application/pdf',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PPT: 'application/vnd.ms-powerpoint',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
} as const;

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export interface ParsedGoogleLink {
  kind: 'folder' | 'spreadsheet' | 'presentation' | 'drive_file' | 'external';
  id: string | null;
  cleanUrl: string;
}

export interface GoogleSheetTab {
  name: string;
  rows: string[][];
}

export interface GoogleSlidePage {
  index: number;
  objectId: string;
  texts: string[];
  notes: string;
}

export function parseGoogleWorkspaceUrl(rawInput: string): ParsedGoogleLink {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { kind: 'external', id: null, cleanUrl: '' };
  }

  // Allow pasting a raw Google Drive folder/file ID directly
  if (!trimmed.includes('://') && /^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return {
      kind: 'folder',
      id: trimmed,
      cleanUrl: `https://drive.google.com/drive/folders/${trimmed}`,
    };
  }

  const folderMatch = trimmed.match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders|folderview\?id=)([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    return { kind: 'folder', id: folderMatch[1], cleanUrl: trimmed };
  }
  const folderQueryMatch = trimmed.match(/drive\.google\.com\/folderview\?[^#]*[?&]id=([a-zA-Z0-9_-]+)/);
  if (folderQueryMatch) {
    return { kind: 'folder', id: folderQueryMatch[1], cleanUrl: trimmed };
  }

  const sheetMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch) {
    return { kind: 'spreadsheet', id: sheetMatch[1], cleanUrl: trimmed };
  }

  const slideMatch = trimmed.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slideMatch) {
    return { kind: 'presentation', id: slideMatch[1], cleanUrl: trimmed };
  }

  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) {
    return { kind: 'drive_file', id: driveFileMatch[1], cleanUrl: trimmed };
  }

  const openIdMatch = trimmed.match(/drive\.google\.com\/open\?[^#]*[?&]id=([a-zA-Z0-9_-]+)/);
  if (openIdMatch) {
    return { kind: 'drive_file', id: openIdMatch[1], cleanUrl: trimmed };
  }

  return { kind: 'external', id: null, cleanUrl: trimmed };
}

export function getDriveItemTypeLabel(item: Pick<DriveItem, 'mimeType' | 'name'>): string {
  const mime = item.mimeType;
  const lower = item.name.toLowerCase();
  if (mime === DRIVE_MIME.FOLDER) return 'Pasta do Google Drive';
  if (mime === DRIVE_MIME.SHEET) return 'Planilha Google';
  if (mime === DRIVE_MIME.SLIDE) return 'Apresentação Google Slides';
  if (mime === DRIVE_MIME.PPTX || mime === DRIVE_MIME.PPT || /\.(pptx?|odp)$/i.test(lower)) {
    return 'PowerPoint (.pptx)';
  }
  if (mime === DRIVE_MIME.XLSX || mime === DRIVE_MIME.XLS || /\.(xlsx?|csv)$/i.test(lower)) {
    return 'Planilha Excel (.xlsx)';
  }
  if (mime === DRIVE_MIME.PDF || lower.endsWith('.pdf')) return 'Documento PDF';
  if (mime === DRIVE_MIME.DOC) return 'Google Docs';
  return 'Arquivo do Drive';
}

export function isSpreadsheetDriveItem(item: Pick<DriveItem, 'mimeType' | 'name'>): boolean {
  const lower = item.name.toLowerCase();
  return (
    item.mimeType === DRIVE_MIME.SHEET ||
    item.mimeType === DRIVE_MIME.XLSX ||
    item.mimeType === DRIVE_MIME.XLS ||
    /\.(xlsx?|csv)$/i.test(lower)
  );
}

export function isPresentationDriveItem(item: Pick<DriveItem, 'mimeType' | 'name'>): boolean {
  const lower = item.name.toLowerCase();
  return (
    item.mimeType === DRIVE_MIME.SLIDE ||
    item.mimeType === DRIVE_MIME.PPTX ||
    item.mimeType === DRIVE_MIME.PPT ||
    /\.(pptx?|odp)$/i.test(lower)
  );
}

async function handleGoogleApiResponse(res: Response): Promise<Response> {
  if (res.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }
  if (!res.ok) {
    let message = `Erro na API Google (${res.status})`;
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      if (json?.error?.message) {
        message = json.error.message;
      }
    } catch {
      // Ignore JSON parse fallback
    }
    throw new Error(message);
  }
  return res;
}

export async function listDriveFiles(params: {
  accessToken: string;
  folderId?: string | null;
  searchQuery?: string;
  filterKind?: 'all' | 'folders' | 'sheets' | 'slides' | 'pdfs';
}): Promise<DriveItem[]> {
  const { accessToken, folderId, searchQuery, filterKind = 'all' } = params;
  const clauses: string[] = ['trashed = false'];

  if (folderId) {
    const safeFolderId = folderId.replace(/'/g, '');
    clauses.push(`'${safeFolderId}' in parents`);
  }

  if (searchQuery && searchQuery.trim()) {
    const safeQuery = searchQuery.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    clauses.push(`name contains '${safeQuery}'`);
  }

  if (filterKind === 'folders') {
    clauses.push(`mimeType = '${DRIVE_MIME.FOLDER}'`);
  } else if (filterKind === 'sheets') {
    clauses.push(
      `(mimeType = '${DRIVE_MIME.SHEET}' or mimeType = '${DRIVE_MIME.XLSX}' or mimeType = '${DRIVE_MIME.XLS}' or mimeType = 'text/csv')`
    );
  } else if (filterKind === 'slides') {
    clauses.push(
      `(mimeType = '${DRIVE_MIME.SLIDE}' or mimeType = '${DRIVE_MIME.PPTX}' or mimeType = '${DRIVE_MIME.PPT}')`
    );
  } else if (filterKind === 'pdfs') {
    clauses.push(`mimeType = '${DRIVE_MIME.PDF}'`);
  } else if (!folderId && !searchQuery?.trim()) {
    // At root without search, highlight folders and study-relevant file types first
    clauses.push(
      `(mimeType = '${DRIVE_MIME.FOLDER}' or mimeType = '${DRIVE_MIME.SHEET}' or mimeType = '${DRIVE_MIME.SLIDE}' or mimeType = '${DRIVE_MIME.PDF}' or mimeType = '${DRIVE_MIME.PPTX}' or mimeType = '${DRIVE_MIME.PPT}' or mimeType = '${DRIVE_MIME.XLSX}' or mimeType = '${DRIVE_MIME.XLS}' or mimeType = '${DRIVE_MIME.DOC}')`
    );
  }

  const qs = new URLSearchParams({
    q: clauses.join(' and '),
    pageSize: '60',
    orderBy: 'folder,modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size,parents)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await handleGoogleApiResponse(res);
  const data = (await res.json()) as { files?: DriveItem[] };
  return data.files || [];
}

export async function getDriveFileMetadata(accessToken: string, fileId: string): Promise<DriveItem> {
  const qs = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name,mimeType,webViewLink,modifiedTime,size,parents',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await handleGoogleApiResponse(res);
  return (await res.json()) as DriveItem;
}

export async function downloadDriveFileBuffer(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await handleGoogleApiResponse(res);
  return res.arrayBuffer();
}

export async function exportGoogleWorkspaceFile(
  accessToken: string,
  fileId: string,
  targetMimeType: string
): Promise<ArrayBuffer> {
  const qs = new URLSearchParams({ mimeType: targetMimeType });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?${qs.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await handleGoogleApiResponse(res);
  return res.arrayBuffer();
}

export async function fetchGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ title: string; sheets: GoogleSheetTab[] }> {
  // Always fetch spreadsheet metadata first to identify actual tab names (avoid hardcoding "Sheet1")
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties(title,sheetId)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await handleGoogleApiResponse(metaRes);
  const meta = (await metaRes.json()) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  const tabTitles = (meta.sheets || [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t))
    .slice(0, 12);

  if (tabTitles.length === 0) {
    return { title: meta.properties?.title || 'Planilha Google', sheets: [] };
  }

  const batchParams = new URLSearchParams();
  tabTitles.forEach((tab) => {
    const escaped = tab.replace(/'/g, "''");
    batchParams.append('ranges', `'${escaped}'!A1:Z150`);
  });

  const valRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${batchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await handleGoogleApiResponse(valRes);
  const valData = (await valRes.json()) as {
    valueRanges?: Array<{ range?: string; values?: string[][] }>;
  };

  const sheets: GoogleSheetTab[] = tabTitles.map((name, idx) => ({
    name,
    rows: valData.valueRanges?.[idx]?.values || [],
  }));

  return {
    title: meta.properties?.title || 'Planilha Google',
    sheets,
  };
}

interface SlideTextElement {
  textRun?: { content?: string };
}

interface SlidePageElement {
  shape?: {
    text?: { textElements?: SlideTextElement[] };
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        text?: { textElements?: SlideTextElement[] };
      }>;
    }>;
  };
}

function extractElementsText(elements?: SlidePageElement[]): string[] {
  if (!elements) return [];
  const lines: string[] = [];

  for (const el of elements) {
    if (el.shape?.text?.textElements) {
      const combined = el.shape.text.textElements
        .map((te) => te.textRun?.content || '')
        .join('')
        .trim();
      if (combined) lines.push(combined);
    }
    if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const rowCells = (row.tableCells || [])
          .map((cell) =>
            (cell.text?.textElements || [])
              .map((te) => te.textRun?.content || '')
              .join('')
              .trim()
          )
          .filter(Boolean);
        if (rowCells.length > 0) {
          lines.push(rowCells.join(' | '));
        }
      }
    }
  }

  return lines;
}

export async function fetchGooglePresentation(
  accessToken: string,
  presentationId: string
): Promise<{ title: string; slides: GoogleSlidePage[] }> {
  const res = await fetch(
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await handleGoogleApiResponse(res);
  const data = (await res.json()) as {
    title?: string;
    slides?: Array<{
      objectId?: string;
      pageElements?: SlidePageElement[];
      slideProperties?: {
        notesPage?: {
          pageElements?: SlidePageElement[];
        };
      };
    }>;
  };

  const slides: GoogleSlidePage[] = (data.slides || []).map((slide, index) => ({
    index: index + 1,
    objectId: slide.objectId || `slide_${index + 1}`,
    texts: extractElementsText(slide.pageElements),
    notes: extractElementsText(slide.slideProperties?.notesPage?.pageElements).join('\n'),
  }));

  return {
    title: data.title || 'Apresentação Google Slides',
    slides,
  };
}

export interface CalendarStudyEvent {
  id: string;
  summary: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method: 'popup' | 'email'; minutes: number }>;
  };
}

function formatOffsetIso(date: Date): string {
  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzOffsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');

  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${hh}:${mm}`;
}

export async function listAlepaStudyCalendarEvents(accessToken: string): Promise<CalendarStudyEvent[]> {
  const qs = new URLSearchParams({
    q: 'ALEPA 2026',
    singleEvents: 'false',
    maxResults: '15',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await handleGoogleApiResponse(res);
  const data = (await res.json()) as { items?: CalendarStudyEvent[] };
  return (data.items || []).filter((item) => item.id && item.summary);
}

export async function createOrUpdateCalendarStudyAlert(
  accessToken: string,
  params: {
    existingEventId?: string;
    title: string;
    description: string;
    dateKey: string; // YYYY-MM-DD
    timeHHMM: string; // HH:MM
    durationMinutes: number;
    recurrenceDailyUntilExam: boolean;
    popupMinutesBefore: number;
    emailMinutesBefore: number | null;
  }
): Promise<CalendarStudyEvent> {
  const [y, m, d] = params.dateKey.split('-').map(Number);
  const [hh, mm] = (params.timeHHMM || '19:00').split(':').map(Number);

  const startDate = new Date(y, (m || 1) - 1, d || 1, hh || 19, mm || 0, 0);
  const endDate = new Date(startDate.getTime() + Math.max(15, params.durationMinutes) * 60 * 1000);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Belem';

  const overrides: Array<{ method: 'popup' | 'email'; minutes: number }> = [
    { method: 'popup', minutes: Math.max(0, Math.min(40320, params.popupMinutesBefore)) },
  ];
  if (params.emailMinutesBefore !== null) {
    overrides.push({ method: 'email', minutes: Math.max(0, Math.min(40320, params.emailMinutesBefore)) });
  }

  const body: Record<string, unknown> = {
    summary: params.title,
    description: params.description,
    start: {
      dateTime: formatOffsetIso(startDate),
      timeZone,
    },
    end: {
      dateTime: formatOffsetIso(endDate),
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides,
    },
  };

  if (params.recurrenceDailyUntilExam) {
    body.recurrence = ['RRULE:FREQ=DAILY;UNTIL=20261213T235959Z'];
  } else {
    body.recurrence = [];
  }

  const endpoint = params.existingEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(params.existingEventId)}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const res = await fetch(endpoint, {
    method: params.existingEventId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  await handleGoogleApiResponse(res);
  return (await res.json()) as CalendarStudyEvent;
}

export async function deleteCalendarStudyEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (res.status === 204) return;
  await handleGoogleApiResponse(res);
}

function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeBase64UrlUtf8(input: string): string {
  return encodeBase64Utf8(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendStudyAlertViaGmail(
  accessToken: string,
  params: {
    toEmail: string;
    subject: string;
    bodyText: string;
  }
): Promise<{ id: string; threadId?: string }> {
  const cleanEmail = params.toEmail.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Informe um endereço de e-mail válido para enviar pelo Gmail.');
  }

  const encodedSubject = `=?UTF-8?B?${encodeBase64Utf8(params.subject)}?=`;
  const mimeMessage = [
    `To: ${cleanEmail}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.bodyText,
  ].join('\r\n');

  const raw = encodeBase64UrlUtf8(mimeMessage);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  await handleGoogleApiResponse(res);
  return (await res.json()) as { id: string; threadId?: string };
}
