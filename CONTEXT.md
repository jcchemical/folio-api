# Contexto de desenvolvimento — Folio API

> Última revisão documental: 2026-10-10.
> Este documento descreve o código e schema presentes no repositório nessa data. A existência de uma migration no repositório não prova que esteja aplicada num ambiente concreto.

Roadmap cross-cutting: ver `folio-app/docs/ROADMAP.md`

## Como ler este documento

Os estados são explícitos:

- **Implementado** — comportamento confirmado em código, schema ou testes do repositório.
- **Limitação actual** — capacidade ausente, incompleta ou com uma lacuna verificada.
- **Decisão arquitectural** — princípio a preservar; não implica que toda a implementação futura esteja concluída.
- **Planeado** — trabalho recomendado ainda não implementado.

Não usar este documento para inferir o estado de outra aplicação. O âmbito aqui é exclusivamente `folio-api`.

## Greenfield e ausência de compatibilidade obrigatória

Este repositório pertence a um produto em fase inicial. O código existente é apenas o estado actual do trabalho, não uma obrigação arquitectural.

Antes de preservar uma API, campo, migration, fallback ou comportamento, pergunta se existe uma razão real de produto. Se não existir, podes alterá-lo ou removê-lo.

A base de dados de desenvolvimento pode ser resetada. Breaking changes coordenadas entre `folio-api` e `folio-app` são permitidas.

Não criar dívida técnica transitória para proteger:

- dados de teste;
- consumidores inexistentes;
- contratos internos provisórios;
- implementações que contradizem a arquitectura aprovada.

Quando uma decisão nova substituir uma decisão antiga, actualizar schema, código, testes, migrations e documentação para representar apenas o desenho novo.

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
- `works`, `editions`, `items`, `contributions`, `external-identifiers` e `bibliographic-records`;
- `catalogues` (contratos genéricos e adapter PORBASE);
- `bibliography` (mappers e serializers MARC);
- `exports`, `storage`, `health` e `common`;
- `work-items` (captura/processamento iterativo com máquina de estados);

`WorksModule` agrega actualmente controllers e services de várias entidades do catálogo. Esta organização é válida no monólito actual; a evolução para módulos por capacidade é uma direcção, não uma refactorização já concluída.

`WorkItem` é uma entidade de processo de captura, separada de `Item`, `Edition` e `BibliographicRecord`. `WorkItemsModule` fornece captura manual ou scan, leitura, transição de estado e associação/desassociação manual a Item existente; não fornece CRUD geral nem fila/UI de curadoria.

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

