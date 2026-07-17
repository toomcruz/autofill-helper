/**
 * Modo de revisão visual dos dados extraídos.
 *
 * Objetivo: substituir a lista técnica de campos por uma simulação
 * organizada do documento, destacando apenas o que precisa de atenção
 * (revisão por exceção). Mantém a lógica de negócio intacta — apenas
 * traduz nomes técnicos, agrupa aliases e permite edição inline.
 */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FieldConflict } from "@/lib/domain/vision/types";
import type { FieldStatus, ReviewSummary } from "@/lib/vision/review-status";
import type { FlatFieldMeta } from "@/lib/vision/flatten-vision";
import {
  getFriendlyLabel,
  groupFields,
  isBlankValue,
  type PresentationGroup,
} from "@/lib/vision/field-presentation";

export interface DocumentReviewProps {
  keys: readonly string[];
  fields: Record<string, string>;
  meta: Record<string, FlatFieldMeta | undefined>;
  statuses: Record<string, FieldStatus>;
  summary: ReviewSummary;
  conflicts: FieldConflict[];
  criticalKeys: ReadonlySet<string>;
  onFieldsChange: (next: Record<string, string>) => void;
  onConfirmField?: (key: string) => void;
}

type GroupStatus = "normal" | "revisar" | "conflito" | "nao_encontrado";

function groupWorstStatus(
  group: PresentationGroup,
  statuses: Record<string, FieldStatus>,
): GroupStatus {
  const priority: Record<GroupStatus, number> = {
    normal: 0,
    revisar: 1,
    conflito: 2,
    nao_encontrado: 3,
  };
  let worst: GroupStatus = "normal";
  for (const k of group.keys) {
    const s = statuses[k] ?? "normal";
    if (priority[s] > priority[worst]) worst = s;
  }
  return worst;
}

function groupIsCritical(group: PresentationGroup, criticalKeys: ReadonlySet<string>): boolean {
  return group.keys.some((k) => criticalKeys.has(k));
}

function groupIsResolved(
  group: PresentationGroup,
  fields: Record<string, string>,
  status: GroupStatus,
): boolean {
  if (status !== "normal") return false;
  return group.keys.some((k) => !isBlankValue(fields[k]));
}

