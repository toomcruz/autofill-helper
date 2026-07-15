export type ProcessKey =
  | "sepultamento"
  | "exumacao"
  | "ossario"
  | "translado"
  | "atualizacao_cadastral";

export interface ProcessDef {
  key: ProcessKey;
  label: string;
  description: string;
  subprocessLabel?: string;
  subprocessOptions?: { value: string; label: string }[];
  extraFields?: { name: string; label: string; type: "text" | "textarea" }[];
}

export const PROCESSES: ProcessDef[] = [
  {
    key: "sepultamento",
    label: "Sepultamento",
    description: "Registro de novo sepultamento em quadra geral ou jazigo.",
    subprocessLabel: "Local",
    subprocessOptions: [
      { value: "quadra_geral", label: "Quadra geral" },
      { value: "jazigo", label: "Jazigo" },
    ],
  },
  {
    key: "exumacao",
    label: "Exumação",
    description: "Exumação em quadra geral ou jazigo.",
    subprocessLabel: "Local",
    subprocessOptions: [
      { value: "quadra_geral", label: "Quadra geral" },
      { value: "jazigo", label: "Jazigo" },
    ],
  },
  {
    key: "ossario",
    label: "Ossário",
    description: "Aluguel, aquisição ou renovação de ossário.",
    subprocessLabel: "Operação",
    subprocessOptions: [
      { value: "aluguel", label: "Aluguel" },
      { value: "aquisicao", label: "Aquisição" },
      { value: "renovacao", label: "Renovação" },
    ],
  },
  {
    key: "translado",
    label: "Translado",
    description: "Translado interno ou externo com origem e destino.",
    subprocessLabel: "Tipo",
    subprocessOptions: [
      { value: "interno", label: "Interno" },
      { value: "externo", label: "Externo" },
    ],
    extraFields: [
      { name: "origem", label: "Origem", type: "text" },
      { name: "destino", label: "Destino", type: "text" },
    ],
  },
  {
    key: "atualizacao_cadastral",
    label: "Atualização cadastral",
    description: "Atualizar dados do jazigo e responsáveis.",
  },
];

export function getProcess(key: string): ProcessDef | undefined {
  return PROCESSES.find((p) => p.key === key);
}
