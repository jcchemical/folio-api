# Reavaliação da Arquitectura Folio

## Síntese executiva

A direcção conceptual está correcta: separar o registo original da PORBASE, o modelo local editável, o mapeamento de perfil e a serialização MARC é a decisão mais importante tomada até agora. O uso de PostgreSQL + Prisma + NestJS + Flutter também é adequado para crescer de uma biblioteca pessoal para uma plataforma multi-instituição, desde que sejam corrigidos alguns limites antes de adicionar muitas funcionalidades.

A recomendação principal é **não abandonar a arquitectura actual, mas interromper temporariamente a expansão de exportadores e fazer uma iteração de fundação do domínio**. O risco maior não está no Flutter, no NestJS ou no PostgreSQL; está no modelo bibliográfico e no modelo de autoridade/posse: `pages: Int`, contributors demasiado simples, `Item.userId` como fronteira de propriedade, ausência de memberships/roles de instituição, e armazenamento de proveniência pouco versionado.

O padrão MARC intermédio criado como `MarcRecord` é uma boa base para serializadores. UNIMARC foi concebido para intercâmbio internacional e a estrutura MARC é composta por estrutura do registo, designadores de conteúdo e conteúdo; ISO 2709 e MARCXchange são representações relacionadas mas distintas. O `MarcRecord` deve, contudo, evoluir para preservar encoding, leader actualizado, campos de controlo, indicadores, subcampos, ordem, proveniência e warnings de perda.[^1][^2]

## Escopo e estado actual

O contexto fornecido descreve uma API NestJS 12 com TypeScript ESM, Prisma 7, PostgreSQL, JWT e Swagger, e uma app Flutter multiplataforma com Riverpod, Dio, `go_router` e armazenamento seguro do token. O fluxo implementado já cobre login, pesquisa ISBN server-side na PORBASE, preview, confirmação transaccional, edição do preview, warnings estruturados, biblioteca, detalhe de edição e exportação local MARCXchange.[^3][^4][^5]

A importação distingue correctamente preview de confirmação: o preview não persiste dados; a confirmação usa o utilizador autenticado, uma transacção e não volta a contactar a PORBASE. Esta separação é importante e deve ser mantida quando forem acrescentados importação de ficheiros, jobs assíncronos e revisão humana.[^5]

A exportação local já não copia `rawContent`: usa `Edition`, `Work`, contributors e identificadores através de um mapper UNIMARC e de um serializer MARCXchange. A comparação com o XML original demonstra que a exportação local é deliberadamente mais pequena; isso é aceitável como primeira versão, desde que as perdas sejam explícitas e o modelo futuro consiga absorver os campos em falta.[^4][^6]

## Decisões que estão certas

### Separação de proveniência

Manter o `rawContent` como registo original imutável, separado dos dados locais corrigidos, é a decisão certa. Permite auditoria, comparação, reprocessamento com um parser melhor e exportação original sem sobrescrever a curadoria local. O `rawContent` não deve ser a fonte da exportação local.

A melhoria necessária é transformar `BibliographicRecord` num registo de proveniência mais rico: fonte, formato, schema, remoteId, hash do payload, data de aquisição, versão do parser, estado de parsing e warnings. Se o mesmo título for importado de PORBASE, MARC21 ou um ficheiro local várias vezes, deve ser possível conservar várias fontes/registos, não apenas um payload indistinto.

### Modelo canónico mais serializadores

A cadeia `modelo local → mapper de perfil → MarcRecord → serializer` é correcta. Evita que Prisma fique acoplado a UNIMARC e permite no futuro mapear para MARC21, MARCXchange, MARCXML, ISO 2709, Dublin Core ou BIBFRAME sem duplicar todo o domínio.

O `MarcRecord` actual deve ser tratado como uma representação de intercâmbio, não como o modelo canónico completo. Deve suportar pelo menos `recordFormat`, `characterEncoding`, `leader`, control fields, data fields, indicators, subfields, ordem e metadados de conversão. Para preservar campos desconhecidos, não se deve depender apenas de mappers que conhecem os campos actuais.

### PostgreSQL e Prisma

