# Contexto do Projeto Folio API

> Atualizado em: 2026-09-06

## Visão geral

API NestJS para a Folio, uma plataforma de gestão de bibliotecas pessoais e, progressivamente, institucionais.

A primeira versão suporta o caso de uso de biblioteca pessoal, mas a arquitectura deve permitir a evolução para bibliotecas municipais ou outras organizações, com:

- catálogo bibliográfico;
- obras, edições e exemplares;
- importação e exportação de formatos MARC;
- pesquisa por ISBN e outros identificadores;
- organizações, filiais e permissões;
- utilizadores gestores, bibliotecários e leitores;
- empréstimos, devoluções, reservas e auditoria.

A prioridade actual é consolidar o domínio, a segurança e a proveniência bibliográfica antes de ampliar o número de formatos ou implementar circulação.

A base de desenvolvimento pode ser descartada.
O objectivo é a estrutura de domínio mais correcta.
Compatibilidade só deve existir quando reduz risco real de produto, não por apego a dados de teste.

## Stack

- Runtime: Node.js (ESM);
- Framework: NestJS 12;
- Linguagem: TypeScript ESM;
- ORM: Prisma 7;
- Base de dados: PostgreSQL;
- Driver: `@prisma/adapter-pg` + `pg`;
- Documentação: Swagger UI em `/docs`;
- CORS configurado para desenvolvimento local.

A configuração do Prisma 7 usa `prisma.config.ts`; o `datasource` do schema não contém `url`. O cliente gerado em `src/generated/prisma/` é output e não deve ser editado manualmente.

## Arquitectura

A API deve manter um monólito modular enquanto o domínio cresce:

```text
HTTP controllers
→ application services / use cases
→ domínio e políticas de autorização
→ repositories / Prisma
→ PostgreSQL e, futuramente, object storage e workers
```

Os controllers devem ser finos. Regras de importação, exportação, circulação e autorização devem viver em services/use cases testáveis sem NestJS sempre que possível.

Módulos de domínio previstos:

- Identity & Access;
- Organizations & Memberships;
- Cataloguing;
- Bibliographic Sources & Provenance;
- Holdings & Inventory;
- Circulation;
- Search;
- Import/Export Jobs;
- Audit & Observability.

A divisão actual por entidades continua válida durante o MVP, mas `WorksModule` não deve permanecer como proprietário implícito de todas as regras bibliográficas e de circulação.

## Estrutura actual

```text
folio-api/
  prisma/
    config.ts
    schema.prisma
    migrations/
  src/
    main.ts
    app.module.ts
    auth/
    prisma/
    health/
    users/
    works/
    editions/
    contributors/
    external-identifiers/
    bibliographic-records/
    items/
    exports/
    catalogues/
      adapters/
        dto/
      import-preview.service.ts
      import-preview.controller.ts
  test/
```

A estrutura exacta deve ser confirmada no código antes de alterar módulos. Imports locais TypeScript devem manter a extensão `.js` conforme a configuração ESM.

## Tenancy e autorização

### Decisão arquitectural

`Organization` é a única fronteira de tenancy do catálogo e do inventário.

```text
User
  └── OrganizationMembership
        └── Organization
              ├── Work
              │     └── Edition
              │           └── Item
              └── Library / Branch (futuro, opcional)
```

`User` é uma identidade global. A relação entre utilizador e organização é muitos-para-muitos e é representada por `OrganizationMembership`, que também contém o role:

- `OWNER`;
- `ADMIN`;
- `STAFF`;
- `READER`.

Um utilizador pode pertencer a várias organizações. A organização pessoal é apenas uma organização normal com uma única membership `OWNER`.

### Estado implementado

- `Work.organizationId` é obrigatório;
- `Item.organizationId` é obrigatório;
- `Edition` pertence a `Work`;
- `Item` pertence a `Edition` e é criado na mesma organização;
- `Work.userId` não existe;
- `Item.userId` não existe;
- `Institution` e `institutionId` não existem no modelo actual;
- catálogo e inventário não têm ownership directo por utilizador;
- todos os acessos protegidos usam o utilizador do JWT para procurar a membership;
- leitura requer membership;
- escrita requer `STAFF`, `ADMIN` ou `OWNER`;
- endpoints administrativos requerem role específica.

