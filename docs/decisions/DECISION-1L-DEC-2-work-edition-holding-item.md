# Decision: Work, Edition, Holding and Item

**Status:** Proposed for implementation  
**Date:** 2026-10-06  
**Scope:** Domain model, Prisma schema, API contracts, inventory boundaries, future circulation support

## 1. Context

Tomos já assumiu um modelo canónico com `Work`, `Edition` e `Item`, bem como `Agent` e `Contribution` para autoria e participação. A análise do FOLIO mostrou que o inventário bibliotecário precisa de separar claramente descrição bibliográfica, posse/localização e exemplar físico. No FOLIO, o Inventory usa `Instance → Holdings → Item`, com localização e cota ao nível de holdings e identificação/circulação ao nível do item.[web:76][web:81][web:78]

Tomos não deve copiar literalmente o modelo do FOLIO, porque quer preservar uma distinção mais expressiva entre obra intelectual (`Work`) e edição concreta (`Edition`). No entanto, deve adotar a mesma separação entre descrição e posse física.[page:1][web:76]

## 2. Problema

O modelo atual `Work → Edition → Item` é insuficiente para representar corretamente posse e localização física em cenários institucionais. Sem um nível intermédio, o sistema tende a empurrar para `Item` dados que pertencem ao conjunto de exemplares de uma edição dentro de uma biblioteca, como:

- localização permanente;
- cota partilhada;
- informação de coleção;
- volumes possuídos;
- configuração por biblioteca/localização.

Isto prejudica a clareza do domínio e dificulta circulação, inventário, relatórios e gestão multi-polo.

## 3. Decisão

### 3.1 Work representa a obra intelectual

`Work` representa a obra intelectual ou conceptual.

Exemplos:

- *Os Lusíadas* enquanto obra;
- *Dom Quixote* enquanto obra;
- um comentário jurídico enquanto obra.

`Work` não representa um exemplar físico nem uma posse específica de uma biblioteca.

### 3.2 Edition representa a edição concreta

`Edition` representa uma manifestação ou publicação concreta de uma obra.

Exemplos:

- edição de 1998 de uma obra;
- edição anotada de um texto jurídico;
- edição com ISBN e editora específicos.

`Edition` herda o contexto bibliográfico da `Work`, mas continua sem representar posse física direta.

### 3.3 Holding representa a posse/localização organizacional

`Holding` é introduzido entre `Edition` e `Item`.

`Holding` representa que uma determinada organização possui uma determinada edição numa determinada `Library` e `Location`, agregando dados partilhados pelos exemplares dessa posse.

Exemplos de dados próprios de `Holding`:

- `organizationId`;
- `libraryId`;
- `locationId`;
- `editionId`;
- cota base;
- notas de coleção;
- política local de circulação, se vier a existir;
- metadados operacionais da posse.

### 3.4 Item representa o exemplar físico individual

`Item` representa a cópia física individual e é a unidade de circulação.

Exemplos de dados próprios de `Item`:

- barcode;
- número de exemplar;
- estado;
- notas específicas do exemplar;
- disponibilidade;
- condição;
- dados próprios de empréstimo e circulação.

O FOLIO usa o item como unidade de empréstimo e rastreamento de estado; Tomos deve seguir este princípio.[web:38][web:73]

### 3.5 Estrutura aprovada

A estrutura aprovada é:

```text
Organization
└── Work
    └── Edition
        └── Holding
            └── Item
```

A estrutura física interna relevante é:

```text
Organization
└── Library
    └── Location
        └── Holding
            └── Item
```

Invariantes:

1. Uma `Work` pertence exatamente a uma `Organization`.
2. Uma `Edition` pertence exatamente a uma `Work`.
3. Uma `Holding` pertence exatamente a uma `Edition` e a uma `Location`.
4. Uma `Holding` pertence indiretamente a uma `Library` e a uma `Organization` através da `Location`.
5. Um `Item` pertence exatamente a uma `Holding`.
6. Um `Item` não deve guardar ownership redundante que possa divergir da `Holding`.
7. Nenhum `Holding` ou `Item` pode atravessar organizações.

### 3.6 Organization-scoped catalog na primeira fase

Tomos mantém, na primeira fase, `Work` e `Edition` scoped por `Organization`. Isto simplifica autorização, importação e evolução do produto, evitando introduzir já um catálogo bibliográfico global partilhado entre organizações.[cite:2][cite:5]

Uma eventual deduplicação ou catálogo coletivo cross-organization seria uma decisão futura própria.

### 3.7 Agent e Contribution são o modelo canónico

`Agent` e `Contribution` continuam a ser o modelo canónico para autoria, edição, tradução e outras participações. Não deve coexistir um modelo paralelo legacy de `Contributor` quando isso introduz duplicação conceptual ou ambiguidade de tenancy.[page:1]

### 3.8 Cover e identificadores externos

Capas, identificadores externos e registos bibliográficos devem alinhar-se com esta cadeia.

Regras gerais:

- `EditionCover` pertence ao nível de `Edition`;
- `CoverAsset` pode continuar scoped por organização;
- `ExternalIdentifier` deve ligar-se ao nível correto sem duplicar ownership contraditório;
- `BibliographicRecord` deve refletir claramente se representa dados da `Work`, da `Edition` ou da importação externa.

## 4. Consequências para a API

### 4.1 Criações root

Criar `Work` continua a ser uma operação root com contexto explícito de organização.

### 4.2 Criações derivadas

Criar `Edition`, `Holding` e `Item` deve derivar tenant dos respetivos parents persistidos:

- `Edition` deriva de `Work`;
- `Holding` deriva de `Edition` e `Location`;
- `Item` deriva de `Holding`.

Se um header explícito também existir, deve coincidir com o tenant derivado.[cite:5]

### 4.3 Listagens

Listagens root continuam a usar contexto explícito de organização. Filtros por `Library`, `Location`, `Holding` ou `Edition` refinam o resultado dentro do mesmo tenant.

## 5. Não objetivos

Esta decisão não define:

- regras detalhadas de circulação;
- políticas de empréstimo;
- pedidos/reservas;
- catálogo global partilhado;
- serials/periódicos;
- digital objects;
- volumes complexos ou bound-withs;
- modelo final de importação MARC.

Esses temas podem depender desta cadeia, mas exigem decisões próprias.

## 6. Critérios de aceitação

A decisão fica implementada quando:

- `Holding` existe formalmente no domínio e no schema;
- `Item` depende de `Holding` e não replica ownership divergente;
- localização física de inventário não está colapsada diretamente em `Item` sem justificação;
- `Work` e `Edition` mantêm a sua distinção canónica;
- o modelo legacy de `Contributor`, se incompatível, deixa de ser a via principal;
- contratos e documentação já descrevem a nova cadeia.

## 7. Regra final

Quando o código atual ou o schema atual estiverem em conflito com esta decisão, a prioridade é corrigir o modelo de domínio e não preservar simplificações transitórias apenas por já existirem.[cite:1][cite:3]
