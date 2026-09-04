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
  description String?
  year        Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId       String
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  institutionId String?
  institution   Institution? @relation(fields: [institutionId], references: [id], onDelete: SetNull)
}
```

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
    "description": "Descriçªº da obra",
    "year": 2025,
    "institutionId": "id-opcional"
  }
  ```
- `PUT /works/:id`
- `DELETE /works/:id`

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

## Comandos Úteis

```bash
# Instalar dependencias
npm install

# Gerar cliente Prisma
npx prisma generate

# Criar e aplicar migration
npx prisma migrate dev --name <nome>

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
