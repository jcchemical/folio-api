# Reavaliação da Arquitectura Folio

## Síntese executiva

A direcção conceptual está correcta: separar o registo original da PORBASE, o modelo local editável, o mapeamento de perfil e a serialização MARC é a decisão mais importante tomada até agora. O uso de PostgreSQL + Prisma + NestJS + Flutter também é adequado para crescer de uma biblioteca pessoal para uma plataforma multi-instituição.

A arquitectura evoluiu para usar `Organization` como tenant único, com `OrganizationMembership` para relacionar utilizadores a organizações através de roles controlados (`OWNER`, `ADMIN`, `STAFF`, `READER`). Esta fundação foi implementada, validada e consolidada.

**Fase 1 (Descrição Física Repetível e Datas Bibliográficas)** foi implementada como uma alteração breaking coordenada:
- `PhysicalDescription` representa uma ocorrência UNIMARC `215`;
- `PhysicalDescriptionPart` representa cada subcampo ordenado da ocorrência;
- ocorrências, subcampos repetidos, ordem e códigos desconhecidos válidos são preservados;
- `Edition.pageCount` é derivado e nunca é a fonte bibliográfica;
- `Edition.publicationDate` preserva exactamente `YYYY`, `YYYY-MM` ou `YYYY-MM-DD`;
- o parser, import, CRUD, Flutter e exportação partilham o contrato agrupado;
- a migration destina-se a uma base de desenvolvimento recriada.

O `MarcRecord` é uma boa base para serializadores. UNIMARC foi concebido para intercâmbio internacional e a estrutura MARC é composta por estrutura do registo, designadores de conteúdo e conteúdo; ISO 2709 e MARCXchange são representações relacionadas mas distintas. O `MarcRecord` deve evoluir para preservar encoding, leader actualizado, campos de controlo, indicadores, subcampos, ordem, proveniência e warnings de perda.[^1][^2]

## Escopo e estado actual

O contexto fornecido descreve uma API NestJS 12 com TypeScript ESM, Prisma 7, PostgreSQL, JWT e Swagger, e uma app Flutter multiplataforma com Riverpod, Dio, `go_router` e armazenamento seguro do token. O fluxo implementado já cobre login, pesquisa ISBN server-side na PORBASE, preview, confirmação transaccional, edição do preview, warnings estruturados, biblioteca, detalhe de edição e exportação local MARCXchange.[^3][^4][^5]

A importação distingue correctamente preview de confirmação: o preview não persiste dados; a confirmação usa o utilizador autenticado, uma transacção e não volta a contactar a PORBASE. Esta separação é importante e deve ser mantida quando forem acrescentados importação de ficheiros, jobs assíncronos e revisão humana.[^5]

A exportação local já não copia `rawContent`: usa `Edition`, `Work`, contributors e identificadores através de um mapper UNIMARC e de um serializer MARCXchange. A comparação com o XML original demonstra que a exportação local é deliberadamente mais pequena; isso é aceitável como primeira versão, desde que as perdas sejam explícitas e o modelo futuro consiga absorver os campos em falta.[^4][^6]

## Decisões implementadas

### Publication statements UNIMARC 210 (Phase 1)

O modelo local agora preserva ocorrências repetíveis de 210 através de
`PublicationStatement` e partes ordenadas. A exportação local usa essas partes
como fonte autoritativa e só usa os escalares de Edition como fallback para
registos legados sem statements. A migration é aditiva, não fabrica statements
para dados antigos e deve ser validada na base de desenvolvimento existente
sem reset. Ver `docs/decisions/publication-statements-phase-1.md` para a decisão
transicional e o plano de remoção futura dos inputs escalares.

### Separação de proveniência

Manter o `rawContent` como registo original imutável, separado dos dados locais corrigidos, é a decisão certa. Permite auditoria, comparação, reprocessamento com um parser melhor e exportação original sem sobrescrever a curadoria local. O `rawContent` não deve ser a fonte da exportação local.

