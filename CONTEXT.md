# Contexto de desenvolvimento — Folio API

> Última revisão documental: 2026-10-06.
> Este documento descreve o código e schema presentes no repositório nessa data. A existência de uma migration no repositório não prova que esteja aplicada num ambiente concreto.

## Como ler este documento

Os estados são explícitos:

- **Implementado** — comportamento confirmado em código, schema ou testes do repositório.
- **Limitação actual** — capacidade ausente, incompleta ou com uma lacuna verificada.
- **Decisão arquitectural** — princípio a preservar; não implica que toda a implementação futura esteja concluída.
- **Planeado** — trabalho recomendado ainda não implementado.

Não usar este documento para inferir o estado de outra aplicação. O âmbito aqui é exclusivamente `folio-api`.

## Visão geral e stack

### Implementado

- API HTTP em NestJS 12, TypeScript ESM e Node.js.
- PostgreSQL com Prisma ORM 7, `@prisma/adapter-pg` e `pg.Pool`.
- JWT para access tokens, Argon2id para passwords e hashes de refresh tokens.
- Swagger UI em `/docs`.
- Integração externa de catálogo exclusivamente server-side; PORBASE é o provider registado actualmente.
- Armazenamento de capas através de `StorageService`, com adaptadores `local_fs` e `in_memory`.
- `SafeHttpFetcherService`, `CoverAcquisitionServiceImpl`, `GET /editions/:id/cover` e `coverUrl` em respostas directas de Edition existem no código.

### Limitações actuais

- Não há adaptador S3.
- API e throttling usam estado local ao processo em vários pontos; não há backend partilhado de rate limit, fila de jobs nem worker separado.
- Não foi confirmado neste trabalho o estado das migrations em qualquer base de dados remota.

## Estrutura modular actual

O código de aplicação está em `src/`; testes unitários junto aos módulos em `src/**/*.spec.ts` e testes e2e em `test/**/*.e2e-spec.ts`.

Módulos/capacidades actuais incluem:

- `auth`, `users`, `organizations` e `prisma`;
- `works`, `editions`, `items`, `contributors`, `contributions`, `external-identifiers` e `bibliographic-records`;
- `catalogues` (contratos genéricos e adapter PORBASE);
- `bibliography` (mappers e serializers MARC);
- `exports`, `storage`, `health` e `common`.

`WorksModule` agrega actualmente controllers e services de várias entidades do catálogo. Esta organização é válida no monólito actual; a evolução para módulos por capacidade é uma direcção, não uma refactorização já concluída.

Imports relativos TypeScript seguem ESM e usam extensão `.js`.

## Tenancy, organizações e autorização

### Decisão arquitectural

`Organization` é a fronteira de tenancy do catálogo e inventário. `User` é uma identidade global; `OrganizationMembership` liga utilizador e organização com um role. Não usar `userId` enviado pelo cliente como autoridade sobre recursos.

Roles definidos no enum Prisma e usados pela autorização:

- `OWNER`
- `ADMIN`
- `STAFF`
- `READER`

A hierarquia implementada é `READER < STAFF < ADMIN < OWNER`. Leituras protegidas requerem membership; escritas bibliográficas e de inventário requerem `STAFF` ou superior, excepto operações organizacionais com requisitos próprios.

### Implementado

- `Work.organizationId` e `Item.organizationId` são obrigatórios; `Edition` pertence a `Work` e `Item` pertence a `Edition`.
- Criar um utilizador cria uma organização pessoal e membership `OWNER` na mesma transacção.
- `GET /organizations` lista organizações do utilizador e o seu role.
- `POST /organizations` cria organização e membership `OWNER` na mesma transacção.
- `GET /organizations/:id` requer membership.
- `PUT /organizations/:id` permite renomear com `OWNER` ou `ADMIN`.
- `DELETE /organizations/:id` requer `OWNER`, mas devolve conflito até existir política de reassociação segura.
- `Organization.defaultCatalogueSource` e `enabledCatalogueSources` expõem configuração de fontes; o default actual é `porbase`.
- `OrganizationMembershipService` fornece validação de membership e acesso a Work.

### Limitações actuais

