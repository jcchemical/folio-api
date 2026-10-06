# DECISION-1L-DEC-0 — Contexto organizacional explícito

## Estado

**Approved for implementation** — decisão normativa para o backend e cliente Tomos. Não significa que a implementação esteja concluída.

**Data:** 2026-10-06

**Âmbito:** tenancy, contexto HTTP, autorização e contratos da API Tomos.

**Dependências aprovadas:**

- `DECISION-1L-DEC-1-organization-library-location.md` — `Organization → Library → Location`;
- `DECISION-1L-DEC-2-work-edition-holding-item.md` — `Work → Edition → Holding → Item`.

Estas decisões são lidas em conjunto. Se o estado textual nos ficheiros dependentes ainda disser “Proposed for implementation”, prevalece a aprovação do proprietário registada nesta decisão; a respectiva metadata documental deve ser alinhada quando esses ficheiros puderem ser editados.

## 1. Contexto

Tomos está numa fase greenfield controlada: não há dados de produção, consumidores externos ou deployments empresariais a preservar. Schema, migrations, DTOs, rotas, serviços, testes e documentação podem ser reescritos para representar o modelo final. Não criar compatibilidade, janelas de depreciação ou fallbacks transitórios.

O servidor e o cliente têm de distinguir identidade autenticada, memberships, organização contextual do pedido, ownership persistido e autorização. Seleccionar a primeira organização ou a organização `OWNER` mais antiga é ambíguo e pode associar uma operação ao tenant errado. Agregar dados de todas as memberships também não representa uma única organização activa.

## 2. Decisão

### 2.1 Tenancy, identidade e estrutura de domínio

`Organization` é a única fronteira de tenancy. A estrutura institucional aprovada é:

```text
User
└── OrganizationMembership
    └── Organization
        ├── Library
        │   └── Location
        └── Work
            └── Edition
                └── Holding
                    └── Item
```

Uma `Library` pertence a uma `Organization`; uma `Location` pertence a uma `Library`. Uma `Work` pertence a uma `Organization`; `Edition` deriva a organização através de `Work`. `Holding` liga uma `Edition` e uma `Location` da mesma organização; `Item` pertence a `Holding`. Os invariantes e limites desses modelos são definidos nas duas decisões dependentes. Não introduzir `Campus` nem `ServicePoint` nesta fase.

O JWT identifica o utilizador apenas. Não contém a organização activa. O contexto organizacional pertence ao pedido e não é autorização: o servidor valida a existência da organização, a membership actual, a role e as regras de domínio. Uma preferência ou ID enviado pelo cliente nunca prova acesso.

### 2.2 Contexto explícito em operações root/ambíguas

O header escolhido para operações root/ambíguas é:

```http
X-Folio-Organization-Id: <organization-id>
```

É obrigatório quando uma operação organizacional não tem um recurso ou parent persistido que determine inequivocamente a organização — em particular, listagens root tenant-scoped, criação root de `Work` e confirmação/importação que cria dados locais. O header é apenas o contexto pretendido. A API valida formato, existência, membership e role antes da operação.

Não exigir o header só porque uma operação cria dados scoped. Criação filha sob um parent persistido deriva o contexto do parent; operações sobre recursos existentes derivam-no do próprio recurso. Se um header for também enviado numa operação de contexto derivado, tem de coincidir com a organização resolvida; caso contrário, falhar com `ORGANIZATION_CONTEXT_CONFLICT`.

Não há selecção implícita, fallback para organização pessoal/default, fallback para a membership `OWNER` mais antiga ou agregação de listas por todas as memberships. `GET /organizations` é a excepção intencional: lista memberships do utilizador e não representa uma lista de recursos de uma organização activa.

### 2.3 Regra de `/organizations/:id`

`/organizations/:id` identifica a organização persistida pelo path. Resolver esse recurso primeiro e, em seguida, validar membership e role. Não exigir header apenas por a operação ser administrativa. O header pode ser aceite como verificação de consistência; se estiver presente e divergir do ID do path, falhar com `ORGANIZATION_CONTEXT_CONFLICT`. `GET /organizations` e `POST /organizations` não exigem contexto organizacional: o primeiro lista memberships do utilizador e o segundo cria uma nova organização com membership inicial.

