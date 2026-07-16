
# Auditoria do leitor de fotos/prints + Plano da Fase 1

## 1. Arquitetura atual (resumo)

**Upload e armazenamento**
- Upload no wizard `src/routes/_authed.atendimento.novo.tsx` → grava blobs no bucket privado `attendance-images` (path `{userId}/{attendanceId}/{filename}`) e insere linhas em `attendance_images` (id, storage_path, mime_type, size_bytes, original_name).
- Nenhuma imagem em base64 no localStorage (bom).

**Extração (IA)**
- `src/lib/attendances.functions.ts::extractAttendanceData` baixa TODAS as imagens do atendimento, concatena em base64 e chama `src/lib/ai-extract.server.ts::extractFromImages`.
- `ai-extract.server.ts` monta um único prompt com todas as imagens juntas, chama `google/gemini-2.5-flash` via gateway Lovable com `response_format: json_object`.
- Resposta: um único objeto `Record<string, string>` sem indicação de fonte, entidade ou confiança.
- Se `JSON.parse` falhar → retorna `{}` (silencioso, dispara apenas erro genérico "IA não devolveu dados válidos").

**Persistência e revisão**
- `extracted_data` (jsonb) na tabela `attendances`: chave → valor plano.
- Tela de revisão em `_authed.atendimento.$id.tsx` renderiza cada chave como input livre.
- Sincronização de agenda em `syncLinkedAgenda()` usa aliases fixos (hardcoded).

**Geração**
- `generateDocument` usa `extracted_data` + `applyOfficialTemplateAliases` para preencher DOCX.

## 2. Limitações identificadas

| # | Limitação | Risco |
|---|-----------|-------|
| L1 | Todas imagens em um único prompt | Uma falha derruba tudo; impossível rastrear origem de cada campo |
| L2 | Sem status por imagem | Usuário não sabe qual falhou; sem reprocessamento individual |
| L3 | Sem hash/deduplicação | Uploads duplicados consomem créditos |
| L4 | Sem pré-processamento (EXIF, resize) | Imagens grandes, orientação errada, custo elevado |
| L5 | Schema da IA fraco (`Record<string,string>`) | JSON inválido cai em `{}` silencioso; sem confiança, entidade ou fonte |
| L6 | Aliases espalhados (`syncLinkedAgenda`, `official-templates.ts`, prompt) | Chaves divergem entre módulos, difícil manter |
| L7 | Sem validação determinística (CPF, datas, horários) | IA pode inventar CPF válido semanticamente mas inválido |
| L8 | Sem classificação de documento | Impossível priorizar campos ou detectar tipo |
| L9 | Sem consolidação/conflito | Segunda imagem sobrescreve primeira silenciosamente |
| L10 | Sem contexto de processo enviado explicitamente à IA | Extrai campos irrelevantes |
| L11 | Logs podem vazar payload completo em erros | Privacidade |
| L12 | Sem testes automatizados do pipeline | Regressões silenciosas |

## 3. Arquivos que serão tocados (mapa geral)

| Arquivo | Papel |
|---------|-------|
| `src/lib/extraction/types.ts` (novo) | Tipos `ExtractedField`, `ImageProcessingState`, `ExtractionResult`, enums |
| `src/lib/extraction/field-catalog.ts` (novo) | Catálogo canônico único (chave, aliases, entidade, tipo, validador, processos) |
| `src/lib/extraction/schemas.ts` (novo) | Schemas Zod da resposta da IA e das entidades |
| `src/lib/extraction/validators.ts` (novo) | CPF, CEP, datas, horários, telefone, nome, inscrição |
| `src/lib/extraction/aliases.ts` (novo) | Resolvedor `alias → chave canônica` (usa catálogo) |
| `src/lib/extraction/__tests__/*.test.ts` (novo) | Vitest para validadores, catálogo, aliases, schemas |
| `vitest.config.ts` / `package.json` | Somente se ainda não houver vitest configurado |

**Não tocar nesta fase:** `ai-extract.server.ts`, `attendances.functions.ts`, rotas, UI, migrations, DOCX, agendas.

## 4. Plano por fases (execução após aprovação)

- **Fase 1 (esta):** fundação isolada — tipos, catálogo, schemas Zod, validadores determinísticos, testes unitários. **Zero mudança de comportamento em runtime.**
- **Fase 2:** processamento individual por imagem no server (loop, status, hash, retries) — usa Fase 1.
- **Fase 3:** classificação + extração contextual + fonte + confiança — troca prompt e resposta da IA para o schema da Fase 1.
- **Fase 4:** consolidação, conflitos, remoção/reprocessamento inteligentes.
- **Fase 5:** UI de fotos e de revisão (miniaturas, status, filtros, "ver fonte").