PostgreSQL é uma escolha sólida para catálogo, circulação, permissões e transacções. Prisma 7 com driver `pg` fornece pool de conexões; a documentação indica que o tamanho e timeouts dependem do driver adapter, cujo default `max` para `pg` é 10 e cujo timeout de conexão por defeito pode ser ilimitado, pelo que estes valores devem ser configurados explicitamente para produção.[^7]

A escala não deve ser optimizada prematuramente trocando de base de dados. Deve-se primeiro garantir índices, paginação, queries selectivas, limites de payload, pool configurado, métricas e testes de carga. Para tráfego concorrente, a aplicação deve usar pool; migrações, introspecção e ferramentas administrativas devem usar conexão directa quando a infraestrutura fornecer ambas.[^8]

## Riscos arquitecturais actuais

### 1. Modelo de biblioteca ainda é pessoal

O schema actual associa `Work` a `userId`, permite `institutionId` opcional e associa `Item` a `userId` e `editionId`. Isto funciona para a biblioteca pessoal, mas não modela uma biblioteca institucional real. Uma biblioteca municipal precisa de distinguir organização, bibliotecas/filiais, acervo, cópias, membros, funcionários, papéis, empréstimos e políticas.[^4]

O risco é semear dados institucionais com `userId` como proprietário e depois ter de migrar todas as queries e regras de autorização. A correcção deve começar agora: introduzir uma fronteira explícita de tenant, mesmo que inicialmente exista uma única organização pessoal por utilizador.

Modelo conceptual recomendado:

```text
User
Organization / Institution
OrganizationMembership(User, Organization, Role)
Library / Branch(Organization)
Work
Expression (futuro, opcional)
Manifestation / Edition
Item / Holding
Loan / Reservation / Fine
```

`Work` representa a entidade intelectual; `Edition` representa uma manifestação/publicação; `Item` representa uma cópia física ou unidade gerível. Para uma biblioteca institucional, a propriedade e autorização devem ser determinadas por `OrganizationMembership`, não apenas por `Item.userId`.

### 2. Autenticação e autorização insuficientes para produção

O contexto ainda descreve login temporário que compara `passwordHash` directamente, ausência de refresh tokens e ausência de perfil restaurado após reinício. Isto é aceitável no protótipo, mas deve ser tratado como bloqueador antes de dados reais de bibliotecas.[^3]

A ordem recomendada é:

- armazenar passwords com Argon2id ou bcrypt, nunca o valor recebido;
- alterar o contrato para `password`, mantendo a UI com “Palavra-passe”;
- implementar access tokens curtos e refresh tokens revogáveis/rotativos;
- adicionar endpoint `/auth/me`;
- introduzir memberships e roles;
- aplicar autorização por organização, filial e operação;
- limitar endpoints CRUD administrativos;
- adicionar rate limiting, auditoria e política de password.

JWT resolve autenticação de pedidos, mas não substitui autorização granular. Um utilizador autenticado não deve automaticamente poder ler, editar ou exportar todos os recursos que tenham apenas um `userId` relacionado.

### 3. `Edition` não representa a descrição física

O campo `pages: Int?` é inadequado para UNIMARC `215$a`. O exemplo fornecido contém `146, [^6] p.`, que é texto bibliográfico complexo, pode repetir e pode coexistir com dimensão, ilustrações e outros subcampos. Substituir simplesmente por `physicalDescription: String?` melhora o caso imediato, mas ainda limita a repetibilidade e a estrutura.[^6][^9]

Recomendação faseada:

1. manter temporariamente `pages` para compatibilidade e pesquisa simples;
2. adicionar `physicalDescriptions` como entidade repetível com `editionId`, `subfield`, `value`, `sortOrder`, `source` e `normalizedValue` opcional;
3. mapear `215$a`, `$b`, `$c`, `$d` sem os concatenar irreversivelmente;
4. mostrar uma descrição legível na UI;
5. usar a estrutura repetível na exportação.

Exemplo:

```prisma
model PhysicalDescription {
  id             String @id @default(cuid())
  editionId      String
  subfield       String
  value          String
  sortOrder      Int    @default(0)
  source         String?
  normalizedValue String?

  edition Edition @relation(fields: [editionId], references: [id], onDelete: Cascade)
  @@index([editionId, sortOrder])
}
```