`userId` continua a existir como identidade do actor e como chave da membership, mas não como proprietário de Work, Edition ou Item.

### Organização pessoal

Quando um utilizador é criado, o sistema cria na mesma transacção:

1. uma `Organization` pessoal;
2. uma `OrganizationMembership` com role `OWNER`.

Esta organização usa o mesmo modelo que uma organização municipal ou empresarial. A diferença é apenas operacional: normalmente tem um único membro e não precisa de branches.

### Organizações múltiplas

Um utilizador pode pertencer a várias organizações para suportar:

- biblioteca pessoal e biblioteca profissional;
- bibliotecários que trabalham em várias instituições;
- consultores externos;
- leitores inscritos em várias bibliotecas.

A organização activa e a administração de memberships ainda não fazem parte do contrato actual.

### Endpoints de organizações

Estão implementados, protegidos por JWT e limitados às memberships do utilizador:

- `GET /organizations` — lista `id`, `name`, `role` e `createdAt` das organizações onde o utilizador é membro;
- `POST /organizations` — recebe apenas `name`, normaliza espaços, cria Organization e membership `OWNER` numa transacção;
- `GET /organizations/:id` — exige membership e devolve a organização com o role do utilizador;
- `PUT /organizations/:id` — exige `OWNER` ou `ADMIN` e permite apenas alterar `name`, sem aceitar ownership;
- `DELETE /organizations/:id` — exige `OWNER`, mas devolve `409 Conflict` enquanto não existir política segura para reassociar Works e Items.

Organizações inexistentes devolvem `404`; utilizadores sem membership devolvem `403`. Não existem ainda endpoints para administrar membros, convidar utilizadores, atribuir roles ou eliminar organizações.

### Futuro

- endpoints de gestão de memberships;
- convites;
- selecção de organização activa;
- Library/Branch subordinada a Organization;
- holdings e localização;
- circulação;
- auditoria de acessos e alterações.

## Internationalization

- The product UI supports `pt-PT` and `en`.
- Flutter is responsible for translating user-facing UI strings.
- The API returns stable machine-readable error codes; clients translate them.
- API messages are not a localization contract.
- Bibliographic source data and MARC values are preserved verbatim and are never translated.
- `publicationDate` is bibliographic text with partial precision and must not be locale-formatted as a full date.
- Dates/times representing system events use locale-aware formatting in the client.

## Modelo actual

### User e Organization

O modelo contém `User`, `Organization` e `OrganizationMembership`. `Organization` é a fronteira única de tenancy para todo o material bibliográfico e de inventário. As memberships usam os roles controlados `OWNER`, `ADMIN`, `STAFF` e `READER`.

### Work, Edition e Item

- `Work` representa a obra intelectual;
- `Edition` representa a publicação/manifestação específica;
- `Item` representa uma cópia ou exemplar gerível;
- `Contributor` é associado a works e editions através de relações com role e sort order;
- `ExternalIdentifier` guarda ISBN, PORBASE e outros identificadores e é scoped à Organization através de `organizationId`.

Invariável:

```text
ExternalIdentifier.organizationId
= ExternalIdentifier.edition.work.organizationId
```

A unicidade é `(organizationId, type, value)`: o mesmo ISBN pode existir em organizações diferentes, mas identificadores do mesmo tipo e valor são únicos dentro da mesma organização.
- `BibliographicRecord` guarda a proveniência original recebida de fontes externas.

O modelo actual usa `cuid()` para IDs. Controllers não devem assumir UUID sem validar o padrão real usado pelo schema.

### Descrição física e datas bibliográficas

`Edition.pageCount: Int?` não é uma representação bibliográfica suficiente. É um valor derivado opcional, calculado pelo backend a partir das partes `215$a`, e pode ser `null` quando a derivação é ambígua. Nunca é a fonte de verdade nem é aceite como valor autoritativo em escritas públicas.

`PhysicalDescription` representa exactamente uma ocorrência do campo UNIMARC `215`. `PhysicalDescriptionPart` representa um subcampo ordenado dessa ocorrência. O modelo preserva ocorrências múltiplas, subcampos repetidos, ordem, códigos desconhecidos de um carácter, `source` da ocorrência e `normalizedValue` gerado no servidor:

```text
Edition
└── PhysicalDescription (uma ocorrência 215)
  ├── PhysicalDescriptionPart (215$a)
  └── PhysicalDescriptionPart (215$b)
```

Os códigos conhecidos são `a` a `f`; códigos desconhecidos lowercase alfanuméricos de um carácter são preservados e exportados sem label semântico na UI. A descrição física UNIMARC `215$a` pode conter texto como:

```text
146, [6] p.
```

Pode também repetir e coexistir com outros subcampos de `215`, como dimensões e ilustrações.

Decisão:

- o texto bibliográfico completo é a fonte de verdade;
- o número de páginas, quando existir, é um valor derivado opcional;
- uma descrição não deve ser rejeitada por não ser um inteiro;
- o parser deve preservar o original e emitir warning quando a extracção numérica for parcial ou impossível;
- `PhysicalDescriptionPart` preserva subfield, value, sortOrder e normalizedValue, sem concatenar informação de forma irreversível;
- o parser PORBASE preserva cada ocorrência `215` e todos os subcampos válidos;
- o export local emite uma ocorrência `215` por `PhysicalDescription` antes de recorrer ao fallback numérico `pageCount`.

`Edition.publicationDate` é uma string canónica opcional com exactamente uma das formas `YYYY`, `YYYY-MM` ou `YYYY-MM-DD`. A validação inclui calendário real e anos bissextos. A precisão é derivada em runtime da forma da string; não existe enum redundante persistido. Datas parciais nunca são convertidas em datas completas.

## Autenticação e segurança

### Estado actual

- `POST /auth/login` emite JWT;
- `JwtStrategy` valida Bearer tokens e confirma que o utilizador existe;
- rotas protegidas usam o claim `sub` como identidade;
- o contrato público de autenticação usa `password`;
- `UsersService` gera hashes Argon2id antes de persistir utilizadores;
- `AuthService` verifica passwords com `argon2.verify`, nunca por comparação directa;
- respostas públicas de utilizadores não incluem `passwordHash`;
- access tokens JWT têm validade de 15 minutos;
- refresh tokens são hashes Argon2id guardados no utilizador, com validade de 7 dias, rotação e revogação.

### Dívida técnica prioritária

Antes de produção ou utilização institucional:

1. A fundação de memberships e roles e os endpoints self-service de Organizations já existem. Continua pendente a administração completa de memberships, a selecção de organização activa, políticas por filial, rate limiting e auditoria.
2. adicionar rate limiting e auditoria;
3. nunca expor hashes, tokens ou credenciais em respostas e logs.

O hashing actual usa Argon2id através da biblioteca `argon2`, com `memoryCost: 65536` KiB, `timeCost: 3` e `parallelism: 1`. O salt é aleatório e gerado pela biblioteca para cada password; os parâmetros e o salt ficam codificados no hash Argon2id armazenado no campo `User.passwordHash`.

O schema mantém `User.passwordHash String` exclusivamente como armazenamento interno. Dados existentes que contenham passwords em plaintext ou hashes de outro formato não são comparados nem convertidos silenciosamente: devem ser recriados ou submetidos a um fluxo explícito de redefinição de password. O hash nunca é aceite na entrada pública, devolvido em respostas ou usado como nome de campo da API.

Estas mudanças devem ser feitas com migrações e compatibilidade explícita, não através de alterações silenciosas aos contratos.

### Estratégia de tokens

O login devolve um access token JWT com validade de 15 minutos e um refresh token opaco com validade de 7 dias. O refresh token inclui apenas um identificador de utilizador e um UUID aleatório para permitir localizar a sessão; o valor completo nunca é persistido. Apenas o seu hash Argon2id e a data `refreshTokenExpires` são guardados em `User`.

`POST /auth/refresh` valida o hash e a expiração, emite novos tokens e substitui atomicamente o hash anterior. Por isso, cada refresh token só pode ser usado uma vez. `POST /auth/logout` valida o token apresentado e limpa `refreshToken` e `refreshTokenExpires`, revogando a sessão. Tokens inválidos, expirados ou já rodados devolvem `401 Unauthorized`.

O modelo actual suporta uma sessão de refresh por utilizador. Suportar várias sessões/dispositivos exigirá uma entidade de sessões/token families numa evolução futura.

## Endpoints actuais

### Root

- `GET /` → `Hello World!` (desenvolvimento).

