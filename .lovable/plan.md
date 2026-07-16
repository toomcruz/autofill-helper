# Fase 2 — Integração UI ↔ Domínio (Velório/Sepultamento e PPS)

## Objetivo
Conectar a camada de domínio puro (criada na Fase 1) aos fluxos reais de atendimento e agenda, **sem** alterar prompts de IA, modelos DOCX, leitor de imagens ou regras administrativas já validadas.

## Escopo

### 1. Novo atendimento (`src/routes/_authed.atendimento.novo.tsx`)
- Consumir `getVisibleQuestions` / `cleanupObsoleteAnswers` de `src/lib/domain/questions.ts` e `cleanup.ts` para controlar quais perguntas aparecem e limpar respostas quando o usuário troca de processo.
- Consumir `getRequiredDocuments` de `src/lib/domain/documents.ts` para gerar a lista de documentos necessários por contexto (sepultamento, exumação comum, PPS).
- Para PPS/exumação: restringir o seletor de horário aos valores expostos em `EXHUMATION_TIME_SLOTS` e bloquear dias não úteis via `isExhumationWorkingDay`.

### 2. Agenda (`src/routes/_authed.agenda.tsx`)
- Ao renderizar a agenda de exumação, usar `isExhumationBlockingStatus` para determinar quais eventos ocupam vaga (mantém o layout atual — só corrige a lógica de "livre/ocupado").
- Nenhuma mudança visual/estrutural.

### 3. Server function (`src/lib/attendances.functions.ts`)
- Reutilizar `resolveAgendaType` + `shouldCreateAgendaEvent` + `buildAgendaSyncPatch` (já em `agenda-sync.ts`) nos pontos onde ainda houver lógica duplicada.
- Sem novas colunas, sem migration.

### 4. Testes
- Testes de integração leves (sem Supabase real) usando os helpers puros para validar:
  - Alternância sepultamento ↔ exumação limpa respostas corretas.
  - PPS exibe apenas os 3 slots de horário.
  - Documentos obrigatórios batem com a spec para cada contexto.

## Fora de escopo (explicitamente preservado)
- Prompts, modelo e pipeline da IA de extração.
- Modelos DOCX e catálogo oficial.
- Migrations Supabase (nenhuma nesta fase).
- Layout visual da agenda e do formulário.
- Deploy / publish / prettier global.

## Detalhes técnicos
- Todas as edições em arquivos existentes usam `line_replace`; nenhum arquivo novo além de testes.
- Tipagem estrita mantida (sem `as any` novos).
- Verificação final: `tsgo`, `vitest run`, `eslint` direcionado aos arquivos tocados.

## Entregáveis do relatório final
Arquitetura anterior/nova, arquivos alterados, testes adicionados, contagem de testes, resultados de typecheck/build/lint, confirmação de que leitor de imagens, prompts, DOCX e agenda visual não foram alterados e de que nenhum deploy foi feito.
