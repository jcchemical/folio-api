# Reavaliação arquitectural — Folio API

> Revisão: 2026-10-07. Este documento avalia a direcção e riscos arquitecturais; `CONTEXT.md` é a referência operacional do estado detalhado das rotas e configuração.

## 1. Síntese executiva

A arquitectura central continua coerente: monólito modular NestJS, PostgreSQL, tenancy por `Organization`, modelo bibliográfico canónico separado dos perfis MARC e fluxo de importação com confirmação explícita. A base possui autenticação e rotação de refresh token, memberships e roles, estruturas canónicas bibliográficas, export local MARCXchange, throttling, CORS configurável e aquisição/serving de capas.

A ligação Candidate → Asset → EditionCover está implementada com idempotência, isolamento tenant e preservação da selecção activa. A escrita bibliográfica geral também não mantém ainda todas as relações canónicas que o import cria.

## 2. Estado arquitectural actual

### Fundação implementada

- **Runtime e persistência:** NestJS 12, TypeScript ESM, Prisma 7, PostgreSQL e `pg.Pool` com valores configuráveis.
- **Identity & Access:** Argon2id, JWT curto, refresh hashado/rotativo/revogável, filtro global de erros e guards.
- **Tenancy:** Organization como única fronteira; contexto explícito/derivado com memberships actuais e roles `OWNER`, `ADMIN`, `STAFF`, `READER`.
- **Inventário físico:** `Organization → Library → Location` e `Organization → Work → Edition → Holding → Item`; Item conserva apenas atributos de exemplar e `holdingId`.
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

Organization é a fronteira única de acesso do catálogo e inventário; User é identidade global. Membership e role são validados no servidor. Não reintroduzir ownership por `userId`, nem tratar organização pessoal como modelo diferente. O JWT identifica apenas User; `X-Folio-Organization-Id` é obrigatório em listas/criações root ambíguas e opcional como verificação de consistência quando o parent/recurso persistido deriva o tenant. Organizations, Works, Editions, Libraries, Locations, Holdings e Items já usam esse contrato nas rotas migradas.

### Library, Location, Holding e Item

`Library` pertence a Organization e `Location` pertence a Library; nenhuma das duas é uma fronteira de tenancy. `Holding` liga exactamente uma Edition e uma Location, sem duplicar `organizationId`; a migration baseline valida por constraint triggers diferidos que `Edition → Work → Organization` e `Location → Library → Organization` coincidem. `Item` pertence somente a Holding e não duplica Edition, Library, Location ou Organization. Não há Campus, ServicePoint ou estados de circulação em Item.

### Registo original separado dos dados locais

`BibliographicRecord.rawContent` preserva payload de origem e não é sobrescrito por edição local. O resultado curado vive nas relações/campos locais. Confirmação de preview é uma operação explícita e não deve ser automatizada.

### Modelo canónico e perfis de intercâmbio

Literais, ordem, repetição, indicadores e partes suportadas devem manter-se independentes do formato externo. Mappers devem declarar campos não mapeados e perdas; não preencher diferenças de perfil inventando dados. Participações usam apenas `Agent + Contribution`; não existe fallback para Contributor legacy.

### PostgreSQL e monólito modular

As transacções, constraints e relações actuais justificam PostgreSQL. Manter monólito modular com services/use cases; controllers finos e lógica de domínio testável. Não decompor em microserviços por antecipação.

### Circulação explícita

Empréstimo, devolução, reserva, políticas e multas são conceitos próprios. Não codificar circulação em flags de `Item`.

## 4. Fronteiras de domínio e integração presente

### Identity, Organization e catálogo

Há self-service de organizações, mas não há selecção de organização activa, memberships administráveis, convites, alteração de roles ou branches. As rotas de Organizations/Works/Editions/Libraries/Locations/Holdings/Items/External Identifiers/Contributions/Bibliographic Records/Exports e a confirmação de import usam contexto explícito ou derivado. `POST /contributions` deriva tenant do único Work/Edition target; Agent tem de estar na mesma Organization e `source=MANUAL` é atribuído pelo servidor. `GET /bibliographic-records/:id` e `GET /exports/marcxchange/edition/:editionId` derivam Organization da Edition → Work e aceitam header opcional de consistência. O export exige membership Reader+, valida contexto antes de carregar o grafo e mascara a falta de acesso como `RESOURCE_NOT_FOUND` para não revelar existência cross-tenant; um header divergente para um membro retorna `ORGANIZATION_CONTEXT_CONFLICT`. As rotas e modelos Contributor legacy foram removidos. `POST /catalogues/import` exige header e STAFF+; o Work recebe Organization apenas do header e Editions derivam do Work. `POST /catalogues/search` permanece externo/context-free. `getDefaultOrganization()` permanece usado pelo onboarding pessoal, não por estas rotas.