### 2.4 Recursos existentes e criações-filhas

Para leitura, alteração ou remoção de um recurso existente, carregar o recurso e derivar a organização da ownership persistida, depois validar membership, role e autorização de domínio. Não aceitar `organizationId` redundante no body, query ou path como segunda autoridade.

Criações-filhas derivam contexto dos parents persistidos:

- `Edition` deriva de `Work`;
- `Holding` deriva de `Edition` e `Location`, que têm de pertencer à mesma `Organization`;
- `Item` deriva de `Holding`;
- `Location` deriva de `Library`;
- `Library` criada sob uma `Organization` deriva dessa organização;
- `Contribution` deriva do seu único alvo `Work` ou `Edition`;
- identificadores externos derivam da `Edition`;
- registos bibliográficos e capas derivam do alvo canónico persistido.

Se o header também for fornecido, comparar com a organização derivada e falhar em caso de divergência. Relações inconsistentes ou ambíguas falham de forma segura; não escolher um dos tenants silenciosamente.

### 2.5 Ordem de autorização

```text
Pedido
→ autenticação
→ resolução do contexto root ou do recurso/parent persistido
→ validação da membership actual
→ resolução/verificação da role
→ autorização de domínio
→ operação
```

Não autorizar com base apenas em `userId`, `organizationId` ou role fornecidos pelo cliente, claims de organização no JWT, contexto guardado anteriormente, ou fallback escolhido pelo servidor. Resolver autorização antes da mutação.

## 3. Matriz normativa de contexto por área

<!-- prettier-ignore -->
| Área / operações | Contexto normativo |
|---|---|
| Auth e sessão: `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` | Global à identidade/sessão; sem organização. |
| Users | Global ou self-scoped ao utilizador autenticado; sem organização. Signup não escolhe tenant de pedidos futuros. Defaults de `Library`/`Location` seguem a decisão de onboarding, não um fallback de contexto. |
| Organizations | `GET /organizations`: memberships do utilizador, sem header. `POST /organizations`: cria organização e membership inicial, sem organização prévia. `/organizations/:id`: deriva do path, valida membership/role; header opcional apenas para confirmar igualdade. |
| Libraries | Listagem root scoped: header obrigatório. Recurso por ID deriva `Organization`. Criação sob Organization persistida deriva pelo parent; header opcional tem de coincidir. |
| Locations | Listagem root scoped: header obrigatório. Recurso por ID deriva via `Library`. Criação sob Library persistida deriva pelo parent; header opcional tem de coincidir. |
| Works | `GET /works` e `POST /works`: header obrigatório. Detalhe/alteração/remoção por ID: derive de Work e valide membership/role. |
| Editions | Listagem root `GET /editions`: header obrigatório. Criação com `workId`: deriva de Work; header opcional tem de coincidir. Operações por ID, capa e export: derivam de Edition → Work. |
| Holdings | Listagem root: header obrigatório. Criação: deriva de Edition e Location persistidas e valida mesma organização. Operações por ID: derivam do Holding. Header opcional em contexto derivado tem de coincidir. |
| Items | Listagem root: header obrigatório. Criação: deriva do Holding persistido. Operações por ID: derivam de Item → Holding. Header opcional em contexto derivado tem de coincidir. |
| Catalogue search | `POST /catalogues/search` consulta provider externo e não lê/persiste dados locais; sem organização. Não confundir com pesquisa local, que não é definida por esta decisão. |
| Catalogue import | `POST /catalogues/import` confirma e persiste dados locais; header obrigatório para a criação root de Work. Editions e restantes filhos derivados seguem os parents criados/persistidos. |
| External identifiers | Listagem root: header obrigatório. Criação sob Edition e operações por ID: derivam de Edition → Work; header opcional tem de coincidir. |
| Contributions | Escrita aponta exactamente para um Work ou Edition persistido e deriva daí a organização; valida Agent na mesma organização. Header opcional tem de coincidir. |
| Bibliographic records | Operações por ID derivam do alvo canónico e inequívoco; relações inconsistentes ou sem alvo organizacional falham, não escolhem arbitrariamente um alvo. |
| Covers | Leitura deriva de Edition; aquisição em background deriva do registo/alvo persistido e valida a mesma organização. Requests não escolhem tenant de um asset isolado. |
| Exports | Export de Edition deriva de Edition → Work e valida membership; header opcional tem de coincidir. |
| Health, raiz e Swagger/docs | Globais; sem contexto organizacional. |

