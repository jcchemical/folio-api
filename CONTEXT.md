# Contexto do Projeto Folio API

> Atualizado em: 2026-09-04

## Vis Geral

API NestJS para gestão de biblioteca (Folio), com:

- Users
- Auth (JWT)
- Institutions
- Works
- Health check

Stack moderna com Prisma 7, PostgreSQL, Swagger UI e CORS configurado para dev.

## Stack

- **Runtime:** Node.js (ESM)
- **Framework:** NestJS
- **Linguagem:** TypeScript (ESM, `moduleResolution: "bundler"`)
- **ORM:** Prisma 7
  - Driver adapter: `@prisma/adapter-pg` + `pg`
  - Config em `prisma.config.ts`
  - Schema em `prisma/schema.prisma` (sem `url` no datasource)
- **Base de dados:** PostgreSQL
- **Documentacao:** Swagger UI em `/docs`
- **CORS:** Aberto para localhost (portas 3000, 8080, etc.)

## Estrutura do Projeto

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
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      jwt.strategy.ts
      jwt-auth.guard.ts
    prisma/
      prisma.service.ts
      prisma.module.ts
    health/
      health.module.ts
      health.controller.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
    institutions/
      institutions.module.ts
      institutions.controller.ts
      institutions.service.ts
    works/
      works.module.ts
      works.controller.ts
      works.service.ts
    editions/
      editions.controller.ts
      editions.service.ts
    contributors/
      contributors.controller.ts
      contributors.service.ts
    external-identifiers/
      external_identifiers.service.ts
    bibliographic-records/
      bibliographic_records.controller.ts
      bibliographic_records.service.ts
    items/
      items.controller.ts
      items.service.ts
    catalogues/
      catalogues.module.ts
      catalogues.controller.ts
      catalogues.service.ts
      isbn.utils.ts
      porbase.parser.ts
      adapters/
        porbase.adapter.ts
      dto/
        porbase-search-query.dto.ts
        porbase-search-response.dto.ts
        import-preview-query.dto.ts
        import-preview-response.dto.ts
      import-preview.service.ts
      import-preview.controller.ts
  package.json
  tsconfig.json
  .env
```

## Models Prisma

### User

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  institutions Institution[]
  works        Work[]
}
```

### Institution

```prisma
model Institution {
  id          String   @id @default(cuid())
  name        String
  address     String?
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  works Work[]
}
```

### Work

```prisma
model Work {
  id          String   @id @default(cuid())
  title       String
  subtitle    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId       String
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  institutionId String?
  institution   Institution? @relation(fields: [institutionId], references: [id], onDelete: SetNull)

  editions Edition[]
}
```

### Bibliographic catalogue

- `Edition` belongs to a `Work` and stores ISBN, publisher, publication date, language, format and page count.
- `Contributor` is shared by works and editions through `WorkContributor` and `EditionContributor`, with a role and sort order.
- `ExternalIdentifier` belongs to an edition and enforces uniqueness for `(type, value)`.
- `BibliographicRecord` stores raw MARC or other source records and can point to a work, an edition, or both.
- `Item` represents a user's copy of an edition. It always has `userId` and `editionId`, and may have an `institutionId` for storage or management.

## Endpoints

### Health

- `GET /health` → `{ status: 'ok' }`

### Users

- `GET /users`
- `GET /users/:id`
- `POST /users`
  ```json
  {
    "email": "user@fol.io",
    "name": "Nome Opcional",
    "passwordHash": "hash-da-password"
  }
  ```
- `PUT /users/:id`
- `DELETE /users/:id`

### Auth

- `POST /auth/login` → emite `{ accessToken, user }` para um utilizador válido.
  ```json
  {
    "email": "user@fol.io",
    "passwordHash": "hash-da-password"
  }
  ```
- Os endpoints de `institutions` e `works` exigem `Authorization: Bearer <token>`.
- O `userId` desses endpoints vem do claim `sub` do JWT autenticado.

### Institutions

- `GET /institutions`
- `GET /institutions/:id`
- `POST /institutions`
  ```json
  {
    "name": "Instituiçªº Exemplo",
    "address": "Rua Exemplo, 123",
    "description": "Descriçªº de teste"
  }
  ```
- `PUT /institutions/:id`
- `DELETE /institutions/:id`

### Works