- `Organization` é a única fronteira de tenancy. `Library` pertence à Organization; `Location` pertence à Library. `Work` pertence à Organization; `Edition` pertence à Work; `Holding` liga Edition e Location da mesma Organization; `Item` pertence apenas a Holding.
- O schema e a migration baseline removem ownership duplicado de Item (`organizationId`, `editionId`, `libraryId`, `locationId`). A migration baseline também impõe igualdade de organização entre `Holding → Edition → Work` e `Holding → Location → Library` por constraint triggers diferidos.
- A migration `20261006150000_tomos_domain_baseline` já representa esse modelo final; esta iteração não cria nem aplica migrations. O estado aplicado em qualquer base de dados não foi verificado.
- Criar um utilizador cria uma organização pessoal e membership `OWNER` na mesma transacção.
- `GET /organizations` lista organizações do utilizador e o seu role.
- `POST /organizations` cria organização e membership `OWNER` na mesma transacção.
- `GET /organizations/:id` deriva do ID no path, requer membership; header opcional só confirma consistência.
- `PUT /organizations/:id` permite renomear com `OWNER` ou `ADMIN`.
- `DELETE /organizations/:id` deriva do ID no path, requer `OWNER` e devolve conflito até existir política de reassociação segura; header opcional só confirma consistência.
- `GET /works` requer `X-Folio-Organization-Id` e lista apenas Works da organização escolhida.
- `POST /works` requer o mesmo header e role `STAFF` ou superior; `organizationId` não é campo do DTO nem autoridade de tenancy. Editions aninhadas derivam do Work criado e são escritas na mesma transacção.
- `GET /works/:id` e operações de escrita por ID derivam a organização do Work persistido; header opcional tem de coincidir. Leituras requerem membership; escritas requerem `STAFF` ou superior.
- `GET /editions` requer `X-Folio-Organization-Id` e filtra por `Edition → Work → Organization`.
- `POST /editions` deriva organização de `workId` persistido; header opcional tem de coincidir; criação exige `STAFF` ou superior.
- Operações `/editions/:id` derivam organização de `Edition → Work`; header opcional tem de coincidir. Leituras requerem membership e escritas `STAFF` ou superior.
- `GET /libraries` exige header e lista apenas Libraries da organização escolhida; `POST /libraries` é root e exige header + `STAFF`; operações por ID derivam Organization da Library e escritas exigem `STAFF`. Numa operação derivada, header malformado é rejeitado antes de carregar o ID; uma Library existente noutra Organization sem membership é mascarada como `RESOURCE_NOT_FOUND`, tal como um ID inexistente. Eliminar Library elimina Locations em cascata; falha com `CONFLICT_FOREIGN_KEY_REFERENCE` se uma dessas Locations tiver Holding.
- `GET /locations` exige header e filtra através de `Location → Library → Organization`; `POST /locations` deriva de `libraryId` persistido sem exigir header; header opcional tem de coincidir. Operações por ID derivam via Library; escritas exigem `STAFF`. Header malformado é rejeitado antes da leitura; Location ou Library parent noutra Organization sem membership é mascarada como `RESOURCE_NOT_FOUND`, tal como inexistência.
- `GET /holdings` exige header e filtra tanto por `Edition → Work → Organization` como por `Location → Library → Organization`; filtros Edition/Location apenas refinam. `POST /holdings` carrega Edition e Location, exige membership em ambas as Organizations antes de comparar o header ou validar que os pais coincidem, e requer `STAFF` para a Organization comum. Sem membership em qualquer parent, devolve `RESOURCE_NOT_FOUND`; o conflito entre Organizations só é devolvido a quem pode inspeccionar ambas. As operações por ID aplicam a mesma autorização aos dois pais antes de validar a invariável.
- `GET /items` exige header e filtra por `Item → Holding → Edition → Work` e `Item → Holding → Location → Library`, ambas na Organization seleccionada; `POST /items` deriva de `holdingId` persistido sem exigir header; operações por ID derivam pela mesma cadeia e verificam acesso aos dois pais do Holding. Escritas exigem `STAFF`; respostas projectam Edition, Work, Location, Library e Organization das relações persistidas. Item ou parent sem membership é mascarado como `RESOURCE_NOT_FOUND`, tal como inexistência.
- External Identifiers ligam uma authority/value a `Work`, `Edition`, `Library`, `Location`, `Holding` ou `Item`; persistem `organizationId` como tenant e não têm FK polimórfica para o alvo. A criação deriva a Organization do alvo persistido: `Work`/`Library` directamente, `Edition → Work`, `Location → Library`, e `Holding`/`Item → Holding → Edition/Location`. Holdings e Items só são aceites quando os dois caminhos parentais pertencem à mesma Organization.
- `GET /external-identifiers` exige `X-Folio-Organization-Id`, filtra pela Organization seleccionada e aceita somente filtros `entityType`, `entityId` e `authority`, além de cursor/limit. `POST` deriva a Organization do alvo; o header é opcional e apenas confirma consistência. `GET/PUT/DELETE :id` derivam do `organizationId` persistido. Leituras exigem membership; escritas exigem STAFF+. O vínculo entityType/entityId é imutável no update; authority e value podem ser alterados.
- `authority` aceita qualquer namespace não vazio; exemplos iniciais incluem `isbn-13`, `isbn-10`, `issn`, `doi`, `lccn`, `oclc`, `viaf`, `isni`, `wikidata` e `local`. O binding duplicado de entityType/entityId/authority/value devolve `CONFLICT_DUPLICATE_EXTERNAL_IDENTIFIER`; não há unicidade global de value nem exclusividade de authority por entidade.
- Remoção de Work, Edition, Library, Location, Holding ou Item apaga, na mesma transacção Prisma (`$transaction`), os External Identifiers do alvo e dos descendentes que a operação remove por cascade (`Work → Edition → Holding → Item`, `Edition → Holding → Item`, `Holding → Item`, `Library → Location`), antes do delete que desencadeia a cascade. `Location → Holding` mantém `Restrict`: com Holdings, a remoção falha sem limpar identifiers. Não existe FK polimórfica nem alteração de schema, migration, API ou códigos de erro. A autorização continua antes da transacção; falha de cleanup ou delete propaga e a transacção reverte todas as operações. Não há alteração no frontend.
- Recursos derivados fora da Organization do utilizador são mascarados como `RESOURCE_NOT_FOUND`; o header malformado continua `ORGANIZATION_ID_INVALID`, e um membro da Organization derivada com header divergente recebe `ORGANIZATION_CONTEXT_CONFLICT`. Listas root mantêm `ORGANIZATION_MEMBERSHIP_REQUIRED`. `organizationId` nunca é aceite no body.
- `POST /contributions` aceita exactamente um target persistido `workId` ou `editionId`; Organization deriva desse target e header opcional só confirma igualdade. Agent/target têm de pertencer à mesma Organization; escrita exige STAFF+. `Contribution.source` é definido pelo servidor (`MANUAL` nesta rota), e os campos trusted MARC não pertencem ao DTO manual.
- `POST /catalogues/import` exige JWT, `X-Folio-Organization-Id` e role `STAFF` ou superior. O guard resolve contexto e autorização antes das pipes de payload; Work é criado apenas na Organization resolvida, Editions derivam do Work na mesma transacção e `work.organizationId`/ownership concorrente são rejeitados. `POST /catalogues/search` continua global ao tenant e apenas consulta o provider externo.
- Listagens de inventário rejeitam query fields de tenant/parent que tentem substituir ou competir com o header e as relações persistidas. DTOs de inventário rejeitam ownership redundante com `VALIDATION_INVALID_BODY`; não dependem apenas de whitelist/strip.
- `Item.status` é não-null no contrato de escrita: ausência preserva o default/valor existente; `null` é rejeitado. O schema ainda guarda este campo como String, sem enum de estados aprovado; não representa empréstimo nem disponibilidade de circulação.
- Contexto root e contexto derivado usam `OrganizationContextResolver` e os códigos estáveis `ORGANIZATION_CONTEXT_REQUIRED`, `ORGANIZATION_ID_INVALID`, `ORGANIZATION_NOT_FOUND`, `ORGANIZATION_MEMBERSHIP_REQUIRED`, `ORGANIZATION_ROLE_INSUFFICIENT` e `ORGANIZATION_CONTEXT_CONFLICT`. Em operações root com Organization explícita, falta de membership continua a responder `ORGANIZATION_MEMBERSHIP_REQUIRED`. Em recursos/parents derivados de inventário, falta de membership é mascarada como `RESOURCE_NOT_FOUND` (HTTP 404, código e mensagem idênticos aos de um ID inexistente); header malformado continua a ser `ORGANIZATION_ID_INVALID`, e um membro com header divergente recebe `ORGANIZATION_CONTEXT_CONFLICT`. Na criação de Holding, o conflito entre Edition e Location só é exposto depois de o utilizador poder inspeccionar ambas as Organizations.
- `Organization.defaultCatalogueSource` e `enabledCatalogueSources` expõem configuração de fontes; o default actual é `porbase`.
- `OrganizationMembershipService` fornece validação de membership e acesso a Work.

