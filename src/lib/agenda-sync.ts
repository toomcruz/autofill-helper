import type { AgendaType } from "@/lib/agenda";
import {
  EXHUMATION_TIME_SLOTS,
  isExhumationTimeSlot,
  isExhumationWorkingDay,
} from "@/lib/domain/exhumation-slots";

/**
 * Pure helpers for the agenda linkage flow.
 *
 * Extracted from the "new attendance" route and the extract server function so
 * their business rules can be unit-tested without touching Supabase or the UI.
 */

export type ProcessKey = "sepultamento" | "exumacao" | (string & {});

/** Resolves which operational agenda an attendance belongs to. */
export function resolveAgendaType(
  processKey: ProcessKey,
  tipoAgendaExumacao?: string | null,
): AgendaType | null {
  if (processKey === "sepultamento") return "velorio_sepultamento";
  if (processKey === "exumacao") {
    return tipoAgendaExumacao === "exumacao_pss" ? "exumacao_pss" : "exumacao";
  }
  return null;
}

/** Determines whether an attendance should produce an agenda event. */
export function shouldCreateAgendaEvent(
  processKey: ProcessKey,
  extras: Record<string, string | undefined>,
): boolean {
  if (processKey !== "sepultamento" && processKey !== "exumacao") return false;
  const eventDate = extras.data_agendada?.trim();
  return Boolean(eventDate);
}

/**
 * Builds a partial update patch that only fills empty fields on the linked
 * agenda event. Non-empty existing values are preserved so extraction cannot
 * overwrite manual entries.
 */
export function buildAgendaSyncPatch<
  E extends Record<string, unknown>,
>(event: E, candidates: Record<string, string | null>): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const [field, candidate] of Object.entries(candidates)) {
    const current = String(event[field] ?? "").trim();
    if (!current && candidate && candidate.trim()) {
      patch[field] = candidate;
    }
  }
  return patch;
}
