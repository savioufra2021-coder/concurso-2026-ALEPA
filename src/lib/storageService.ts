import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import {
  FIREBASE_CONSOLE_STORAGE_URL,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  storage,
} from './firebase';
import type { StorageObjectCategory } from '../types';

export type CloudStorageStatus =
  | 'connected'
  | 'permission_or_cors'
  | 'not_provisioned'
  | 'unauthenticated';

export interface CloudStorageHealthReport {
  status: CloudStorageStatus;
  bucket: string;
  projectId: string;
  consoleUrl: string;
  objectCount: number;
  totalBytes: number;
  message: string;
  checkedAt: string;
}

export interface CloudStorageListedObject {
  name: string;
  fullPath: string;
  sizeBytes: number;
  contentType: string;
  updatedAt?: string;
  downloadUrl: string;
  category: StorageObjectCategory;
}

export function inferMaterialMimeType(file: { name: string; type?: string }): string {
  const rawType = (file.type || '').trim().toLowerCase();
  const lower = (file.name || '').trim().toLowerCase();

  if (lower.endsWith('.epub')) return 'application/epub+zip';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';

  if (
    rawType &&
    rawType !== 'application/octet-stream' &&
    rawType !== 'binary/octet-stream'
  ) {
    return rawType;
  }

  return rawType || 'application/octet-stream';
}

export function mapCloudStorageError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);
  if (code === 'storage/unauthorized') {
    return 'Permissão negada no Firebase Storage. Verifique se sua conta possui perfil autorizado e se as storage.rules estão publicadas.';
  }
  if (code === 'storage/canceled') {
    return 'Envio para a nuvem cancelado.';
  }
  if (code === 'storage/quota-exceeded') {
    return 'Cota de armazenamento do Firebase Storage excedida.';
  }
  if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
    return 'Bucket do Firebase Storage não encontrado ou ainda não provisionado no projeto.';
  }
  return msg || 'Não foi possível enviar o arquivo para o Firebase Storage.';
}

export function inferStorageCategory(mimeType: string, fileName: string): StorageObjectCategory {
  const mime = (mimeType || '').toLowerCase();
  const lower = (fileName || '').toLowerCase();
  if (mime.includes('pdf') || lower.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(lower)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac)$/i.test(lower)) return 'audio';
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) return 'image';
  return 'other';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

export async function computeFileSha256(file: File | ArrayBuffer): Promise<string> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return '';
  }
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function listCloudStorageObjects(prefix = 'campus-materials'): Promise<CloudStorageListedObject[]> {
  const rootRef = ref(storage, prefix);
  const res = await listAll(rootRef);
  const files: CloudStorageListedObject[] = [];

  const collectFolder = async (items: typeof res.items, prefixes: typeof res.prefixes): Promise<void> => {
    for (const itemRef of items) {
      const [meta, downloadUrl] = await Promise.all([
        getMetadata(itemRef),
        getDownloadURL(itemRef),
      ]);
      files.push({
        name: itemRef.name,
        fullPath: itemRef.fullPath,
        sizeBytes: meta.size || 0,
        contentType: meta.contentType || 'application/octet-stream',
        updatedAt: meta.updated || meta.timeCreated,
        downloadUrl,
        category: inferStorageCategory(meta.contentType || '', itemRef.name),
      });
    }
    for (const subPrefix of prefixes) {
      const subRes = await listAll(subPrefix);
      await collectFolder(subRes.items, subRes.prefixes);
    }
  };

  await collectFolder(res.items, res.prefixes);
  return files;
}