### Health

- `GET /health` → `{ status: 'ok' }`.

### Auth

- `POST /auth/login` → `{ accessToken, refreshToken, user }`;
- `GET /auth/me` → utilizador autenticado, protegido por JWT;
- `POST /auth/refresh` → roda um refresh token e devolve novo `{ accessToken, refreshToken, user }`;
- `POST /auth/logout` → revoga o refresh token apresentado;
- Rotas privadas usam `Authorization: Bearer <token>`.

`GET /auth/me` devolve `id`, `email`, `name` e `roles: []`. Os roles de OrganizationMembership são usados internamente nas políticas de autorização, mas ainda não são projectados para o contrato de `/auth/me`; a selecção de organização activa ainda não existe. Não devolve `passwordHash`, refresh tokens ou outros segredos.

A autorização de Works e Editions já consulta a fundação de tenancy através de `OrganizationMembership`, com os roles `OWNER`, `ADMIN`, `STAFF` e `READER`.

### Users

- `GET /users`;
- `GET /users/:id`;
- `POST /users`;
- `PUT /users/:id`;
- `DELETE /users/:id`.

`POST /users` recebe `email`, `name` opcional e `password`; o service gera e guarda o hash Argon2id. `passwordHash` não faz parte do contrato HTTP.

### Works

- `GET /works`;
- `GET /works/:id`;
- `POST /works`;
- `PUT /works/:id`;
- `DELETE /works/:id`.

`GET /works` é paginado por cursor e devolve `{ items, nextCursor, hasMore }`. Os clientes devem ler as obras em `items`; não devem tratar a resposta como um array directo.

O payload de criação/actualização pode conter `editions`. A substituição de edições durante update deve continuar a ser transaccional e scoped à organização do utilizador autenticado.

### Catálogo

Todas as rotas de catálogo devem usar JWT e aplicar tenancy no servidor:

- `GET/POST/PUT/DELETE /editions`;
- `GET/POST/PUT/DELETE /contributors`;
- `GET/POST/PUT/DELETE /bibliographic-records`;
- `GET/POST/PUT/DELETE /items`.

Nunca aceitar `userId` do body como autoridade. O utilizador deve vir do contexto autenticado.

### Exportação local

- `GET /exports/marcxchange/edition/:editionId`.

O endpoint:

- exige JWT;
- valida existência e membership;
- usa o mapper UNIMARC local;
- usa o serializer MARCXchange;
- devolve `application/xml; charset=utf-8`;
- força download com `folio-{editionId}.marcxchange.xml`;
- não usa `BibliographicRecord.rawContent`.

O endpoint do registo original ainda não existe. MARCXML da Library of Congress será um serializer e endpoint separados.

## Integração PORBASE

`CataloguesModule` é uma camada de adapters HTTP e não deve persistir resultados durante pesquisas ou previews.

### Fluxo

```text
GET /catalogues/porbase/search?isbn={isbn}
→ POST /catalogues/porbase/import-preview
→ revisão do utilizador
→ POST /catalogues/porbase/import
```

- pesquisa e preview são protegidos por JWT;
- a app Flutter nunca contacta PORBASE directamente;
- preview não cria nem actualiza Work, Edition, Contributor, ExternalIdentifier, BibliographicRecord ou Item;
- confirmação é a única operação que persiste;
- confirmação usa uma transacção Prisma;
- confirmação não volta a contactar PORBASE;
- organization membership e o role `STAFF` devem ser validados;
- ISBNs devem ser normalizados e checksum-validados;
- duplicados de edições dentro da mesma organização devem devolver `409 Conflict`;
- falhas internas devem provocar rollback;
- reuso de contributors continua conservador: correspondência exacta case-insensitive após normalização de espaços;
- não existe ainda authority control completo.

### Proveniência e parsing

O parser deve detectar respostas por Content-Type, conteúdo inicial e estrutura, não apenas pelo nome do endpoint.

O corpo exacto recebido deve permanecer em `BibliographicRecord.rawContent`, sem normalização ou reserialização. Os dados normalizados devem ser usados apenas no preview e no modelo local confirmado.

O subconjunto PORBASE actualmente coberto inclui:

- `001`;
- `003`;
- `010$a`;
- `101$a`;
- `200$a/f/g`;
- `210$a/c/d`;
- `215` completo, com ocorrências e subcampos ordenados;
- `035$a`;
- `675$3`;
- `700/701`;
- `702$4=730`;
- `966$s`.

Warnings devem ser objectos estruturados com `field`, `message`, `original`, `normalized` e `type` quando aplicável. Normalizações nunca devem ocorrer silenciosamente.

Exemplos:

- `210$d`: `D.L. 2009`, `2009.` e `2009?` podem normalizar para `YYYY` com warning;
- `s.d.` deve produzir `null` e `parse_error`;
- `215$a`: `146, [6] p.` deve ser preservado, mesmo que não seja possível derivar um inteiro;
- o raw provider body permanece inalterado.

Os subcampos físicos `215$a`, `$b`, `$c` e `$d` são preservados no modelo local `PhysicalDescription`, por ordem de origem e com `source` quando provenientes da PORBASE. A incapacidade de derivar um número inteiro de páginas produz apenas um warning de derivação; não invalida a descrição textual.

## Proveniência bibliográfica

Existem dois conceitos que não devem ser misturados:

- registo original: payload preservado da fonte;
- modelo local: dados confirmados/corrigidos pelo utilizador.

`BibliographicRecord` deve evoluir para suportar múltiplas fontes e versões, com metadados como:

- source;
- sourceRecordId/remoteId;
- format;
- schema;
- characterEncoding;
- contentHash;
- acquiredAt;
- parserVersion;
- status;
- warnings;
- referência a object storage para ficheiros grandes.

### Consistência de relações bibliográficas

`BibliographicRecord` pode actualmente referenciar simultaneamente um `workId` e um `editionId`. Estes dois caminhos devem representar a mesma organização, mas o schema ainda não impõe essa consistência.

Na leitura individual (`GET /bibliographic-records/:id`), a autorização prioriza `record.edition?.work` e usa `record.work` como fallback. Nas mutações de registo actuais, a verificação ainda prioriza `record.work`.

Não é um problema imediato para os fluxos de criação suportados, que devem manter ambas as relações consistentes, mas deverá ser resolvido quando forem definidas constraints ou validações de consistência no modelo. Opções futuras incluem:

- validar no service que `record.edition.workId === record.workId` quando ambos existirem;
- adicionar uma constraint de base de dados ou trigger que garanta esta igualdade;
- ou simplificar o modelo para usar apenas uma das duas relações (`workId` ou `editionId`), conforme o caso de uso dominante.

Não é necessário implementar tudo já. A prioridade é não sobrescrever rawContent e permitir reprocessamento/auditoria no futuro.

## Formatos bibliográficos

A arquitectura de exportação é:

```text
modelo local canónico
→ mapper de perfil
→ MarcRecord
→ serializer
```

O modelo Prisma não deve ser UNIMARC, MARC21 ou outro formato de intercâmbio.

### Prioridade

1. UNIMARC;
2. MARCXchange/XML;
3. ISO 2709;
4. MARCXML;
5. MARC21 e outros perfis.

MARCXchange/XML e ISO 2709 são serializações distintas de uma estrutura MARC comum. MARCXML não é um alias de MARCXchange.

`MarcRecord` deve evoluir para preservar:

- perfil (`UNIMARC`, `MARC21` ou desconhecido);
- syntax/serialização;
- encoding;
- leader;
- control fields;
- data fields;
- indicators;
- subfields;
- repetição;
- ordem;
- warnings e perda de informação.

Mappers devem poder devolver `record`, `warnings`, `unmappedFields` e `lossy`. Exportações pequenas podem ser síncronas; ficheiros, lotes e conversões devem usar jobs assíncronos com progresso, idempotency key e erros por registo.

## Desempenho e escalabilidade

Não migrar prematuramente para microserviços ou outra base de dados. O monólito modular NestJS + PostgreSQL é suficiente para a próxima fase.

### Paginação de listas

As listas HTTP usam paginação por cursor estável, com os campos `id` e a ordenação temporal ou alfabética da lista. Os parâmetros comuns são `cursor` e `limit`; o limite por página é no máximo **100** e o valor por defeito é **25**. A resposta tem a forma `{ items, nextCursor, hasMore }`.