A melhoria necessária é transformar `BibliographicRecord` num registo de proveniência mais rico: fonte, formato, schema, remoteId, hash do payload, data de aquisição, versão do parser, estado de parsing e warnings. Se o mesmo título for importado de PORBASE, MARC21 ou um ficheiro local várias vezes, deve ser possível conservar várias fontes/registos, não apenas um payload indistinto.

### Modelo canónico mais serializadores

A cadeia `modelo local → mapper de perfil → MarcRecord → serializer` é correcta. Evita que Prisma fique acoplado a UNIMARC e permite no futuro mapear para MARC21, MARCXchange, MARCXML, ISO 2709, Dublin Core ou BIBFRAME sem duplicar todo o domínio.

O `MarcRecord` actual deve ser tratado como uma representação de intercâmbio, não como o modelo canónico completo. Deve suportar pelo menos `recordFormat`, `characterEncoding`, `leader`, control fields, data fields, indicators, subfields, ordem e metadados de conversão. Para preservar campos desconhecidos, não se deve depender apenas de mappers que conhecem os campos actuais.

### PostgreSQL e Prisma

PostgreSQL é uma escolha sólida para catálogo, circulação, permissões e transacções. Prisma 7 com driver `pg` fornece pool de conexões; a documentação indica que o tamanho e timeouts dependem do driver adapter, cujo default `max` para `pg` é 10 e cujo timeout de conexão por defeito pode ser ilimitado, pelo que estes valores devem ser configurados explicitamente para produção.[^7]

A escala não deve ser optimizada prematuramente trocando de base de dados. Deve-se primeiro garantir índices, paginação, queries selectivas, limites de payload, pool configurado, métricas e testes de carga. Para tráfego concorrente, a aplicação deve usar pool; migrações, introspecção e ferramentas administrativas devem usar conexão directa quando a infraestrutura fornecer ambas.[^8]

### Tenancy por Organization (implementado)

A arquitectura evoluiu para usar `Organization` como tenant único:

```text
User
  └── OrganizationMembership
        └── Organization
              ├── Work
              │     └── Edition
              │           └── Item
              └── Library / Branch (futuro, opcional)
```

- `Work.organizationId` e `Item.organizationId` são obrigatórios;
- `Work.userId` e `Item.userId` não existem;
- `Institution` e `institutionId` foram removidos;
- a autorização é baseada em `OrganizationMembership` com roles controlados;
- cada utilizador recebe uma organização pessoal na criação;
- um utilizador pode pertencer a várias organizações.

Esta fundação resolve o risco histórico de ownership por `userId` e prepara o terreno para instituições, filiais e circulação.

### Descrição física repetível e datas (implementado em Phase 1)

`PhysicalDescription` é uma ocorrência `215`; os seus `PhysicalDescriptionPart` preservam códigos, valores, repetição e ordem. Os códigos conhecidos `a`–`f` têm labels na UI; códigos lowercase alfanuméricos desconhecidos de um carácter permanecem dados estruturais exportáveis.

`Edition.pageCount: Int?` é derivado conservadoramente de um único `215$a` simples como `383 p.`. Descrições complexas como `146, [6] p.` são preservadas e deixam `pageCount` nulo quando não é possível determinar um inteiro. A exportação só usa `pageCount` quando não existem ocorrências físicas.

`Edition.publicationDate` é uma string canónica em `YYYY`, `YYYY-MM` ou `YYYY-MM-DD`. A precisão é derivada da forma do valor e não é persistida redundante; nunca se usa `Date`/`toISOString()` para estes dados bibliográficos.

## Riscos arquitecturais

### Históricos (resolvidos)

