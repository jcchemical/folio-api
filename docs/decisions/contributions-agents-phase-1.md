# Contributions e Agents — Registo histórico da Phase 1

## Estado e precedência

**Estado:** registo histórico da implementação original da Phase 1; a direcção de preservação do Contributor legacy está **superseded**.

O alvo actual é definido por `DECISION-1L-DEC-2-work-edition-holding-item.md` e pelo contexto organizacional aprovado. Em caso de conflito, prevalece esse alvo, não as decisões provisórias de compatibilidade descritas neste registo.

## Modelo normativo actual

`Agent + Contribution` é o modelo canónico para autoria, edição, tradução e outras participações. `Agent` pertence a exactamente uma `Organization`; `Contribution` aponta para exactamente um `Work` ou `Edition` e o seu Agent tem de pertencer à mesma organização do alvo. O modelo deve preservar proveniência e partes suportadas sem tratar `Agent.displayName` como forma de autoridade.

`Contributor`, `WorkContributor` e `EditionContributor` não são tabelas-alvo obrigatórias. Os modelos, rotas, DTOs, serviços, relações de resposta, mappers, projecções e caminhos de fallback legacy devem ser removidos ou reescritos para usar apenas `Agent + Contribution`. Não manter um modo de compatibilidade nem uma escolha “canónico se existir, legacy caso contrário”.

## Histórico da implementação anterior — não normativo

A implementação original adicionou `Organization → Agent → Contribution → ContributionSourcePart[]`. `Agent` tinha Organization obrigatória, tipo, display name local e nome normalizado; `Contribution` usava source controlado (`PORBASE`/`MANUAL`) e um XOR Work/Edition reforçado por constraint SQL. Os serviços resolviam a organização pelo alvo e verificavam igualdade entre Agent e alvo.

O fluxo PORBASE da Phase 1 preservava um subset de 700/701/702, indicadores e `ContributionSourcePart` ordenadas, repetíveis e literais; `$2` contribuía para a scheme, e `$4` era preservado segundo o mapeamento implementado. O mapper local preferia Contributions canónicas e reconstruía campos a partir das partes persistidas, nunca apenas de `displayName`.

A implementação deixou intencionalmente as tabelas Contributor antigas e usava as relações canónicas quando presentes, recorrendo às relações legacy caso contrário. Essa escolha foi justificada originalmente por compatibilidade e migração gradual. **Essa justificação foi substituída pelo modelo greenfield aprovado:** não preservar tabelas ou fallbacks por causa de código, dados de teste ou consumidores inexistentes.

## Rechecks obrigatórios durante schema/API work

Antes de considerar a remoção concluída, rever e actualizar:

- `prisma/schema.prisma` e a migration de Agents/Contributions, retirando `Contributor`, `WorkContributor` e `EditionContributor` do schema final e reescrevendo/recriando a baseline de migrations conforme o modelo aprovado;
- `src/contributors/**` e o registo do módulo/controller, removendo as rotas CRUD legacy;
- leituras/projecções em Works, Editions e importação de catálogo que incluem Contributors ou escolhem legacy como fallback;
- `src/catalogues/porbase-import.service.ts`, parser/preview e DTOs, garantindo que participações persistidas usam o modelo canónico e que o cliente não controla metadata de proveniência que deve ser definida/reconstruída no servidor;
- `src/bibliography/mappers/unimarc-local.mapper.ts` e fixtures de export, removendo aliases e projections de `LocalContributorLink`, `editionContributors` e `workContributors`;
- export/import e respostas API, confirmando que o caminho canónico preserva, na medida suportada, tags, indicadores, ordem, repetição e literais de source parts;
- testes unitários/e2e e testes de migration. Em particular, `src/contributions/contributions.migration.spec.ts` contém uma expectativa histórica de que as tabelas Contributor não sejam removidas; substituir essa expectativa por verificações do schema/baseline final e da ausência dos modelos legacy.

Verificar também que cada `Contribution` continua a ter exactamente um alvo, que `Agent` e alvo pertencem à mesma `Organization`, e que operações root/child seguem as regras de contexto de DECISION-1L-DEC-0. Não inferir âmbito Work/Edition a partir da tag 7XX, `$4` ou texto de role.

## Decisões históricas substituídas

As seguintes posições documentavam apenas a estratégia antiga e não são requisitos actuais:

- “Não houve rename, delete ou backfill” das tabelas legacy;
- manter ambos os modelos e escolher um set por alvo;
- rejeitar substituição imediata de Contributor por ser breaking;
- manter testes que impeçam a remoção das tabelas antigas.

Não usar estas posições para orientar a implementação. O alvo aprovado permite remover ou reescrever schema, migrations, contratos e testes sem camada transitória.

## Fora do âmbito desta decisão

A remoção do Contributor legacy não aprova controlo de autoridades. `AgentName`, variantes, identificadores de autoridade, merge/split, CRUD administrativo completo de Agents, famílias adicionais MARC e perfis MARC21 continuam fora do âmbito salvo decisão própria. Preservar apenas a proveniência e os elementos de contribuição suportados pelo contrato canónico aprovado.