- Não há organização activa por pedido nem selector de organização no contrato de autenticação. `GET /auth/me` devolve `roles: []`; não projecta roles de memberships.
- Não há endpoints de administração de memberships, convites ou alteração de roles.
- Não há `Library`/`Branch`, políticas por filial, holdings ou localizações institucionais.
- `WorksService.create` aceita `organizationId` opcional e verifica membership STAFF; sem valor usa a organização OWNER mais antiga. O import de catálogo também aceita `work.organizationId` opcional com verificação STAFF; se omitido, usa a organização OWNER mais antiga. Isto é fallback de compatibilidade, não uma selecção explícita de contexto.
- `ExternalIdentifier` é scoped à organização e a Edition; a igualdade entre `ExternalIdentifier.organizationId` e a organização da Edition é validada no service, não representada por uma constraint relacional composta.
- `BibliographicRecord` pode apontar simultaneamente para Work e Edition; o schema não garante que ambos pertençam ao mesmo Work/organização.

## Autenticação, sessão e segurança

### Implementado

- `POST /auth/login` verifica password com Argon2id e emite access JWT de 15 minutos e refresh token opaco de 7 dias.
- Password e refresh token completos não são persistidos; guardam-se hashes Argon2id. As opções Argon2id são `memoryCost: 65536` KiB, `timeCost: 3` e `parallelism: 1`.
- `POST /auth/refresh` verifica e roda o refresh token com actualização condicional; `POST /auth/logout` valida e revoga-o.
- `GET /auth/me` exige Bearer access token e confirma que o utilizador ainda existe.
- `POST /users` é a criação pública de utilizador (signup); `passwordHash` não é devolvido.
- `JWT_SECRET` é obrigatório fora de `NODE_ENV=test` e tem mínimo de 32 bytes. O fallback de teste está limitado a test.
- O modelo suporta **uma sessão de refresh por utilizador**, não sessões independentes por dispositivo.

### Erros e logging

O `ApiExceptionFilter` global em `src/main.ts` devolve `{ statusCode, error, code, message, details? }` e mantém códigos estáveis. Inclui mapeamentos explícitos de erros Prisma `P2002`, `P2025`, `P2003` e validação Prisma. Erros inesperados devolvem `500 INTERNAL_ERROR`. Excepções HTTP conhecidas não são reinterpretadas a partir de texto livre.

`ERROR_DETAILS_IN_RESPONSE=true` só é aceite com `NODE_ENV=development`; detalhes opcionais aparecem sob a propriedade `debug` e não alteram o contrato estável.

**Limitação de logging:** o filtro usa Nest `Logger` e regista método, path, status, nome, mensagem da excepção e stack para falhas de servidor/Prisma. Embora exista `sanitizeRequestContext`, o filtro não o aplica à mensagem/stack da excepção. Não regista bodies ou headers do request por defeito, mas segredos incluídos pelo código numa mensagem/stack não estão comprovadamente redigidos. Não foi encontrado mecanismo de request/correlation ID.

## Endpoints HTTP actuais

Todos os endpoints não marcados como públicos exigem JWT. A autorização de catálogo e recursos continua a verificar membership no servidor.

Autenticação:

- `POST /auth/login` — público; emite tokens.
- `POST /auth/refresh` — público; valida e roda refresh token.
- `POST /auth/logout` — público; revoga refresh token apresentado.
- `GET /auth/me` — JWT; utilizador actual, com `roles: []`.
- `/users` — `POST` cria utilizador e é público; `GET`, `GET :id`, `PUT :id` e
  `DELETE :id` são protegidos e auto-scoped.

Organizações e catálogo local:

- `/organizations` — `GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`; regras
  de role descritas acima.
- `/works` — CRUD; lista/detalhe filtrados por membership.
- `/editions` — CRUD; acesso autorizado pelo Work associado. Respostas directas
  incluem `coverUrl`.
- `/items` — CRUD; organização deriva da Edition e escritas exigem STAFF+.
- `/contributors` — CRUD legado, sujeito a tenancy/autorização do service.
- `/contributions` — apenas `POST` manual; agente/role e exactamente um alvo
  Work ou Edition; não aceita metadata MARC de origem nesta rota.