- **Modelo de biblioteca pessoal:** `Work.userId` e `Item.userId` foram removidos; `Organization` é agora o tenant único.[^4]
- **Autenticação e autorização:** password hashing Argon2id, access tokens curtos, refresh tokens rotativos/revogáveis e `/auth/me` já estão implementados.[^3]
- **Tenancy:** `Organization` e `OrganizationMembership` já existem; `Work.organizationId` e `Item.organizationId` são obrigatórios.
- **Descrição física:** `PhysicalDescription` + `PhysicalDescriptionPart` preservam ocorrências `215`, ordem, repetição e códigos desconhecidos válidos. `Edition.pageCount` é derivado e secundário.[^6][^9]

### Actuais (pendentes)

1. **Contributors:** não são ainda autoridades bibliográficas; falta `Agent`, `AgentName`, `AuthorityIdentifier` e `Contribution` com role codes.[^4]
2. **Proveniência versionada:** `BibliographicRecord` precisa de mais metadados (source, format, schema, encoding, hash, parserVersion, warnings) e deve suportar múltiplas versões/fontes por obra ou edição.
3. **Datas e texto original:** `publicationDate` já suporta precisão bibliográfica; permanece futuro preservar texto original adicional quando uma normalização não puder ser representada no modelo local.
4. **Normalização de dados:** `PhysicalDescription.normalizedValue` é ainda derivado manualmente; é futuro automatizar a normalização e a extracção de dimensões, material e ilustrações.
5. **Administração de memberships:** não existem endpoints para gerir membros, convidar utilizadores, alterar roles e selecção de organização activa.[^3]
6. **Library/Branch:** não existe modelo de filiais ou localizações subordinadas a Organization.[^4]
7. **Holdings e inventário:** não existe localização, cota, código de barras ou estado detalhado dos exemplares.
8. **Auditoria:** não existe tabela `AuditEvent` para acções como importação, correcção, empréstimo e alteração de permissões.
9. **Circulação:** não existe domínio de empréstimos, devoluções, reservas, políticas e multas.[^4]
10. **Formatos MARC:** MARCXML, ISO 2709 e MARC21 são ainda futuras implementações; mapeadores para perfis adicionais permanecem pendentes.

## Limitações actuais

O sistema está operacional para o fluxo de importação PORBASE e exportação local UNIMARC/MARCXchange. A integração Flutter é compatível com os campos actuais. As limitações conhecidas são:

- `PhysicalDescription.normalizedValue` não é preenchido automaticamente (design para permitir normalização inteligente futura);
- não existe UI de edição para descrições físicas (integração Flutter é aditiva e pode ser implementada em fase posterior);
- não existe controlo de autoridades para contribuidores;
- não existe versionamento de provenância (cada registo original substitui o anterior);
- não existe modelo de holdings, filiais ou circulação;
- não existe auditoria de acessos e alterações;
- exportação original (`BibliographicRecord.rawContent`) não tem endpoint dedicado;
- MARCXML, ISO 2709 e MARC21 não têm mappers ou serializadores.

## Desempenho e escalabilidade

### API e consultas

Os endpoints de lista precisam de paginação estável antes de o catálogo crescer. Evitar respostas que carregam todas as `works`, `editions`, contributors e items num único pedido. Usar `limit` limitado pelo servidor, cursor pagination para listas mutáveis e `select` explícito em Prisma.

Os índices actuais suportam os padrões de tenancy, ordenação e paginação:[^8]

- `User(createdAt, id)`;
- `Work(organizationId, createdAt, id)`;
- `Work(organizationId, updatedAt, id)` (a considerar);
- `Edition(workId, createdAt, id)`;
- `Edition(workId, updatedAt, id)` (a considerar);
- `Contributor(createdAt, id)`;
- `WorkContributor(workId, sortOrder, id)` e `WorkContributor(contributorId)`;
- `EditionContributor(editionId, sortOrder, id)` e `EditionContributor(contributorId)`;
- `ExternalIdentifier(editionId, createdAt, id)`;
- `BibliographicRecord(workId, createdAt, id)` e `BibliographicRecord(editionId, createdAt, id)`;
- `Item(organizationId, status, createdAt, id)`;
- `Item(organizationId, editionId)` (a considerar).