- `GET /works`
- `GET /works/:id`
- `POST /works`
  ```json
  {
    "title": "Obra Exemplo",
    "subtitle": "Subtítulo opcional",
    "institutionId": "id-opcional"
  }
  ```
- `PUT /works/:id`
- `DELETE /works/:id`

The work create/update payload also accepts an optional `editions` array. The `WorksService` persists edition changes with the work; sending `editions` during update replaces that work's current editions.

### Catalogue endpoints

All catalogue endpoints require `Authorization: Bearer <token>` and scope data to the authenticated user:

- `GET/POST/PUT/DELETE /editions` — editions scoped through the authenticated user's works. Creation requires `workId`.
- `GET/POST/PUT/DELETE /contributors` — contributors linked to the user's works or editions. Creation requires `workId` or `editionId`.
- `GET/POST/PUT/DELETE /bibliographic-records` — raw records linked to the user's works and/or editions.
- `GET/POST/PUT/DELETE /items` — user-owned copies, optionally associated with the user's institution.

External identifier CRUD remains available through `ExternalIdentifiersService`; its controller is not exposed yet.

### PORBASE catalogue integration

- `GET /catalogues/porbase/search?isbn=9789724426495` searches the PORBASE URN MARCXchange endpoint through the API.
- `POST /catalogues/porbase/import-preview` builds a Work/Edition/contributor/identifier suggestion from an ISBN without persisting anything.
- Request:
  ```json
  { "isbn": "9789724426495" }
  ```
- Response shape:
  ```json
  {
    "work": { "title": "Vida e andanças de Alexis Zorbás" },
    "edition": {
      "title": "Vida e andanças de Alexis Zorbás",
      "isbn13": "9789724426495",
      "publisher": "Edições 70",
      "publishDate": "2022",
      "language": "por",
      "placeOfPublication": "Coimbra",
      "pages": 383
    },
    "contributors": [
      { "name": "Kazantzákis, Níkos", "role": "author" },
      { "name": "Leite, Carlos", "role": "translator" }
    ],
    "externalIdentifiers": [
      { "type": "ISBN-13", "value": "9789724426495", "source": "PORBASE" },
      { "type": "PORBASE", "value": "3664836", "source": "PORBASE" }
    ],
    "bibliographicRecord": {
      "format": "MARCXCHANGE",
      "schema": "UNIMARC",
      "source": "PORBASE",
      "remoteId": "3664836",
      "rawContent": "..."
    },
    "warnings": []
  }
  ```
- The preview is a stable proposal for a future confirmation/import endpoint. It never creates or updates Prisma records.
- `POST /catalogues/porbase/import` confirms a corrected preview and persists Work, Edition, contributors, external identifiers, the bibliographic record, and an Item atomically from the authenticated user's `request.user.id`.
- Confirmation never calls PORBASE again. It stores the body submitted by the user and returns HTTP 409 when an ISBN-13, or otherwise ISBN-10, already exists on an Edition belonging to that user. Imports without ISBN are allowed.
- The confirmation transaction validates institution ownership, reuses contributors only on exact case-insensitive name matches after whitespace normalization, and rolls back all records if any internal creation fails. Contributor matching is not yet a true authority-control system.
- The endpoint requires a JWT Bearer token and does not persist the result automatically.
- ISBN-10 and ISBN-13 values are normalized by removing spaces and hyphens and are checksum-validated before any upstream request.
- The normalized response includes `source`, `query`, `found`, `detectedFormat`, `format`, `schema`, `metadata`, `warnings`, and the unmodified `rawContent`.
- The observed live response for ISBN `9789724426495` was `HTTP 200` with `Content-Type: text/xml;charset=utf-8` and MARCXchange XML in one line. The adapter does not rely on the endpoint name and also supports line-oriented MARC text.
- PORBASE URL and timeout are configured with `PORBASE_URN_BASE_URL` and `PORBASE_URN_TIMEOUT_MS`.
- XML extraction supports `001`, `003`, `010$a`, `101$a`, `200$a/f/g`, `210$a/c/d`, `215$a`, `035$a`, `675$3`, `700/701`, `702$4=730`, and `966$s`. The text parser uses the same tags when visible and emits warnings when responsibility statements are ambiguous.
- `detectedFormat` is one of `MARCXCHANGE_XML`, `MARC_TEXT`, `UNKNOWN`, or `ERROR`. HTTP 404, empty responses, and provider error messages return `found: false`; timeout returns 503; upstream 5xx and malformed XML return 502.