function groupAnchorId(group: PresentationGroup): string {
  return `rev-${group.id.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

const STATUS_LABEL: Record<GroupStatus, string> = {
  normal: "Confirmado",
  revisar: "Baixa confiança",
  conflito: "Divergência",
  nao_encontrado: "Pendente",
};

export function DocumentReview({
  keys,
  fields,
  meta,
  statuses,
  summary,
  conflicts,
  criticalKeys,
  onFieldsChange,
  onConfirmField,
}: DocumentReviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { sections } = useMemo(() => groupFields({ keys, fields }), [keys, fields]);

  const conflictsByKey = useMemo(() => {
    const map = new Map<string, FieldConflict>();
    for (const c of conflicts) map.set(c.key, c);
    return map;
  }, [conflicts]);

  // Contagem por categoria (com base em grupos, não em chaves duplicadas).
  const counts = useMemo(() => {
    let criticas = 0;
    let divergencias = 0;
    let baixa = 0;
    let resolvidas = 0;
    let total = 0;
    for (const section of sections) {
      for (const group of section.groups) {
        total += 1;
        const status = groupWorstStatus(group, statuses);
        const isCritical = groupIsCritical(group, criticalKeys);
        if (status === "conflito") {
          divergencias += 1;
          if (isCritical) criticas += 1;
        } else if (status === "nao_encontrado") {
          criticas += 1;
        } else if (status === "revisar") {
          baixa += 1;
        } else if (groupIsResolved(group, fields, status)) {
          resolvidas += 1;
        }
      }
    }
    return { criticas, divergencias, baixa, resolvidas, total };
  }, [sections, statuses, fields, criticalKeys]);

  const pending = counts.criticas + counts.divergencias + counts.baixa;
  const progress = counts.total === 0 ? 0 : Math.round((counts.resolvidas / counts.total) * 100);

  function scrollToGroup(group: PresentationGroup) {
    const el = containerRef.current?.querySelector<HTMLElement>(`#${groupAnchorId(group)}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/60");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 1600);
  }

  function updateGroup(group: PresentationGroup, value: string) {
    const next = { ...fields };
    for (const k of group.keys) next[k] = value;
    onFieldsChange(next);
  }

  return (
    <div ref={containerRef} className="grid lg:grid-cols-[280px,1fr] gap-4">
      {/* Painel resumido */}
      <aside className="lg:sticky lg:top-4 lg:self-start space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revisão do documento</CardDescription>
            <CardTitle className="text-2xl">
              {pending === 0 ? "Tudo em ordem" : `${pending} pendência${pending > 1 ? "s" : ""}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1.5">
              <SummaryLine
                color="destructive"
                label="Críticas"
                value={counts.criticas}
              />
              <SummaryLine color="destructive" label="Divergências" value={counts.divergencias} />
              <SummaryLine color="amber" label="Conferir" value={counts.baixa} />
              <SummaryLine color="emerald" label="Resolvidas" value={counts.resolvidas} />
            </div>
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso</span>
                <span>
                  {counts.resolvidas} de {counts.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {pending > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ir para pendência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[420px] overflow-auto pr-1">
              {sections.flatMap((section) =>
                section.groups
                  .filter((g) => groupWorstStatus(g, statuses) !== "normal")
                  .map((g) => {
                    const status = groupWorstStatus(g, statuses);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => scrollToGroup(g)}
                        className="w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{g.label}</span>
                        <StatusPill status={status} compact />
                      </button>
                    );
                  }),
              )}
            </CardContent>
          </Card>
        )}
      </aside>

      {/* Documento */}
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{section.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.groups.map((group) => {
                const status = groupWorstStatus(group, statuses);
                const isCritical = groupIsCritical(group, criticalKeys);
                const primaryKey = group.primaryKey;
                const currentValue = (() => {
                  for (const k of group.keys) {
                    const v = fields[k];
                    if (!isBlankValue(v)) return v!;
                  }
                  return "";
                })();
                const conflict = group.keys
                  .map((k) => conflictsByKey.get(k))
                  .find((c): c is FieldConflict => !!c);
                const info = group.keys
                  .map((k) => meta[k])
                  .find((m): m is FlatFieldMeta => !!m);

                return (
                  <GroupRow
                    key={group.id}
                    anchorId={groupAnchorId(group)}
                    group={group}
                    status={status}
                    isCritical={isCritical}
                    value={currentValue}
                    conflict={conflict}
                    meta={info}
                    onChange={(v) => updateGroup(group, v)}
                    onConfirm={() => onConfirmField?.(primaryKey)}
                  />
                );
              })}
            </CardContent>
          </Card>
        ))}

        {summary.blockingKeys.length > 0 && (
          <div className="text-sm rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Resolva as pendências críticas para liberar a geração dos documentos.
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-componentes
// ------------------------------------------------------------------

function SummaryLine({
  color,
  label,
  value,
}: {
  color: "destructive" | "amber" | "emerald";
  label: string;
  value: number;
}) {
  const dot =
    color === "destructive"
      ? "bg-destructive"
      : color === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatusPill({ status, compact }: { status: GroupStatus; compact?: boolean }) {
  if (status === "normal") {
    return compact ? null : (
      <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-500/40 bg-emerald-500/10 dark:text-emerald-300">
        <Check className="h-3 w-3" /> {STATUS_LABEL.normal}
      </Badge>
    );
  }
  const cls =
    status === "conflito" || status === "nao_encontrado"
      ? "bg-destructive/10 text-destructive border-destructive/40"
      : "bg-amber-500/10 text-amber-700 border-amber-500/40 dark:text-amber-300";
  return (
    <Badge variant="outline" className={cn("gap-1", cls, compact && "text-[10px] h-5 px-1.5")}>
      <AlertTriangle className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

interface GroupRowProps {
  anchorId: string;
  group: PresentationGroup;
  status: GroupStatus;
  isCritical: boolean;
  value: string;
  conflict: FieldConflict | undefined;
  meta: FlatFieldMeta | undefined;
  onChange: (value: string) => void;
  onConfirm: () => void;
}

function GroupRow({
  anchorId,
  group,
  status,
  isCritical,
  value,
  conflict,
  meta,
  onChange,
  onConfirm,
}: GroupRowProps) {
  const [showAlt, setShowAlt] = useState(false);
  const [manual, setManual] = useState(false);

  const borderClass =
    status === "conflito" || status === "nao_encontrado"
      ? "border-destructive/50 bg-destructive/5"
      : status === "revisar"
        ? "border-amber-500/50 bg-amber-500/5"
        : "border-transparent";

  const blank = isBlankValue(value);
  const placeholder =
    status === "nao_encontrado"
      ? "Informação pendente"
      : blank
        ? "Não informado"
        : "";

  return (
    <div
      id={anchorId}
      className={cn(
        "rounded-lg border px-3 py-2 transition-shadow scroll-mt-24",
        borderClass,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {group.label}
            {isCritical && status !== "normal" && (
              <span className="text-[10px] uppercase tracking-wide text-destructive font-semibold">
                obrigatório
              </span>
            )}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Conflito com candidatos */}
      {status === "conflito" && conflict && Array.isArray(conflict.candidates) && conflict.candidates.length > 0 && !manual ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Encontramos valores diferentes para este campo. Escolha qual usar:
          </p>
          <div className="flex flex-wrap gap-2">
            {conflict.candidates.map((cand, idx) => (
              <Button
                key={`${cand?.value ?? idx}-${idx}`}
                type="button"
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                onClick={() => onChange(String(cand?.value ?? ""))}
              >
                <span className="text-xs text-muted-foreground shrink-0">
                  {idx === 0 ? "Documento principal" : `Documento ${idx + 1}`}:
                </span>
                <span className="font-medium">{String(cand?.value ?? "")}</span>
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setManual(true)}>
              Digitar manualmente
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              status === "nao_encontrado" && "border-destructive/60",
              status === "conflito" && "border-destructive/60",
              status === "revisar" && "border-amber-500/60",
            )}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] text-muted-foreground min-h-[1rem]">
              {meta?.hasConflict === false && meta.source && status === "revisar" && (
                <>Origem: {String(meta.source).replace(/_/g, " ")}</>
              )}
            </div>
            <div className="flex items-center gap-1">
              {status === "revisar" && !blank && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-emerald-700 hover:text-emerald-700"
                  onClick={onConfirm}
                >
                  <Check className="h-3 w-3" /> Confirmar informação atual
                </Button>
              )}
              {manual && conflict && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setManual(false)}
                >
                  Voltar às opções
                </Button>
              )}
              {group.keys.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAlt((v) => !v)}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ChevronRight
                    className={cn("h-3 w-3 transition-transform", showAlt && "rotate-90")}
                  />
                  {group.keys.length} campos vinculados
                </button>
              )}
            </div>
          </div>
          {showAlt && group.keys.length > 1 && (
            <div className="text-[11px] text-muted-foreground pl-4 pt-1">
              Este dado é aplicado em: {group.keys.map((k) => getFriendlyLabel(k)).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Indicador auxiliar (usado por callers) para saber se uma pendência
 * originou-se em campo crítico. Não usado internamente aqui.
 */
export function hasCriticalBlocking(summary: ReviewSummary): boolean {
  return summary.blockingKeys.length > 0;
}

// Re-export defensivo para consumidores externos que queriam um loader.
export const DocumentReviewLoading = () => (
  <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
    <Loader2 className="h-4 w-4 animate-spin" /> Preparando revisão…
  </div>
);
