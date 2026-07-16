/**
 * Helpers puros para a "triagem rápida" do processo Sepultamento.
 *
 * Sem dependências de UI, DOM ou Supabase — para permitir testes puros e
 * uso tanto no client quanto no server ao montar o payload do DOCX.
 */

export type LocalSepultamento = "quadra_geral" | "jazigo";

export type QuickDateChoice = "hoje" | "amanha" | "mais2" | "outra";

/** Horários oficiais de sepultamento (seleção única). */
export const HORARIOS_SEPULTAMENTO = [
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

/** Salas de velório (seleção única) — A..F ou "SEM VELÓRIO". */
export const SALAS_VELORIO = ["A", "B", "C", "D", "E", "F"] as const;

/**
 * Aplica o efeito colateral da escolha do local do sepultamento nos campos
 * derivados de triagem (`concessao`, `quadra_geral_gaveta`).
 */
export function applyLocalSepultamento(
  local: LocalSepultamento,
): { concessao: "SIM" | "NAO"; quadra_geral_gaveta: "SIM" | "NAO" } {
  if (local === "quadra_geral") return { concessao: "NAO", quadra_geral_gaveta: "SIM" };
  return { concessao: "SIM", quadra_geral_gaveta: "NAO" };
}

/** Retorna a data ISO (YYYY-MM-DD) para os presets rápidos. */
export function computeQuickDate(
  choice: Exclude<QuickDateChoice, "outra">,
  base: Date = new Date(),
): string {
  const offset = choice === "hoje" ? 0 : choice === "amanha" ? 1 : 2;
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Converte YYYY-MM-DD → DD/MM/AAAA. Retorna a string original se inválida. */
export function formatIsoToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export interface TriagemSepultamentoState {
  /** "quadra_geral" | "jazigo" — usado como `subprocess`. */
  subprocess?: string;
  /** ISO YYYY-MM-DD. */
  data_agendada?: string;
  hora_sepultamento?: string;
  /** Letra A..F, string vazia quando "sem_velorio". */
  sala_velorio?: string;
  sem_velorio?: "SIM" | "";
  /** Só efetivado depois de "Confirmar". */
  placa_identificacao?: string;
  placa_confirmada?: "SIM" | "";
}

/**
 * Valida se a triagem pode ser confirmada. Retorna a lista de mensagens de
 * erro na ordem em que devem ser exibidas (a UI mostra apenas a primeira).
 * A placa NÃO é obrigatória.
 */
export function validateTriagemSepultamento(state: TriagemSepultamentoState): string[] {
  const errors: string[] = [];
  if (state.subprocess !== "quadra_geral" && state.subprocess !== "jazigo") {
    errors.push("Selecione o local do sepultamento (Quadra geral ou Jazigo).");
  }
  if (!state.data_agendada?.trim()) {
    errors.push("Selecione a data do sepultamento.");
  }
  if (!state.hora_sepultamento?.trim()) {
    errors.push("Selecione o horário do sepultamento.");
  }
  const hasSala = !!state.sala_velorio?.trim();
  const semVelorio = state.sem_velorio === "SIM";
  if (!hasSala && !semVelorio) {
    errors.push("Selecione a sala do velório ou marque \"Sem velório\".");
  }
  return errors;
}

/**
 * Constrói o subconjunto de campos que devem sobrescrever `extracted_data`
 * na geração do DOCX. A placa só entra se confirmada. Sala fica vazia quando
 * "Sem velório" (o modelo pode omitir/renderizar em branco via `nullGetter`).
 */
export function buildTriagemOverrides(state: TriagemSepultamentoState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.data_agendada) out.data_sepultamento = formatIsoToBr(state.data_agendada);
  if (state.hora_sepultamento) out.hora_sepultamento = state.hora_sepultamento;
  if (state.sem_velorio === "SIM") {
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
