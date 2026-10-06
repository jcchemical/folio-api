# FOLIO vs Tomos — Arquitectura, domínio e tenancy

## Síntese executiva

Tomos deve estudar o FOLIO como uma biblioteca de soluções de domínio, não como um blueprint técnico. O FOLIO foi desenhado como uma plataforma modular, multi-tenant e extensível para instituições bibliotecárias complexas; Tomos pretende servir desde uma coleção pessoal até redes municipais, com uma aplicação e um domínio inicialmente muito mais compactos. O princípio greenfield já estabelecido para Tomos permite adotar apenas os conceitos que simplificam o domínio e rejeitar complexidade criada para consórcios, integrações extensas ou implantação modular em grande escala.[^1][^2]

As aprendizagens mais fortes são: separar descrição bibliográfica de posse física; modelar a localização abaixo do tenant; fazer do exemplar a unidade de circulação; guardar no empréstimo um snapshot dos dados relevantes no checkout; separar permissões de staff da classificação dos leitores; e manter pedidos/reservas como domínio próprio. Não se recomenda copiar Okapi/Eureka, microserviços, tenants técnicos por biblioteca, a árvore fixa Institution → Campus → Library → Location, nem o modelo de consórcios ECS nesta fase.[^3][^4][^5][^6]

A consequência imediata é rever o modelo atual de Tomos antes de executar `1L-API.0`: `Organization` continua a ser a fronteira de tenancy, mas o catálogo deverá evoluir de `Work → Edition → Item` para `Work → Edition → Holding → Item`, ou pelo menos preservar explicitamente espaço para `Holding`. `Library` e `Location` devem ficar dentro de `Organization`; `ServicePoint` deve ser introduzido apenas com circulação; e `User`, `OrganizationMembership` e `PatronAccount` devem representar conceitos diferentes.

## Objetivos de produto

Tomos é uma plataforma independente para gestão de bibliotecas pessoais e institucionais. O âmbito inclui uma pessoa que cataloga os livros de casa, um escritório com empréstimos internos e uma instituição municipal ou escolar com vários polos, colaboradores, leitores, pedidos e circulação. O projeto está ainda em definição, sem obrigações de compatibilidade ou dados de produção a preservar, pelo que schema, contratos e implementações podem ser reescritos para evitar dívida técnica.

FOLIO significa “Future of Libraries Is Open” e serve aqui apenas como fonte de aprendizagem. Não existe intenção de compatibilidade, derivação de marca ou competição funcional completa.

## Arquitetura FOLIO

### Plataforma técnica

FOLIO separa o frontend Stripes dos serviços de backend e expõe funcionalidade através de APIs. Na arquitetura Okapi, os módulos são desacoplados, cada pedido é executado em nome de um tenant e o cliente envia contexto através de `X-Okapi-Tenant`; o desenho permite que módulos sejam implementados em linguagens diferentes.[^1][^2][^7]

O tenant do FOLIO é uma fronteira técnica ampla: configuração, permissões e dados são tenant-specific. No modelo tradicional, Okapi combina autenticação, tenant e permissões em headers; a evolução Eureka adota autenticação Keycloak e roles/capabilities, mas mantém o tenant como contexto de execução.[^8][^9][^10]

O suporte a consórcios acrescenta uma camada substancial: tenant central, tenants membros, afiliações, shadow users, contexto ativo e pesquisa consolidada. Uma pessoa de staff pode receber acesso a alguns tenants de um consórcio; patrons comuns não são normalmente propagados pelo pipeline de consórcios.[^11][^12][^13]

### Leitura para Tomos

O conceito útil não é “cada biblioteca deve ser um tenant técnico”. O conceito útil é que todo o pedido organizacional deve ter uma fronteira inequívoca e verificável. Tomos pode concretizar isso numa aplicação modular monolítica com `Organization` como tenant de domínio, sem reproduzir gateway, módulos implantáveis, shadow users ou infraestrutura de consórcio.

## Tenants e bibliotecas

### Modelo FOLIO

Dentro de cada tenant, FOLIO configura uma árvore de localização com quatro níveis: `Institution → Campus → Library → Location`. A Institution é o topo administrativo, Library costuma representar um edifício ou domínio de serviço, e Location costuma representar uma área concreta como stacks, reservas ou uma coleção linguística.[^14][^15]

