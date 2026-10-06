# Decision: Organizational Context

**Status:** Proposed for implementation  
**Date:** 2026-10-06  
**Scope:** `folio-api`, `folio-app`, Prisma schema, HTTP contracts and documentation

## 1. Contexto

O Folio encontra-se numa fase inicial de definição e construção. A base de dados de desenvolvimento não contém dados relevantes, não existem utilizadores externos e não existem contratos empresariais que tenham de ser preservados.[1]

Por essa razão, esta decisão não procura introduzir contexto organizacional de forma compatível com uma arquitectura anterior. Define directamente o modelo que deve ser considerado correcto daqui para a frente.[1]

Se a implementação actual divergir desta decisão, podem ser alterados ou removidos livremente:

- schema;
- migrations;
- endpoints;
- DTOs;
- services;
- providers;
- código Flutter;
- testes;
- documentação;
- dados da base de desenvolvimento.[1]

Não deve ser mantida uma solução inferior apenas porque já foi implementada.[1]

## 2. Problema

O Folio suporta bibliotecas pessoais e institucionais, e o mesmo utilizador pode pertencer a várias organizações e trabalhar numa delas de cada vez.[2]

A aplicação precisa de distinguir claramente:

- a identidade autenticada;
- as organizações a que o utilizador pertence;
- a organização no contexto da operação actual;
- a organização proprietária dos recursos persistidos;
- as permissões do utilizador nessa organização.

O sistema não deve escolher silenciosamente uma organização nem permitir que o contexto seja inferido de forma ambígua.[3][2]

## 3. Decisão

### 3.1 Organization é a fronteira de tenancy

Todos os recursos organizacionais pertencem exactamente a uma `Organization`.[3][2]

A relação conceptual é:

```text
User
└── OrganizationMembership
    └── Organization
        └── Work
            └── Edition
                └── Item
```

As entidades organizacionais não devem manter ownership paralelo por utilizador, instituição ou sessão.[3][2]

Não devem existir, para o mesmo recurso:

- `organizationId` e `userId` como proprietários alternativos;
- `institutionId` paralelo;
- regras diferentes de tenancy conforme o endpoint;
- fallback para uma organização pessoal;
- fallback para a primeira organização encontrada.[3][2]

### 3.2 Identidade e contexto são conceitos diferentes

O token representa a identidade autenticada do utilizador e as claims globais necessárias.[2]

A organização activa não faz parte do JWT.[2]

A organização activa é contexto da operação e pode mudar sem alterar a identidade ou renovar tokens.[2]

A autorização é sempre calculada com base na membership actual, não numa claim antiga sobre a organização.[2]

### 3.3 Contexto explícito para operações ambíguas

As operações cujo tenant não pode ser derivado inequivocamente de um recurso devem receber a organização explicitamente.

O contrato escolhido é:

```http
X-Folio-Organization-Id: <organization-id>
```

O header é obrigatório para:

- listagens de recursos organizacionais;
- criação de recursos organizacionais;
- pesquisa local do catálogo;
- importação que persiste dados locais;
- operações administrativas sobre uma organização;
- qualquer operação cujo alvo não contenha já um identificador de organização.

O header não é uma autorização. É apenas a indicação do contexto pretendido.

O servidor deve:

1. validar o formato do identificador;
2. confirmar que a organização existe;
3. confirmar a membership do utilizador;
4. resolver a role;
5. aplicar as regras de autorização;
6. executar a operação dentro desse contexto.

### 3.4 Recursos existentes derivam o contexto

Quando o pedido contém um recurso cujo tenant é inequívoco, a organização é derivada do recurso.

Exemplos:

```http
GET /works/:workId
PATCH /editions/:editionId
DELETE /items/:itemId
GET /editions/:editionId/cover
```

Nesses casos, a API deve:

1. carregar o recurso;
2. resolver o `organizationId` persistido;
3. validar a membership nessa organização;
4. aplicar a autorização;
5. executar a operação.

Não é necessário repetir o `organizationId` na query, no body ou no path.

Se uma rota receber também `X-Folio-Organization-Id`, o servidor deve validar que coincide com a organização do recurso. Um conflito deve falhar explicitamente, nunca ser ignorado.