PORBASE aceita variantes de pesquisa no DTO, mas implementa só ISBN. O preview não persiste. A confirmação envia o payload editável completo e não usa snapshot server-side nem repesquisa. Campos de metadata de contribuições (`sourceTag`, indicadores e source parts) continuam aceites no DTO de confirmação; a origem é marcada pelo servidor, mas a estrutura de origem apresentada pelo cliente não é autenticada contra o raw record. A rota manual de Contribution tem validação mais estrita. Esta fronteira merece decisão de segurança própria.

### Integração do modelo canónico

Schema e import PORBASE suportam grande parte da fundação Phase 1, e leitura/exportação consomem várias destas relações. Contudo, “modelo canónico implementado” não significa que todos os caminhos de escrita tenham migrado:

- CRUD regular Work/Edition continua a escrever escalares para certos conceitos e não mantém sempre WorkTitle/EditionTitle/EditionLanguage;
- o parser extrai 200$h/$i, mas não há armazenamento estruturado correspondente no schema;
- notas podem modelar Work e Edition, mas o contrato/import corrente oferece a cobertura mais completa na Edition;
- `BibliographicRecord` pertence apenas a Edition; o endpoint actual é read-only por ID, sem listagem root nem CRUD público. A proveniência continua básica, sem versionamento/hash/versão de parser.

Manter a classificação por percurso — parsing, preview, confirmação, CRUD normal, leitura e exportação — em vez de rotular genericamente uma “Phase 1 concluída”.

### Capas: componentes criados, ligação incompleta

O schema distingue candidato de aquisição (`CoverCandidate`), blob (`CoverAsset`) e associação servível (`EditionCover`). `CoverCandidate` deriva tenant por `BibliographicRecord → Edition → Work`; `EditionCover` por `Edition → Work`; `CoverAsset` mantém `organizationId` para dedupe/storage e nunca é autorização isolada. Triggers diferidos do baseline validam igualdade de organização nos vínculos Candidate/EditionCover a Asset, e índice único parcial garante no máximo uma EditionCover activa por Edition. O extractor detecta URLs 856; `SafeHttpFetcherService` aceita apenas HTTPS, valida allowlist, DNS/IP fixado, redirects, tempos, tamanho, MIME, magic bytes e descodificação; `StorageService` suporta filesystem/memória; o serviço adquire e deduplica assets.

`GET /editions/:id/cover` deriva organização por Edition → Work, usa `OrganizationContextResolver`, permite header opcional apenas como confirmação de igualdade e exige membership (Reader+). O OpenAPI documenta resposta binária, MIME, ETag/cache, 304 e erros de contexto/recurso. `coverUrl` é projectado também nas Editions aninhadas em respostas de Work; não existe rota pública para criar/alterar Candidates, Assets ou EditionCovers.

**Ligação implementada nesta iteração:** a Edition é resolvida apenas pelo `BibliographicRecord.editionId`; registos ligados só a Work mantêm o asset adquirido sem associação inventada. Uma transacção bloqueia Edition e Work, valida organização, cria/reutiliza `EditionCover` activa apenas se ainda não houver activa e grava `CoverCandidate.status=ACQUIRED`/`coverAssetId` na mesma transacção. A aquisição validada (fetch, armazenamento e upsert do `CoverAsset`) precede essa transacção. Se a associação falhar, a transacção reverte e agenda retry, mas mantém o asset/ficheiro já persistido; não remove assets potencialmente partilhados.

