# Plano — Integração da nova arquitetura de extração e confirmação

O escopo é grande demais para uma única entrega. Proponho executar em **incrementos verificáveis**, cada um com testes + typecheck + build antes de passar ao próximo. Sem deploy, sem publish.

## Estado atual (verificado)

- **Nova arquitetura já existe**: `src/lib/domain/*` (field-catalog canônico, expected-fields, template-payload, context-adapter, canonicalize, documents) e `src/lib/domain/vision/*` (types, document-types, validators, person-consolidation, role-inference, confidence). 186 testes passando.
- **Arquitetura antiga em uso**: `src/lib/extraction/*` (schemas, field-catalog, aliases, validators), `src/lib/ai-extract.server.ts` (uma única chamada com todas as imagens juntas, retorna `Record<string,string>`), `src/routes/_authed.atendimento.$id.tsx` (431 linhas, inputs genéricos).
- **A ponte ainda não existe**: `ai-extract` → `extraction/*` → `attendances.functions` → UI. É essa ponte que precisa ser trocada.

## Incrementos propostos

### Incremento 1 — Correção PPS/PSS + adaptador central de processo

Escopo pequeno, alto valor, zero regressão.

- Varrer código e templates buscando `PSS`, `referencia_pss`, `numero_pss` e corrigir para PPS onde o significado for "Exumação para Pronto Sepultamento".
- Consolidar `src/lib/domain/context-adapter.ts` como único ponto que traduz nomes antigos de processo (`sepultamento` → `velorio_sepultamento`) e remover checagens manuais espalhadas.
- Migration idempotente renomeando chaves legadas remanescentes em `extracted_data`.
- Testes: 17 (context-adapter converte processos antigos) + 18 (nenhuma referência PSS).

### Incremento 2 — Extração por imagem (backend)

Substituir `ai-extract.server.ts` pelo pipeline novo, mantendo a assinatura atual como wrapper de compatibilidade.

- Novo `src/lib/vision/extract-image.server.ts`: uma chamada Gemini por imagem, schema Zod real usando os tipos de `domain/vision/types.ts`, retry único em JSON inválido, logs sem PII (apenas imageId/tipo/duração/contagens).
- Novo `src/lib/vision/extract-batch.server.ts`: paraleliza N imagens com limite de concorrência, isola erros por imagem.
- `ai-extract.server.ts` vira adaptador fino que chama o novo pipeline e reduz para o shape antigo enquanto a UI legada não migra.
- Testes: 5 (independência), 6 (erro isolado), 7 (JSON vazio ≠ sucesso).

### Incremento 3 — Store de sessão + consolidação

- `src/lib/vision/attendance-vision-store.ts` (Zustand ou reducer): imagens, pessoas consolidadas, campos canônicos, `confirmedByUser`, conflitos.
- Consumir `person-consolidation` e `role-inference` já existentes.
- Reprocessar/adicionar/remover imagem preserva confirmações (Fase 7 do briefing).
- Persistir em `attendances.extracted_data.vision` (JSON), mantendo `extracted_data` plano para compatibilidade com a UI antiga durante a transição.
- Testes: 8, 9, 10, 11.

### Incremento 4 — Nova UI em etapas dentro de `_authed.atendimento.$id.tsx`

Substitui a seção de inputs genéricos. Rota mantida, componentes novos em `src/components/vision/`:

- `StepAnalyze`: grid de cards por imagem (miniatura, status, tipo, confiança, reprocessar/remover).
- `StepConfirmPeople`: perguntas rápidas Sim/Não/Não tenho certeza + atalhos + união manual.
- `StepConfirmFields`: seções humanas (Falecido, Responsável, Jazigo…) via `getExpectedFields`; rótulos humanos; obrigatórios primeiro.
- `StepConflicts`: só campos com conflito, obrigatórios vazios, papéis não confirmados.
- `StepGenerate`: lista documentos aplicáveis / prontos / bloqueados via `buildTemplatePayload`.

### Incremento 5 — Geração de documentos canônica

- `attendances.functions.ts` `generateDocuments` passa a chamar `buildTemplatePayload` com dados canônicos + `confirmedByUser`.
- Bloqueia documento com conflito não resolvido ou obrigatório vazio; status parcial quando "Gerar todos" mistura sucesso/erro; não marca `done` se houver falha.
- Testes: 12, 13, 14, 15, 16.

### Incremento 6 — Depreciação de `src/lib/extraction/*`

- Manter arquivos como reexports finos apontando para `src/lib/domain/*` (adaptador de compatibilidade), com `@deprecated` JSDoc.
- Nenhuma nova regra em `extraction/*`.
- Rodar testes 19 (agenda intacta) e 20 (modelos oficiais intactos).

## Preservação (checado a cada incremento)

Auth, dashboard, agenda, sync agenda, slots exumação, instalação de modelos oficiais, geração DOCX, download, Supabase/RLS, uploads existentes, atendimentos salvos.

## Validação por incremento

`bunx vitest run` + `bunx tsc --noEmit` + `bun run build`. Lint apenas nos arquivos tocados, reportando novos vs herdados.

## Decisões que preciso confirmar

1. **Ritmo**: aprovar todo o roadmap agora e eu executo incremento a incremento reportando ao fim de cada um, OU aprovar apenas o Incremento 1 primeiro?
2. **Persistência (Incremento 3)**: guardar o estado vision em `attendances.extracted_data.vision` (JSON dentro da tabela existente, sem migration) ou criar tabela filha `attendance_vision` vinculada por `attendance_id` com RLS?
3. **Store cliente (Incremento 3)**: Zustand (novo dep) ou `useReducer` + Context (zero dep)?

Confirme essas três respostas e eu começo pelo Incremento 1.
