from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Trecho não encontrado em {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# 1) A triagem passa a produzir todos os campos operacionais que controla.
replace_once(
    "src/lib/triagem-sepultamento.ts",
    '''  /** Letra A..F. */
  sala_velorio?: string;
  /** Compatibilidade com documentos e atendimentos anteriores. */
  sem_velorio?: "SIM" | "";
  /** Só efetivado depois de "Confirmar". */
  placa_identificacao?: string;
  placa_confirmada?: "SIM" | "";
}
''',
    '''  /** Letra A..F. */
  sala_velorio?: string;
  inicio_velorio?: string;
  fim_velorio?: string;
  local_sepultamento?: string;
  funeraria?: string;
  /** Compatibilidade com documentos e atendimentos anteriores. */
  sem_velorio?: "SIM" | "";
  /** Valor informado deliberadamente na triagem. */
  placa_identificacao?: string;
  placa_confirmada?: "SIM" | "";
}

/**
 * Chaves que já foram definidas na triagem e não devem reaparecer como campos
 * editáveis na revisão do documento. Inclui aliases canônicos e legados.
 */
export const TRIAGEM_SEPULTAMENTO_REVIEW_KEYS = new Set([
  "data_sepultamento",
  "dataSepultamento",
  "dataSep",
  "hora_sepultamento",
  "horario_sepultamento",
  "horaSepultamento",
  "horaSep",
  "sala_velorio",
  "salaVelorio",
  "sala",
  "inicio_velorio",
  "inicio",
  "fim_velorio",
  "fim",
  "local_sepultamento",
  "localSepultamento",
  "funeraria",
  "empresa_funeraria",
  "empresaFuneraria",
  "placa_identificacao",
  "placaIdentificacao",
  "placa",
  "concessao",
  "quadra_geral_gaveta",
]);
''',
)

replace_once(
    "src/lib/triagem-sepultamento.ts",
    '''export function buildTriagemOverrides(state: TriagemSepultamentoState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.data_agendada) out.data_sepultamento = formatIsoToBr(state.data_agendada);
  if (state.hora_sepultamento) out.hora_sepultamento = state.hora_sepultamento;
  const semVelorio = state.tem_velorio === "NAO" || state.sem_velorio === "SIM";
  if (semVelorio) {
    out.sala_velorio = "";
  } else if (state.sala_velorio) {
    out.sala_velorio = state.sala_velorio;
  }
  if (state.placa_confirmada === "SIM" && state.placa_identificacao?.trim()) {
    out.placa_identificacao = state.placa_identificacao.trim();
  }
  if (state.subprocess === "quadra_geral" || state.subprocess === "jazigo") {
    const { concessao, quadra_geral_gaveta } = applyLocalSepultamento(state.subprocess);
    out.concessao = concessao;
    out.quadra_geral_gaveta = quadra_geral_gaveta;
  }
  return out;
}
''',
    '''export function buildTriagemOverrides(state: TriagemSepultamentoState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.data_agendada) out.data_sepultamento = formatIsoToBr(state.data_agendada);
  if (state.hora_sepultamento) {
    out.hora_sepultamento = state.hora_sepultamento;
    out.horario_sepultamento = state.hora_sepultamento;
  }
  const semVelorio = state.tem_velorio === "NAO" || state.sem_velorio === "SIM";
  if (semVelorio) {
    out.sala_velorio = "";
    out.inicio_velorio = "";
    out.fim_velorio = "";
  } else {
    if (state.sala_velorio) out.sala_velorio = state.sala_velorio;
    if (state.inicio_velorio) out.inicio_velorio = state.inicio_velorio;
    if (state.fim_velorio) out.fim_velorio = state.fim_velorio;
  }
  if (state.local_sepultamento?.trim()) {
    out.local_sepultamento = state.local_sepultamento.trim();
  }
  if (state.funeraria?.trim()) {
    out.funeraria = state.funeraria.trim();
    out.empresa_funeraria = state.funeraria.trim();
  }
  if (state.placa_identificacao?.trim()) {
    out.placa_identificacao = state.placa_identificacao.trim();
  }
  if (state.subprocess === "quadra_geral" || state.subprocess === "jazigo") {
    const { concessao, quadra_geral_gaveta } = applyLocalSepultamento(state.subprocess);
    out.concessao = concessao;
    out.quadra_geral_gaveta = quadra_geral_gaveta;
  }
  return out;
}
''',
)

# 2) Digitação manual da placa é uma confirmação deliberada.
replace_once(
    "src/components/triagem-sepultamento.tsx",
    '''  function updatePlacaText(value: string) {
    onExtrasChange({ placa_identificacao: value, placa_confirmada: "" });
    setPlacaEncontrada(null);
  }
''',
    '''  function updatePlacaText(value: string) {
    onExtrasChange({
      placa_identificacao: value,
      placa_confirmada: value.trim() ? "SIM" : "",
    });
    setPlacaEncontrada(null);
  }
''',
)

# 3) A revisão herda a triagem, não exibe campos duplicados e preserva metadados.
route = "src/routes/_authed.atendimento.$id.tsx"
replace_once(
    route,
    '''import type { FieldConflict } from "@/lib/domain/vision/types";
''',
    '''import type { FieldConflict } from "@/lib/domain/vision/types";
import {
  buildTriagemOverrides,
  TRIAGEM_SEPULTAMENTO_REVIEW_KEYS,
} from "@/lib/triagem-sepultamento";
''',
)

replace_once(
    route,
    '''  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
''',
    '''  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const triagemFields = useMemo<Record<string, string>>(() => {
    if (att?.process !== "sepultamento") return {};
    const details = (att.subprocess_details as Record<string, string>) ?? {};
    return buildTriagemOverrides({
      subprocess: att.subprocess ?? undefined,
      data_agendada: details.data_agendada,
      hora_sepultamento: details.hora_sepultamento,
      tem_velorio: (details.tem_velorio as "SIM" | "NAO" | "") || "",
      sala_velorio: details.sala_velorio,
      inicio_velorio: details.inicio_velorio,
      fim_velorio: details.fim_velorio,
      local_sepultamento: details.local_sepultamento,
      funeraria: details.funeraria,
      sem_velorio: (details.sem_velorio as "SIM" | "") || "",
      placa_identificacao: details.placa_identificacao,
      placa_confirmada: (details.placa_confirmada as "SIM" | "") || "",
    });
  }, [att?.process, att?.subprocess, att?.subprocess_details]);

  useEffect(() => {
''',
)

replace_once(
    route,
    '''      setFields(flat);
    }
  }, [att?.extracted_data]);
''',
    '''      setFields({ ...flat, ...triagemFields });
    }
  }, [att?.extracted_data, triagemFields]);
''',
)

replace_once(
    route,
    '''  const criticalKeys = useMemo(
    () => getCriticalFieldKeys(applicableTemplates),
    [applicableTemplates],
  );

  const reviewSummary = useMemo(
''',
    '''  const reviewFields = useMemo(
    () =>
      att?.process === "sepultamento"
        ? allFields.filter((key) => !TRIAGEM_SEPULTAMENTO_REVIEW_KEYS.has(key))
        : allFields,
    [allFields, att?.process],
  );

  const criticalKeys = useMemo(
    () => getCriticalFieldKeys(applicableTemplates),
    [applicableTemplates],
  );

  const reviewSummary = useMemo(
''',
)

replace_once(
    route,
    '''        keys: allFields,
        fields,
        meta: effectiveMeta,
        criticalKeys,
      }),
    [allFields, fields, effectiveMeta, criticalKeys],
''',
    '''        keys: reviewFields,
        fields,
        meta: effectiveMeta,
        criticalKeys,
      }),
    [reviewFields, fields, effectiveMeta, criticalKeys],
''',
)

replace_once(
    route,
    '''      setFields(extracted);
      if (autoGenerate && att) {
''',
    '''      const consolidated = { ...extracted, ...triagemFields };
      setFields(consolidated);
      if (autoGenerate && att) {
''',
)

replace_once(
    route,
    '''            extractedData: extracted,
''',
    '''            extractedData: consolidated,
''',
)

replace_once(
    route,
    '''      .update({ extracted_data: fields, status: "reviewing" })
''',
    '''      .update({
        extracted_data: buildPersistedExtractedData(att.extracted_data, fields, effectiveMeta),
        status: "reviewing",
      })
''',
)

replace_once(
    route,
    '''    await supabase.from("attendances").update({ extracted_data: fields }).eq("id", id);
    setGeneratingId(templateId);
''',
    '''    await supabase
      .from("attendances")
      .update({ extracted_data: buildPersistedExtractedData(att.extracted_data, fields, effectiveMeta) })
      .eq("id", id);
    setGeneratingId(templateId);
''',
)

replace_once(
    route,
    '''    await supabase.from("attendances").update({ extracted_data: fields }).eq("id", id);
    for (const template of applicableTemplates) {
''',
    '''    await supabase
      .from("attendances")
      .update({ extracted_data: buildPersistedExtractedData(att.extracted_data, fields, effectiveMeta) })
      .eq("id", id);
    for (const template of applicableTemplates) {
''',
)

replace_once(
    route,
    '''            <CardContent>
              {extracting && !Object.keys(fields).length && (
''',
    '''            <CardContent>
              {att.process === "sepultamento" && Object.keys(triagemFields).length > 0 && (
                <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-sm font-medium">Dados da triagem já aplicados</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Modalidade, data, horário, sala, placa e demais dados operacionais não precisam
                    ser preenchidos novamente nesta tela.
                  </p>
                </div>
              )}
              {extracting && !Object.keys(fields).length && (
''',
)

replace_once(route, '''                  keys={allFields}
''', '''                  keys={reviewFields}
''')

# 4) Pipeline de visão: triagem sobrescreve IA e fica marcada como confirmada.
vision = "src/lib/vision/extract-attendance.functions.ts"
replace_once(
    vision,
    '''    const { flattenVisionState } = await import("./flatten-vision");
    const { flat, meta } = flattenVisionState(state);

    // Preserva chaves já confirmadas manualmente em extracted_data (que não
''',
    '''    const { flattenVisionState } = await import("./flatten-vision");
    const { flat, meta } = flattenVisionState(state);
    let finalFlat = flat;
    let finalMeta = meta;

    if (attendance.process === "sepultamento") {
      const { buildTriagemOverrides } = await import("@/lib/triagem-sepultamento");
      const details = (attendance.subprocess_details as Record<string, string>) ?? {};
      const triagem = buildTriagemOverrides({
        subprocess: attendance.subprocess ?? undefined,
        data_agendada: details.data_agendada,
        hora_sepultamento: details.hora_sepultamento,
        tem_velorio: (details.tem_velorio as "SIM" | "NAO" | "") || "",
        sala_velorio: details.sala_velorio,
        inicio_velorio: details.inicio_velorio,
        fim_velorio: details.fim_velorio,
        local_sepultamento: details.local_sepultamento,
        funeraria: details.funeraria,
        sem_velorio: (details.sem_velorio as "SIM" | "") || "",
        placa_identificacao: details.placa_identificacao,
        placa_confirmada: (details.placa_confirmada as "SIM" | "") || "",
      });
      finalFlat = { ...flat, ...triagem };
      finalMeta = { ...meta };
      for (const [key, value] of Object.entries(triagem)) {
        finalMeta[key] = {
          key,
          value,
          confidence: 1,
          source: "triagem",
          confirmedByUser: true,
        };
      }
    }

    // Preserva chaves já confirmadas manualmente em extracted_data (que não
''',
)
replace_once(vision, '''      ...flat,
      _vision: state,
      _visionMeta: meta,
''', '''      ...finalFlat,
      _vision: state,
      _visionMeta: finalMeta,
''')
replace_once(vision, '''        ...flat,
      });
''', '''        ...finalFlat,
      });
''')
replace_once(vision, '''    return { data: flat, meta, state, errors };
''', '''    return { data: finalFlat, meta: finalMeta, state, errors };
''')

# 5) Extrator legado também respeita a triagem.
legacy = "src/lib/attendances.functions.ts"
replace_once(
    legacy,
    '''    if (!Object.keys(extracted).length) {
      await supabase.from("attendances").update({ status: "error" }).eq("id", data.attendanceId);
      throw new Error("A IA não devolveu dados válidos. Tente novamente.");
    }

    const { error: saveError } = await supabase
''',
    '''    if (!Object.keys(extracted).length) {
      await supabase.from("attendances").update({ status: "error" }).eq("id", data.attendanceId);
      throw new Error("A IA não devolveu dados válidos. Tente novamente.");
    }

    let finalExtracted = extracted;
    if (attendance.process === "sepultamento") {
      const { buildTriagemOverrides } = await import("./triagem-sepultamento");
      const details = (attendance.subprocess_details as Record<string, string>) ?? {};
      finalExtracted = {
        ...extracted,
        ...buildTriagemOverrides({
          subprocess: attendance.subprocess ?? undefined,
          data_agendada: details.data_agendada,
          hora_sepultamento: details.hora_sepultamento,
          tem_velorio: (details.tem_velorio as "SIM" | "NAO" | "") || "",
          sala_velorio: details.sala_velorio,
          inicio_velorio: details.inicio_velorio,
          fim_velorio: details.fim_velorio,
          local_sepultamento: details.local_sepultamento,
          funeraria: details.funeraria,
          sem_velorio: (details.sem_velorio as "SIM" | "") || "",
          placa_identificacao: details.placa_identificacao,
          placa_confirmada: (details.placa_confirmada as "SIM" | "") || "",
        }),
      };
    }

    const { error: saveError } = await supabase
''',
)
replace_once(legacy, '''      .update({ extracted_data: extracted, status: "reviewing" })
''', '''      .update({ extracted_data: finalExtracted, status: "reviewing" })
''')
replace_once(legacy, '''    const agendaSynced = await syncLinkedAgenda(supabase, data.attendanceId, extracted);

    return { data: extracted, agendaSynced };
''', '''    const agendaSynced = await syncLinkedAgenda(supabase, data.attendanceId, finalExtracted);

    return { data: finalExtracted, agendaSynced };
''')

replace_once(
    legacy,
    '''        hora_sepultamento: details.hora_sepultamento,
        sala_velorio: details.sala_velorio,
        sem_velorio: (details.sem_velorio as "SIM" | "") || "",
''',
    '''        hora_sepultamento: details.hora_sepultamento,
        tem_velorio: (details.tem_velorio as "SIM" | "NAO" | "") || "",
        sala_velorio: details.sala_velorio,
        inicio_velorio: details.inicio_velorio,
        fim_velorio: details.fim_velorio,
        local_sepultamento: details.local_sepultamento,
        funeraria: details.funeraria,
        sem_velorio: (details.sem_velorio as "SIM" | "") || "",
''',
)

# 6) Testes de regressão.
test = "src/lib/__tests__/triagem-sepultamento.test.ts"
replace_once(
    test,
    '''  SALAS_VELORIO,
} from "@/lib/triagem-sepultamento";
''',
    '''  SALAS_VELORIO,
  TRIAGEM_SEPULTAMENTO_REVIEW_KEYS,
} from "@/lib/triagem-sepultamento";
''',
)
replace_once(
    test,
    '''  it("buildTriagemOverrides não inclui placa quando não confirmada", () => {
''',
    '''  it("buildTriagemOverrides usa placa digitada na triagem como fonte de verdade", () => {
''',
)
replace_once(
    test,
    '''    expect(out.placa_identificacao).toBeUndefined();
''',
    '''    expect(out.placa_identificacao).toBe("12345");
''',
)
replace_once(
    test,
    '''  it("buildTriagemOverrides zera sala quando for somente sepultamento", () => {
''',
    '''  it("buildTriagemOverrides inclui todos os dados operacionais da triagem", () => {
    const out = buildTriagemOverrides({
      subprocess: "jazigo",
      data_agendada: "2026-07-16",
      hora_sepultamento: "14:00",
      tem_velorio: "SIM",
      sala_velorio: "B",
      inicio_velorio: "09:00",
      fim_velorio: "13:30",
      local_sepultamento: "Rua 03, terreno 10",
      funeraria: "Consolare",
      placa_identificacao: "98765",
    });
    expect(out).toMatchObject({
      data_sepultamento: "16/07/2026",
      hora_sepultamento: "14:00",
      horario_sepultamento: "14:00",
      sala_velorio: "B",
      inicio_velorio: "09:00",
      fim_velorio: "13:30",
      local_sepultamento: "Rua 03, terreno 10",
      funeraria: "Consolare",
      empresa_funeraria: "Consolare",
      placa_identificacao: "98765",
      concessao: "SIM",
      quadra_geral_gaveta: "NAO",
    });
  });

  it("oculta da revisão os campos já definidos na triagem", () => {
    expect(TRIAGEM_SEPULTAMENTO_REVIEW_KEYS.has("data_sepultamento")).toBe(true);
    expect(TRIAGEM_SEPULTAMENTO_REVIEW_KEYS.has("horario_sepultamento")).toBe(true);
    expect(TRIAGEM_SEPULTAMENTO_REVIEW_KEYS.has("sala_velorio")).toBe(true);
    expect(TRIAGEM_SEPULTAMENTO_REVIEW_KEYS.has("placa_identificacao")).toBe(true);
    expect(TRIAGEM_SEPULTAMENTO_REVIEW_KEYS.has("inscricao_gscemi")).toBe(false);
  });

  it("buildTriagemOverrides zera sala quando for somente sepultamento", () => {
''',
)

print("Triagem consolidada como fonte de verdade.")