O `pages` numérico pode continuar como um valor derivado para filtros, estatísticas e UI, mas não deve ser a fonte de verdade bibliográfica. Um parser que não consegue extrair um número não deve rejeitar uma descrição física válida; deve emitir warning e preservar o texto.

### 4. Contributors não são ainda autoridades bibliográficas

`Contributor` associado por `role` e `sortOrder` é suficiente para o MVP, mas não para uma biblioteca municipal. É necessário distinguir entidade pessoa/corporativa, nome preferido, formas variantes, identificadores de autoridade, datas, língua e fonte do nome. A função bibliográfica também não deve ficar apenas numa string livre se será mapeada para códigos UNIMARC/MARC21.

Evolução recomendada:

```text
Agent / Contributor
AgentName
AuthorityIdentifier
Contribution(edition/work, agent, roleCode, relatorCode, sortOrder, source)
```

A tabela de mapeamento de papéis deve ser configurável por perfil, com warnings quando um papel local não tiver representação segura no destino. Não inventar `702$4` ou equivalentes apenas para evitar perda aparente.

### 5. Registo MARC original precisa de versão e proveniência

`BibliographicRecord` como `rawContent` associado a work/edition é um bom começo, mas não chega para importação repetida e conversão futura. Deve suportar múltiplos registos por entidade e fonte:

```text
BibliographicRecord
  id
  source
  sourceRecordId
  format
  schema
  characterEncoding
  rawContent / objectStorageKey
  contentHash
  acquiredAt
  parserVersion
  status
  warnings
  workId?
  editionId?
```

Para payloads pequenos, PostgreSQL pode armazenar texto/XML; para ficheiros grandes, MARC batches e originais importados, object storage com hash e metadados reduz pressão na base de dados. O catálogo deve guardar a referência e o checksum, não obrigatoriamente todos os binários grandes na mesma tabela.

### 6. Ausência de domínio de circulação

Empréstimos não devem ser adicionados directamente a `Item` com vários flags. Criar entidades explícitas:

```text
Patron / LibraryMember
Loan
LoanPolicy
Hold / Reservation
ReturnEvent
Fine / Fee
```

Um `Loan` deve guardar item, membro, biblioteca/filial, estado, datas previstas e efectivas, actor que emprestou/devolveu e timestamps. A operação de empréstimo deve ser transaccional e impedir dois empréstimos activos para o mesmo item. Índices e constraints parciais no PostgreSQL devem ser considerados para garantir esta invariável também sob concorrência.

## Desempenho e escalabilidade

### API e consultas

Os endpoints de lista precisam de paginação estável antes de o catálogo crescer. Evitar respostas que carregam todas as `works`, `editions`, contributors e items num único pedido. Usar `limit` limitado pelo servidor, cursor pagination para listas mutáveis e `select` explícito em Prisma.

Os índices prioritários incluem:

- `Work(userId, updatedAt, id)`;
- `Work(institutionId, updatedAt, id)`;
- `Edition(workId, updatedAt, id)`;
- ISBN normalizado com índices adequados;
- `Item(userId, editionId)`;
- `Item(institutionId, status)`;
- `Contribution(workId/editionId, sortOrder)`;
- `BibliographicRecord(source, sourceRecordId)`;
- `Loan(itemId, status)`;
- `Loan(memberId, status)`.

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

### Fase 0 — estabilização e segurança

- Corrigir password hashing.
- Implementar `/auth/me`, refresh token e revogação.
- Rever ownership e autorização.
- Adicionar paginação e limites a todas as listas.
- Configurar índices e pool/timeouts.
- Remover contratos temporários de `passwordHash`.
- Adicionar CI com build, lint, testes e migrações.

### Fase 1 — fundação bibliográfica

- Introduzir `Organization`/`Membership` de forma compatível com biblioteca pessoal.
- Expandir descrição física repetível.
- Criar proveniência versionada/import events.
- Evoluir contributors para contributions, roles e authority identifiers.
- Corrigir data como precisão bibliográfica, não apenas `DateTime`.
- Expandir `MarcRecord` com encoding, syntax e warnings de perda.

### Fase 2 — catálogo utilizável

- Importação de ficheiros MARCXchange/ISO 2709.
- Preview por registo e relatório de warnings.
- Deduplicação/idempotência por identificadores e source record ID.
- Pesquisa paginada por título, autor, ISBN e assunto.
- Edição bibliográfica com histórico/auditoria.