Para pesquisa de catálogo, `ILIKE '%termo%'` não será suficiente em escala. PostgreSQL oferece full-text search com `tsvector`, `tsquery` e o operador `@@`; também oferece ranking e pesquisa por relevância. A evolução recomendada é uma coluna de pesquisa denormalizada ou materializada para título, subtítulo, autores, ISBN, assuntos e identificadores, com índices GIN, além de trigramas para correspondência parcial e tolerância a acentos.[^10][^11][^12]

### Importação e exportação

Importações PORBASE individuais podem continuar síncronas no início. Importação de ficheiros MARC, lotes grandes, conversões e exports ISO 2709 devem ser jobs assíncronos: criar `ImportJob`/`ExportJob`, guardar progresso, erros por registo, idempotency key e resultado descarregável.

A exportação MARCXchange de um registo é pequena e pode permanecer síncrona. Exportar milhares de registos, converter ISO 2709 ou processar ficheiros deve sair do request HTTP para um worker. Isto evita timeouts, consumo excessivo de memória e bloqueio do processo API.

### Caching e limites

Não adicionar Redis já sem uma necessidade medida. Primeiro configurar pool, índices, paginação, observabilidade e cache HTTP onde fizer sentido. Redis será útil para rate limits distribuídos, jobs, locks e cache de pesquisas externas, não como substituto de um modelo de dados correcto.

Para PORBASE, manter timeouts curtos, retries limitados com backoff apenas para erros transitórios, circuit breaker e cache de respostas por ISBN com TTL. Nunca persistir automaticamente um preview como catálogo; a confirmação explícita deve continuar a ser obrigatória.[^5]

## Decisão sobre formatos MARC

A escolha de UNIMARC para o contexto português é coerente. A IFLA mantém documentação UNIMARC e descreve ferramentas e documentação relacionadas com formatos ISO 2709 e XML. O objectivo futuro de aceitar MARC21 e exportar vários formatos deve ser resolvido por perfis de mapeamento, não por tornar o Prisma um esquema UNIMARC.[^13][^1]

A estrutura `MarcRecord` actual deve ser evoluída para incluir:

```ts
type MarcRecord = {
  format: 'UNIMARC' | 'MARC21' | 'UNKNOWN';
  syntax: 'ISO2709' | 'MARCXCHANGE' | 'MARCXML' | 'TEXT';
  encoding: 'UTF-8' | 'MARC-8' | 'UNKNOWN';
  leader: string;
  controlFields: MarcControlField[];
  dataFields: MarcDataField[];
  source?: MarcProvenance;
};
```

O `syntax` e o `format` não devem ser confundidos. UNIMARC pode ser serializado em ISO 2709 ou MARCXchange; MARC21 também pode ser serializado em ISO 2709 ou MARCXML. A mesma estrutura intermédia deve suportar indicadores, subcampos e repetição.

Os mappers devem devolver resultado e warnings:

```text
MarcMappingResult
  record
  warnings[]
  unmappedFields[]
  lossy: boolean
```

Quando a saída for incompleta, a UI deve indicar que é um subconjunto exportado. Para uma futura exportação institucional, convém ter modos `strict` e `permissive`: o modo strict recusa perdas críticas; o permissive gera o ficheiro com relatório de warnings.

## Arquitetura futura recomendada

### Camadas

```text
Flutter Web/Mobile
        |
API / BFF NestJS
        |
Application services / use cases
        |
Domain model + authorization policies
        |
Repositories / Prisma
        |
PostgreSQL + object storage + worker queue
```

Os controllers devem permanecer finos. A lógica de importação, circulação e exportação deve viver em application services/use cases, com mappers e serializers puros testáveis sem NestJS.

### Módulos de domínio

A divisão actual por entidades é útil no início, mas o crescimento deve orientar os módulos para capacidades:

- Identity & Access
- Organizations & Memberships
- Cataloguing
- Bibliographic Sources & Provenance
- Holdings & Inventory
- Circulation
- Search
- Import/Export Jobs
- Audit & Observability

Isto reduz a dependência entre controllers de CRUD e regras de negócio. `WorksModule` não deve continuar a ser o proprietário implícito de todos os recursos bibliográficos à medida que surgem instituições e circulação.

### Eventos e auditoria

Acções como importação confirmada, correcção bibliográfica, empréstimo, devolução e alteração de permissões devem produzir eventos de auditoria. Não é necessário adoptar event sourcing completo; uma tabela append-only `AuditEvent` é suficiente inicialmente.

Os eventos podem ser usados mais tarde para notificações, sincronização e reconstrução de histórico sem transformar todo o domínio numa arquitectura distribuída prematuramente.

## Roadmap revisto

### Fase 0 — fundação e estabilização (concluída para o MVP)

Concluída:

- hashing seguro;
- access tokens e refresh tokens;
- `/auth/me`;
- tenancy por Organization;
- OrganizationMembership e roles;
- autorização por membership;
- paginação e índices;
- pool/timeouts;
- CI e testes principais.

Pendente antes de produção institucional:

- administração completa de memberships;
- convites;
- selecção de organização activa;
- políticas por filial;
- rate limiting;
- auditoria operacional;
- validação da migration no ambiente de destino.

### Fase 1 — fundação bibliográfica

Concluída:

- descrição física agrupada (`PhysicalDescription` + `PhysicalDescriptionPart`);
- preservação de ocorrências, subcampos, ordem e códigos desconhecidos de `215`;
- `pageCount` derivado conservativamente;
- `publicationDate` textual com precisão bibliográfica preservada;
- importação PORBASE transaccional;
- exportação local MARCXchange sem depender de `rawContent`;
- contrato Flutter coordenado;
- internacionalização da UI com `pt-PT` e `en`;
- códigos estáveis de erro API e warnings PORBASE.

Pendente:

- `PublicationStatement` para local, agente/editor e data de publicação;
- `Contribution` e evolução de contributors/roles;
- provenance versionada e metadados ricos;
- normalizações derivadas e não destrutivas;
- `MarcRecord` mais completo, incluindo encoding, syntax e relatório de perda;
- `SeriesStatement`;
- assuntos, classificações e notas;
- authority control;
- perfis/mappers adicionais, como MARC21.

### Fase 2 — catálogo e ficheiros

- importação MARCXchange/ISO 2709;
- preview por registo;
- deduplicação e idempotência;
- jobs de importação/exportação assíncronos;
- pesquisa de catálogo com full-text search PostgreSQL.

### Fase 3 — inventário institucional

- administração completa de memberships e selecção de organização activa;
- Library/Branch subordinada a Organization;
- holdings, localização, cota e código de barras;
- inventário e operações em lote;
- estados e histórico dos exemplares.

### Fase 4 — circulação

- patrons/membros da biblioteca;
- loans, returns e reservations;
- políticas, multas e notificações;
- permissões para bibliotecários e leitores;
- auditoria de empréstimos.

### Fase 5 — formatos e integrações

- exportação robusta de UNIMARC;
- ISO 2709 com encoding e validação independente;
- MARCXML separado de MARCXchange;
- MARC21 mapper e serializer;
- APIs/integrações externas adicionais;
- scanner ISBN e importações em lote.

## Decisões imediatas

1. **Evoluir descrição física para edição e normalização.** A primeira iteração backend (Phase 1) adiciona `PhysicalDescription` com subfield, value, sortOrder, source e normalizedValue. A próxima iteração deve permitir edição local, normalização automática de dimensões e material, e UI correspondente.

2. **Implementar contributions como autoridades.** Reuso conservador actual deve evoluir para `Agent`, `AgentName`, `AuthorityIdentifier` e `Contribution` com role codes controlados.