### Limitações actuais

- Não há organização activa por pedido nem selector de organização no contrato de autenticação. `GET /auth/me` devolve `roles: []`; não projecta roles de memberships.
- Não há endpoints de administração de memberships, convites ou alteração de roles.
- Não há Branch, políticas por Library/Location, Campus, ServicePoint ou circulação. `Library`, `Location` e `Holding` já estão implementados no schema e API.
- `getDefaultOrganization()` permanece para o onboarding de organização pessoal; não é usado pela confirmação de import nem pelos handlers de Organizations, Works, Editions ou inventário físico.
- Exports por Edition usam contexto derivado; não existe export root nem agregação multi-organização.
- `ExternalIdentifier` persiste `organizationId` com FK `RESTRICT`; a migration converte os bindings Edition existentes e preserva as colunas legadas como nullable sem as usar na API. A implementação é exclusivamente backend; ainda não há frontend External Identifiers.
- `BibliographicRecord` pertence exclusivamente a uma Edition; Organization deriva de `Edition → Work → Organization`. Não tem `workId` nem `organizationId` duplicados.

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

- `/organizations` — `GET` devolve memberships do utilizador; `POST` cria organização e membership OWNER; `GET/PUT/DELETE :id` derivam do path e validam membership/role. Header opcional em `:id` apenas verifica igualdade.
- `/works` — CRUD; `GET` e `POST` exigem `X-Folio-Organization-Id`; `GET/PUT/DELETE :id` derivam do Work persistido. Escritas requerem STAFF+.
- `/editions` — `GET` exige `X-Folio-Organization-Id`; `POST` deriva de `workId`; operações `:id` derivam por `Edition → Work`. Escritas requerem STAFF+. Respostas directas incluem `coverUrl`.
- `/libraries` — CRUD; listas e criação root exigem header; operações por ID derivam da Library. Escritas exigem STAFF+.
- `/locations` — CRUD; lista root exige header; criação deriva de `libraryId`; operações por ID derivam de `Location → Library`. Escritas exigem STAFF+.
- `/holdings` — CRUD; lista root exige header; criação deriva de `editionId` + `locationId` e valida organização comum; operações por ID derivam do Holding. Escritas exigem STAFF+.
- `/items` — CRUD; lista root exige header; criação deriva de `holdingId`; operações por ID derivam de `Item → Holding → Edition → Work`. Escritas exigem STAFF+.
- `/external-identifiers` — `GET` root exige header, filtra por Organization e aceita apenas entityType/entityId/authority como filtros. `POST` deriva Organization de Work, Edition, Library, Location, Holding ou Item; `GET/PUT/DELETE :id` usam a Organization persistida. Leituras requerem membership e escritas STAFF+; update mantém `entityType`/`entityId` imutáveis e permite alterar `authority` e `value`.
- Não existe `/contributors`; os modelos `Contributor`, `WorkContributor` e `EditionContributor` não fazem parte do schema/baseline.
- `/agents` — `GET` (raiz, contexto explícito, cursor, filtro `kind`) e `POST` (raiz, STAFF+); `GET/PATCH/DELETE /agents/:id` com Organization derivada do Agent (escrita STAFF+, não-membro mascarado como `RESOURCE_NOT_FOUND`). Duplicado `kind`+nome normalizado → `CONFLICT_DUPLICATE_RESOURCE`; apagar Agent com Contributions → `CONFLICT_FOREIGN_KEY_REFERENCE`. Sem `organizationId` no body/query.
- `/contributions` — `GET` raiz (contexto explícito, cursor, filtros `workId`/`editionId`/`agentId`) e `GET/PATCH/DELETE /contributions/:id` (Organization derivada do Work/Edition; PATCH só `roleLabel`/`sortOrder`; target e Agent imutáveis; escrita STAFF+). `POST` manual canónico; exactamente um `workId`/`editionId`, Organization derivada do target, Agent no mesmo tenant, header opcional de consistência e STAFF+. `source=MANUAL` é atribuído pelo servidor.
- `/bibliographic-records/:id` — `GET` read-only; Organization deriva de
  `BibliographicRecord → Edition → Work`; header opcional só confirma igualdade
  e a leitura requer membership. Não há root list nem rotas próprias de escrita;
  Records são criados pela confirmação de importação de catálogo.
- `GET /editions/:id/record` — devolve o Record mais recente da Edition,
  projectando `id`, `editionId`, `source`, `sourceId`, `importedAt`, `remoteId`,
  `format` e proveniência `pipeline-only`; não devolve `rawContent`. Edition sem
  Record produz `RESOURCE_NOT_FOUND`. A Organization deriva de Edition → Work;
  o header opcional só confirma igualdade e qualquer membership pode ler. A
  proveniência PORBASE identifica o pipeline de ingestão, não um snapshot upstream.
