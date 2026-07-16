# Assistente "Confirmar pessoas e informações"

Escopo grande (25 seções, 30 testes). Para minimizar risco de quebrar geração de documentos e agenda (que estão fora do escopo), proponho **6 fases incrementais**. Cada fase entrega valor isolado, com testes verdes antes de avançar.

## Restrições respeitadas (todas)

- Não altero atendimento, agendas, regras de documentos, PDF/Word.
- Sem deploy, sem publicar, sem Prettier global.
- Testes existentes preservados.
- Dados vivem apenas no atendimento atual (sem cadastro permanente de pessoa).
- Logs sem PII (só imageId, tipo, contagem, duração, status, hash parcial).

## Fase 1 — Domínio puro (sem UI, sem IA)

Arquivos novos em `src/lib/domain/vision/`:

- `types.ts` — `ImageRecord`, `ExtractedPerson`, `RoleCandidate`, `ImageExtractionResult`, `ConfirmedField`, status enum.
- `document-types.ts` — enum de tipos de documento + `expectedRolesForProcess(process)`.
- `validators.ts` — CPF (11 dígitos + DV + rejeita repetidos), data ISO, telefone, CEP, email, HH:mm, preservação de zeros.
- `person-consolidation.ts` — mescla por CPF → RG → nome+nascimento → nome+telefone → nome+endereço → similaridade forte. Nunca funde só por nome parecido.
- `role-inference.ts` — regras determinísticas: declarante ≠ responsável, concessionário exige evidência específica, PPS mantém dois falecidos separados.
- `confidence.ts` — cálculo agregando rótulo/tipo/consistência/repetição/validação/conflito.
- `__tests__/` — cobre testes 1-10, 16-18 (puros, sem UI/IA).

## Fase 2 — Schema Zod e cliente IA por imagem

- `src/lib/domain/vision/schema.ts` — Zod para `ImageExtractionResult` com retry único de parse.
- `src/lib/vision/classify-and-extract.functions.ts` — server function `createServerFn` que recebe uma imagem (base64 + mime), chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com prompt que espera schema estrito, valida com Zod. Se inválido: 1 retry, senão retorna erro daquela imagem.
- Logging server-side: só imageId, documentType, duração, status. Sem PII, sem base64, sem resposta bruta.
- Testes de schema (JSON inválido não retorna sucesso vazio, teste 24).

## Fase 3 — Store do atendimento (session state)

`src/lib/vision/attendance-vision-store.ts` (Zustand ou reducer em contexto):

- `images: ImageRecord[]`, `persons: ExtractedPerson[]`, `fields: ConfirmedField[]`.
- Ações: `addImages`, `reprocessImage`, `removeImage`, `mergePersons`, `splitPersons`, `answerRole`, `confirmField`, `confirmBatch`.
- Preserva `confirmedByUser: true` em reprocess/add/remove.
- Remove órfãos automáticos, mantém confirmados manuais mesmo perdendo fonte (com aviso).
- Testes 13, 20-23, 28-29.

## Fase 4 — UI da etapa "Analisar documentos" (Etapa 1)

Componente `AnalyzeDocumentsStep`:

- Grid de cards por imagem: thumbnail, status, tipo detectado, confiança, erro, botões reprocessar/remover/visualizar.
- Barra "6 de 8 documentos concluídos".
- Processamento paralelo com limite; erro em uma não bloqueia demais.
- Botão "Adicionar imagens" e "Reprocessar imagens com erro".

## Fase 5 — UI "Confirmar pessoas" (Etapa 2) — coração da UX

Componente `ConfirmPersonsWizard`:

- Pergunta uma-a-uma para papéis esperados do processo atual (`expectedRolesForProcess`).
- Botões grandes: Sim / Não / Não tenho certeza. Atalhos teclado 1/2/3.
- Ao responder Não: mostra outros candidatos + input livre + "não encontrado".
- Card de fonte: "Certidão de óbito", "Confiança: Alta", botão "Ver documento" que abre a imagem.
- Diálogo de unificação: "Esses registros representam a mesma pessoa?" [Sim, unir] [Não, manter separados].
- Confirmação em lote quando alta confiança e sem conflito ("Confirmar tudo" / "Revisar uma por uma").

## Fase 6 — Etapas 3, 4, 5 + integração

- Etapa 3 `ConfirmLocationStep`: inscrição/livro/folha/quadra/rua/terreno/gaveta com "Confirmar tudo" e resolução de conflitos ("Qual valor utilizar?").
- Etapa 4 `ReviewPendingStep`: só conflitos, inválidos, obrigatórios ausentes, papéis não confirmados.
- Etapa 5 `ReadySummaryStep`: resumo final → prossegue para geração (não altero geração).
- Rota nova ou etapa dentro do atendimento existente (a definir — ver pergunta abaixo).

## Testes

Suíte nova `src/lib/domain/vision/__tests__/` + `src/lib/vision/__tests__/` cobrindo os 30 casos listados. Testes de UI de wizard com Testing Library nos cenários 11, 12, 14, 15, 27, 30.

## Validações finais

`bunx vitest run` + `bunx tsgo --noEmit` + `bun run build` + ESLint só nos arquivos alterados.

## Perguntas antes de começar

1. **Onde plugar o wizard?** (a) Substituir a tela atual de "Dados Extraídos" em `_authed.atendimento.novo`; (b) Nova rota `/atendimento/:id/confirmar`; (c) Modal/drawer dentro da tela atual.
2. **Confirmar Fase 1 primeiro** e mostrar testes verdes antes de tocar em UI, ou **executar Fases 1+2+3 em sequência** antes de te mostrar a UI?