- `/external-identifiers` — listagem e operações de gestão, scoped a
  organização e Edition.
- `/bibliographic-records/:id` — `GET` read-only; não há CRUD público destes
  registos.

Catálogo externo, capas e exportação:

- `POST /catalogues/search` — pesquisa/preview genérico, provider opcional.
- `POST /catalogues/import` — confirmação editável, persistida
  transaccionalmente; não refaz pesquisa externa.
- `GET /editions/:id/cover` — capa activa, autorização de membership, `ETag` e
  `If-None-Match`.
- `GET /exports/marcxchange/edition/:editionId` — export local MARCXchange; não
  usa `rawContent`.
- `/docs` — Swagger UI.

Não existem rotas antigas específicas PORBASE para pesquisa/import. Não existe endpoint MARCXML, ISO 2709, exportação de `rawContent` ou pesquisa local de catálogo.

## Catálogo e integração PORBASE

### Contratos e comportamento implementados

`CatalogueProvider` é a fronteira genérica. O único provider registado é `porbase`, formato `UNIMARC`, default actual.

`SearchCatalogueDto` aceita um de:

- `{ type: 'isbn', isbn }`
- `{ type: 'title', title }`
- `{ type: 'author', author }`
- `{ type: 'keyword', keyword }`

O DTO rejeita campos que não correspondem ao discriminante. **PORBASE só implementa ISBN**; title, author e keyword devolvem `CATALOGUE_SEARCH_TYPE_UNSUPPORTED`. Search e import aceitam `sourceId` opcional; a identidade `sourceId` de resposta é acrescentada pelo provider.

O preview consulta PORBASE, interpreta XML/MARC text e devolve campos estruturados, warnings e conteúdo original. Preview não persiste. A confirmação exige `POST /catalogues/import` com o payload editável completo; o servidor não volta a PORBASE.

### Limitações de confirmação e proveniência

- Não existe snapshot/token server-side do preview. O servidor não consegue provar que os campos confirmados e `rawContent` correspondem ao preview previamente mostrado.
- O DTO de import continua a aceitar dados MARC de contribuição — `sourceTag`, indicadores e source parts — enviados pelo cliente. O service atribui `ContributionSource.PORBASE`, mas estes elementos estruturais não são reconstruídos integralmente do raw payload persistido. A rota manual `/contributions` é mais restrita. Esta diferença de confiança é uma lacuna real a rever.
- `format`, `remoteId` e `rawContent` vêm no payload de confirmação; `source`, schema UNIMARC e `sourceId` do provider são definidos pelo servidor.
- A configuração da organização para fontes está exposta; não há selector nem gestão de fontes activa no produto.

## Modelo canónico bibliográfico e proveniência

### Decisão arquitectural

A base persistente Folio é canónica, não UNIMARC, MARC 21, MARCXchange, MARCXML nem ISO 2709. Preservar literais, ordem, repetição e conteúdo desconhecido suportado; não inventar silenciosamente valores.

Exportação:

```text
modelo canónico Folio → mapper de perfil → MarcRecord → serializer → formato
```

Importação:

```text
payload externo → parser → MarcRecord → mapper de importação → preview
→ confirmação explícita → persistência canónica
```

MARCXchange e MARCXML são serializers/endpoints separados. O export actual é apenas MARCXchange.

### Schema implementado

- `Work` e `Edition` com campos escalares transicionais de título/subtítulo; Edition também tem projecções de língua e dados de publicação.
- `WorkTitle`, `EditionTitle` com tipo, valor, subtitle, language e sort order.
- `ResponsibilityStatement` para transcrição literal de responsabilidades da Edition.
- `EditionLanguage`, `Series`, `EditionStatement`, `Classification`.
- `PublicationStatement` e partes ordenadas, com indicadores e `groupIndex`.
- `PhysicalDescription` por ocorrência e `PhysicalDescriptionPart` por subcampo ordenado.
- `Agent`, `Contribution` e `ContributionSourcePart`; `Contribution` tem XOR Work/Edition reforçado por check SQL. Agent é scoped a Organization; `displayName` não é forma de autoridade.
- `BibliographicNote` pode apontar a Work ou Edition, com XOR SQL.
- `Contributor`, `WorkContributor` e `EditionContributor` legados continuam no schema.
- `BibliographicRecord` guarda `rawContent` e proveniência básica (`source`, `remoteId`, `sourceId`, `format`), e tem relações opcionais para Work e Edition.
- `UnmappedSourceField` e `UnmappedSourceSubfield` preservam campos de origem não mapeados, além do raw payload.