3. **Implementar administração completa de memberships.** Endpoints para gerir membros, convidar utilizadores, alterar roles e selecção de organização activa.

4. **Implementar Library/Branch e holdings.** Filiais e localizações subordinadas a Organization, com cota, código de barras e estado dos exemplares.

5. **Implementar circulação com entidades explícitas.** `Patron`, `Loan`, `LoanPolicy`, `Hold`, `ReturnEvent`, `Fine`.

6. **Implementar auditoria.** Tabela `AuditEvent` para acções importantes.

7. **Expandir suporte MARC.** MARCXML, ISO 2709 e MARC21 com mappers e serializadores separados.

## Não-objetivos explícitos

1. **Não modelar Prisma como UNIMARC.** A local source of truth é canónica; UNIMARC é um perfil de exportação entre muitos.

2. **Não implementar circulação com flags em Item.** Circulação exige entidades de domínio explícitas (Patron, Loan, LoanPolicy, etc).

3. **Não aceitar ownership de catálogo por userId.** Organization é o único tenant; utilizador é global e relacionado através de OrganizationMembership.

4. **Não descartar silenciosamente campos desconhecidos.** Quando a preservação for possível, guardar no MarcRecord; quando houver perda, emitir warnings estruturados.

5. **Não implementar versões de Prisma que sejam cópias de standards bibliográficos.** Padrões como UNIMARC definem formatos de intercâmbio, não esquemas relacionais. Usar mappers e serializadores.

6. **Não chamar PORBASE do Flutter.** O servidor-side é o único ponto de entrada; cache e rate limiting aplicam-se ali.

7. **Não automatizar persistência de previews.** Preview é proposta; confirmação é operação separada e idempotente.

## Conclusão

O projecto está na direcção certa. A fundação de tenancy por `Organization` foi implementada e validada, resolvendo o risco histórico de ownership por `userId`. A Fase 1 de descrição física repetível foi implementada no backend, com Flutter compatível e aditivo.

A próxima etapa é evoluir o modelo bibliográfico com contributions, proveniência versionada e auditoria, antes de implementar circulação e formatos avançados.

A recomendação prática é consolidar a fundação bibliográfica e administrativa, depois implementar circulação e formatos adicionais sem reescrever as relações centrais.

---

## References

1. [UNIMARC formats and related documentation](https://www.ifla.org/publications/unimarc-formats-and-related-documentation/)

2. [Introduction - UNIMARC](https://unimarc.org.ua/ifla/biblio2023/2023n1_0_0_UNIMARC_Introduction_4-7.pdf)

3. [CONTEXT-5.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/74e2103d-8f7a-47a4-a9fe-02e69b86dd52/CONTEXT-5.md)

4. [CONTEXT.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/bf995b35-e095-4a70-b6fa-fcfa642f5021/CONTEXT.md)

5. [AGENTS-2.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/5c6a1c95-4297-40dd-a77e-84646d8ec675/AGENTS-2.md)

6. [folio-cmtpp3zk10001hmv6jnwuycty.marcxchange.xml](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/db0d9e26-755d-48ea-a2b4-4f54af794500/folio-cmtpp3zk10001hmv6jnwuycty.marcxchange.xml)

7. [Connection pool | Prisma Documentation](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)

8. [Connecting to your database](https://www.prisma.io/docs/postgres/database/connecting-to-your-database)

9. [marcxchange.xml](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/cf824549-a60f-4b52-857b-a8810b8cfc0d/marcxchange.xml)

10. [Documentation: 18: Chapter 12. Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)

11. [PostgreSQL: Documentation: 18: 12.1. Introduction](https://www.postgresql.org/docs/current/textsearch-intro.html)

12. [Documentation: 18: 12.3. Controlling Text Search](https://www.postgresql.org/docs/current/textsearch-controls.html)

13. [UNIMARC Formats and Updates](https://www.ifla.org/unimarc-updates/)