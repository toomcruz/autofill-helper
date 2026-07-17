/**
 * Modelo de "revisão por exceção" para os dados extraídos.
 *
 * A UI só destaca campos quando existe uma ação necessária:
 *   - CONFLITO       — valores divergentes entre imagens (bloqueia geração
 *                       apenas quando o campo for crítico).
 *   - NÃO ENCONTRADO — campo crítico esperado, vazio (bloqueia geração).
 *   - REVISAR        — baixa confiança (< 0,90), sem conflito; apenas avisa.
 *   - NORMAL         — sem indicação; campo aparece limpo na UI.
 *
 * A definição de "crítico" é centralizada em `getCriticalFieldKeys`
 * (`@/lib/domain/critical-fields`) para não espalhar hardcodes.
 */
import type { FlatFieldMeta } from "./flatten-vision";

export type FieldStatus = "normal" | "revisar" | "conflito" | "nao_encontrado";

const CONFIDENCE_THRESHOLD = 0.9;

export interface ComputeFieldStatusInput {
  value: string | undefined;
  meta: FlatFieldMeta | undefined;
  isCritical: boolean;
}

export function computeFieldStatus(input: ComputeFieldStatusInput): FieldStatus {
  const { value, meta, isCritical } = input;
  if (meta?.hasConflict) return "conflito";
  const trimmed = (value ?? "").trim();
  if (isCritical && !trimmed) return "nao_encontrado";
  if (meta && !meta.confirmedByUser && meta.confidence < CONFIDENCE_THRESHOLD) {
    return "revisar";
  }
  return "normal";
}

export interface ReviewSummary {
  statuses: Record<string, FieldStatus>;
  pendingCount: number;
  blockingKeys: string[];
  canGenerate: boolean;
}

export interface ComputeReviewSummaryInput {
  keys: readonly string[];
  fields: Record<string, string | undefined>;
  meta: Record<string, FlatFieldMeta | undefined>;
  criticalKeys: ReadonlySet<string>;
}

export function computeReviewSummary(input: ComputeReviewSummaryInput): ReviewSummary {
  const { keys, fields, meta, criticalKeys } = input;
  const statuses: Record<string, FieldStatus> = {};
  const blocking: string[] = [];
  let pending = 0;

  for (const key of keys) {
    const isCritical = criticalKeys.has(key);
    const status = computeFieldStatus({
      value: fields[key],
      meta: meta[key],
      isCritical,
    });
    statuses[key] = status;
    if (status !== "normal") pending += 1;
    if (isCritical && (status === "conflito" || status === "nao_encontrado")) {
      blocking.push(key);
    }
  }

  return {
    statuses,
    pendingCount: pending,
    blockingKeys: blocking,
    canGenerate: blocking.length === 0,
  };
}
