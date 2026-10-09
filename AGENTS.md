# Folio API — Agent Guidance

## Âmbito e fontes normativas

Este guia aplica-se exclusivamente a `folio-api`, um backend NestJS 12,
TypeScript ESM, Prisma 7 e PostgreSQL, com testes Vitest.

Antes de alterar comportamento, ler:

- `CONTEXT.md`, fonte operacional do estado actual;
- `folio_architecture.md`, direcção e riscos arquitecturais;
- `prisma/schema.prisma` e migrations relevantes;
- decisões em `docs/decisions/`;
- DTOs, controllers, services e testes da capacidade afectada.

Quando documentação histórica contradiz código, schema, testes ou uma decisão
aprovada mais recente, não preservar o comportamento antigo por compatibilidade.
Actualizar a documentação activa quando o contrato mudar.

## Greenfield e compatibilidade

O produto está numa fase greenfield controlada. Código, fixtures e contratos
internos provisórios não justificam aliases, payloads duplos, rotas legacy,
fallbacks tenant ou migrations de compatibilidade.

Não reintroduzir `Contributor`, `WorkContributor` ou `EditionContributor`.
Participações usam exclusivamente `Agent + Contribution`.

Não assumir que uma migration versionada foi aplicada a qualquer base. Alterar
schema exige uma migration revista; nunca executar reset ou migration sem
autorização explícita e confirmação do ambiente.

## Organização, tenancy e autorização

`Organization` é a única fronteira de tenancy. O JWT identifica o utilizador,
não uma Organization activa.

- Operações root ou ambíguas exigem `X-Folio-Organization-Id` explícito.
- Criações filhas derivam Organization do parent persistido.
- Operações sobre recursos existentes derivam Organization do recurso.
- Um header numa operação derivada é apenas uma verificação de consistência.
- `organizationId` no body, query ou JWT nunca é autoridade de tenant.
- Não seleccionar silenciosamente a primeira membership, a mais antiga ou uma
  Organization `OWNER`; não agregar implicitamente todas as memberships.
- Membership, role e autorização de domínio são sempre validadas no backend.

As cadeias canónicas são:

```text
Catalogue: Work → Edition
Physical inventory: Library → Location → Holding → Item
Participation: Agent + Contribution
```

Holding liga Edition e Location da mesma Organization. Item pertence apenas a
Holding. Contribution aponta para exactamente um Work ou Edition, e Agent e
alvo têm de pertencer à mesma Organization.

## Contratos HTTP e validação

- Manter controllers finos e regras em services/use cases testáveis.
- Usar DTOs de classe e `class-validator`; validar estruturas nested com
  `@ValidateNested` e `@Type`.
- Preservar o envelope estável
  `{ statusCode, error, code, message, details? }`.
- Não usar mensagens humanas como contrato nem inferir códigos pelo texto.
- Não devolver mensagens, stacks, Prisma metadata, SQL, paths ou segredos em
  respostas de produção.
- Usar `NestJS Logger`; nunca registar passwords, tokens, cookies,
  authorization headers, secrets ou `DATABASE_URL`.
- Não aceitar proveniência enviada pelo cliente como autenticada. Na confirmação
  PORBASE, campos editáveis não são prova de correspondência com `rawContent`.

External Identifiers usam binding imutável `entityType` + `entityId`; o backend
actual permite alterar `authority` e `value`. A Organization deriva do alvo na
criação e do identifier persistido nas operações por ID.

## Prisma e migrations

- Reutilizar `PrismaService` e transacções existentes.
- Preservar constraints SQL, cascades e invariantes cross-model.
- Rever efeitos `Cascade`, `Restrict`, `SetNull` e cleanup polimórfico antes de
  alterar deletes.
- Não editar migrations aplicadas como atalho; criar uma migration própria
  quando uma alteração de schema for aprovada.
- Nunca executar `migrate`, `db push`, seed ou consultas a bases sem autorização
  explícita para essa tarefa.

## Testes e validação

Testes unitários ficam junto dos módulos em `src/**/*.spec.ts`; testes HTTP/e2e
ficam em `test/**/*.e2e-spec.ts`. Usar mocks/fakes quando o comportamento não
exige PostgreSQL. Constraints e migrations só ficam provadas por testes contra
uma base isolada apropriada.

Para alterações de código, executar o menor conjunto relevante e, quando o
âmbito permitir:

```bash
npx prisma validate --schema prisma/schema.prisma
npx tsc -p tsconfig.build.json --noEmit --pretty false --incremental false
npm test -- --run --no-file-parallelism <paths>
npm run build
npm run lint
git diff --check
```

Não executar `test:e2e` se depender de uma base ou serviço não aprovado para a
tarefa. Alterações exclusivamente documentais não exigem npm, Prisma ou testes;
usar `git diff --check`.

## Antes de concluir

- Confirmar que nenhum campo tenant concorrente foi introduzido.
- Confirmar que root e derived routes mantêm a fonte de contexto correcta.
- Distinguir implementação local, integração validada, smoke pendente,
  hardening futuro e decisão de produto.
- Não declarar migrations aplicadas, fases concluídas ou ausência de dívida sem
  evidência correspondente.
- Actualizar `CONTEXT.md` quando mudarem endpoints, modelo, configuração,
  limitações ou estado de validação.