O cliente deve guardar `nextCursor` e enviá-lo no pedido seguinte até `hasMore` ser `false`. Cursors inválidos e limits fora do intervalo `1..100` são rejeitados com `400 Bad Request`. Listas protegidas continuam sempre filtradas pelas memberships do utilizador autenticado antes da paginação. Pesquisas PORBASE devolvem um resultado bibliográfico individual e não são convertidas artificialmente numa lista paginada.

### Índices, pool e timeouts

Os índices compostos actuais suportam os padrões de tenancy, ordenação e paginação:

- `User(createdAt, id)`;
- `Work(organizationId, createdAt, id)`;
- `Edition(workId, createdAt, id)`;
- `Contributor(createdAt, id)`;
- `WorkContributor(workId, sortOrder, id)` e `WorkContributor(contributorId)`;
- `EditionContributor(editionId, sortOrder, id)` e `EditionContributor(contributorId)`;
- `ExternalIdentifier(editionId, createdAt, id)`;
- `BibliographicRecord(workId, createdAt, id)` e `BibliographicRecord(editionId, createdAt, id)`;
- `Item(organizationId, status, createdAt, id)`.

A migration `20260906151404_add_query_performance_indexes` cria estes índices sem alterar dados. A aplicação configura o `pg.Pool` com `DATABASE_POOL_MAX` (10 por defeito), `DATABASE_CONNECTION_TIMEOUT_MS` (5 segundos), `DATABASE_IDLE_TIMEOUT_MS` (10 segundos) e `DATABASE_QUERY_TIMEOUT_MS` (10 segundos). O servidor HTTP usa `APP_REQUEST_TIMEOUT_MS` (15 segundos), `APP_HEADERS_TIMEOUT_MS` (20 segundos) e `APP_KEEP_ALIVE_TIMEOUT_MS` (5 segundos). Estes valores podem ser substituídos por ambiente; valores inválidos ou não positivos recaem nos defaults seguros.

Prioridades:

- configurar explicitamente o pool `pg` e timeouts;
- usar pool para tráfego da aplicação;
- usar conexão adequada para migrações e ferramentas administrativas;
- adicionar índices antes de optimizações exóticas;
- usar paginação estável/cursor nas listas;
- aplicar limites de tamanho e payload;
- usar `select` explícito nas queries Prisma;
- criar jobs assíncronos para imports/exports em lote;
- medir com logs estruturados, métricas e tracing.

Índices a considerar:

- `Work(organizationId, updatedAt, id)`;
- `Edition(workId, updatedAt, id)`;
- ISBN normalizado;
- `Item(organizationId, editionId)`;
- `Item(organizationId, status)`;
- relações de contributors por entidade e `sortOrder`;
- `BibliographicRecord(source, sourceRecordId)`;
- `Loan(itemId, status)`;
- `Loan(memberId, status)`.

A pesquisa de catálogo deve evoluir de filtros simples para pesquisa textual PostgreSQL, com uma representação pesquisável de título, subtítulo, autores, ISBN, assuntos e identificadores. Um motor de pesquisa externo só deve ser considerado depois de medir a necessidade.

Para PORBASE, usar timeouts curtos, retries limitados e cache por ISBN com TTL quando houver necessidade comprovada. Não adicionar Redis sem uma necessidade medida.

### Perfil UNIMARC actual

A Folio não implementa semanticamente todos os campos do UNIMARC Bibliográfico.

O suporte actual é dividido em:

- parsing estrutural dos campos e subcampos suportados pelo parser;
- perfil PORBASE para os campos actualmente usados;
- mapeamento para o modelo local;
- exportação local de um subconjunto UNIMARC;
- warnings explícitos para campos não mapeados ou perda de informação.

Campos desconhecidos ou ainda não modelados não devem ser descartados silenciosamente quando o fluxo permitir preservar o `MarcRecord` original.

A implementação semântica de novos campos deve ser orientada por:
1. casos de uso;
2. dados PORBASE reais;
3. necessidade de edição local;
4. impacto na exportação;
5. frequência e risco de perda.

## Circulação futura

Não implementar circulação em cima de flags em `Item`.

Criar entidades explícitas:

- `Patron`/`LibraryMember`;
- `Loan`;
- `LoanPolicy`;
- `Hold`/`Reservation`;
- `ReturnEvent`;
- `Fine`/`Fee`.

