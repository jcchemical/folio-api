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
    institutions/
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

## Modelo actual

### User e Institution

O modelo actual contém `User` e `Institution`, com relações de propriedade entre utilizador, instituições e obras. Este modelo é suficiente para o início pessoal, mas ainda não representa memberships, roles ou acesso de vários utilizadores à mesma instituição.

### Work, Edition e Item

- `Work` representa a obra intelectual;
- `Edition` representa a publicação/manifestação específica;
- `Item` representa uma cópia ou exemplar gerível;
- `Contributor` é associado a works e editions através de relações com role e sort order;
- `ExternalIdentifier` guarda ISBN, PORBASE e outros identificadores;
- `BibliographicRecord` guarda a proveniência original recebida de fontes externas.

O modelo actual usa `cuid()` para IDs. Controllers não devem assumir UUID sem validar o padrão real usado pelo schema.

### Limitação de descrição física

`Edition.pages: Int?` não é uma representação bibliográfica suficiente. A descrição física UNIMARC `215$a` pode conter texto como:

```text
146, [6] p.
```

Pode também repetir e coexistir com outros subcampos de `215`, como dimensões e ilustrações.

Decisão:

- o texto bibliográfico completo é a fonte de verdade;
- o número de páginas, quando existir, é um valor derivado opcional;
- uma descrição não deve ser rejeitada por não ser um inteiro;
- o parser deve preservar o original e emitir warning quando a extracção numérica for parcial ou impossível;
- a evolução preferida é uma estrutura repetível para os subcampos `215$a`, `$b`, `$c` e `$d`, sem concatenar informação de forma irreversível.

Não remover `pages` sem uma migração de compatibilidade e sem rever todos os DTOs, parser, mapper e cliente Flutter.

## Ownership e evolução institucional

O ownership actual baseia-se principalmente em `userId`, com `institutionId` opcional. Isso funciona para bibliotecas pessoais, mas não para uma biblioteca municipal.

A evolução prevista é:

```text
User
Organization
OrganizationMembership
Library / Branch
Work
Edition
Item / Holding
Patron / Member
Loan
Reservation
Fine / Fee
AuditEvent
```

Antes de implementar circulação institucional, introduzir:

- organização/tenant explícita;
- memberships;
- roles e permissões;
- filiais/bibliotecas;
- fronteiras de autorização por organização e filial.

Não criar empréstimos apenas adicionando flags a `Item`. `Loan` deve ser uma entidade explícita, transaccional e capaz de impedir dois empréstimos activos para o mesmo item.

## Autenticação e segurança

### Estado actual

- `POST /auth/login` emite JWT;
- `JwtStrategy` valida Bearer tokens e confirma que o utilizador existe;
- rotas protegidas usam o claim `sub` como identidade;
- o contrato de entrada de password ainda é temporário e usa o nome histórico `passwordHash`;
- `UsersService` gera hashes Argon2id antes de persistir utilizadores;
- `AuthService` verifica passwords com `argon2.verify`, nunca por comparação directa;
- respostas públicas de utilizadores não incluem `passwordHash`.
- access tokens JWT têm validade de 15 minutos;
- refresh tokens são hashes Argon2id guardados no utilizador, com validade de 7 dias, rotação e revogação.

### Dívida técnica prioritária

Antes de produção ou utilização institucional:

1. alterar o contrato público para `password`, mantendo “Palavra-passe” na UI;
2. adicionar RBAC/memberships;
3. adicionar rate limiting e auditoria;
4. nunca expor hashes, tokens ou credenciais em respostas e logs.

O hashing actual usa Argon2id através da biblioteca `argon2`, com `memoryCost: 65536` KiB, `timeCost: 3` e `parallelism: 1`. O salt é aleatório e gerado pela biblioteca para cada password; os parâmetros e o salt ficam codificados no hash Argon2id armazenado no campo `User.passwordHash`.

O schema mantém `User.passwordHash String`, sem migration. Dados existentes que contenham passwords em plaintext ou hashes de outro formato não são comparados nem convertidos silenciosamente: devem ser recriados ou submetidos a um fluxo explícito de redefinição de password. O nome histórico `passwordHash` continua aceite temporariamente na entrada para preservar compatibilidade com o frontend actual, mas o valor recebido é tratado como password e nunca como hash fornecido pelo cliente.

Estas mudanças devem ser feitas com migrações e compatibilidade explícita, não através de alterações silenciosas aos contratos.

### Estratégia de tokens