Esta árvore não é a própria tenancy. Um tenant pode alojar várias instituições ou bibliotecas; quando isso acontece, consultas e relatórios podem precisar de filtrar por localização. Holdings e Items usam localizações permanentes e temporárias, e a localização efetiva do Item participa nas regras de circulação.[^16][^17][^18]

FOLIO liga Locations a Service Points. Os Service Points representam os balcões ou contextos operacionais de check-in, checkout, pickup e outras ações; staff que trabalha nesses fluxos precisa de um service point atribuído.[^4][^14]

### Modelo recomendado para Tomos

| Conceito | FOLIO | Tomos recomendado |
|---|---|---|
| Fronteira isolada | Tenant técnico | `Organization` |
| Instituição | Nível da árvore de localização | A própria `Organization` |
| Polo ou biblioteca | `Library`, abaixo de Campus | `Library`, diretamente abaixo de `Organization` |
| Campus | Nível obrigatório na árvore | Não criar inicialmente; adicionar uma unidade organizacional genérica se surgir necessidade real |
| Localização física | `Location` | `Location`, abaixo de `Library` |
| Balcão de circulação | `ServicePoint` | Futuro `ServicePoint`, introduzido com circulação |
| Consórcio | Tenant central + tenants membros | Fora do escopo inicial |

Uma estrutura simples cobre os casos atuais:

```text
Organization
└── Library
    └── Location
        └── Holding
            └── Item
```

Para uma biblioteca pessoal, Tomos pode criar uma `Library` e uma `Location` padrão sem as expor obrigatoriamente na experiência inicial. Para um escritório, `Library` pode representar cada sede ou coleção interna. Para um município ou agrupamento escolar, cada polo é uma `Library`, e `Location` representa salas, depósitos, secções ou estantes.

A designação `Library` é preferível a `Branch`: “branch” pressupõe uma sede com filiais, enquanto uma organização pode conter polos equivalentes, bibliotecas escolares ou coleções departamentais. O conceito pode ter um `type` mais tarde, mas não deve começar com subclasses rígidas.

## Catálogo e inventário

### Modelo FOLIO

O Inventory do FOLIO separa `Instance`, `Holdings` e `Item`. Instance contém a descrição bibliográfica utilizada para identificar o título; Holdings representa a posse e localização da instituição; Item identifica e acompanha uma cópia ou peça individual, incluindo barcode, disponibilidade e material type.[^19][^20][^3]

A relação habitual é:

```text
Instance
└── Holdings
    └── Item
```

O Item é a unidade de circulação. Mesmo em casos complexos como volumes encadernados em conjunto, FOLIO mantém uma relação principal Item → Holdings → Instance e modela associações adicionais separadamente.[^21]

FOLIO distingue ainda os dados normalizados no Inventory do registo-fonte, por exemplo MARC em Source Record Storage. Isto permite que operações de inventário não dependam diretamente do formato de catalogação.[^20][^3][^19]

### Modelo Tomos

O modelo atual de Tomos tem uma separação bibliográfica mais rica:

```text
Work
└── Edition
    └── Item
```

`Work` representa a obra intelectual; `Edition` representa uma manifestação/publicação concreta; `Item` representa a cópia física. Esta separação é apropriada para Tomos e não deve ser substituída por uma cópia literal de FOLIO Instance.

O conceito em falta é `Holding`:

```text
Organization
└── Work
    └── Edition
        └── Holding
            └── Item
```

`Holding` deve representar que uma organização possui uma edição numa determinada `Library`/`Location`, juntamente com dados partilhados pelos exemplares: cota, localização permanente, política de empréstimo padrão e eventualmente informação de volumes. Isto evita colocar diretamente em cada Item dados repetidos que pertencem ao conjunto de exemplares.

### Tenancy bibliográfica

Há duas opções legítimas para `Work` e `Edition`:

| Opção | Vantagem | Custo |
|---|---|---|
| Catálogo scoped por `Organization` | Isolamento simples, edição local, implementação direta | Duplicação da mesma obra entre organizações |
| Catálogo bibliográfico global + Holdings locais | Deduplicação e descoberta transversal | Curadoria partilhada, conflitos de edição, autorização e proveniência muito mais complexos |

Para a primeira versão, recomenda-se manter `Work` e `Edition` dentro de `Organization`. A separação `Holding` continua valiosa mesmo sem catálogo global. Uma eventual rede ou catálogo coletivo deverá ser uma decisão futura explícita, não uma consequência acidental de tornar entidades bibliográficas globais.