### 3.5 Operações globais ou externas

As operações que não leem nem criam dados organizacionais não precisam de contexto de organização.

Exemplos:

```http
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /auth/me
GET /organizations
POST /catalogues/search
GET /health
```

A pesquisa externa de catálogo não pertence a uma organização porque apenas consulta um provider externo.

A importação confirmada pertence a uma organização porque cria dados locais e exige `X-Folio-Organization-Id`.

## 4. Contratos de API

### 4.1 Matriz normativa

| Operação | Contexto |
|---|---|
| `GET /organizations` | Utilizador autenticado |
| `POST /organizations` | Utilizador autenticado; cria a organização e membership inicial |
| `GET /works` | `X-Folio-Organization-Id` obrigatório |
| `POST /works` | `X-Folio-Organization-Id` obrigatório |
| `GET /works/:id` | Derivado do recurso |
| `PATCH /works/:id` | Derivado do recurso |
| `DELETE /works/:id` | Derivado do recurso |
| `GET /editions` | `X-Folio-Organization-Id` obrigatório |
| `GET /editions/:id` | Derivado do recurso |
| `PATCH /editions/:id` | Derivado do recurso |
| `DELETE /editions/:id` | Derivado do recurso |
| `GET /items` | `X-Folio-Organization-Id` obrigatório |
| `POST /items` | `X-Folio-Organization-Id` obrigatório |
| `DELETE /items/:id` | Derivado do recurso |
| `POST /catalogues/search` | Sem organização |
| `POST /catalogues/import` | `X-Folio-Organization-Id` obrigatório |
| `GET /editions/:id/cover` | Derivado da Edition |
| endpoints de memberships | Organização explícita ou derivada conforme o recurso |

Esta tabela deve ser completada com todas as rotas reais antes da implementação.

### 4.2 Body e query

O contexto de tenancy não deve ser representado por `organizationId` redundante no body quando o pedido já usa o header ou um recurso identificável.

Não criar dois valores concorrentes para a mesma decisão.

Se uma operação requer contexto mas não recebe o header, falha.
Se recebe um ID inválido, falha.
Se o utilizador não tem membership, falha.
Se o header contradiz o recurso, falha.

## 5. Comportamento do cliente

O `folio-app` deve:

1. carregar as organizações do utilizador depois de restaurar a sessão;
2. seleccionar automaticamente a única organização, quando existir apenas uma;
3. pedir selecção explícita quando existirem várias;
4. manter a organização seleccionada apenas como preferência de UX;
5. enviar `X-Folio-Organization-Id` nas operações que exigem contexto;
6. não enviar contexto em operações globais;
7. invalidar todo o estado dependente da organização ao trocar;
8. cancelar ou ignorar respostas tardias do contexto anterior;
9. limpar caches scoped, incluindo capas;
10. reagir a membership perdida ou organização removida.

A preferência local nunca é autoridade. O servidor valida sempre o contexto.

## 6. Autorização

A autorização deve seguir esta ordem:

```text
Request
→ autenticação
→ resolução do recurso ou contexto
→ validação da membership
→ verificação da role
→ regra de domínio
→ operação
```

Não deve existir autorização baseada apenas em:

- `userId` enviado pelo cliente;
- `organizationId` enviado pelo cliente;
- role enviada pelo cliente;
- organização guardada no JWT;
- fallback escolhido pelo servidor.

## 7. Erros

Definir códigos estáveis e únicos para estes casos:

- contexto obrigatório ausente;
- identificador de organização inválido;
- organização inexistente;
- membership inexistente;
- role insuficiente;
- conflito entre contexto explícito e recurso;
- recurso inexistente.

Os nomes concretos devem ser escolhidos uma vez e usados de forma consistente pela API e pelo Flutter.

Exemplo:

```text
ORGANIZATION_CONTEXT_REQUIRED
ORGANIZATION_ID_INVALID
ORGANIZATION_NOT_FOUND
ORGANIZATION_MEMBERSHIP_REQUIRED
ORGANIZATION_ROLE_INSUFFICIENT
ORGANIZATION_CONTEXT_CONFLICT
RESOURCE_NOT_FOUND
```

