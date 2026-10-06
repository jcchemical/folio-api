# Reavaliação arquitectural — Folio API

> Revisão: 2026-10-06. Este documento avalia a direcção e riscos arquitecturais; `CONTEXT.md` é a referência operacional do estado detalhado das rotas e configuração.

## 1. Síntese executiva

A arquitectura central continua coerente: monólito modular NestJS, PostgreSQL, tenancy por `Organization`, modelo bibliográfico canónico separado dos perfis MARC e fluxo de importação com confirmação explícita. A base possui autenticação e rotação de refresh token, memberships e roles, estruturas canónicas bibliográficas, export local MARCXchange, throttling, CORS configurável e aquisição/serving de capas.

A prioridade desta iteração é fechar a ligação Candidate → Asset → EditionCover com idempotência, isolamento tenant e preservação da selecção activa. A escrita bibliográfica geral também não mantém ainda todas as relações canónicas que o import cria.

## 2. Estado arquitectural actual

### Fundação implementada

- **Runtime e persistência:** NestJS 12, TypeScript ESM, Prisma 7, PostgreSQL e `pg.Pool` com valores configuráveis.
- **Identity & Access:** Argon2id, JWT curto, refresh hashado/rotativo/revogável, filtro global de erros e guards.
- **Tenancy:** Organization como fronteira de Work, Edition e Item; membership N:N com `OWNER`, `ADMIN`, `STAFF`, `READER`.
- **Catálogo externo:** contrato `CatalogueProvider`, provider PORBASE único, preview separado de persistência.
- **Modelo bibliográfico:** tabelas canónicas para títulos, responsabilidades, línguas, declarações, séries, notas, classificações, publicação, descrição física e contribuições.
- **Intercâmbio:** mapeamento de dados locais para UNIMARC e serialização MARCXchange separada.
- **Ficheiros:** storage interface com filesystem e memória de teste; fetcher com validação SSRF; aquisição/retries in-process; endpoint de capa protegido.
- **Protecção transversal:** throttling in-memory e CORS com suporte a `If-None-Match`/`ETag`.

### Pipeline bibliográfico

```text
modelo canónico Folio
→ mapper do perfil
→ MarcRecord
→ serializer
→ formato de saída
```

```text
payload externo
→ parser
→ MarcRecord/preview editável
→ confirmação explícita
→ persistência canónica e proveniência
```

O modelo Prisma não é UNIMARC, MARC 21, MARCXchange, MARCXML ou ISO 2709. MARCXchange e MARCXML são serializações distintas. A exportação local usa dados persistidos, não `BibliographicRecord.rawContent`.

## 3. Decisões implementadas que devem ser preservadas

### Organization como tenant

Organization é a fronteira de acesso do catálogo e inventário; User é identidade global. Membership e role são validados no servidor. Não reintroduzir ownership por `userId`, nem tratar organização pessoal como modelo diferente.

### Registo original separado dos dados locais

`BibliographicRecord.rawContent` preserva payload de origem e não é sobrescrito por edição local. O resultado curado vive nas relações/campos locais. Confirmação de preview é uma operação explícita e não deve ser automatizada.

### Modelo canónico e perfis de intercâmbio

Literais, ordem, repetição, indicadores e partes suportadas devem manter-se independentes do formato externo. Mappers devem declarar campos não mapeados e perdas; não preencher diferenças de perfil inventando dados. Dados legados mantêm fallback por alvo, sem misturar sets canónicos e legados.

### PostgreSQL e monólito modular

As transacções, constraints e relações actuais justificam PostgreSQL. Manter monólito modular com services/use cases; controllers finos e lógica de domínio testável. Não decompor em microserviços por antecipação.

### Circulação explícita

Empréstimo, devolução, reserva, políticas e multas são conceitos próprios. Não codificar circulação em flags de `Item`.

## 4. Fronteiras de domínio e integração presente

### Identity, Organization e catálogo

Há self-service de organizações, mas não há selecção de organização activa, memberships administráveis, convites, alteração de roles ou branches. Work creation e confirmação PORBASE sem `organizationId` usam fallback para a organização OWNER mais antiga. Esse fallback é compatibilidade transitória, não substituto para contexto tenant explícito.

PORBASE aceita variantes de pesquisa no DTO, mas implementa só ISBN. O preview não persiste. A confirmação envia o payload editável completo e não usa snapshot server-side nem repesquisa. Campos de metadata de contribuições (`sourceTag`, indicadores e source parts) continuam aceites no DTO de confirmação; a origem é marcada pelo servidor, mas a estrutura de origem apresentada pelo cliente não é autenticada contra o raw record. A rota manual de Contribution tem validação mais estrita. Esta fronteira merece decisão de segurança própria.

### Integração do modelo canónico

Schema e import PORBASE suportam grande parte da fundação Phase 1, e leitura/exportação consomem várias destas relações. Contudo, “modelo canónico implementado” não significa que todos os caminhos de escrita tenham migrado:

- CRUD regular Work/Edition continua a escrever escalares para certos conceitos e não mantém sempre WorkTitle/EditionTitle/EditionLanguage;
- o parser extrai 200$h/$i, mas não há armazenamento estruturado correspondente no schema;
- notas podem modelar Work e Edition, mas o contrato/import corrente oferece a cobertura mais completa na Edition;
- `BibliographicRecord` ainda tem proveniência básica, sem versionamento/hash/versão de parser e sem constraint que alinhe Work e Edition referenciados.

Manter a classificação por percurso — parsing, preview, confirmação, CRUD normal, leitura e exportação — em vez de rotular genericamente uma “Phase 1 concluída”.

### Capas: componentes criados, ligação incompleta

O schema distingue candidato de aquisição (`CoverCandidate`), blob (`CoverAsset`) e associação servível (`EditionCover`). O extractor detecta URLs 856; `SafeHttpFetcherService` valida allowlist, DNS/IP fixado, redirects, tempos, tamanho, MIME, magic bytes e descodificação; `StorageService` suporta filesystem/memória; o serviço adquire e deduplica assets; o endpoint requer membership e suporta ETag/cache condicional.

**Ligação implementada nesta iteração:** a Edition é resolvida apenas pelo `BibliographicRecord.editionId`; registos ligados só a Work mantêm o asset adquirido sem associação inventada. Uma transacção bloqueia Edition e Work, valida organização, cria/reutiliza `EditionCover` activa apenas se ainda não houver activa e grava `CoverCandidate.status=ACQUIRED`/`coverAssetId` na mesma transacção. A aquisição validada (fetch, armazenamento e upsert do `CoverAsset`) precede essa transacção. Se a associação falhar, a transacção reverte e agenda retry, mas mantém o asset/ficheiro já persistido; não remove assets potencialmente partilhados.

A migration `20261006120000_one_active_edition_cover` adiciona índice único parcial por Edition para linhas activas. Antes de criar o índice, aborta sem alterar dados se encontrar duplicados; é necessária resolução explícita desses dados para aplicar a migration. O lock de Work serializa aquisições concorrentes do service entre processos; o índice protege também contra outros escritores. Não há worker/fila, lease/recuperação de estado ACQUIRING preso ou limite global de concorrência. S3 não está implementado; allowlist vazia continua a ser o default efectivo se `COVER_ALLOWED_HOSTS` faltar; `coverUrl` continua projectado apenas nas respostas directas de Edition, não nas Editions aninhadas em Work/import.

Uma falha de persistência do asset após `StorageService.save` pode deixar bytes órfãos, mas não cria associação incompleta. Uma Edition removida entre a leitura inicial e a transacção resulta em candidato ACQUIRED/asset sem EditionCover. Esta iteração não cria uma regra de substituição automática: uma capa activa existente é sempre preservada.

## 5. Riscos resolvidos ou reduzidos

- **Ownership pessoal acoplado a User:** substituído por Organization e membership.
- **Passwords/tokens em claro:** password e refresh hashados; refresh rotativo e revogável.
- **Preview persistido implicitamente:** preview e confirmação são operações separadas.
- **Export a partir do raw record:** export local usa dados curados e pipeline mapper/serializer.
- **XOR de Contribution/Note apenas em controller:** check SQL para exactamente um target.
- **Abuso sem quotas HTTP:** `ThrottlerGuard` global e overrides para auth/signup, catálogo e listagens.
- **Cache condicional incompatível com browsers:** CORS permite `If-None-Match` e expõe `ETag`.
- **Fetch externo sem validação SSRF:** allowlist, DNS pinning, bloqueio de IPs especiais e limites de imagem no fetcher.

Estas medidas reduzem riscos, mas não removem limitações identificadas na integração nem são evidência de deployment/configuração de produção.

## 6. Riscos e lacunas actuais

### Prioridade de produto/tenancy

Sem organização activa, requests não identificam explicitamente o contexto tenant. Fallback para a primeira/mais antiga membership OWNER pode seleccionar contexto não pretendido quando um utilizador tem várias organizações. É o principal checkpoint arquitectural próximo.

### Integridade catalográfica e proveniência

Confirmação de import aceita estruturas editáveis sem snapshot assinado/guardado no servidor. Partes 200$h/$i são extraídas mas não persistidas como conceitos estruturados. CRUD geral não mantém uniformemente relações canónicas. BibliographicRecord pode ligar simultaneamente Work e Edition sem garantir consistência entre eles.

### Capas

Candidate → Asset → EditionCover activa está ligado no fluxo de aquisição, com lock transaccional e índice único parcial de capa activa. Estados ACQUIRING sem lease não são recuperados automaticamente após queda de processo. Sweep periódico é síncrono/sequencial por instância; não existe fila nem coordenação global de retries. Storage pode reter bytes sem associação se a transacção posterior falhar, permitindo retry sem apagar assets partilhados.

### Segurança operacional

- `ApiExceptionFilter` escreve mensagem e stack de excepções no log sem aplicar redacção ao conteúdo da excepção; não regista request bodies/headers por defeito.
- Não existe request/correlation ID.
- Rate-limit storage é in-memory e não coordena réplicas.
- Com allowlist de capa ausente, fetcher falha fechado; isto é seguro, mas precisa de configuração explícita.

