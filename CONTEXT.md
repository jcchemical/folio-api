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
      editions.service.ts
    contributors/
      contributors.service.ts
    external-identifiers/
      external_identifiers.service.ts
    bibliographic-records/
      bibliographic_records.service.ts
    items/
      items.service.ts
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

### Planned catalogue endpoints

The data services are implemented first so the catalogue layer can be tested independently. Controllers can expose these endpoints next:

- `GET/POST/PUT/DELETE /editions` — editions scoped through the authenticated user's works.
- `GET/POST/PUT/DELETE /contributors` — contributor registry and work/edition links.
- `GET/POST/PUT/DELETE /external-identifiers` — ISBN and external catalogue identifiers.
- `GET/POST/PUT/DELETE /bibliographic-records` — raw records linked to works and/or editions.
- `GET/POST/PUT/DELETE /items` — user-owned copies, optionally associated with an institution.

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
