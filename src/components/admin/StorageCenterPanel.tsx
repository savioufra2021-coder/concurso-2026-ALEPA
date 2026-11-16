import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  HardDrive,
  Lock,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/apiClient';
import {
  FIREBASE_CONSOLE_STORAGE_URL,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
} from '../../lib/firebase';
import {
  CloudStorageHealthReport,
  CloudStorageListedObject,
  deleteCloudStorageObject,
  formatBytes,
  inferStorageCategory,
  listCloudStorageObjects,
  probeCloudStorageHealth,
  uploadFileToCloudStorage,
} from '../../lib/storageService';
import { LibraryScope, StorageMetadataRecord, StorageObjectCategory } from '../../types';
import { SectionCard, StatTile } from '../ui/CampusPrimitives';

interface StorageCenterPanelProps {
  onNotifyOk: (msg: string) => void;
  onNotifyErr: (err: unknown, fallback: string) => void;
}

interface ServerStorageHealth {
  projectId: string;
  storageBucket: string;
  consoleUrl: string;
  geminiConfigured?: boolean;
  spotifyConfigured?: boolean;
  checkedAt?: string;
}

const SOFT_BUDGET_KEY = 'alepa_storage_soft_limit_mb_v1';

export function StorageCenterPanel({ onNotifyOk, onNotifyErr }: StorageCenterPanelProps) {
  const {
    user,
    canManageUsers,
    allManagedMaterials,
    allManagedLessons,
    storageMetadataRecords,
    registerStorageMetadata,
    updateStorageMetadataRecord,
    deleteStorageMetadataRecord,
    writeAuditLog,
  } = useAuth();

  const [probe, setProbe] = useState<CloudStorageHealthReport | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerStorageHealth | null>(null);
  const [liveObjects, setLiveObjects] = useState<CloudStorageListedObject[]>([]);
  const [probing, setProbing] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<'all' | StorageObjectCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCampus, setUploadCampus] = useState<LibraryScope>('superior');
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const [softLimitMb, setSoftLimitMb] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SOFT_BUDGET_KEY) || '5120');
      return saved >= 100 ? saved : 5120;
    } catch {
      return 5120;
    }
  });

  const runProbe = useCallback(async () => {
    setProbing(true);
    try {
      const [clientReport, serverResp] = await Promise.all([
        probeCloudStorageHealth(Boolean(user)),
        user
          ? apiFetch('/api/storage/health').then(async (r) =>
              r.ok ? ((await r.json()) as ServerStorageHealth) : null
            )
          : Promise.resolve(null),
      ]);
      setProbe(clientReport);
      if (serverResp) setServerHealth(serverResp);
      if (clientReport.status === 'connected') {
        const listed = await listCloudStorageObjects('campus-materials');
        setLiveObjects(listed);
      } else {
        setLiveObjects([]);
      }
    } catch (err) {
      onNotifyErr(err, 'Erro ao testar conexão com o Firebase Storage.');
    } finally {
      setProbing(false);
    }
  }, [onNotifyErr, user]);

  useEffect(() => {
    if (canManageUsers) {
      void runProbe();
    }
  }, [canManageUsers, runProbe]);

  const mergedItems = useMemo(() => {
    const byPath = new Map<
      string,
      {
        id: string;
        fileName: string;
        objectPath: string;
        downloadUrl: string;
        sizeBytes: number;
        category: StorageObjectCategory;
        checksumSha256?: string;
        archived?: boolean;
        linkedMaterialId?: string;
        version?: number;
        metaRecord?: StorageMetadataRecord;
        inLiveBucket: boolean;
      }
    >();

    for (const rec of storageMetadataRecords) {
      byPath.set(rec.objectPath, {
        id: rec.id,
        fileName: rec.fileName,
        objectPath: rec.objectPath,
        downloadUrl: rec.downloadUrl,
        sizeBytes: rec.sizeBytes,
        category: rec.category,
        checksumSha256: rec.checksumSha256,
        archived: rec.archived,
        linkedMaterialId: rec.linkedMaterialId,
        version: rec.version,
        metaRecord: rec,
        inLiveBucket: false,
      });
    }

    for (const obj of liveObjects) {
      const existing = byPath.get(obj.fullPath);
      if (existing) {
        existing.inLiveBucket = true;
        existing.sizeBytes = obj.sizeBytes || existing.sizeBytes;
        existing.downloadUrl = obj.downloadUrl || existing.downloadUrl;
      } else {
        byPath.set(obj.fullPath, {
          id: obj.fullPath,
          fileName: obj.name,
          objectPath: obj.fullPath,
          downloadUrl: obj.downloadUrl,
          sizeBytes: obj.sizeBytes,
          category: obj.category,
          inLiveBucket: true,
        });
      }
    }

    return Array.from(byPath.values());
  }, [liveObjects, storageMetadataRecords]);

  const breakdown = useMemo(() => {
    const cats: Record<StorageObjectCategory, { count: number; bytes: number }> = {
      pdf: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      image: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 },
    };
    let totalBytes = 0;
    for (const item of mergedItems) {
      cats[item.category].count += 1;
      cats[item.category].bytes += item.sizeBytes;
      totalBytes += item.sizeBytes;
    }
    const softBytes = softLimitMb * 1024 * 1024;
    const pct = softBytes > 0 ? Math.min(100, Math.round((totalBytes / softBytes) * 100)) : 0;
    return { cats, totalBytes, pct, totalCount: mergedItems.length };
  }, [mergedItems, softLimitMb]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return mergedItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        item.fileName.toLowerCase().includes(term) ||
        item.objectPath.toLowerCase().includes(term)
      );
    });
  }, [mergedItems, categoryFilter, searchTerm]);

  const getReferences = (item: { downloadUrl: string; objectPath: string; linkedMaterialId?: string }) => {
    const matRefs = allManagedMaterials.filter(
      (m) =>
        m.id === item.linkedMaterialId ||
        m.url === item.downloadUrl ||
        (m.storagePath && m.storagePath === item.objectPath)
    );
    const lessonRefs = allManagedLessons.filter(
      (l) =>
        l.videoUrl === item.downloadUrl ||
        matRefs.some((m) => l.materialIds.includes(m.id))
    );
    return { matRefs, lessonRefs };
  };

  if (!canManageUsers) {
    return (
      <SectionCard
        title="Central de Armazenamento Restrita"
        subtitle="Apenas o Administrador Principal tem acesso ao bucket na nuvem"
      >
        <div className="flex items-center gap-3 py-6 text-xs text-slate-600 dark:text-slate-300">
          <Lock className="h-5 w-5 text-slate-400" />
          <span>Permissão exclusiva para Administrador Principal / Desenvolvedor.</span>
        </div>
      </SectionCard>
    );
  }

  const handleUpload = async () => {
    if (!uploadFile || !user) {
      onNotifyErr(null, 'Selecione um arquivo antes de iniciar o envio.');
      return;
    }
    try {
      setUploadPercent(1);
      const uploaded = await uploadFileToCloudStorage({
        file: uploadFile,
        uploaderUid: user.uid,
        folder: 'campus-materials',
        onProgress: (p) => setUploadPercent(p),
      });
      const fileId = await registerStorageMetadata({
        fileName: uploadFile.name,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        checksumSha256: uploaded.checksumSha256,
        storageProvider: 'firebase_storage',
        bucket: uploaded.bucket,
        objectPath: uploaded.objectPath,
        downloadUrl: uploaded.downloadUrl,
        category: inferStorageCategory(uploaded.mimeType, uploadFile.name),
        campusLevel: uploadCampus,
        version: 1,
      });
      await writeAuditLog({
        action: 'upload_storage_object',
        targetCollection: 'storageMetadata',
        targetId: fileId,
        summary: `Upload na nuvem: ${uploadFile.name} (${formatBytes(uploaded.sizeBytes)})`,
      });
      setUploadFile(null);
      setUploadPercent(null);
      onNotifyOk('Arquivo enviado para o Firebase Storage e registrado na auditoria.');
      void runProbe();
    } catch (err) {
      setUploadPercent(null);
      onNotifyErr(
        err,
        'Falha no upload para o bucket. Verifique se o Firebase Storage foi ativado e se storage.rules foi implantado.'
      );
    }
  };

  const handleSafeDelete = async (item: (typeof mergedItems)[number]) => {
    const refs = getReferences(item);
    if (refs.matRefs.length > 0 || refs.lessonRefs.length > 0) {
      onNotifyErr(
        null,
        `Exclusão bloqueada por segurança: arquivo referenciado por ${refs.matRefs.length} material(is) e ${refs.lessonRefs.length} aula(s). Use Arquivar Metadado para preservar vínculos.`
      );
      return;
    }
    try {
      if (item.inLiveBucket) {
        await deleteCloudStorageObject(item.objectPath);
      }
      if (item.metaRecord) {
        await deleteStorageMetadataRecord(item.metaRecord.id);
      }
      await writeAuditLog({
        action: 'delete_storage_object',
        targetCollection: 'storageMetadata',
        targetId: item.objectPath,
        summary: `Arquivo órfão removido do armazenamento: ${item.fileName}`,
      });
      onNotifyOk(`Arquivo "${item.fileName}" removido com verificação de vínculos.`);
      void runProbe();
    } catch (err) {
      onNotifyErr(err, 'Erro ao excluir arquivo do bucket.');
    }
  };

  const statusMeta =
    probe?.status === 'connected'
      ? {
          label: 'Conectado',
          cls: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
        }
      : probe?.status === 'permission_or_cors'
        ? {
            label: 'Permissão / CORS pendente',
            cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
          }
        : {
            label: 'Bucket não inicializado / indisponível',
            cls: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
          };

  const thresholdLevel =
    breakdown.pct >= 95
      ? { label: 'Crítico (≥ 95%)', cls: 'text-rose-700 dark:text-rose-300' }
      : breakdown.pct >= 85
        ? { label: 'Elevado (≥ 85%)', cls: 'text-amber-700 dark:text-amber-300' }
        : breakdown.pct >= 70
          ? { label: 'Atenção (≥ 70%)', cls: 'text-sky-700 dark:text-sky-300' }
          : { label: 'Normal', cls: 'text-emerald-700 dark:text-emerald-300' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Objetos Mapeados" value={breakdown.totalCount} hint={`${liveObjects.length} no bucket ao vivo`} />
        <StatTile label="Volume Listado" value={formatBytes(breakdown.totalBytes)} hint="Soma real dos arquivos" />
        <StatTile
          label="PDFs / Apostilas"
          value={breakdown.cats.pdf.count}
          hint={formatBytes(breakdown.cats.pdf.bytes)}
        />
        <StatTile
          label="Vídeos / Áudios / Img"
          value={
            breakdown.cats.video.count + breakdown.cats.audio.count + breakdown.cats.image.count
          }
          hint={formatBytes(
            breakdown.cats.video.bytes + breakdown.cats.audio.bytes + breakdown.cats.image.bytes
          )}
        />
      </div>

      <SectionCard
        title="Central Administrativa de Armazenamento na Nuvem"
        subtitle="Diagnóstico real do bucket Firebase Storage, limites internos e acesso direto ao Console"
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runProbe()}
              disabled={probing}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} />
              Testar Conexão
            </button>
            <a
              href={FIREBASE_CONSOLE_STORAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0B3321] px-3.5 text-xs font-semibold text-white hover:bg-[#146C43]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              ABRIR ARMAZENAMENTO NA NUVEM
            </a>
          </div>
        }
      >
        <div className="space-y-4">
          <div className={`rounded-xl border p-3.5 text-xs ${statusMeta.cls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <HardDrive className="h-4 w-4" />
                <span>Status do Provedor: {statusMeta.label}</span>
              </div>
              <span className="font-mono text-[11px]">
                Bucket: {probe?.bucket || serverHealth?.storageBucket || FIREBASE_STORAGE_BUCKET}
              </span>
            </div>
            <p className="mt-1.5">
              {probe?.message || 'Executando diagnóstico do bucket na nuvem...'}
            </p>
            <p className="mt-1 text-[11px] opacity-85">
              Projeto: {FIREBASE_PROJECT_ID} · Deploy de <code>storage.rules</code>, configuração de CORS e planos Spark/Blaze são administrados diretamente no Console Firebase.
            </p>
          </div>

          {/* Soft quota monitor (explicitly labeled as local reference estimate) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  Controle de Capacidade e Limite Preventivo (Referência Interna)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Calculado sobre os objetos listados na plataforma ({formatBytes(breakdown.totalBytes)} de{' '}
                  {formatBytes(softLimitMb * 1024 * 1024)}). Alertas automáticos em 70%, 85% e 95%.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${thresholdLevel.cls}`}>{thresholdLevel.label}</span>
                <select
                  value={softLimitMb}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setSoftLimitMb(next);
                    try {
                      localStorage.setItem(SOFT_BUDGET_KEY, String(next));
                    } catch {
                      // ignore
                    }
                  }}
                  className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value={1024}>Meta 1 GB</option>
                  <option value={5120}>Meta 5 GB (Spark)</option>
                  <option value={25600}>Meta 25 GB</option>
                  <option value={102400}>Meta 100 GB</option>
                </select>
              </div>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full transition-all ${
                  breakdown.pct >= 95
                    ? 'bg-rose-600'
                    : breakdown.pct >= 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-700'
                }`}
                style={{ width: `${breakdown.pct}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-5 dark:text-slate-400">
              <span>PDFs: {formatBytes(breakdown.cats.pdf.bytes)}</span>
              <span>Vídeos: {formatBytes(breakdown.cats.video.bytes)}</span>
              <span>Áudios: {formatBytes(breakdown.cats.audio.bytes)}</span>
              <span>Imagens: {formatBytes(breakdown.cats.image.bytes)}</span>
              <span>Outros: {formatBytes(breakdown.cats.other.bytes)}</span>
            </div>
          </div>

          {/* Direct Cloud Upload */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <CloudUpload className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span>{uploadFile ? `${uploadFile.name} (${formatBytes(uploadFile.size)})` : 'Escolher arquivo p/ Nuvem'}</span>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <select
                value={uploadCampus}
                onChange={(e) => setUploadCampus(e.target.value as LibraryScope)}
                className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="geral">Geral</option>
                <option value="superior">Superior</option>
                <option value="medio">Médio</option>
              </select>
            </div>

            <button
              type="button"
              disabled={!uploadFile || uploadPercent !== null}
              onClick={() => void handleUpload()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43] disabled:opacity-50"
            >
              <CloudUpload className="h-4 w-4" />
              {uploadPercent !== null ? `Enviando ${uploadPercent}%` : 'Enviar para Firebase Storage'}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Cloud & Metadata Inventory */}
      <SectionCard
        title="Objetos & Metadados Registrados"
        subtitle="Verificação de integridade e bloqueio contra exclusão de arquivos em uso"
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar arquivo..."
              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | StorageObjectCategory)}
              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">Todas categorias</option>
              <option value="pdf">PDFs</option>
              <option value="video">Vídeos</option>
              <option value="audio">Áudios</option>
              <option value="image">Imagens</option>
              <option value="other">Outros</option>
            </select>
          </div>
        }
      >
        {filteredItems.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Nenhum objeto de armazenamento registrado ou encontrado neste filtro.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const refs = getReferences(item);
              const isReferenced = refs.matRefs.length > 0 || refs.lessonRefs.length > 0;
              return (
                <div
                  key={item.objectPath}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 p-3 text-xs sm:flex-row sm:items-center dark:border-slate-800"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {item.fileName}
                      </span>
                      {isReferenced ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Vinculado ({refs.matRefs.length} mat · {refs.lessonRefs.length} aula)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          <AlertTriangle className="h-3 w-3" />
                          Sem vínculo (Órfão)
                        </span>
                      )}
                      {item.archived && (
                        <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          Arquivado
                        </span>
                      )}
                    </div>
                    <p className="truncate text-slate-500 dark:text-slate-400">
                      {item.category.toUpperCase()} · {formatBytes(item.sizeBytes)} · {item.objectPath}
                      {item.checksumSha256 ? ` · SHA ${item.checksumSha256.slice(0, 8)}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[34px] items-center gap-1 rounded border border-slate-200 px-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </a>
                    )}
                    {item.metaRecord && !item.archived && (
                      <button
                        type="button"
                        onClick={() =>
                          void updateStorageMetadataRecord(item.metaRecord!.id, { archived: true })
                            .then(() => onNotifyOk('Metadado arquivado preservando o arquivo.'))
                            .catch((err) => onNotifyErr(err, 'Erro ao arquivar metadado.'))
                        }
                        className="inline-flex min-h-[34px] items-center gap-1 rounded border border-slate-200 px-2.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Arquivar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSafeDelete(item)}
                      className={`inline-flex min-h-[34px] items-center gap-1 rounded border px-2.5 font-semibold ${
                        isReferenced
                          ? 'border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600'
                          : 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300'
                      }`}
                      title={
                        isReferenced
                          ? 'Arquivo em uso: desvincule antes de excluir'
                          : 'Excluir arquivo órfão'
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