### Consulta e performance

Cursor limita o nível superior, não a fanout de relações incluídas. Alguns padrões de ordenação não coincidem com índices e algumas listas não têm desempate explícito. Medir antes de optimizar. Não há pesquisa local full-text.

### Deployment/migrations

O repositório contém migrations, mas estado aplicado depende de cada ambiente. `20260907180000_refine_bibliographic_model` contém `DROP TABLE PhysicalDescription` e declara intenção de reset de desenvolvimento; qualquer aplicação deve ser revista contra dados e histórico do ambiente de destino.

## 7. Arquitectura futura recomendada

### Contexto organizacional explícito

Formalizar em `1L-DEC.0` e implementar depois. Proposta para decisão, não contrato aprovado:

- contexto tenant explícito em cada request, possivelmente `X-Folio-Organization-Id`;
- membership sempre verificada no servidor;
- organização activa fora do JWT;
- preferência cliente não é autoridade;
- nenhuma selecção implícita da primeira organização;
- mudança de contexto invalida estado scoped no cliente.

Nome final do header e códigos de erro ainda requerem decisão formal. A componente Flutter é dependência de contrato e está fora do escopo deste repositório.

### Busca local

Separar pesquisa do catálogo Folio da pesquisa nos providers externos. Avaliar extensão controlada de `GET /works`, full-text PostgreSQL (`tsvector`, ranking, GIN) e cursor consistente com a ordenação. Trigramas apenas se relevância/medição justificar. Sem Elasticsearch ou Redis nesta fase.

### Capas

Completar primeiro a associação Candidate/Asset/EditionCover, idempotência e recuperação após falha. Só então considerar processamento distribuído, quotas de download por organização e S3, com storage partilhado e política de ciclo de vida.

### Audit e captura

Adicionar auditoria de acções sem event sourcing completo. Na iteração `1M`, separar `ScanCapture`, maturidade/qualidade catalográfica, `ReviewTask` e `AuditEvent`; não os colapsar num enum `captured/identified/provisional/needsReview/validated` sem decisão de domínio.

## 8. Roadmap acordado — ordem actualizada

Estado nesta revisão: `1J-API.1` está implementada e validada; `1J-FLUTTER.1`
é a próxima dependência; `1L-DEC.0` continua futuro.

### Próxima iteração

1. `1J-API.1` — completar a associação automática `CoverAsset → EditionCover`,
	garantir idempotência, coerência de tenancy e servir a capa adquirida.

2. `1J-FLUTTER.1` — proteger a `CoverCache` contra respostas tardias de pedidos
	iniciados antes do logout ou mudança de geração de sessão.

### Depois da estabilização das capas

3. `1L-DEC.0` — decisão formal sobre contexto organizacional explícito.

4. `1L-API.0` — resolução explícita do contexto da organização e isolamento de
	tenancy.

5. `1L-FLUTTER.0` — selector de organização e invalidação de estado scoped;
	dependência de contrato e fora do repositório `folio-api`.

6. `1K-API.0` — contrato de listagem, pesquisa e ordenação da biblioteca.

7. `1K-API.1` — pesquisa local PostgreSQL.

8. `1K-FLUTTER.0` — paginação/infinite loading; dependência de contrato.

9. `1K-FLUTTER.1` — pesquisa e ordenação; dependência de contrato.

10. `1L-API.1` — memberships, convites e roles.

11. `1L-FLUTTER.1` — gestão de membros; dependência de contrato.

12. `1M` — captura, qualidade catalográfica, tarefas de revisão e auditoria como
	 conceitos separados.

## 9. Não-objectivos

- Não modelar Prisma como cópia de UNIMARC/MARC 21.
- Não persistir preview sem confirmação.
- Não usar `rawContent` como dados locais curados ou como export local.
- Não autorizar por `userId` do body.
- Não confundir MARCXchange e MARCXML.
- Não fazer circulação através de flags em Item.
- Não introduzir Redis, microserviços, Elasticsearch ou filas sem volume/necessidade medidos.
- Não tratar estados futuros de captura/revisão como enum já aprovado.

## 10. Decisões imediatas

1. Formalizar contexto organizacional e contrato tenant em `1L-DEC.0`; não cristalizar header antes da decisão.
2. Fechar a associação do asset adquirido à Edition e a política de capa activa antes de prometer disponibilidade via `coverUrl`.
3. Decidir como autenticar os dados de contribuição de origem na confirmação do catálogo (snapshot do preview ou rederivação server-side).
4. Definir estratégia de recuperação para candidatos ACQUIRING após falha de processo e coordenação se houver múltiplas réplicas.
5. Planejar migração gradual dos CRUDs escalares para relações canónicas e decidir explicitamente a preservação de 200$h/$i.
6. Corrigir/aceitar formalmente a política de redacção de mensagens/stacks e adicionar request ID antes de produção institucional.
7. Rever migrations por ambiente; não inferir estado aplicado do repositório.