Cada fase termina com: testes verdes + `tsgo` + build + diff apresentado + espera aprovação.

## 5. Detalhe da Fase 1 (o que será feito agora)

### 5.1 `src/lib/extraction/types.ts`
- `EntityType` (falecido, responsavel, requerente, concessionario, administrador, sucessor, autorizado, jazigo, ossario, atendimento, funeraria, outro)
- `DocumentType` (documento_identidade, cpf, comprovante_endereco, certidao_obito, tela_sistema_interno, documento_jazigo, ordem_sepultamento, ordem_exumacao, termo_responsabilidade, documento_ossuario, documento_translado, atualizacao_cadastral, recibo, desconhecido)
- `FieldStatus` (confirmado, revisar, conflito, invalido)
- `ImageProcessingStatus` (pendente, preparando, processando, concluida, precisa_revisao, duplicada, erro)
- `ExtractedField`, `ImageState`, `ExtractionRunResult`, `FieldAlternative`

### 5.2 `src/lib/extraction/field-catalog.ts`
- Uma constante `FIELD_CATALOG: FieldDefinition[]`.
- `FieldDefinition`: `key`, `label`, `entity`, `aliases[]`, `type` ("text"|"cpf"|"date"|"time"|"cep"|"phone"|"email"|"number"|"name"), `processes[]` (quais processos usam), `format?`, `validator?` (nome do validador em `validators.ts`), `priority` (1..3), `sensitive: boolean`.
- Cobertura inicial: campos hoje usados no prompt + em `syncLinkedAgenda` + em `official-templates` (nome_falecido, cpf_falecido, cpf_responsavel, inscricao_gs, sala_velorio, inicio_velorio, fim_velorio, hora_sepultamento, local_sepultamento, funeraria, hora_agendamento, localizacao, quadra, terreno, gaveta, referencia_pss, endereco, telefone, data_nascimento, data_falecimento, data_sepultamento).
- Helpers: `getFieldByAlias(alias)`, `getFieldsForProcess(process)`, `canonicalize(rawKey)`.

### 5.3 `src/lib/extraction/aliases.ts`
- Constrói mapa `alias → canonicalKey` a partir do catálogo (evita duplicar strings pelo código).
- Função `resolveAlias(input: string): string | null`.
- Normalização: lowercase, remove acentos, remove `_`/camelCase → snake.

### 5.4 `src/lib/extraction/validators.ts`
- `validateCPF(value)`: strip pontuação, 11 dígitos, rejeita repetidos, valida DVs.
- `validateDateBR(value)`: DD/MM/AAAA, datas possíveis, retorna ISO.
- `validateTime(value)`: HH:mm 00:00–23:59.
- `validateCEP(value)`: 8 dígitos.
- `validatePhoneBR(value)`: DDD + 8/9 dígitos, sem inventar.
- `validateEmail(value)`.
- `sanitizeName(value)`: espaços colapsados, mantém acentos, não força uppercase.
- `preserveLeadingZeros(value)`: string, nunca converter para Number.
- Cada função retorna `{ ok: boolean; normalized?: string; reason?: string }`.

### 5.5 `src/lib/extraction/schemas.ts`
- Zod schemas correspondentes aos tipos:
  - `ExtractedFieldSchema` (sem `.min`/`.max` — validações vão nos validators).
  - `DocumentClassificationSchema` (documentType enum, confidence 0..1, reason, possibleAlternatives array).
  - `AIResponseSchema` = `{ documentClassification, fields: ExtractedField[], warnings: string[], missingExpectedFields: string[], processingNotes: string[] }`.
- `parseAIResponse(raw: unknown)`: `{ ok: true, data } | { ok: false, error }`.

### 5.6 Testes (Vitest, colocados em `src/lib/extraction/__tests__/`)
- `validators.test.ts`: 20+ casos (CPF válido/inválido/repetido, datas impossíveis, horários limite, CEP, telefone, preserva zeros).
- `field-catalog.test.ts`: aliases resolvem, campos por processo, sem chaves duplicadas.
- `aliases.test.ts`: camelCase→snake, acentos, unknown → null.
- `schemas.test.ts`: JSON válido, JSON inválido, campos faltantes → mensagens claras.

Meta: ~30–40 testes, todos determinísticos, sem chamadas à IA.

### 5.7 Verificações ao final da Fase 1
- `bunx vitest run src/lib/extraction` → 100% verde.
- `tsgo --noEmit` limpo nos arquivos novos.
- `bun run build` (o harness roda automaticamente).
- Nenhum arquivo de runtime existente é alterado; comportamento atual do sistema inalterado.

## 6. Aguardando aprovação

Ao aprovar este plano, executarei **apenas a Fase 1** e apresentarei diff + resultado dos testes/typecheck/build. Não seguirei para a Fase 2 sem nova aprovação.