### Implementação por pipeline

- PORBASE parser/preview extrai títulos, responsabilidade, línguas, publicação, descrição física, série, declarações de edição, notas, classificações, identificadores, contribuições e campos não mapeados dos campos actualmente suportados.
- Cobertura concreta do parser: `001`, `003`, `010$a`, `021$a/$b`, `035$a`, `101$a/$c`, `102$a`, `200$a/$b/$d/$e/$f/$g/$h/$i`, `205$a/$b/$f`, `210$a..$g`, `215` completo, `225$a/$e/$v/$x`, títulos variantes de `500`, `510–545` e `560` (`$a/$e`), notas `300/317/320/327/328/330$a`, classificações `675/676/680/686`, contribuições `700–713` e identificadores de origem `003/021/035`. `856` é tratado pelo extractor de candidatos de capa (`$u`, com `$q/$y/$z` como metadados auxiliares), não como mapeamento bibliográfico canónico.
- Confirmação de importação persiste muitas dessas estruturas numa transacção. `UnmappedSourceField` é recalculado no servidor a partir do `rawContent` confirmado, best-effort.
- Import grava contribuições canónicas PORBASE; leituras/exportações escolhem Contributions por alvo quando existem e recorrem ao conjunto legado exclusivo quando não existem. Não misturam os dois conjuntos.
- `EditionsService` lê as estruturas canónicas para Edition e mapeia `coverUrl`; `WorksService` inclui Editions aninhadas sem projectar `coverUrl`.
- Export local usa relações estruturadas suportadas, com fallback escalar/legado quando aplicável; mapper produz warnings, mas o endpoint actual devolve apenas XML.

### Limitações de integração canónica

- CRUD normal de Work/Edition ainda escreve os campos escalares; não mantém sempre `WorkTitle`, `EditionTitle` ou `EditionLanguage`. Assim, a fonte canónica por estrutura está integrada mais completamente no import/export do que nas operações gerais de escrita.
- Parser/DTO de título reconhece `200$h/$i` como `partNumber`/`partName`, mas o schema `WorkTitle`/`EditionTitle` não tem esses campos e a persistência não os grava estruturadamente. O raw original permanece disponível.
- `BibliographicNote` suporta alvos Work e Edition no schema; o fluxo actual de import oferece notas na Edition, não um contrato completo de nota de Work.
- A camada de proveniência não tem ainda versões/histórico de aquisição, hash do raw, encoding, versão do parser ou gestão de múltiplos snapshots.
- A consistência entre `BibliographicRecord.workId` e `editionId` não é imposta no schema.
- O perfil PORBASE é subconjunto: não implica implementação semântica de todo UNIMARC, authority control, MARC 21 ou preservação de todo campo desconhecido como conceito canónico.

## Capas e ficheiros

### Schema e extracção

O schema tem `CoverCandidate`, `CoverAsset` e `EditionCover`:

- `CoverCandidate` guarda URL/hash, fonte, estado (String, não enum), retries e próxima tentativa; liga-se a `BibliographicRecord` e opcionalmente a `CoverAsset`.
- `CoverAsset` é único por `(organizationId, contentHash)` e aponta para backend/key, MIME, tamanho e dimensões.
- `EditionCover` associa asset a Edition e tem `isActive`; há unique `(editionId, coverAssetId)`, mas não constraint que limite a uma só capa activa.

`PorbaseCoverCandidateExtractor` extrai `$u` de campos UNIMARC 856, calcula URL hash e classifica candidato. O import grava candidatos com savepoint e não falha o import se essa extracção/persistência falhar. A classificação do extractor não substitui a validação de rede do fetcher.

### SafeHttpFetcher

`SafeHttpFetcherService`:

- usa allowlist exacta `COVER_ALLOWED_HOSTS`; valida esquema, userinfo e portas;
- resolve DNS e rejeita endereços não públicos; fixa endereço aprovado no callback lookup para ligação;
- não usa proxy ambiente; trata redirects manualmente até três, revalidando host e DNS;
- usa timeout total (`COVER_HTTP_TIMEOUT`, default 10 s), timeout de ligação (`COVER_CONNECT_TIMEOUT`, default 5 s) e stream máximo (`COVER_MAX_SIZE_BYTES`, default 5 MiB);
- valida magic bytes e Content-Type para JPEG, PNG, GIF e WebP, e descodifica com `sharp`, limitando dimensões (`COVER_MAX_WIDTH`/`COVER_MAX_HEIGHT`, 5000 cada) e pixels;
- `COVER_ALLOWED_HOSTS` ausente resulta em allowlist vazia, apesar de existir constante de configuração de exemplo; em runtime é necessário configurar hosts explicitamente.

### Storage e aquisição

`StorageService` tem `save/get/delete/exists`. Adaptadores existentes: `LocalFsStorage` (default fora de tests; raiz `COVER_STORAGE_ROOT`) e `InMemoryStorage` (apenas tests). S3 é planeado, não implementado.

`CoverAcquisitionServiceImpl` é serviço in-process, com sweep no bootstrap e de 60 em 60 segundos fora de `NODE_ENV=test`. Busca candidatos PENDING vencidos, faz claim condicional atómico para ACQUIRING, fetch, SHA-256, armazenamento e upsert de `CoverAsset` scoped por organização. Retries usam `nextAttemptAt` e backoff de 1 min, 5 min, 15 min e 1 h; o fallback repete 1 h para a quinta retry. Ao atingir `retryCount >= 5`, marca `REJECTED/MAX_RETRIES_EXCEEDED`. O scan é sequencial; não há queue/worker nem limite global de concorrência.

**Lacuna crítica:** a aquisição associa `CoverCandidate` a `CoverAsset`, mas não cria/activa `EditionCover`. O endpoint e `coverUrl` consultam `EditionCover`; portanto a aquisição actual, isoladamente, não torna o asset servível e não faz surgir `coverUrl`.

### Endpoint e saída

`GET /editions/:id/cover` valida CUID, exige JWT e membership da organização da Edition, procura `EditionCover` activa, e lê `StorageService` apenas se o `If-None-Match` não corresponder. Responde com MIME, ETag baseado em `contentHash`, `Cache-Control: private, max-age=31536000` e `X-Content-Type-Options: nosniff`; correspondência devolve 304.

`coverUrl` é um path relativo `/editions/{id}/cover` ou `null` nas respostas directas geradas por `EditionsService` (lista, detalhe, create/update). **Não é projectado nas Editions aninhadas em respostas de Work nem na resposta de importação de catálogo.**

## Exportação

`GET /exports/marcxchange/edition/:editionId` exige JWT, permite CUID e UUID, valida membership, carrega dados locais, usa mapper UNIMARC e serializer MARCXchange. Não lê `BibliographicRecord.rawContent`.

O endpoint devolve apenas XML. Warnings do mapper não são persistidos nem expostos. Não existem endpoints MARCXML, ISO 2709 ou exportação original.

## Paginação, performance e throttling

### Paginação e base de dados

`PaginationQueryDto`: cursor CUID opcional, `limit` default 25, intervalo 1–100. Helper consulta `limit + 1` e devolve `{ items, nextCursor, hasMore }`; cursor continua por `id` com `skip: 1`.

Listas de Works, Editions, Items, Users, Contributors e ExternalIdentifiers usam helper partilhado. As listas bibliográficas principais filtram membership. Pesquisa PORBASE é um resultado individual, não lista paginada.

O pool `pg` usa `DATABASE_POOL_MAX` default 10, conexão 5 s, idle 10 s e query 10 s. HTTP usa request 15 s, headers 20 s e keep-alive 5 s. Valores ambientais inválidos/não positivos recaem em defaults.