- `GET /editions/:id/cover` — lê a capa activa; Organization deriva de
  `Edition → Work`; header opcional só confirma igualdade; leitura requer
  membership. Responde com bytes de imagem ou 304 para `If-None-Match` válido.

Catálogo externo, capas e exportação:

- `POST /catalogues/search` — pesquisa/preview externo, provider opcional; JWT conforme contrato actual, sem contexto organizacional e sem persistência local.
- `POST /catalogues/import` — confirmação editável persistida transaccionalmente; exige `X-Folio-Organization-Id` e STAFF+; não refaz pesquisa externa. Tenant de Work vem exclusivamente do header; `Edition` deriva do Work criado.
- `GET /editions/:id/cover` — capa activa, autorização de membership, `ETag` e
  `If-None-Match`.
- `GET /exports/marcxchange/edition/:editionId` — export local MARCXchange;
  Organization deriva de `Edition → Work`; header opcional só confirma igualdade;
  membership Reader+ é obrigatória. Edition/Record ausente ou sem membership
  devolve `RESOURCE_NOT_FOUND` para não revelar existência cross-tenant; membro
  com header divergente recebe `ORGANIZATION_CONTEXT_CONFLICT`. Mapeia os
  campos canónicos da Edition para MARC21 e serializa XML em memória, sem
  ficheiro/job; exige um BibliographicRecord associado, mas não lê o seu
  `rawContent`.
- `/docs` — Swagger UI.

Não existem rotas antigas específicas PORBASE para pesquisa/import. Não existe endpoint MARCXML, ISO 2709, resposta do campo `rawContent` sem serialização ou pesquisa local de catálogo.

## Catálogo e integração PORBASE

### Contratos e comportamento implementados

`CatalogueProvider` é a fronteira genérica. O único provider registado é `porbase`, formato `UNIMARC`, default actual.

`SearchCatalogueDto` aceita um de:

- `{ type: 'isbn', isbn }`
- `{ type: 'title', title }`
- `{ type: 'author', author }`
- `{ type: 'keyword', keyword }`

O DTO rejeita campos que não correspondem ao discriminante. **PORBASE só implementa ISBN**; title, author e keyword devolvem `CATALOGUE_SEARCH_TYPE_UNSUPPORTED`. Search e import aceitam `sourceId` opcional; a identidade `sourceId` de resposta é acrescentada pelo provider.

O preview consulta PORBASE, interpreta XML/MARC text e devolve campos estruturados, warnings e conteúdo original. `POST /catalogues/search` não exige organização e não persiste. A confirmação `POST /catalogues/import` exige contexto organizacional explícito e payload editável; o servidor não volta a PORBASE, e o tenant não é aceite no body.

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
- `BibliographicNote` pode apontar a Work ou Edition, com XOR SQL; Organization
  deriva do único parent. O import actual cria Notes na Edition; não há rotas
  públicas de CRUD para Notes.
- Não existem modelos `Contributor`, `WorkContributor` ou `EditionContributor` no schema nem fallback para esses dados.
- `BibliographicRecord` pertence obrigatoriamente a Edition, guarda `rawContent`
  e proveniência básica (`source`, `remoteId`, `sourceId`, `format`), e não tem
  ownership duplicada por Work ou Organization.
- `UnmappedSourceField` e `UnmappedSourceSubfield` preservam campos de origem não mapeados, além do raw payload.

### Implementação por pipeline

- PORBASE parser/preview extrai títulos, responsabilidade, línguas, publicação, descrição física, série, declarações de edição, notas, classificações, identificadores, contribuições e campos não mapeados dos campos actualmente suportados.
- Cobertura concreta do parser: `001`, `003`, `010$a`, `021$a/$b`, `035$a`, `101$a/$c`, `102$a`, `200$a/$b/$d/$e/$f/$g/$h/$i`, `205$a/$b/$f`, `210$a..$g`, `215` completo, `225$a/$e/$v/$x`, títulos variantes de `500`, `510–545` e `560` (`$a/$e`), notas `300/317/320/327/328/330$a`, classificações `675/676/680/686`, contribuições `700–713` e identificadores de origem `003/021/035`. `856` é tratado pelo extractor de candidatos de capa (`$u`, com `$q/$y/$z` como metadados auxiliares), não como mapeamento bibliográfico canónico.
- Confirmação de importação persiste muitas dessas estruturas numa transacção. `UnmappedSourceField` é recalculado no servidor a partir do `rawContent` confirmado, best-effort.
- Import grava contribuições canónicas PORBASE; leituras de Work/Edition e export usam estruturas canónicas, preservando source parts de contribuições quando suportadas. Export não lê raw nem campos não mapeados do provider.
- `EditionsService` lê as estruturas canónicas para Edition e mapeia `coverUrl`; `WorksService` inclui Editions aninhadas sem projectar `coverUrl`.
- O export MARCXchange consome o modelo canónico de Edition e serializa o perfil MARC21; campos de provider ficam confinados ao raw e aos dados não mapeados.

### Limitações de integração canónica