“Listagem root” significa uma colecção sem parent persistido na rota que determine um tenant único. Uma rota nested sob um parent persistido usa contexto derivado desse parent. Filtros adicionais (`Library`, `Location`, `Holding`, `Edition`) restringem dentro da organização resolvida; não substituem o contexto de uma listagem root ambígua.

## 4. Erros

A API usa códigos estáveis distintos para:

- `ORGANIZATION_CONTEXT_REQUIRED` — header ausente em operação root que o exige;
- `ORGANIZATION_ID_INVALID` — identificador de contexto inválido;
- `ORGANIZATION_NOT_FOUND` — organização inexistente;
- `ORGANIZATION_MEMBERSHIP_REQUIRED` — utilizador sem membership;
- `ORGANIZATION_ROLE_INSUFFICIENT` — role insuficiente;
- `ORGANIZATION_CONTEXT_CONFLICT` — header em conflito com recurso/parent/path resolvido;
- `RESOURCE_NOT_FOUND` — recurso solicitado inexistente.

Os status HTTP devem ser definidos de forma consistente na implementação. Erros de contexto explícito não devem ser confundidos com ausência de recurso. O cliente usa códigos, não texto livre, como contrato de tratamento.

## 5. Consequências

### Benefícios

- Um único tenant de domínio, explícito e verificável.
- Listagens não agregam organizações sem intenção.
- Child creates seguem ownership persistida em vez de repetir IDs de tenant.
- O mesmo utilizador pode alternar de organização sem alterar identidade ou JWT.
- Os modelos `Library/Location` e `Holding/Item` refinam o domínio sem criarem novos tenants.

### Custos e riscos

- Alteração coordenada de API e cliente, CORS, DTOs, rotas, autorização e testes.
- Reescrita de schema/migrations e remoção de ownership duplicada/legacy.
- Headers inválidos, memberships alteradas, recursos inconsistentes e respostas tardias têm de ser tratados explicitamente.

## 6. Não objectivos

Esta decisão não define administração completa de memberships, convites, roles finais, `Campus`, `ServicePoint`, branches, holdings adicionais além da decisão dependente, circulação, empréstimos, reservas, catálogo bibliográfico global, pesquisa full-text, auditoria completa ou persistência server-side da organização activa.

## 7. Ordem de implementação

1. Aplicar conjuntamente esta decisão e as decisões de Library/Location e Holding/Item ao schema e migrations finais, sem camadas de compatibilidade.
2. Implementar resolvers comuns de contexto explícito root e contexto derivado de recurso/parent.
3. Classificar e actualizar rotas, DTOs, CORS, autorização e erros conforme a matriz.
4. Remover fallbacks, agregação multi-organização nas listas scoped, ownership redundante e Contributor legacy conforme DEC-2.
5. Provar isolamento, derivação de parent e mismatch com testes de duas organizações.
6. Alinhar documentação e contratos do cliente com o comportamento implementado.

## 8. Critérios de aceitação

- `Organization` é a única fronteira de tenancy; JWT representa apenas User.
- Operações root/ambíguas exigem `X-Folio-Organization-Id`; operações por recurso e child creates derivam contexto persistido.
- `/organizations/:id` deriva do path, valida membership/role e só compara header se este for fornecido.
- Header em conflito falha explicitamente.
- Não há fallback de organização nem listagem scoped que agregue todas as memberships.
- `Library/Location` e `Holding/Item` obedecem às respectivas decisões e invariantes.
- Erros e isolamento entre organizações são estáveis e testados.