Índices efectivos relevantes do schema incluem `Work(organizationId, createdAt, id)`, `Edition(workId, createdAt, id)`, `Item(organizationId, status, createdAt, id)` e `Item(editionId, createdAt, id)`, `OrganizationMembership(userId, organizationId)` único, relações de contribuidor/contribuição por alvo e ordem, títulos/declarações/notas por owner e ordem, e `BibliographicRecord(workId|editionId, createdAt, id)`. Capas têm `CoverCandidate(status)`, `CoverCandidate(nextAttemptAt)`, unicidade `(bibliographicRecordId, urlHash)`, `CoverAsset(organizationId, contentHash)` único e índices de `EditionCover`.

Lacunas observáveis: ExternalIdentifier lista ordena por `createdAt` sem desempate explícito `id`; Contributor ordena por nome/id, mas o índice apresentado no schema é createdAt/id; o índice de Item começa por status embora a listagem por membership não filtre por status; há índice simples e índice único redundantes em `(organizationId, type, value)` para ExternalIdentifier; fanout aninhado de Editions em listas de Works não tem paginação própria. São observações de schema/query, não resultados de benchmark; medir antes de alterar índices.

### Throttling

`ThrottlerGuard` global, por IP, default `THROTTLE_LIMIT=10` e `THROTTLE_TTL=60000` ms; ignora User-Agent que corresponda a `/node-fetch/` e envia headers `X-RateLimit-*`. Overrides: login/refresh/signup 10 por janela; catalogues search/import 5; listagens GET `/works`, `/editions`, `/items` 100. Outros handlers usam default global. Storage é default em memória do processo; multi-réplica requer storage partilhado. `/editions/:id/cover` não tem override específico e usa o limite global.

## CORS

`getCorsOptions` divide `CORS_ORIGIN` por vírgulas e remove espaços. Sem valor, usa `http://localhost:4200` se `NODE_ENV=development`; quando ausente ou diferente de development usa `https://app.fol.io`. Isto é um default da configuração CORS, não define `NODE_ENV` globalmente.

Permite `GET`, `POST`, `PUT`, `DELETE`, `PATCH`; headers `Content-Type`, `Authorization`, `If-None-Match`; expõe `ETag`; credenciais activas e max-age 3600 segundos.

## Infraestrutura, CI e validação

`.github/workflows/ci.yml` executa em push/PR com Node 24 e PostgreSQL 16 efémero. Passos: `npm ci`, `prisma migrate deploy`, `npm run build`, `npm run lint`, `npm run test`. Não invoca explicitamente `npm run test:e2e`; a config normal selecciona `**/*.spec.ts`, e o repositório também tem ficheiros `*.e2e-spec.ts`. Config e2e separada selecciona `**/*.e2e-spec.ts`.

Comandos definidos em `package.json`:

- `npm run build`
- `npm run lint` (oxlint em `src/` e `test/`)
- `npm run test -- --no-file-parallelism`
- `npm run test:e2e` (para este repositório, `npm run test:e2e -- --no-file-parallelism` evita contenção observada entre suites)
- `npx prettier --check <ficheiros>` para verificar formatação; não há configuração dedicada de markdownlint no repositório.
- `git diff --check`

Os comandos são procedimentos de validação, não afirmação de que foram corridos em todas as alterações documentais.

## Limitações conhecidas consolidadas

1. Sem contexto organizacional explícito por pedido; algumas operações usam organização OWNER mais antiga como fallback.
2. Sem gestão de memberships/convites/roles, branches, holdings avançados, auditoria ou circulação.
3. Confirmação de import sem preview snapshot; campos de contribuição de origem do import são editáveis pelo cliente.
4. CRUD regular de Work/Edition ainda não mantém sempre relações de títulos/línguas canónicas; `$h/$i` parseados não são persistidos estruturadamente.
5. Proveniência limitada; inconsistência Work/Edition em BibliographicRecord não é constraint.
6. Cover acquisition não cria EditionCover; então endpoint/coverUrl dependem de associação activada por mecanismo ainda ausente.
7. coverUrl só em respostas directas de Edition; ausência em Editions aninhadas/resultado de import.
8. Hosts do fetcher devem ser configurados; sem variável a allowlist é vazia.
9. Storage S3, queue, rate-limit distribuído, request ID e redacção de mensagem/stack de excepções não existem.
10. Migração `20260907180000_refine_bibliographic_model` declara-se como alvo de reset deliberado de desenvolvimento e executa `DROP TABLE PhysicalDescription`; confirmar estado/impacto do ambiente antes de aplicar migrations. Migrations versionadas não demonstram estado de aplicação remota.

