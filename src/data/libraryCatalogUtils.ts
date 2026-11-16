import { classifyMaterialOpeningMode, type MaterialOpeningMode } from '../lib/epubAndHtmlEngine';
import type { StudyMaterial } from '../types';

export const RESERVED_PENDING_CATALOG_NUMBERS = [1, 6] as const;

export interface StandardizedMaterialView {
  material: StudyMaterial;
  openingMode: MaterialOpeningMode;
  isPendingDefinition: boolean;
  effectiveVersion: number;
  originBadge: 'Oficial' | 'Complementar' | 'Pendente';
}

export function isMaterialPendingDefinition(
  mat: Pick<StudyMaterial, 'pendingDefinition' | 'catalogNumber' | 'url'>
): boolean {
  if (mat.pendingDefinition) return true;
  if (
    (mat.catalogNumber === 1 || mat.catalogNumber === 6) &&
    (!mat.url || !mat.url.trim())
  ) {
    return true;
  }
  return false;
}

/**
 * Normalizes catalog metadata for display and validation without fabricating
 * definitions for Materials 1 and 6 when marked as pendingDefinition.
 */
export function normalizeMaterialRecord(material: StudyMaterial): StudyMaterial {
  const isPending = isMaterialPendingDefinition(material);
  if (isPending) {
    return {
      ...material,
      pendingDefinition: true,
      version: material.version && material.version >= 1 ? material.version : 1,
    };
  }

  return {
    ...material,
    version: material.version && material.version >= 1 ? material.version : 1,
    linkStatus: material.linkStatus || 'ativo',
    pricing: material.pricing || 'gratuito',
  };
}

export function standardizeMaterialCatalog(materials: StudyMaterial[]): StudyMaterial[] {
  return materials.map(normalizeMaterialRecord);
}

export function describeMaterialForCatalog(material: StudyMaterial): StandardizedMaterialView {
  const normalized = normalizeMaterialRecord(material);
  const isPendingDefinition = isMaterialPendingDefinition(normalized);
  const openingMode = classifyMaterialOpeningMode(normalized);
  const originBadge: StandardizedMaterialView['originBadge'] = isPendingDefinition
    ? 'Pendente'
    : normalized.isOfficialContent
      ? 'Oficial'
      : 'Complementar';

  return {
    material: normalized,
    openingMode,
    isPendingDefinition,
    effectiveVersion: normalized.version || 1,
    originBadge,
  };
}