Um empréstimo deve guardar item, membro, filial, estado, datas previstas/efectivas, actor e timestamps. A operação deve ser transaccional e garantir que um item não tem dois empréstimos activos simultâneos.

## Decisões de design

1. **Prisma 7:** configuração em `prisma.config.ts`, driver adapter e cliente gerado sem edição manual.
2. **PostgreSQL:** base relacional principal para catálogo, permissões, inventário e circulação.
3. **PrismaService:** encapsula `PrismaClient` e o adapter `PrismaPg`.
4. **JWT:** autenticação actual; autorização deve evoluir para memberships e roles.
5. **CORS:** actualmente aberto apenas para origens locais de desenvolvimento; restringir explicitamente em produção.
6. **Swagger:** documentação OpenAPI em `/docs`.
7. **PORBASE:** adapter server-side; nunca chamada directa pelo Flutter.
8. **Proveniência:** rawContent é imutável e separado do modelo local.
9. **MARC:** mapper de perfil e serializer independentes do Prisma.
10. **Monólito modular:** manter até que métricas justifiquem workers ou serviços separados.

## Roadmap

### Fase 0 — segurança e estabilização

- hashing seguro;
- refresh tokens;
- `/auth/me`;
- administração de memberships e políticas de autorização activas;
- paginação e índices;
- pool/timeouts;
- CI/CD e testes de integração;
- auditoria básica.

### Fase 1 — fundação bibliográfica

- descrição física repetível;
- datas com precisão e texto original;
- contributions com roles e identificadores;
- proveniência versionada;
- `MarcRecord` com encoding, syntax e warnings;
- normalizações não destrutivas.

### Fase 2 — catálogo e ficheiros

- importação MARCXchange/ISO 2709;
- preview por registo;
- deduplicação e idempotência;
- jobs de importação/exportação;
- pesquisa paginada.

### Fase 3 — inventário institucional

- organizations, memberships e branches;
- holdings, localização, cotas e códigos de barras;
- inventário e operações em lote.

### Fase 4 — circulação

- patrons;
- loans, returns e reservations;
- políticas, multas e notificações;
- permissões para bibliotecários e leitores.

### Fase 5 — formatos e integrações

- UNIMARC completo;
- ISO 2709;
- MARCXML separado;
- MARC21;
- fontes bibliográficas adicionais.

## Regras para futuras alterações

- Ler este ficheiro e `AGENTS.md` antes de alterar comportamento.
- Não editar o cliente Prisma gerado manualmente.
- Não aceitar `userId` do body como autoridade.
- Não persistir previews automaticamente.
- Não sobrescrever rawContent com dados normalizados.
- Não misturar MARCXchange com MARCXML.
- Não remover campos actuais sem migração e compatibilidade.
- Criar migrations explícitas para alterações de schema.
- Actualizar testes unitários e de integração.
- Actualizar este ficheiro quando mudarem endpoints, schema, contratos ou decisões arquitecturais.
- Nunca fazer commit de `.env`, secrets ou tokens.

## Comandos úteis

```bash
npm install
npx prisma generate
npx prisma migrate dev --name <nome>
npx prisma migrate status
npm run build
npm run lint
npm run test
npm run test:e2e
npm run start:dev
git diff --check
```

## Integração contínua

O workflow `.github/workflows/ci.yml` executa em todos os `push` e `pull_request`. Usa Node.js 24, PostgreSQL 16 como service de teste e uma `DATABASE_URL`/`JWT_SECRET` exclusivos de CI.

Cada execução:

1. instala dependências com `npm ci`;
2. aplica as migrations com `npx prisma migrate deploy`;
3. executa `npm run build`;
4. executa `npm run lint`;
5. executa `npm run test`.

O merge deve exigir que este workflow termine com sucesso. O workflow não usa secrets de produção; a base de dados e o JWT são efémeros e exclusivos da execução. A execução remota do workflow só será possível depois de o ficheiro ser commitado e enviado para o GitHub.

## Como usar este ficheiro

Antes de cada iteração:

1. ler este `CONTEXT.md` e `AGENTS.md`;
2. confirmar o estado real no código, schema e migrations;
3. distinguir decisões implementadas de decisões futuras;
4. alterar apenas o escopo solicitado;
5. executar os testes relevantes e actualizar a documentação quando contratos ou arquitectura mudarem.