A migration baseline `20261006150000_tomos_domain_baseline` adiciona índice único parcial por Edition para linhas activas e aborta sem alterar dados se encontrar duplicados; a constraint já existe na baseline, não se cria uma migration adicional. O lock de Work serializa aquisições concorrentes do service entre processos; o índice protege também contra outros escritores. Não há worker/fila, lease/recuperação de estado ACQUIRING preso ou limite global de concorrência. S3 não está implementado. `COVER_ALLOWED_HOSTS` ausente resulta em allowlist vazia; `.env.example` não é carregado automaticamente. O extractor aceita `porbase.pt` e subdomínios, mas o fetcher usa allowlist exacta, pelo que essa diferença pode deixar candidatos sem aquisição. O fetcher agora rejeita HTTP em qualquer hop, incluindo downgrade de redirect.

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

Não há organização activa no JWT/servidor. As rotas root bibliográficas e de inventário migradas exigem contexto explícito; outras áreas ainda mantêm as próprias regras e precisam de migração incremental. O fallback OWNER permanece na confirmação PORBASE, fora desta fatia.

### Integridade catalográfica e proveniência

Confirmação de import aceita estruturas editáveis sem snapshot assinado/guardado no servidor. Partes 200$h/$i são extraídas mas não persistidas como conceitos estruturados. CRUD geral não mantém uniformemente relações canónicas. BibliographicRecord é Edition-owned; a resposta de import projecta-o sob Edition, não como uma segunda relação directa de Work.

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

`1L-DEC.0` está aprovada e o header `X-Folio-Organization-Id` e respectivos códigos estáveis estão implementados nas áreas migradas. A migração backend continua parcial; o selector/invalidação de contexto no cliente é dependência de contrato fora do escopo deste repositório.

### Busca local

Separar pesquisa do catálogo Folio da pesquisa nos providers externos. Avaliar extensão controlada de `GET /works`, full-text PostgreSQL (`tsvector`, ranking, GIN) e cursor consistente com a ordenação. Trigramas apenas se relevância/medição justificar. Sem Elasticsearch ou Redis nesta fase.

### Capas

Completar primeiro a associação Candidate/Asset/EditionCover, idempotência e recuperação após falha. Só então considerar processamento distribuído, quotas de download por organização e S3, com storage partilhado e política de ciclo de vida.

### Audit e captura

Adicionar auditoria de acções sem event sourcing completo. Na iteração `1M`, separar `ScanCapture`, maturidade/qualidade catalográfica, `ReviewTask` e `AuditEvent`; não os colapsar num enum `captured/identified/provisional/needsReview/validated` sem decisão de domínio.

## 8. Roadmap acordado — ordem actualizada

Estado nesta revisão: `1J-API.1` e `1L-DEC.0` estão implementadas/aprovadas; Organizations, Works, Editions e a cadeia de inventário físico estão migradas. Os restantes grupos de tenancy continuam pendentes.

### Próximas iterações

1. `1J-FLUTTER.1` — proteger a `CoverCache` contra respostas tardias de pedidos
	iniciados antes do logout ou mudança de geração de sessão.

2. `1L-FLUTTER.0` — selector de organização e invalidação de estado scoped;
	dependência de contrato e fora do repositório `folio-api`.

3. `1K-API.0` — contrato de listagem, pesquisa e ordenação da biblioteca.

4. `1K-API.1` — pesquisa local PostgreSQL.

5. `1K-FLUTTER.0` — paginação/infinite loading; dependência de contrato.

6. `1K-FLUTTER.1` — pesquisa e ordenação; dependência de contrato.

7. `1L-API.1` — memberships, convites e roles.

8. `1L-FLUTTER.1` — gestão de membros; dependência de contrato.

9. `1M` — captura, qualidade catalográfica, tarefas de revisão e auditoria como
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

1. Continuar a migração tenant dos grupos ainda não migrados; não reintroduzir fallback OWNER nem listas multi-organização nas rotas migradas.
2. Fechar a associação do asset adquirido à Edition e a política de capa activa antes de prometer disponibilidade via `coverUrl`.
3. Decidir como autenticar os dados de contribuição de origem na confirmação do catálogo (snapshot do preview ou rederivação server-side).
4. Definir estratégia de recuperação para candidatos ACQUIRING após falha de processo e coordenação se houver múltiplas réplicas.
5. Planejar migração gradual dos CRUDs escalares para relações canónicas e decidir explicitamente a preservação de 200$h/$i.
6. Corrigir/aceitar formalmente a política de redacção de mensagens/stacks e adicionar request ID antes de produção institucional.
7. Rever migrations por ambiente; não inferir estado aplicado do repositório.