### Fase 3 — inventário institucional

- Libraries/branches.
- Holdings e localização.
- Número de chamada, classificação, códigos de barras e estados do item.
- Inventário e operações em lote.

### Fase 4 — circulação

- Membros/patronos.
- Empréstimos, devoluções, reservas e políticas.
- Permissões para bibliotecários, gestores e leitores.
- Auditoria e notificações.

### Fase 5 — formatos e integrações

- Exportação/importação UNIMARC robusta.
- ISO 2709 com encoding e validação independente.
- MARCXML separado.
- MARC21 mapper.
- APIs/integrações externas adicionais.
- Scanner ISBN e importações em lote.

## Decisões imediatas

1. **Não remover `pages` sem migração de compatibilidade.** Introduzir descrição física repetível e tratar `pages` como derivado.
2. **Não implementar já mais serializers.** Primeiro rever o `MarcRecord` para encoding, syntax, leader e warnings de perda.
3. **Não criar circulação em cima de `Item.userId`.** Introduzir organização, membership, biblioteca/filial e autorização antes dos empréstimos.
4. **Não aceitar ficheiros MARC directamente no request da API em produção.** Criar jobs de importação com limites e resultados por registo.
5. **Não adicionar Redis ou microserviços por antecipação.** A arquitectura modular de um monólito NestJS é suficiente para a próxima escala.
6. **Fazer uma migração de segurança antes de biblioteca institucional real.** Password hashing, refresh tokens, perfil, RBAC e auditoria são prioritários.

## Conclusão

O projecto está na direcção certa, mas a próxima etapa não deve ser mais uma funcionalidade de exportação isolada. O melhor investimento é uma iteração de fundação que transforme a biblioteca pessoal actual num núcleo multi-tenant compatível com instituições, sem sacrificar a velocidade do MVP.

A recomendação prática é congelar momentaneamente o mapper/exporter, corrigir segurança e tenancy, e evoluir o modelo bibliográfico com `PhysicalDescription`, proveniência versionada e contributions. Depois disso, a importação de ficheiros MARC e a circulação poderão ser acrescentadas sem reescrever as relações centrais.

---

## References