Os status HTTP devem ser definidos de forma coerente no contrato, não herdados automaticamente das implementações actuais.

## 8. Alterações permitidas

Para concretizar esta decisão, é permitido:

- remover fallbacks actuais;
- alterar ou remover `organizationId` de DTOs;
- alterar rotas;
- alterar providers e interceptors;
- recriar migrations;
- apagar a base de desenvolvimento;
- reescrever services;
- alterar testes;
- actualizar documentação;
- fazer breaking changes entre API e Flutter.[1]

Não criar uma camada de compatibilidade apenas para preservar o desenho actual.[1]

## 9. Invariantes

A implementação deve garantir:

1. Um recurso organizacional pertence a exactamente uma organização.
2. Nenhum pedido organizacional atravessa organizações.
3. Uma membership é validada antes da autorização.
4. A ausência de contexto nunca escolhe silenciosamente uma organização.
5. O cliente nunca consegue escolher uma role.
6. Um recurso existente resolve o seu próprio tenant.
7. O contexto não é identidade.
8. A organização activa não é persistida como autoridade no servidor.
9. A mudança de organização não reutiliza estado do contexto anterior.
10. Os testes cobrem pelo menos dois utilizadores, duas organizações e recursos pertencentes a ambas.

## 10. Não objectivos

Esta decisão não define:

- convites;
- administração completa de memberships;
- branches;
- holdings;
- circulação;
- sincronização offline;
- auditoria completa;
- organização activa global no servidor;
- pesquisa bibliográfica externa;
- modelo de roles definitivo além do necessário para autorização.

Esses assuntos podem depender deste contrato, mas devem ter decisões próprias.

## 11. Ordem de implementação

1. Reescrever schema, migrations e contratos para remover fallbacks.
2. Implementar resolução explícita de contexto na API.
3. Aplicar autorização uniforme a listagens, criações e recursos.
4. Alinhar o cliente Flutter.
5. Implementar selector de organização.
6. Invalidar estado e caches ao trocar de contexto.
7. Criar testes de isolamento.
8. Actualizar `CONTEXT.md`, `AGENTS.md`, `folio_architecture.md` e `ITERATION_PLAN.md`.
9. Resetar e verificar a base de desenvolvimento.[1]
10. Fazer uma revisão final do contrato, não uma revisão de compatibilidade.

## 12. Critérios de aceitação

A decisão fica implementada quando:

- não existem fallbacks de organização;
- não existe ownership paralelo;
- as operações ambíguas exigem contexto explícito;
- os recursos identificados derivam o seu tenant;
- o Flutter envia o header adequado;
- operações entre organizações falham;
- a alteração de contexto invalida estado e caches;
- os códigos de erro são estáveis;
- API e Flutter usam um único contrato;
- a base de desenvolvimento pode ser recriada de raiz;
- build, lint e testes passam;
- a documentação já não descreve a arquitectura antiga.[1]

## 13. Consequências

### Positivas

- modelo de tenancy explícito;
- ausência de fallbacks silenciosos;
- autorização uniforme;
- contrato único;
- menos condicionais históricas;
- menos dívida técnica;
- maior facilidade para evoluir memberships, branches e holdings;
- testes de isolamento mais claros.

### Negativas

- serão necessárias alterações coordenadas na API e no Flutter;
- alguns endpoints actuais podem mudar;
- migrations e dados de desenvolvimento podem ser recriados;
- o cliente precisa de gerir explicitamente o contexto;
- certas decisões, como roles e memberships, continuam a exigir decisões próprias.[1]

Estas consequências são aceitáveis porque o Folio ainda não tem dados ou consumidores que necessitem de compatibilidade.[1]

## 14. Regra final

Sempre que uma implementação actual entrar em conflito com esta decisão, não deve ser protegida por ser anterior.[1]

A resposta preferida é escolher entre:

- alterar;
- remover;
- reescrever;
- recriar a migration;
- resetar a base;
- actualizar os contratos.[1]

A existência de código não transforma uma decisão provisória numa restrição arquitectural.[1]