- CRUD normal de Work/Edition ainda escreve os campos escalares; não mantém sempre `WorkTitle`, `EditionTitle` ou `EditionLanguage`. Assim, a fonte canónica por estrutura está integrada mais completamente no import/export do que nas operações gerais de escrita.
- Parser/DTO de título reconhece `200$h/$i` como `partNumber`/`partName`, mas o schema `WorkTitle`/`EditionTitle` não tem esses campos e a persistência não os grava estruturadamente. O raw original permanece disponível.
- `BibliographicNote` suporta alvos Work e Edition no schema; o fluxo actual de import oferece notas na Edition, não um contrato completo de nota de Work.
- A camada de proveniência não tem ainda versões/histórico de aquisição, hash do raw, encoding, versão do parser ou gestão de múltiplos snapshots. `GET /editions/:id/record` expõe apenas fonte/pipeline e timestamp de importação, sem afirmar snapshot upstream.
- `GET /bibliographic-records/:id` e `GET /editions/:id/record` são rotas
  read-only de Record; não há listagem root, criação, atualização ou remoção
  fora da confirmação de import.
- O perfil PORBASE é subconjunto: não implica implementação semântica de todo UNIMARC, authority control, MARC 21 ou preservação de todo campo desconhecido como conceito canónico.

## Capas e ficheiros

### Schema e extracção

O schema tem `CoverCandidate`, `CoverAsset` e `EditionCover`:

- `CoverCandidate` deriva Organization por `BibliographicRecord → Edition → Work`, guarda URL/hash, fonte, estado (String, não enum), retries e próxima tentativa; liga-se ao Record e opcionalmente ao Asset.
- `CoverAsset` é organization-scoped para isolamento do storage e deduplicação por `(organizationId, contentHash)`. Acesso servível nunca é autorizado pelo Asset sozinho.
- `EditionCover` deriva Organization por `Edition → Work`, associa Edition a Asset e tem `isActive`; há unique `(editionId, coverAssetId)` e a migration `20261006150000_tomos_domain_baseline` adiciona índice único parcial para limitar a uma capa activa por Edition. Triggers diferidos impõem igualdade de organização em EditionCover→Asset e Candidate→Record→Edition→Asset. A migration aborta sem alterar dados se detectar capas activas duplicadas.

`PorbaseCoverCandidateExtractor` extrai `$u` de campos UNIMARC 856, calcula URL hash e classifica candidato. O import grava candidatos com savepoint e não falha o import se essa extracção/persistência falhar. A classificação do extractor não substitui a validação de rede do fetcher.

### SafeHttpFetcher

`SafeHttpFetcherService`:

- aceita apenas HTTPS em cada hop, usa allowlist exacta `COVER_ALLOWED_HOSTS` e valida userinfo/portas; redirects HTTP (incluindo downgrade HTTPS→HTTP) são rejeitados;
- resolve DNS e rejeita endereços não públicos; fixa endereço aprovado no callback lookup para ligação;
- não usa proxy ambiente; trata redirects manualmente até três, revalidando host e DNS;
- usa timeout total (`COVER_HTTP_TIMEOUT`, default 10 s), timeout de ligação (`COVER_CONNECT_TIMEOUT`, default 5 s) e stream máximo (`COVER_MAX_SIZE_BYTES`, default 5 MiB);
- valida magic bytes e Content-Type para JPEG, PNG, GIF e WebP, e descodifica com `sharp`, limitando dimensões (`COVER_MAX_WIDTH`/`COVER_MAX_HEIGHT`, 5000 cada) e pixels;
- `COVER_ALLOWED_HOSTS` ausente resulta em allowlist vazia. `.env.example` sugere `images.porbase.pt,purl.pt`, mas não é configuração carregada automaticamente; runtime exige configuração explícita.
- O extractor aceita `porbase.pt` e subdomínios como host conhecido; a allowlist exacta do fetcher pode ainda rejeitar esses hosts/subdomínios, salvo configuração explícita. Isto falha fechado, mas pode deixar candidatos sem aquisição.

### Storage e aquisição

`StorageService` tem `save/get/delete/exists`. Adaptadores existentes: `LocalFsStorage` (default fora de tests; raiz `COVER_STORAGE_ROOT`) e `InMemoryStorage` (apenas tests). S3 é planeado, não implementado.

`CoverAcquisitionServiceImpl` é processamento interno in-process (sem User/header), com sweep no bootstrap e de 60 em 60 segundos fora de `NODE_ENV=test`. Busca candidatos PENDING vencidos, faz claim condicional atómico para ACQUIRING, deriva Organization por `CoverCandidate → BibliographicRecord → Edition → Work`, depois faz fetch, SHA-256, armazenamento e upsert de `CoverAsset` scoped por organização. A Edition só é resolvida por `BibliographicRecord.editionId`. A associação verifica de novo a Edition/Organization sob lock; constraints SQL também impedem associações cross-tenant.

Depois do download, storage e upsert do asset, uma transacção bloqueia as linhas da Edition e do Work, verifica a organização, preserva qualquer capa activa e cria/reutiliza uma `EditionCover` activa apenas quando nenhuma existe. O estado ACQUIRED e o `coverAssetId` do candidato são confirmados na mesma transacção do vínculo. Falha nesta transacção reverte a associação e o estado do candidato, agenda retry e mantém o `CoverAsset`/ficheiro já persistido; não remove assets partilhados. Candidatos sem Edition inequívoca ficam ACQUIRED com asset mas sem EditionCover. A unicidade parcial protege também escritores que não usem este service; o lock de Work serializa aquisições concorrentes da aplicação.