## Roadmap acordado — não implementado

### Próximo checkpoint

- `1L-DEC.0` — decisão formal sobre contexto organizacional explícito.

### Sequência recomendada

1. `1L-API.0` — resolução explícita do contexto da organização e isolamento de tenancy.
2. `1L-FLUTTER.0` — selector de organização e invalidação de estado scoped; dependência de contrato, fora deste repositório.
3. `1K-API.0` — contrato de listagem, pesquisa e ordenação da biblioteca.
4. `1K-API.1` — pesquisa local PostgreSQL.
5. `1K-FLUTTER.0` — paginação/infinite loading; dependência de contrato.
6. `1K-FLUTTER.1` — pesquisa e ordenação; dependência de contrato.
7. `1L-API.1` — memberships, convites e roles.
8. `1L-FLUTTER.1` — gestão de membros; dependência de contrato.
9. `1M` — captura, qualidade catalográfica, tarefas de revisão e auditoria como conceitos separados.

Direcção futura de pesquisa local: pesquisa Folio distinta de providers externos; extensão controlada de `GET /works`; PostgreSQL full-text (`tsvector`, ranking e GIN), cursor compatível com ordenação; trigramas só com justificação medida. Sem Elasticsearch/Redis nesta fase.

## Decisões e propostas ainda por formalizar

`1L-DEC.0` deve decidir o contexto organizacional. Proposta a avaliar, não contrato aprovado:

- contexto explícito por pedido, possivelmente header `X-Folio-Organization-Id`;
- membership sempre verificada no servidor;
- organização activa fora do JWT;
- preferência guardada no cliente nunca constitui autoridade;
- sem escolher implicitamente a primeira organização;
- mudança invalida estado scoped no cliente.

Nome final do header e códigos de erro precisam de decisão formal; não estão implementados neste contrato. A proposta não altera o comportamento actual descrito acima.

A iteração `1M` deve distinguir, sem um enum prematuramente aprovado:

- `ScanCapture`;
- qualidade/maturidade catalográfica;
- `ReviewTask`;
- `AuditEvent`.

## Regras para futuras alterações

- Ler este documento e `AGENTS.md`; confirmar código, testes, schema e migrations antes de implementar.
- Distinguir decisão arquitectural de comportamento implementado e de roadmap.
- Manter Organization como tenant; nunca confiar em `userId` do body.
- Manter controllers finos; serviços/use cases testáveis.
- Preservar preview sem persistência; exigir confirmação explícita.
- Separar `BibliographicRecord.rawContent` dos dados locais confirmados.
- Manter modelo canónico independente de perfis MARC e distinguir MARCXchange de MARCXML.
- Não descartar silenciosamente campos desconhecidos quando o fluxo permite preservá-los; declarar perdas.
- Não aceitar metadata de autoridade/proveniência como verdade do cliente; auditar especialmente o contrato de confirmação PORBASE actual.
- Não introduzir Redis, microserviços, search engine externo ou filas sem necessidade medida.
- Não implementar circulação com flags em Item; usar entidades próprias.
- Proteger segredos em respostas e logs; testar logs e exceptions sem introduzir credenciais.
- Alterações de schema exigem migration revista; verificar efeitos destrutivos e estado de ambientes separadamente.
- Actualizar ambos os documentos quando mudarem contratos, arquitectura ou limitações.

## Referências operacionais

- Schema: `prisma/schema.prisma`; migrations: `prisma/migrations/`.
- Bootstrap/config: `src/main.ts`, `src/app.module.ts`, `src/common/`, `src/prisma/`.
- Catálogo: `src/catalogues/`; export: `src/exports/` e `src/bibliography/`.
- Capas: `src/storage/`, `src/editions/edition-cover.service.ts`.
- Testes de integração relevantes: `test/porbase-import.e2e-spec.ts`, `test/porbase-import-persistence.e2e-spec.ts`, `test/exports.e2e-spec.ts`, `test/edition-cover.e2e-spec.ts`.
- CI: `.github/workflows/ci.yml`.