### Agentes e contribuições

O achado anterior sobre `Contributor` continua válido: manter simultaneamente um caminho legacy `Contributor` e um modelo canónico `Agent + Contribution` cria duas representações do mesmo domínio. Tomos deve conservar apenas `Agent + Contribution`, scoped à organização, e remover o modelo legacy em vez de o adaptar.

## Utilizadores e autorização

### Modelo FOLIO

FOLIO guarda patrons e staff no mesmo domínio Users. Um utilizador de staff distingue-se por ter credenciais e permissões/capabilities; o patron group classifica o leitor para regras de circulação, e apenas um patron group pode ser atribuído a cada user record.[^22][^5]

As permissões de staff são granulares e agrupáveis em roles definidos pelos administradores. Elas controlam ações na plataforma; não equivalem a categorias de leitor como Faculty ou Undergraduate.[^23][^5][^8]

Em consórcios, FOLIO trata a afiliação multi-tenant sobretudo como uma necessidade de staff. Patrons não são normalmente propagados entre tenants, enquanto staff pode receber afiliações e shadow users em tenants membros.[^12][^13]

### Modelo recomendado para Tomos

A recomendação anterior “leitor = membership com role `READER`” deve ser refinada. Ela mistura três dimensões diferentes:

- **Identidade:** quem é a pessoa e como inicia sessão;
- **Afiliação:** a relação da pessoa com uma organização;
- **Autorização:** que ações administrativas ou operacionais pode executar;
- **Circulação:** em que categoria de leitor se enquadra e que regras se aplicam.

O modelo recomendado é:

```text
User
└── OrganizationMembership
    ├── staffRole / permissions
    └── PatronAccount (opcional)
        └── PatronGroup
```

`OrganizationMembership` indica afiliação. `OWNER`, `ADMIN` e `STAFF` são papéis de autorização. `PatronAccount` é opcional e contém barcode, estado, validade, grupo e bloqueios de circulação. A mesma pessoa pode ser simultaneamente staff e patron na mesma organização sem receber duas memberships nem uma role híbrida.

Para a primeira versão, uma membership pode continuar a ter uma única role enum se isso simplificar a implementação, mas o schema não deve consagrar `READER` como simétrico de `ADMIN`/`STAFF`. Quando a circulação entrar no escopo, `READER` deve migrar para `PatronAccount`; como o projeto é greenfield, esta separação pode ser feita já se o custo for pequeno.

### Múltiplas organizações

Deve manter-se a cardinalidade muitos-para-muitos entre `User` e `Organization`, mas sem construir já uma experiência de consórcio. Existem casos plausíveis: consultor que administra várias bibliotecas, colaborador municipal com acesso a organizações separadas, fornecedor de suporte ou pessoa que gere a biblioteca pessoal e a do escritório. O caso comum de uma única organização pode ter seleção automática; o modelo não deve, porém, impor essa limitação.

Para patrons, não é necessário prometer identidade federada entre instituições. Um `User` global pode ter várias memberships, mas cada `PatronAccount`, histórico, barcode, bloqueios e consentimentos permanecem locais à organização.

## Empréstimos e pedidos

### Modelo FOLIO

No FOLIO, um Loan liga o `userId` do patron ao `itemId` do exemplar. O registo conserva também snapshots como localização efetiva do item, service points de checkout/check-in e patron group no momento do empréstimo, o que protege a interpretação histórica se esses dados mudarem depois.[^4]

As condições do empréstimo são determinadas por circulation rules e políticas. As regras podem considerar patron group, localização, material type e loan type, e selecionar políticas de empréstimo, pedidos, notificações e multas.[^24][^25]

Requests são um domínio separado. FOLIO suporta pedidos ao nível do Item e do título; os tipos incluem Hold, Page e Recall, e o fulfillment pode usar pickup service point ou entrega.[^6]

### Modelo recomendado para Tomos

Tomos deve começar com um núcleo de circulação menor:

```text
PatronAccount
Loan
Reservation
CirculationPolicy
ServicePoint
```

Um `Loan` deve apontar para `Item` e `PatronAccount`. O `organizationId` deve ser derivável de ambos e validado; pode ser armazenado no Loan para particionamento/auditoria desde que uma constraint ou a criação transacional impossibilite divergências. Deve guardar snapshots mínimos no checkout: `libraryId`, `locationId`, `servicePointId`, `patronGroupId`, política aplicada e due date.

