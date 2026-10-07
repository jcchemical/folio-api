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

## Verificação do estado actual — 2026-10-07

A remoção do Contributor legacy está concluída na baseline actual:

- `prisma/schema.prisma` e `20261006150000_tomos_domain_baseline` contêm `Agent + Contribution`, XOR Work/Edition e trigger de igualdade de Organization; não contêm `Contributor`, `WorkContributor` ou `EditionContributor`.
- Não existe `src/contributors/**`, controller/rota `/contributors`, DTO ou service legacy.
- Works, Editions, import PORBASE, mapper UNIMARC e export projectam apenas Contributions canónicas; o mapper usa source parts persistidas e não sintetiza Contributions a partir de `Agent.displayName`.
- `POST /contributions` resolve Work/Edition persistido, valida Organization derivada, Agent do mesmo tenant, membership/STAFF e header opcional antes da escrita. A rota define `source=MANUAL`; não aceita fonte, tag 7XX, indicadores nem source parts do cliente.
- O import PORBASE usa Contributions canónicas e fixa `source=PORBASE` no servidor; preserva o subset de source parts suportado.
- Os testes de baseline confirmam ausência dos modelos/tabelas legacy e as constraints XOR/Agent-Organization.

Não inferir âmbito Work/Edition a partir da tag 7XX, `$4` ou texto de role. A existência de source metadata editável no contrato de confirmação PORBASE continua registada como uma limitação separada de proveniência; não reintroduzir Contributor para a resolver.

## Decisões históricas substituídas

As seguintes posições documentavam apenas a estratégia antiga e não são requisitos actuais:

- “Não houve rename, delete ou backfill” das tabelas legacy;
- manter ambos os modelos e escolher um set por alvo;
- rejeitar substituição imediata de Contributor por ser breaking;
- manter testes que impeçam a remoção das tabelas antigas.

Não usar estas posições para orientar a implementação. O alvo aprovado permite remover ou reescrever schema, migrations, contratos e testes sem camada transitória.

## Fora do âmbito desta decisão

A remoção do Contributor legacy não aprova controlo de autoridades. `AgentName`, variantes, identificadores de autoridade, merge/split, CRUD administrativo completo de Agents, famílias adicionais MARC e perfis MARC21 continuam fora do âmbito salvo decisão própria. Preservar apenas a proveniência e os elementos de contribuição suportados pelo contrato canónico aprovado.