1. [UNIMARC formats and related documentation](https://www.ifla.org/publications/unimarc-formats-and-related-documentation/)

2. [Introduction - UNIMARC](https://unimarc.org.ua/ifla/biblio2023/2023n1_0_0_UNIMARC_Introduction_4-7.pdf)

3. [CONTEXT-5.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/74e2103d-8f7a-47a4-a9fe-02e69b86dd52/CONTEXT-5.md?AWSAccessKeyId=ASIA2F3EMEYE4LDBJUXO&Signature=0GAdytTBdV%2FNWuAa3VTikLxylGE%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEF4aCXVzLWVhc3QtMSJGMEQCID%2BzDYj4Zf%2BprxdzKk4lhaTPO8kNAKLyyovSkXfB%2FRuCAiBxwRNcUEwG7JHpUV6tXMr0s%2BbgBAzCgZL8d6kTEKaK7SrzBAgnEAEaDDY5OTc1MzMwOTcwNSIM78QigDSGRCQ09Zv7KtAE8VGgAz0wdyVPKEZd1Ha2KuKEcV%2BDhuo%2BB9Yb%2FQU3B35SC%2FNAUdEowx4CUSaxaWnf0eTgfaM3br%2F9aChpnYhs0OtUlnSRRpuSFOPETfJfpnGHdDgDEeJHvu%2FoUOPkIdC7j5km6fL7zPtL67feK9Ii3%2B3y%2B1%2FQQZVRpcYZXJ1jGoV3lzpAUxrA9Fqq5bPA8mZCcwmojJW9XJetLyJdhFg7rjHQobLHieIKIcalSKCnGCplN4ho6yIrwScfvD82s9aTPb6iUd%2BhyaS3gzzzQg%2Fg33IzCD9s8FasXS3%2BJj6We7dQorMVcaZIp0Vd5pG7ikg3Hn3mRzWvcIVB7VP885WJQDdbFyEXMU6QINuSi8Z0oq%2Befq4fr39VZZFLlLxrEW46zhuaXD5rvqVYYda5AZSGca9bOXBOqSZms3Y9Z4tcgCufYgnTLaCLOt36lDnbjspkdPNziG6cn3SM3Ggr3WmEqUh5UqdNI23V6HGBpFnNt%2FbgMMeZJG5HyIXBgKOX0rFHn6l730vRUfyMv8GO%2BwgFNVOI4t%2BtdhEB%2FvhMBUGExDyjbTWNG3bzkgS5vBsarDzl2RBQ25c5xYEsbM2E1UJEOOPTRGrswPANrP1rlT8J7BofWHlkWmdAiNsu3RNISNySqRZHcQ4WFtgMSolc%2Bcwgv0S0dPN7K%2Bj4Y8K%2B3mZ30GQk6R%2FQj%2BSqwX00Xpf10XRVyoFgKIyvHJIk47LRDY5rCT%2B%2BZj%2F3Tpu6t4OI541b7FdWI8OKZbK0E0yg45PSOC0hSiDWKMTm8B0nXp3qnB63MzDq4fXUBjqZAe6wSv1YkeTiPFSmnGfwpmQnJ1Wv%2FWr5zwQXG3tPAUGMiSf5qS3WnNu%2FJ479Lrx18svpdQgR%2FnLJqRYnG9lFPZq60AuFploHQO7wVTsqi%2F7p4M4due2kBpIUs%2B7iLxYxgfH%2B4Py3Xs6V8G2ntbyXrS2vsM2oL5PNACdYefnAi9ecQWkoOKq6mNf4zlTE%2B3PgghfM033MQikyhQ%3D%3D&Expires=1788706493) - # Folio App — Contexto do Projeto

## Objetivo

Cliente Flutter multiplataforma da Folio, uma biblio...

4. [CONTEXT.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/bf995b35-e095-4a70-b6fa-fcfa642f5021/CONTEXT.md?AWSAccessKeyId=ASIA2F3EMEYE4LDBJUXO&Signature=aF4TRtZATenA7fiyDGATIeQa5Ss%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEF4aCXVzLWVhc3QtMSJGMEQCID%2BzDYj4Zf%2BprxdzKk4lhaTPO8kNAKLyyovSkXfB%2FRuCAiBxwRNcUEwG7JHpUV6tXMr0s%2BbgBAzCgZL8d6kTEKaK7SrzBAgnEAEaDDY5OTc1MzMwOTcwNSIM78QigDSGRCQ09Zv7KtAE8VGgAz0wdyVPKEZd1Ha2KuKEcV%2BDhuo%2BB9Yb%2FQU3B35SC%2FNAUdEowx4CUSaxaWnf0eTgfaM3br%2F9aChpnYhs0OtUlnSRRpuSFOPETfJfpnGHdDgDEeJHvu%2FoUOPkIdC7j5km6fL7zPtL67feK9Ii3%2B3y%2B1%2FQQZVRpcYZXJ1jGoV3lzpAUxrA9Fqq5bPA8mZCcwmojJW9XJetLyJdhFg7rjHQobLHieIKIcalSKCnGCplN4ho6yIrwScfvD82s9aTPb6iUd%2BhyaS3gzzzQg%2Fg33IzCD9s8FasXS3%2BJj6We7dQorMVcaZIp0Vd5pG7ikg3Hn3mRzWvcIVB7VP885WJQDdbFyEXMU6QINuSi8Z0oq%2Befq4fr39VZZFLlLxrEW46zhuaXD5rvqVYYda5AZSGca9bOXBOqSZms3Y9Z4tcgCufYgnTLaCLOt36lDnbjspkdPNziG6cn3SM3Ggr3WmEqUh5UqdNI23V6HGBpFnNt%2FbgMMeZJG5HyIXBgKOX0rFHn6l730vRUfyMv8GO%2BwgFNVOI4t%2BtdhEB%2FvhMBUGExDyjbTWNG3bzkgS5vBsarDzl2RBQ25c5xYEsbM2E1UJEOOPTRGrswPANrP1rlT8J7BofWHlkWmdAiNsu3RNISNySqRZHcQ4WFtgMSolc%2Bcwgv0S0dPN7K%2Bj4Y8K%2B3mZ30GQk6R%2FQj%2BSqwX00Xpf10XRVyoFgKIyvHJIk47LRDY5rCT%2B%2BZj%2F3Tpu6t4OI541b7FdWI8OKZbK0E0yg45PSOC0hSiDWKMTm8B0nXp3qnB63MzDq4fXUBjqZAe6wSv1YkeTiPFSmnGfwpmQnJ1Wv%2FWr5zwQXG3tPAUGMiSf5qS3WnNu%2FJ479Lrx18svpdQgR%2FnLJqRYnG9lFPZq60AuFploHQO7wVTsqi%2F7p4M4due2kBpIUs%2B7iLxYxgfH%2B4Py3Xs6V8G2ntbyXrS2vsM2oL5PNACdYefnAi9ecQWkoOKq6mNf4zlTE%2B3PgghfM033MQikyhQ%3D%3D&Expires=1788706493) - # Contexto do Projeto Folio API

> Atualizado em: 2026-09-04

## Vis Geral

API NestJS para gestão d...

5. [AGENTS-2.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/5c6a1c95-4297-40dd-a77e-84646d8ec675/AGENTS-2.md?AWSAccessKeyId=ASIA2F3EMEYE4LDBJUXO&Signature=O31z9zffN7bcvAFmw6UFvT6%2F8nk%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEF4aCXVzLWVhc3QtMSJGMEQCID%2BzDYj4Zf%2BprxdzKk4lhaTPO8kNAKLyyovSkXfB%2FRuCAiBxwRNcUEwG7JHpUV6tXMr0s%2BbgBAzCgZL8d6kTEKaK7SrzBAgnEAEaDDY5OTc1MzMwOTcwNSIM78QigDSGRCQ09Zv7KtAE8VGgAz0wdyVPKEZd1Ha2KuKEcV%2BDhuo%2BB9Yb%2FQU3B35SC%2FNAUdEowx4CUSaxaWnf0eTgfaM3br%2F9aChpnYhs0OtUlnSRRpuSFOPETfJfpnGHdDgDEeJHvu%2FoUOPkIdC7j5km6fL7zPtL67feK9Ii3%2B3y%2B1%2FQQZVRpcYZXJ1jGoV3lzpAUxrA9Fqq5bPA8mZCcwmojJW9XJetLyJdhFg7rjHQobLHieIKIcalSKCnGCplN4ho6yIrwScfvD82s9aTPb6iUd%2BhyaS3gzzzQg%2Fg33IzCD9s8FasXS3%2BJj6We7dQorMVcaZIp0Vd5pG7ikg3Hn3mRzWvcIVB7VP885WJQDdbFyEXMU6QINuSi8Z0oq%2Befq4fr39VZZFLlLxrEW46zhuaXD5rvqVYYda5AZSGca9bOXBOqSZms3Y9Z4tcgCufYgnTLaCLOt36lDnbjspkdPNziG6cn3SM3Ggr3WmEqUh5UqdNI23V6HGBpFnNt%2FbgMMeZJG5HyIXBgKOX0rFHn6l730vRUfyMv8GO%2BwgFNVOI4t%2BtdhEB%2FvhMBUGExDyjbTWNG3bzkgS5vBsarDzl2RBQ25c5xYEsbM2E1UJEOOPTRGrswPANrP1rlT8J7BofWHlkWmdAiNsu3RNISNySqRZHcQ4WFtgMSolc%2Bcwgv0S0dPN7K%2Bj4Y8K%2B3mZ30GQk6R%2FQj%2BSqwX00Xpf10XRVyoFgKIyvHJIk47LRDY5rCT%2B%2BZj%2F3Tpu6t4OI541b7FdWI8OKZbK0E0yg45PSOC0hSiDWKMTm8B0nXp3qnB63MzDq4fXUBjqZAe6wSv1YkeTiPFSmnGfwpmQnJ1Wv%2FWr5zwQXG3tPAUGMiSf5qS3WnNu%2FJ479Lrx18svpdQgR%2FnLJqRYnG9lFPZq60AuFploHQO7wVTsqi%2F7p4M4due2kBpIUs%2B7iLxYxgfH%2B4Py3Xs6V8G2ntbyXrS2vsM2oL5PNACdYefnAi9ecQWkoOKq6mNf4zlTE%2B3PgghfM033MQikyhQ%3D%3D&Expires=1788706493) - # Folio API agent guidance

## Project context

- Read `CONTEXT.md` before changing application beha...

6. [folio-cmtpp3zk10001hmv6jnwuycty.marcxchange.xml](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/db0d9e26-755d-48ea-a2b4-4f54af794500/folio-cmtpp3zk10001hmv6jnwuycty.marcxchange.xml?AWSAccessKeyId=ASIA2F3EMEYE4LDBJUXO&Signature=xYumx8HeRF1ZAXE78gNVhhThiTA%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEF4aCXVzLWVhc3QtMSJGMEQCID%2BzDYj4Zf%2BprxdzKk4lhaTPO8kNAKLyyovSkXfB%2FRuCAiBxwRNcUEwG7JHpUV6tXMr0s%2BbgBAzCgZL8d6kTEKaK7SrzBAgnEAEaDDY5OTc1MzMwOTcwNSIM78QigDSGRCQ09Zv7KtAE8VGgAz0wdyVPKEZd1Ha2KuKEcV%2BDhuo%2BB9Yb%2FQU3B35SC%2FNAUdEowx4CUSaxaWnf0eTgfaM3br%2F9aChpnYhs0OtUlnSRRpuSFOPETfJfpnGHdDgDEeJHvu%2FoUOPkIdC7j5km6fL7zPtL67feK9Ii3%2B3y%2B1%2FQQZVRpcYZXJ1jGoV3lzpAUxrA9Fqq5bPA8mZCcwmojJW9XJetLyJdhFg7rjHQobLHieIKIcalSKCnGCplN4ho6yIrwScfvD82s9aTPb6iUd%2BhyaS3gzzzQg%2Fg33IzCD9s8FasXS3%2BJj6We7dQorMVcaZIp0Vd5pG7ikg3Hn3mRzWvcIVB7VP885WJQDdbFyEXMU6QINuSi8Z0oq%2Befq4fr39VZZFLlLxrEW46zhuaXD5rvqVYYda5AZSGca9bOXBOqSZms3Y9Z4tcgCufYgnTLaCLOt36lDnbjspkdPNziG6cn3SM3Ggr3WmEqUh5UqdNI23V6HGBpFnNt%2FbgMMeZJG5HyIXBgKOX0rFHn6l730vRUfyMv8GO%2BwgFNVOI4t%2BtdhEB%2FvhMBUGExDyjbTWNG3bzkgS5vBsarDzl2RBQ25c5xYEsbM2E1UJEOOPTRGrswPANrP1rlT8J7BofWHlkWmdAiNsu3RNISNySqRZHcQ4WFtgMSolc%2Bcwgv0S0dPN7K%2Bj4Y8K%2B3mZ30GQk6R%2FQj%2BSqwX00Xpf10XRVyoFgKIyvHJIk47LRDY5rCT%2B%2BZj%2F3Tpu6t4OI541b7FdWI8OKZbK0E0yg45PSOC0hSiDWKMTm8B0nXp3qnB63MzDq4fXUBjqZAe6wSv1YkeTiPFSmnGfwpmQnJ1Wv%2FWr5zwQXG3tPAUGMiSf5qS3WnNu%2FJ479Lrx18svpdQgR%2FnLJqRYnG9lFPZq60AuFploHQO7wVTsqi%2F7p4M4due2kBpIUs%2B7iLxYxgfH%2B4Py3Xs6V8G2ntbyXrS2vsM2oL5PNACdYefnAi9ecQWkoOKq6mNf4zlTE%2B3PgghfM033MQikyhQ%3D%3D&Expires=1788706493) - 00000nam a2200000 a 4500
cmtpp3zk10001hmv6jnwuycty
9789898236005
por
Miséria e grandeza do amor de B...

7. [Connection pool | Prisma Documentation](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool) - This page explains how Prisma ORM manages database connections using a connection pool, and how you ...

8. [Connecting to your database](https://www.prisma.io/docs/postgres/database/connecting-to-your-database)

9. [marcxchange.xml](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/154563503/cf824549-a60f-4b52-857b-a8810b8cfc0d/marcxchange.xml?AWSAccessKeyId=ASIA2F3EMEYE4LDBJUXO&Signature=OEm4FCTx2pre4snsurlVq%2F3miVQ%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEF4aCXVzLWVhc3QtMSJGMEQCID%2BzDYj4Zf%2BprxdzKk4lhaTPO8kNAKLyyovSkXfB%2FRuCAiBxwRNcUEwG7JHpUV6tXMr0s%2BbgBAzCgZL8d6kTEKaK7SrzBAgnEAEaDDY5OTc1MzMwOTcwNSIM78QigDSGRCQ09Zv7KtAE8VGgAz0wdyVPKEZd1Ha2KuKEcV%2BDhuo%2BB9Yb%2FQU3B35SC%2FNAUdEowx4CUSaxaWnf0eTgfaM3br%2F9aChpnYhs0OtUlnSRRpuSFOPETfJfpnGHdDgDEeJHvu%2FoUOPkIdC7j5km6fL7zPtL67feK9Ii3%2B3y%2B1%2FQQZVRpcYZXJ1jGoV3lzpAUxrA9Fqq5bPA8mZCcwmojJW9XJetLyJdhFg7rjHQobLHieIKIcalSKCnGCplN4ho6yIrwScfvD82s9aTPb6iUd%2BhyaS3gzzzQg%2Fg33IzCD9s8FasXS3%2BJj6We7dQorMVcaZIp0Vd5pG7ikg3Hn3mRzWvcIVB7VP885WJQDdbFyEXMU6QINuSi8Z0oq%2Befq4fr39VZZFLlLxrEW46zhuaXD5rvqVYYda5AZSGca9bOXBOqSZms3Y9Z4tcgCufYgnTLaCLOt36lDnbjspkdPNziG6cn3SM3Ggr3WmEqUh5UqdNI23V6HGBpFnNt%2FbgMMeZJG5HyIXBgKOX0rFHn6l730vRUfyMv8GO%2BwgFNVOI4t%2BtdhEB%2FvhMBUGExDyjbTWNG3bzkgS5vBsarDzl2RBQ25c5xYEsbM2E1UJEOOPTRGrswPANrP1rlT8J7BofWHlkWmdAiNsu3RNISNySqRZHcQ4WFtgMSolc%2Bcwgv0S0dPN7K%2Bj4Y8K%2B3mZ30GQk6R%2FQj%2BSqwX00Xpf10XRVyoFgKIyvHJIk47LRDY5rCT%2B%2BZj%2F3Tpu6t4OI541b7FdWI8OKZbK0E0yg45PSOC0hSiDWKMTm8B0nXp3qnB63MzDq4fXUBjqZAe6wSv1YkeTiPFSmnGfwpmQnJ1Wv%2FWr5zwQXG3tPAUGMiSf5qS3WnNu%2FJ479Lrx18svpdQgR%2FnLJqRYnG9lFPZq60AuFploHQO7wVTsqi%2F7p4M4due2kBpIUs%2B7iLxYxgfH%2B4Py3Xs6V8G2ntbyXrS2vsM2oL5PNACdYefnAi9ecQWkoOKq6mNf4zlTE%2B3PgghfM033MQikyhQ%3D%3D&Expires=1788706493) - 00836nam  2200265   450
2509976
http://id.bnportugal.gov.pt/bib/porbase/2509976
978-989-8236-00-5
PT...

10. [Documentation: 18: Chapter 12. Full Text Search](https://www.postgresql.org/docs/current/textsearch.html) - Chapter 12. Full Text Search · 1. Manipulating Documents · 12.4. · 2. Manipulating Queries · 12.4. ·...

11. [PostgreSQL: Documentation: 18: 12.1. Introduction](https://www.postgresql.org/docs/current/textsearch-intro.html) - Full Text Searching (or just text search) provides the capability to identify natural-language docum...

12. [Documentation: 18: 12.3. Controlling Text Search](https://www.postgresql.org/docs/current/textsearch-controls.html) - 12.3. Controlling Text Search # 12.3.1. Parsing Documents 12.3.2. Parsing Queries 12.3.3. Ranking Se...

13. [UNIMARC Formats and Updates](https://www.ifla.org/unimarc-updates/) - User Controlled Generic MARC Converter (USEMARCON) (A generic toolkit for ISO 2709 compatible MARC f...

