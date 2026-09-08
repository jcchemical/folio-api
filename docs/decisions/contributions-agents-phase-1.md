# Contributions e Agents — Phase 1

## Contexto

O legado usa `Contributor`, `WorkContributor` e `EditionContributor`. Este
modelo não preserva organização do agente, tag/indicadores 7XX, partes
repetidas, `$2`, `$4` ou a forma literal de acesso. Também força o export a
inferir tags a partir de um papel textual.

## Decisão implementada

Foi adicionado o modelo canónico `Organization → Agent → Contribution →
ContributionSourcePart[]`. Agent tem Organization obrigatória, kind, display
name local e nome normalizado derivado, sem unicidade nem alegação de controlo
de autoridade. Contribution usa source controlado (`PORBASE`/`MANUAL`) e tem
um alvo XOR Work/Edition, garantido por CHECK SQL.

O serviço resolve a Organization através do alvo e valida igualdade com Agent
em toda escrita. Um Agent de outra Organization produz o conflito estável
`CONFLICT_AGENT_ORGANIZATION_MISMATCH`.

## Importação e exportação

PORBASE aceita apenas 700/701/702 nesta fase, sempre Work-targeted. Mantém tag,
indicadores e `ContributionSourcePart` ordenadas, repetíveis e literais. `$2`
deriva a scheme; `$4` permanece repetível e só mapeamentos documentados criam
`roleLabel`. O `displayName` de pessoa deriva só de `$a` e `$b`.

O mapper local prefere Contributions canónicas e gera campos UNIMARC a partir
das partes persistidas, através de `MarcRecord`. Nunca reconstrói partes a
partir de displayName.

## Compatibilidade

Não houve rename, delete ou backfill de Contributor/WorkContributor/
EditionContributor. Por target, Contributions canónicas são exclusivas quando
existem; caso contrário o fallback legado é exclusivo. Isto impede duplicação
em registos que contenham os dois modelos durante a transição.

## Alternativas rejeitadas

- Renomear/substituir Contributor imediatamente: breaking para contratos e
  dados existentes.
- Um access point concatenado: perderia subcampos, repetições e ordem.
- Agents globais: violariam a fronteira de tenancy e sugeririam autoridade.

## Consequências e futuro

O modelo permite re-export fiel do subset 7XX, mas não é ainda controlo de
autoridades. `AgentName`, variantes, identificadores de autoridade, merge/split,
CRUD de agents, 710/711/712/720, 703, links `$5/$6/$8` semânticos e perfis
MARC21 permanecem Phase 2 ou posteriores. As partes disponíveis podem ser
preservadas agora sem afirmar suporte semântico para esses elementos.