Retries usam `nextAttemptAt` e backoff de 1 min, 5 min, 15 min e 1 h; o fallback repete 1 h para a quinta retry. Ao atingir `retryCount >= 5`, marca `REJECTED/MAX_RETRIES_EXCEEDED`. O scan é sequencial; não há queue/worker nem limite global de concorrência. Storage e criação do asset antecedem a transacção de associação; se a persistência do asset falhar depois de guardar os bytes, pode ficar um ficheiro órfão, sem associação bibliográfica. A migration do índice parcial falha de forma não destrutiva e requer resolução explícita caso encontre Edition com múltiplas capas activas.

### Endpoint e saída

`GET /editions/:id/cover` valida CUID, exige JWT e resolve contexto derivado por `OrganizationContextResolver`; `X-Folio-Organization-Id` é opcional e, se enviado, tem de coincidir com Edition→Work. Qualquer role com membership pode ler; não existe mutação pública de Candidate, Asset ou EditionCover. O handler procura `EditionCover` activa e lê `StorageService` apenas se `If-None-Match` não corresponder. Responde com MIME, ETag baseado em `contentHash`, `Cache-Control: private, max-age=31536000` e `X-Content-Type-Options: nosniff`; correspondência devolve 304. O OpenAPI descreve os MIME binários, headers, 304 e erros de contexto/recurso.

`coverUrl` é um path relativo `/editions/{id}/cover` ou `null` nas respostas directas geradas por `EditionsService` (lista, detalhe, create/update) e nas Editions aninhadas nas respostas de Work (lista e detalhe). Não é projectado na resposta de importação de catálogo.

## Exportação

`GET /exports/marcxchange/edition/:editionId` exige JWT, permite CUID e UUID, deriva Organization por `Edition → Work`, compara o header opcional via `OrganizationContextResolver` e valida membership (Reader+). Edições sem acesso, inexistentes ou sem Bibliographic Record associado devolvem `RESOURCE_NOT_FOUND`; para membros, header divergente devolve `ORGANIZATION_CONTEXT_CONFLICT`. Após resolver contexto, consulta apenas o ID do Record mais recente como requisito de existência e carrega Edition e relações canónicas com filtro pela Organization derivada. Nunca selecciona nem serializa `BibliographicRecord.rawContent` ou campos não mapeados de provider.

O perfil inicial converte o subconjunto canónico suportado para MARC21/MARCXchange — por exemplo, títulos para 245, ISBN para 020, contribuições pessoais para 100/700 e corporativas para 110/710 — e omite dados sem mapeamento aprovado. A resposta é XML (`application/xml; charset=utf-8`) em memória como attachment `folio-{editionId}.marcxchange.xml`; não cria ficheiro temporário nem job. `rawContent` permanece preservado no BibliographicRecord para auditoria/reprocessamento; o export descreve o modelo Folio curado e não afirma autenticidade de conteúdo upstream (DEC-02, DEC-06). Não existem endpoints MARCXML, ISO 2709, root/batch export ou exportação do raw.

## Paginação, performance e throttling

### Paginação e base de dados

`PaginationQueryDto`: cursor CUID opcional, `limit` default 25, intervalo 1–100. Helper consulta `limit + 1` e devolve `{ items, nextCursor, hasMore }`; cursor continua por `id` com `skip: 1`.

Listas de Works, Editions, Libraries, Locations, Holdings, Items, ExternalIdentifiers e Users usam helper partilhado. Listas root tenant-scoped de bibliografia e inventário exigem `X-Folio-Organization-Id` e filtram um único tenant. External Identifiers aceitam `entityType`, `entityId` e `authority` como filtros. Pesquisa PORBASE é um resultado individual, não lista paginada.

O pool `pg` usa `DATABASE_POOL_MAX` default 10, conexão 5 s, idle 10 s e query 10 s. HTTP usa request 15 s, headers 20 s e keep-alive 5 s. Valores ambientais inválidos/não positivos recaem em defaults.

Índices efectivos relevantes do schema incluem `Work(organizationId, createdAt, id)`, `Edition(workId, createdAt, id)`, `Library(organizationId, createdAt, id)`, `Location(libraryId, createdAt, id)`, `Holding(editionId|locationId, createdAt, id)`, `Item(holdingId, createdAt, id)`, `OrganizationMembership(userId, organizationId)` único, relações de contribuição por alvo e ordem, títulos/declarações/notas por owner e ordem, e `BibliographicRecord(editionId, createdAt, id)`. Capas têm `CoverCandidate(status)`, `CoverCandidate(nextAttemptAt)`, unicidade `(bibliographicRecordId, urlHash)`, `CoverAsset(organizationId, contentHash)` único e índices de `EditionCover`.

Lacunas observáveis: fanout aninhado de Editions em listas de Works não tem paginação própria. São observações de schema/query, não resultados de benchmark; medir antes de alterar índices.

### Throttling

`ThrottlerGuard` global, por IP, default `THROTTLE_LIMIT=10` e `THROTTLE_TTL=60000` ms; ignora User-Agent que corresponda a `/node-fetch/` e envia headers `X-RateLimit-*`. Overrides: login/refresh/signup 10 por janela; catalogues search/import 5; listagens GET `/works`, `/editions`, `/items`, `/holdings` 100. Outros handlers usam default global. Storage é default em memória do processo; multi-réplica requer storage partilhado. `/editions/:id/cover` não tem override específico e usa o limite global.