export async function probeCloudStorageHealth(isSignedIn: boolean): Promise<CloudStorageHealthReport> {
  const checkedAt = new Date().toISOString();
  if (!FIREBASE_STORAGE_BUCKET) {
    return {
      status: 'not_provisioned',
      bucket: '',
      projectId: FIREBASE_PROJECT_ID,
      consoleUrl: FIREBASE_CONSOLE_STORAGE_URL,
      objectCount: 0,
      totalBytes: 0,
      message: 'Nenhum bucket Firebase Storage configurado em firebase-applet-config.json.',
      checkedAt,
    };
  }
  if (!isSignedIn) {
    return {
      status: 'unauthenticated',
      bucket: FIREBASE_STORAGE_BUCKET,
      projectId: FIREBASE_PROJECT_ID,
      consoleUrl: FIREBASE_CONSOLE_STORAGE_URL,
      objectCount: 0,
      totalBytes: 0,
      message: 'Faça login com conta administradora verificada para testar o bucket na nuvem.',
      checkedAt,
    };
  }

  try {
    const objects = await listCloudStorageObjects('campus-materials');
    const totalBytes = objects.reduce((acc, item) => acc + item.sizeBytes, 0);
    return {
      status: 'connected',
      bucket: FIREBASE_STORAGE_BUCKET,
      projectId: FIREBASE_PROJECT_ID,
      consoleUrl: FIREBASE_CONSOLE_STORAGE_URL,
      objectCount: objects.length,
      totalBytes,
      message: `Bucket conectado (${objects.length} arquivo(s) em campus-materials/, total de ${formatBytes(totalBytes)}).`,
      checkedAt,
    };
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (
      code === 'storage/bucket-not-found' ||
      code === 'storage/project-not-found' ||
      lower.includes('does not exist') ||
      lower.includes('404')
    ) {
      return {
        status: 'not_provisioned',
        bucket: FIREBASE_STORAGE_BUCKET,
        projectId: FIREBASE_PROJECT_ID,
        consoleUrl: FIREBASE_CONSOLE_STORAGE_URL,
        objectCount: 0,
        totalBytes: 0,
        message: 'Bucket configurado na aplicação, mas o Firebase Storage ainda precisa ser inicializado no Console Firebase.',
        checkedAt,
      };
    }

    return {
      status: 'permission_or_cors',
      bucket: FIREBASE_STORAGE_BUCKET,
      projectId: FIREBASE_PROJECT_ID,
      consoleUrl: FIREBASE_CONSOLE_STORAGE_URL,
      objectCount: 0,
      totalBytes: 0,
      message:
        code === 'storage/unauthorized'
          ? 'Permissão negada pelas storage.rules no bucket. Faça o deploy de storage.rules no Console Firebase.'
          : `Conexão bloqueada por permissão, CORS do bucket ou regra de acesso (${code || msg.slice(0, 120)}).`,
      checkedAt,
    };
  }
}

export async function uploadFileToCloudStorage(params: {
  file: File;
  uploaderUid: string;
  folder?: 'campus-materials' | 'user-uploads';
  onProgress?: (percent: number) => void;
}): Promise<{
  objectPath: string;
  downloadUrl: string;
  sizeBytes: number;
  mimeType: string;
  checksumSha256: string;
  bucket: string;
}> {
  const folder = params.folder || 'campus-materials';
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'arquivo';
  const objectPath = `${folder}/${params.uploaderUid}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, objectPath);
  const checksumSha256 = await computeFileSha256(params.file);
  const resolvedMimeType = inferMaterialMimeType(params.file);

  const task = uploadBytesResumable(storageRef, params.file, {
    contentType: resolvedMimeType,
    customMetadata: {
      checksumSha256,
      uploadedBy: params.uploaderUid,
    },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        if (snapshot.totalBytes > 0 && params.onProgress) {
          params.onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const downloadUrl = await getDownloadURL(task.snapshot.ref);
  return {
    objectPath,
    downloadUrl,
    sizeBytes: params.file.size,
    mimeType: resolvedMimeType,
    checksumSha256,
    bucket: FIREBASE_STORAGE_BUCKET,
  };
}

export async function deleteCloudStorageObject(objectPath: string): Promise<void> {
  const targetRef = ref(storage, objectPath);
  await deleteObject(targetRef);
}