`Reservation` deve começar como pedido sobre uma `Edition` ou um `Item`. Pedidos ao nível de Edition permitem que qualquer exemplar elegível satisfaça a reserva e correspondem melhor ao comportamento esperado de utilizadores; o alvo Item deve existir para casos em que uma cópia específica é necessária. `Page` e `Recall` podem ser adiados até haver requisitos reais.

Não se recomenda copiar já o editor textual de regras do FOLIO. Uma política estruturada por organização, com defaults e algumas condições explícitas, é mais adequada ao âmbito inicial. A localização, patron group, material type e loan type são bons eixos a preservar porque o FOLIO demonstra que afetam operações reais de circulação.[^24][^4]

## FOLIO vs Tomos

| Dimensão | FOLIO | Tomos |
|---|---|---|
| Mercado principal | Instituições complexas e consórcios | Pessoal, pequenas instituições e redes municipais/escolares |
| Arquitetura técnica | Plataforma modular, APIs, Okapi/Eureka, Stripes | Aplicação modular monolítica; extrair serviços apenas quando necessário |
| Tenant | Tenant técnico por contexto de execução | `Organization` como fronteira de domínio |
| Multi-instituição | Consórcios, tenant central, tenants membros, afiliações | Memberships diretas; consórcios fora do escopo |
| Estrutura física | Institution → Campus → Library → Location | Organization → Library → Location |
| Inventário | Instance → Holdings → Item | Work → Edition → Holding → Item |
| Formato bibliográfico | Inventory normalizado + SRS/MARC | Modelo canónico + registos-fonte externos/MARC quando necessário |
| Utilizadores | Patrons e staff no mesmo Users; permissões e patron groups separados | `User` global + membership + autorização + `PatronAccount` separado |
| Circulação | Rules/policies altamente configuráveis | Políticas estruturadas e incrementais |
| Empréstimo | User + Item + snapshots operacionais | PatronAccount + Item + snapshots mínimos |
| Pedidos | Item-level e title-level; Hold/Page/Recall | Reservation por Edition ou Item; começar com Hold |
| Partilha entre instituições | ECS e cross-tenant circulation | Não implementar inicialmente |

## O que adotar

- Separação entre descrição bibliográfica, holdings e exemplares.
- Item como unidade física de circulação.
- `Library`, `Location` e posteriormente `ServicePoint` abaixo de `Organization`.
- Localização permanente, temporária e efetiva como conceitos de circulação, introduzidos apenas quando necessários.
- Staff e patron na mesma identidade, mas permissões de staff separadas da classificação de patron.
- Snapshots históricos no Loan.
- Reservations separadas de Loans.
- Modelo canónico independente de MARC, mantendo proveniência/registo-fonte separado.
- Contexto de tenant explícito e validado em todos os pedidos scoped.

## O que simplificar

- Usar dois níveis físicos (`Library → Location`) em vez dos quatro níveis obrigatórios do FOLIO.
- Usar roles de produto compreensíveis em vez de centenas de capabilities na primeira fase.
- Começar com políticas estruturadas, sem linguagem de regras.
- Suportar múltiplas memberships sem construir consórcios.
- Manter catálogo por organização antes de considerar deduplicação global.
- Introduzir Service Points apenas com check-in, checkout e pickup.

## O que não copiar

- Okapi/Eureka como arquitetura da aplicação.
- Microserviços por domínio desde o início.
- `X-Okapi-Tenant`, shadow users e sincronização cross-tenant.
- Tenant central e tenants membros de ECS.
- Árvore fixa Institution → Campus → Library → Location.
- Complexidade completa de aquisições, multas, notices, DCB e empréstimo interbibliotecas.
- Modelo FOLIO Instance como substituto de `Work + Edition`.

## Impacto em 1L

A decisão de contexto organizacional continua válida no princípio, mas deve ser ajustada antes da implementação:

1. `Organization` permanece a fronteira de tenancy.
2. Múltiplas `OrganizationMembership` continuam permitidas.
3. A seleção de organização não pertence ao JWT e não pode ser inferida silenciosamente.
4. Listagens root e criação de recursos root usam contexto explícito.
5. Recursos existentes e filhos criados sob um parent persistido derivam tenant desse recurso; um header facultativo, se enviado, deve coincidir.
6. `Contributor` legacy deve ser removido em favor de `Agent + Contribution`.
7. O schema deve reservar a cadeia `Edition → Holding → Item` antes da circulação.
8. `READER` não deve ser tratado definitivamente como role equivalente a `STAFF`; a direção é `PatronAccount` local à organização.
9. `Library` e `Location` devem ter decisões próprias, não ser introduzidos incidentalmente dentro da implementação do header.

### Matriz de contexto revista

| Operação | Contexto recomendado |
|---|---|
| `GET /organizations` | Global ao utilizador autenticado |
| `POST /organizations` | Global; cria organização e membership inicial |
| `GET/PUT/DELETE /organizations/:id` | Derivado do path; sem header obrigatório |
| `GET /works` | Header obrigatório |
| `POST /works` | Header obrigatório |
| `GET/PUT/DELETE /works/:id` | Derivado do Work |
| `GET /editions` | Header obrigatório |
| `POST /editions` com `workId` | Derivado do Work; header opcional deve coincidir |
| `GET/PUT/DELETE /editions/:id` | Derivado da Edition |
| `GET /holdings` | Header obrigatório; filtros por Library/Location opcionais |
| `POST /holdings` com `editionId` e `locationId` | Derivado e validado pelos parents |
| `GET /items` | Header obrigatório; filtros opcionais |
| `POST /items` com `holdingId` | Derivado do Holding |
| `GET/PUT/DELETE /items/:id` | Derivado do Item → Holding |
| Pesquisa externa | Sem organização se não persistir dados |
| Importação confirmada | Header obrigatório para criar Work root; parents subsequentes herdam o contexto |

Esta regra elimina duplicação desnecessária: o header escolhe o tenant quando o pedido não tem outro recurso autoritativo; IDs de parent ou recurso persistido determinam-no quando já existe um alvo inequívoco.

## Decisões a cristalizar

### Aprovadas

- O produto chama-se **Tomos**.
- FOLIO é referência de aprendizagem, não concorrente nem alvo de compatibilidade.
- `Organization` é o tenant de domínio.
- Uma organização pode conter várias `Library` e `Location`.
- Um utilizador pode ter memberships em várias organizações.
- A UX otimiza o caso de uma só organização.
- O catálogo canónico mantém `Work + Edition`.
- Deve ser introduzido `Holding` entre Edition e Item.
- `Agent + Contribution` substitui o Contributor legacy.
- Autorização de staff e estatuto de patron são conceitos separados.
- Consórcios e circulação cross-organization ficam fora do escopo inicial.

### Próximas decisões

- Criar já `PatronAccount` ou apenas reservar formalmente o conceito até à fase de circulação.
- Definir se a biblioteca pessoal é criada automaticamente no signup ou num onboarding explícito.
- Definir se toda Organization recebe automaticamente uma Library e Location padrão.
- Definir o conjunto mínimo de roles de staff.
- Definir os campos e invariantes exatos de Holding, Library e Location.
- Decidir se o trabalho `1L-API.0` inclui a remodelação `Holding` ou se esta constitui uma decisão e iteração imediatamente anterior.

## Sequência recomendada

1. Atualizar `CONTEXT.md` com a identidade Tomos e os conceitos aprovados neste relatório.
2. Criar uma decisão curta para o modelo `Organization → Library → Location`.
3. Criar uma decisão para `Work → Edition → Holding → Item` e eliminar `Contributor` legacy.
4. Rever o decision de contexto organizacional e a matriz de rotas usando a regra header-vs-resource derivado.
5. Só depois reescrever schema e migrations e executar `1L-API.0`.
6. Adiar Loan, Reservation, PatronAccount, ServicePoint e CirculationPolicy para uma fase de circulação, preservando já os boundaries necessários.

## Conclusão

A principal aprendizagem do FOLIO para Tomos é de modelação: tenant, estrutura física, descrição bibliográfica, posse, exemplar, utilizador e circulação são dimensões relacionadas, mas não devem ser colapsadas. A principal aprendizagem negativa é igualmente importante: funcionalidades destinadas a consórcios e grandes instalações têm um custo arquitetural elevado e não devem entrar no núcleo de Tomos antes de existir procura real.