## CORS

`getCorsOptions` divide `CORS_ORIGIN` por vírgulas e remove espaços. Sem valor, usa `http://localhost:4200` se `NODE_ENV=development`; quando ausente ou diferente de development usa `https://app.fol.io`. Isto é um default da configuração CORS, não define `NODE_ENV` globalmente.

Permite `GET`, `POST`, `PUT`, `DELETE`, `PATCH`; headers `Content-Type`, `Authorization`, `If-None-Match` e `X-Folio-Organization-Id`; expõe `ETag`; credenciais activas e max-age 3600 segundos.

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

1. A migração do contexto é parcial: Organizations/Works/Editions/Libraries/Locations/Holdings/Items, catalogue import, `POST /contributions`, leitura de Bibliographic Records/Covers, export por Edition e captura (`WorkItem`) usam contexto explícito ou derivado. `getDefaultOrganization()` permanece apenas usado pelo onboarding pessoal.
2. Sem gestão de memberships/convites/roles, branches, Campus, ServicePoint, auditoria ou circulação; Item não representa empréstimos nem estado de circulação. O CRUD de Agents e Contributions (list/get/PATCH/DELETE) está implementado no backend e tem cliente/UI no `folio-app`; a validação de integração e smoke app→API continua pendente. Agents continuam sem merge/autoridade. WorkItem suporta captura por scan, match/unmatch manual a Item existente, leitura e transição de estado; não há fila dedicada nem UI de curadoria.
3. Confirmação de import sem preview snapshot; campos de contribuição de origem do import são editáveis pelo cliente.
4. CRUD regular de Work/Edition ainda não mantém sempre relações de títulos/línguas canónicas; `$h/$i` parseados não são persistidos estruturadamente.
5. Proveniência de Records limitada; não há snapshot do preview nem versionamento/hash do raw record.
6. `coverUrl` não é projectado na resposta de importação de catálogo.
7. Hosts do fetcher devem ser configurados; sem variável a allowlist é vazia e o allowlist exacto pode não incluir todos os hosts aceites pelo extractor.
8. Storage S3, queue, rate-limit distribuído, request ID e redacção de mensagem/stack de excepções não existem.
9. Migração `20260907180000_refine_bibliographic_model` declara-se como alvo de reset deliberado de desenvolvimento e executa `DROP TABLE PhysicalDescription`; confirmar estado/impacto do ambiente antes de aplicar migrations. Migrations versionadas não demonstram estado de aplicação remota.
10. WorkItem é entidade de processo de captura separada de Item, Edition e BibliographicRecord; a relação opcional a Item usa `matchedItemId`. M3b não implementa fila dedicada, UI de curadoria, importação PORBASE a partir de WorkItem, criação automática de catálogo/inventário, edição geral, eliminação de WorkItems nem circulação. O enforcement da Organization comum entre WorkItem e Item é exclusivamente aplicacional, no service.

## Próximos gates

O backend implementa contexto explícito/derivado nos grupos actualmente
expostos, incluindo Agents, Contributions, External Identifiers e WorkItem. O cliente já
implementa selector de Organization, paginação por cursor e as superfícies de
External Identifiers e Agents/Contributions. Isto não fecha a integração:

1. manter documentação e contratos dos dois repositórios convergentes;
2. preparar futuramente uma base de teste isolada e descartável, mediante
   aprovação explícita;
3. validar contract/integration tests e smoke real app→API nessa base;
4. só depois decidir o fecho da Phase 7 e o próximo domínio;
5. tratar pesquisa local, gestão de memberships, fila/UI de curadoria (M3c),
   auditoria e hardening distribuído como trabalho futuro sujeito a decisão própria.

M3a/M3b — WorkItem — estão implementados com isolamento por Organization e estes contratos:

- `GET /work-items` requer JWT e `X-Folio-Organization-Id`; aceita `cursor`, `limit` e filtro opcional `status`; `limit` tem default 25 e máximo 100; devolve `{ items, nextCursor, hasMore }`. Os filtros `status=NEEDS_REVIEW` (capturas por identificar) e `status=IDENTIFIED` (propostas por validar) são isolados por Organization. READER ou superior pode listar; não existe uma fila dedicada nem UI de curadoria.
- `POST /work-items` requer JWT, `X-Folio-Organization-Id` e STAFF, ADMIN ou OWNER; aceita exclusivamente `{ "rawValue": string }` e rejeita propriedades desconhecidas. Cria sempre `source=MANUAL`, `status=NEEDS_REVIEW`, `matchedItemId=null`; deriva Organization do contexto e `createdById` do JWT.
- `POST /work-items/scan` requer JWT, `X-Folio-Organization-Id` e STAFF, ADMIN ou OWNER; aceita exclusivamente `{ "rawValue": string }`, rejeita propriedades desconhecidas e exige valor não vazio/não composto apenas por espaços. Preserva `rawValue` exactamente como recebido, cria `source=SCAN`, `status=NEEDS_REVIEW`, `matchedItemId=null`, Organization do contexto e `createdById` do JWT. Não faz lookup, parsing, normalização nem cria Item, Holding, Edition, Work, BibliographicRecord ou outros recursos.
- `GET /work-items/:id` requer JWT, deriva Organization do WorkItem persistido e permite header opcional apenas como verificação de consistência; READER ou superior pode ler.
- `PATCH /work-items/:id/status` requer JWT, deriva Organization do WorkItem persistido e exige STAFF, ADMIN ou OWNER; aceita exclusivamente `{ "status": WorkItemStatus }` e rejeita propriedades desconhecidas. A actualização é condicionada por `id`, `organizationId` e estado anterior; transição inválida ou perda do compare-and-set devolve HTTP 409 `WORK_ITEM_TRANSITION_INVALID`.
- `PATCH /work-items/:id/match` requer JWT, deriva Organization do WorkItem e aceita header opcional apenas como consistência; exige STAFF, ADMIN ou OWNER e body exclusivamente `{ "itemId": string }`. O Item tem de existir e ambas as cadeias de ownership (`Item → Holding → Edition → Work → Organization` e `Holding → Location → Library → Organization`) têm de resultar na Organization do WorkItem. Match manual move `NEEDS_REVIEW` ou `IDENTIFIED` sem match para `IDENTIFIED`; não substitui match existente nem altera WorkItems `VALIDATED`. O CAS inclui id, Organization, estado anterior e `matchedItemId=null`. Item inexistente ou de outra Organization devolve 404 `RESOURCE_NOT_FOUND`; erros de estado devolvem 409 `WORK_ITEM_MATCH_ALREADY_PRESENT` ou `WORK_ITEM_MATCH_INVALID_STATE`.
- `DELETE /work-items/:id/match` requer JWT, Organization derivada e STAFF, ADMIN ou OWNER; não aceita body. Com match presente e estado não terminal, CAS por id, Organization, estado anterior e match limpa `matchedItemId` e regressa a `NEEDS_REVIEW`. Sem match devolve 409 `WORK_ITEM_MATCH_NOT_PRESENT`; estado inválido/terminal devolve 409 `WORK_ITEM_MATCH_INVALID_STATE`. Não elimina o Item.
- Semântica: `NEEDS_REVIEW` é uma captura ainda por identificar; `IDENTIFIED` representa identidade proposta/resolvida ainda por validar; `VALIDATED` significa validação humana concluída e é terminal. Match nesta fatia é manual, apenas para Item existente na mesma Organization; não valida a identificação. Para mover um WorkItem com match de volta a `NEEDS_REVIEW`, é necessário remover o match primeiro.
- Códigos M3b: `WORK_ITEM_MATCH_NOT_PRESENT`, `WORK_ITEM_MATCH_ALREADY_PRESENT` e `WORK_ITEM_MATCH_INVALID_STATE`; erros de tenancy reutilizam `RESOURCE_NOT_FOUND`, `ORGANIZATION_CONTEXT_CONFLICT` e `ORGANIZATION_ROLE_INSUFFICIENT`.

Barcode/rawValue é opaco: não há inferência de tipo, validação ISBN, normalização ou parsing. Pesquisa PORBASE não altera o estado; confirmação de importação PORBASE a partir de WorkItem é trabalho futuro. O enforcement de tenancy do match ocorre apenas no service; nenhuma base de dados foi tocada nesta fatia.

### Follow-up M3b.1 — enforcement persistente de tenancy no match

- **Estado:** planeado; não implementado.
- **Objectivo:** garantir, ao nível da persistência, que um WorkItem só pode referenciar um Item da mesma Organization.
- **Motivação:** a validação actual está no service e protege os endpoints M3b, mas não escritas directas à base de dados, seeds futuros, importações ou ferramentas administrativas.
- **Âmbito previsto:**
  1. Avaliar a melhor forma de representar a invariante no modelo Prisma.
  2. Criar uma migration revista, apenas se necessário.
  3. Implementar enforcement persistente — por exemplo, trigger/função SQL ou constraint adequada, conforme a solução técnica escolhida.
  4. Adicionar testes de migration/integração para: match same-organization aceite; match cross-organization rejeitado; comportamento ao remover match; ausência de efeito em WorkItems sem match.
  5. Aplicar a migration exclusivamente em `folio_smoke`, com o guard `database == folio_smoke && database != folio`.
  6. Actualizar `schema.prisma`, `CONTEXT.md` e testes para representar apenas o desenho final.
- **Restrições:** não aplicar em `folio`; não criar migration como ficheiro preparado fora de uma fatia própria; não introduzir drift entre `schema.prisma` e PostgreSQL; não implementar nesta fatia M3b.

Direcção futura de pesquisa local: pesquisa Folio distinta de providers externos; extensão controlada de `GET /works`; PostgreSQL full-text (`tsvector`, ranking e GIN), cursor compatível com ordenação; trigramas só com justificação medida. Sem Elasticsearch/Redis nesta fase.

## Decisões e propostas ainda por formalizar

O contexto organizacional e as cadeias de domínio estão aprovados em
`DECISION-1L-DEC-0-organizational-context.md` e decisões dependentes. A
implementação backend é parcial: Organizations, Works, Editions e o inventário
físico (Libraries, Locations, Holdings e Items) estão migrados; aprovação não
significa que os restantes grupos estejam concluídos.

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
- Captura e matching manual: `src/work-items/`, máquina de estados em `work-item-transitions.ts`, endpoints de list/create/scan/detail/transition/match/unmatch em `work-items.controller.ts`.
- Testes de integração relevantes: `test/porbase-import.e2e-spec.ts`, `test/porbase-import-persistence.e2e-spec.ts`, `test/exports.e2e-spec.ts`, `test/edition-cover.e2e-spec.ts`, `test/work-items.e2e-spec.ts`.
- CI: `.github/workflows/ci.yml`.