Swagger UI: http://localhost:3000/docs

## Decisoes de Design

1. **Prisma 7**
   - `url` removida do `datasource` em `schema.prisma`.
   - Config de conexao em `prisma.config.ts`.
   - Cliente usa driver adapter (`PrismaPg` + `Pool`).

2. **PrismaService**
   - Estende `PrismaClient`.
   - Recebe adapter no construtor:
     ```ts
     const pool = new Pool({ connectionString: process.env.DATABASE_URL });
     const adapter = new PrismaPg(pool);
     super({ adapter });
     ```

3. **Autenticação JWT**

- `AuthService` valida o utilizador por `email` e `passwordHash` e assina tokens com `JWT_SECRET`.
- `JwtStrategy` valida o token Bearer e confirma que o utilizador ainda existe.
- `JwtAuthGuard` protege os controllers de `institutions` e `works`.
- O segredo deve ser definido em `.env`; consultar `.env.example` para o formato.

4. **CORS**
   - Aberto para:
     - `http://localhost`
     - `http://localhost:3000`
     - `http://localhost:8080`
     - `http://127.0.0.1`
     - `http://127.0.0.1:8080`
   - Métodos: GET, POST, PUT, PATCH, DELETE, OPTIONS.

5. **Swagger**
   - `@nestjs/swagger` v8+.
   - Documento criado com:
     ```ts
     SwaggerModule.createDocument(app, {
       info: { title, description, version },
       openapi: '3.1.0',
     });
     ```
   - UI em `/docs`.

6. **Catálogo bibliográfico**

- A `Work` is the intellectual work; an `Edition` is its publication-specific manifestation.
- `WorksService` owns the work-to-edition write flow and includes editions in work reads.
- User-owned resources are scoped through the authenticated user's `userId`.
- `Item` deliberately contains both `userId` and optional `institutionId`: ownership belongs to the user, while the institution represents where the copy is held or managed.
- Migration `20260904213703_add_bibliographic_catalog` adds the catalogue tables and removes the legacy `Work.description` and `Work.year` fields. The database was disposable when it was applied.

7. **Integração externa PORBASE** - `CataloguesModule` is an HTTP-only adapter layer and does not access Prisma or save bibliographic data during a search. - The Flutter client must call the Folio API; it must not call PORBASE directly. - The exact upstream body is preserved in `rawContent`; no automatic persistence or transformation replaces it. - No Z39.50, Open Library, or OAI-PMH integration is included in this iteration.

## Comandos Úteis

```bash
# Instalar dependencias
npm install

# Gerar cliente Prisma
npx prisma generate

# Criar e aplicar migration
npx prisma migrate dev --name <nome>

# Ver estado das migrations
npx prisma migrate status

# Executar a suite de testes
npm run test

# Resetar base de dados (dev)
npx prisma migrate reset

# Iniciar em modo dev
npm run start:dev
```

## Pr oximos Passos (Sugestoes)

- [ ] Adicionar hashing de passwords (por exemplo, Argon2 ou bcrypt) em vez de comparar `passwordHash` diretamente.
- [ ] Adicionar refresh tokens e rotação de tokens.
- [ ] Criar `prisma/seed.ts` para dados de teste.
- [ ] Refinar DTOs (class-validator, class-transformer).
- [ ] Adicionar filtros, paginaçªº e ordenaçªº em listas.
- [ ] Estruturar testes (unit arios e integraçªº).
- [ ] Configurar CI/CD básico (lint, test, build).

## Como Usar Este Ficheiro

Sempre que continuares o desenvolvimento com IA:

1. Atualiza este ficheiro quando houver:
   - Novos módulos/endpoints.
   - Mudançªºs importantes de arquitetura.
   - Novas decisoes de design.

2. Para dar contexto a uma nova sessa˜o:
   - Copia este ficheiro (ou partes) para o chat.
   - Ou faz upload dele como anexo.

3. Podes complementar com:
   - `tree -L 2` da estrutura atual.
   - Trechos de código relevantes (controllers, services, schema).

---

Se quiseres, pede à IA para:

- “Ler este CONTEXT.md e sugerir os próximos passos de arquitetura.”
- “Gerar um seed com base nos models descritos aqui.”
- “Revisar a estrutura de módulos e sugerir melhorias.”