O login devolve um access token JWT com validade de 15 minutos e um refresh token opaco com validade de 7 dias. O refresh token inclui apenas um identificador de utilizador e um UUID aleatório para permitir localizar a sessão; o valor completo nunca é persistido. Apenas o seu hash Argon2id e a data `refreshTokenExpires` são guardados em `User`.

`POST /auth/refresh` valida o hash e a expiração, emite novos tokens e substitui atomicamente o hash anterior. Por isso, cada refresh token só pode ser usado uma vez. `POST /auth/logout` valida o token apresentado e limpa `refreshToken` e `refreshTokenExpires`, revogando a sessão. Tokens inválidos, expirados ou já rodados devolvem `401 Unauthorized`.

O modelo actual suporta uma sessão de refresh por utilizador. Suportar várias sessões/dispositivos exigirá uma entidade de sessões/token families numa evolução futura.

## Endpoints actuais

### Health

- `GET /health` → `{ status: 'ok' }`.

### Auth

- `POST /auth/login` → `{ accessToken, user }`.
- `GET /auth/me` → utilizador autenticado, protegido por JWT.
- `POST /auth/refresh` → roda um refresh token e devolve novo `{ accessToken, refreshToken, user }`.
- `POST /auth/logout` → revoga o refresh token apresentado.
- Rotas privadas usam `Authorization: Bearer <token>`.

`GET /auth/me` devolve apenas `id`, `email`, `name` e `roles`, sem `passwordHash`. Como o schema actual ainda não tem roles nem memberships, `roles` é devolvido como uma lista vazia (`[]`). O Flutter deve usar este endpoint depois de restaurar um token para validar a sessão e actualizar o utilizador actual; um token ausente, inválido ou expirado resulta em `401 Unauthorized`.

### Users

- `GET /users`;
- `GET /users/:id`;
- `POST /users`;
- `PUT /users/:id`;
- `DELETE /users/:id`.

O contrato de criação e actualização deve deixar de aceitar passwords em formato de hash fornecido pelo cliente quando a migração de segurança for feita.

### Institutions

- `GET/POST/PUT/DELETE /institutions`;
- dados actualmente associados ao utilizador proprietário.

### Works

- `GET /works`;
- `GET /works/:id`;
- `POST /works`;
- `PUT /works/:id`;
- `DELETE /works/:id`.

O payload de criação/actualização pode conter `editions`. A substituição de edições durante update deve continuar a ser transaccional e scoped ao utilizador autenticado até existir uma fronteira explícita de organização.

### Catálogo

Todas as rotas de catálogo devem usar JWT e aplicar ownership no servidor:

- `GET/POST/PUT/DELETE /editions`;
- `GET/POST/PUT/DELETE /contributors`;
- `GET/POST/PUT/DELETE /bibliographic-records`;
- `GET/POST/PUT/DELETE /items`.

Nunca aceitar `userId` do body como autoridade. O utilizador deve vir do contexto autenticado.

### Exportação local

- `GET /exports/marcxchange/edition/:editionId`.

O endpoint:

- exige JWT;
- valida existência e ownership;
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
- institution ownership deve ser validado;
- ISBNs devem ser normalizados e checksum-validados;
- duplicados de edições do mesmo utilizador devem devolver `409 Conflict`;
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
- `215$a`;
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

- `Work(userId, updatedAt, id)`;
- `Edition(workId, updatedAt, id)`;
- ISBN normalizado;
- `Item(userId, editionId)`;
- `Item(institutionId, status)`;
- relações de contributors por entidade e `sortOrder`;
- `BibliographicRecord(source, sourceRecordId)`;
- `Loan(itemId, status)`;
- `Loan(memberId, status)`.

A pesquisa de catálogo deve evoluir de filtros simples para pesquisa textual PostgreSQL, com uma representação pesquisável de título, subtítulo, autores, ISBN, assuntos e identificadores. Um motor de pesquisa externo só deve ser considerado depois de medir a necessidade.

Para PORBASE, usar timeouts curtos, retries limitados e cache por ISBN com TTL quando houver necessidade comprovada. Não adicionar Redis sem uma necessidade medida.

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
- RBAC/memberships iniciais;
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

## Como usar este ficheiro

Antes de cada iteração:

1. ler este `CONTEXT.md` e `AGENTS.md`;
2. confirmar o estado real no código, schema e migrations;
3. distinguir decisões implementadas de decisões futuras;
4. alterar apenas o escopo solicitado;
5. executar os testes relevantes e actualizar a documentação quando contratos ou arquitectura mudarem.