Tomos deve manter uma arquitetura mais pequena e explícita: `Organization` como tenant, `Library/Location` como estrutura interna, `Work/Edition/Holding/Item` como cadeia bibliográfica e física, e identidade, afiliação, autorização e patronato como conceitos separados. Isso serve a biblioteca pessoal sem impedir o escritório ou a rede municipal, evitando tanto submodelação como complexidade prematura.

---

## References

1. [Initialize Okapi from the command line](https://dev.folio.org/curriculum/02_initialize_okapi_from_the_command_line)

2. [Guides | FOLIO uses any programming language - FOLIO Developers](https://dev.folio.org/guides/any-programming-language/) - FOLIO is a new open source, cloud hostable, app-store based library platform, designed to facilitate...

3. [Inventory | FOLIO Documentation](https://lotus.docs.folio.org/docs/metadata/inventory/) - FOLIO Documentation

4. [Loans | FOLIO Documentation](https://lotus.docs.folio.org/docs/access/additional-topics/loans/loans/) - Library staff manage patron loans in FOLIO through three primary apps - Check in, Check out, and Use...

5. [Settings > Users - FOLIO Documentation](https://docs.folio.org/docs/settings/settings_users/settings_users/) - The Users section in the Settings app provides configuration options for managing user records, incl...

6. [Requests | FOLIO Documentation](https://docs.folio.org/docs/access/requests/requests/) - This section of the documentation contains links to external sites. Please be advised that these sit...

7. [Build, test, and deployment infrastructure](https://dev.folio.org/guides/automation/) - Overview. This document describes the implementation, processes, and automated workflow for FOLIO pr...

8. [Permissions - FOLIO Documentation](https://docs.folio.org/docs/platform-essentials/permissions/) - FOLIO Documentation

9. [Permissions overview - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/FOLIJET/pages/1376406/Permissions+overview)

10. [Developers - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/DEV/pages/46858271)

11. [Technical Designs and Decisions - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/DD/pages/65995149/Consolidated+Access+to+FOLIO+Objects+In+A+Consortium) - With Enhanced Consortia Support(ECS) in FOLIO, multiple member libraries in a consortium require sha...

12. [Steps to setup Consortia env](https://folio-org.atlassian.net/wiki/spaces/FOLIJET/pages/1401417/Steps+to+setup+Consortia+env)

13. [Enhanced Consortia Support Data FAQ](https://folio-org.atlassian.net/wiki/spaces/FOLIJET/pages/1404808/Enhanced+Consortia+Support+Data+FAQ)

14. [Settings > Tenant](https://nolana.docs.folio.org/docs/settings/settings_tenant/settings_tenant/) - The Tenant section of the Settings app is where you configure specific settings that apply to your e...

15. [Information and User Guides for FOLIO Apps - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/FOLIOtips/pages/5669269/Settings+-+Tenant+-+Location+Setup+-+Institution) - FOLIO libraries will need at least one institution created to be able to populate elements down the ...

16. [Location Setup - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/FOLIOtips/pages/5669261/Settings+-+Tenant+-+Location+Setup)

17. [Reporting SIG - FOLIO Wiki](https://folio-org.atlassian.net/wiki/display/RPT/ACRL+Annual+Survey+Report+Prototype) - In the case of FOLIO tenants that are shared by multiple institutions or libraries, filtering by loc...

18. [Reporting SIG - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/RPT/pages/4494787/ACRL+Annual+Survey+Report+Prototype)

19. [Information and User Guides for FOLIO Apps - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/FOLIOtips/pages/5669002/Inventory)

20. [Inventory and SRS - Data Structures](https://folio-org.atlassian.net/wiki/spaces/FOLIOtips/pages/5674350/Inventory+and+SRS+-+Data+Structures)

21. [Bound-with data model](https://folio-org.atlassian.net/wiki/spaces/MM/pages/4661961/Bound-with+data+model)

22. [docs.folio.org · docs · usersUsers - FOLIO Documentation](https://docs.folio.org/docs/users/) - FOLIO Documentation

23. [FOLIO permission model - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/PLATFORM/pages/5854423/FOLIO+permission+model)

24. [circulation rules - FOLIO Wiki](https://folio-org.atlassian.net/wiki/spaces/FOLIOtips/pages/5669171/Settings+-+Circulation+-+Circulation+Rules+Editor)

25. [Loans](https://docs.folio.org/docs/access/additional-topics/loans/loans/) - This section of the documentation contains links to external sites. Please be advised that these sit...

