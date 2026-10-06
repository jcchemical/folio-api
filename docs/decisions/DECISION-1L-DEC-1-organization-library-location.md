# Decision: Organization, Library and Location

**Status:** Proposed for implementation  
**Date:** 2026-10-06  
**Scope:** Domain model, Prisma schema, API contracts, authorization boundaries, future circulation support

## 1. Context

Tomos é uma plataforma de gestão de bibliotecas para bibliotecas pessoais, organizações pequenas e redes municipais ou escolares. O projeto está em fase inicial, sem dados de produção nem compatibilidade externa a preservar, pelo que o modelo pode ser redesenhado livremente quando necessário.[cite:1][cite:2]

A análise comparativa com o FOLIO mostrou duas aprendizagens relevantes. Primeiro, a estrutura física e operacional da biblioteca deve ser modelada separadamente da fronteira principal de tenancy. Segundo, localizações internas têm impacto direto em inventário, circulação e pedidos, pelo que não devem ser tratadas como detalhe informal.[web:77][web:83][web:44]

## 2. Problema

Tomos já assumiu `Organization` como fronteira principal de tenancy, mas ainda precisa de fixar como representa bibliotecas concretas, polos e localizações internas.

Sem esta decisão, surgem ambiguidades como:

- tratar toda a organização como se fosse uma única biblioteca física;
- modelar polos como organizações independentes, multiplicando tenants desnecessariamente;
- guardar localização diretamente em `Item` sem estrutura intermédia clara;
- introduzir conceitos como `Branch`, `Campus` ou `ServicePoint` sem critério estável.

## 3. Decisão

### 3.1 Organization é a fronteira de tenancy

`Organization` continua a ser a fronteira única de tenancy do Tomos. Todos os recursos organizacionais pertencem exatamente a uma `Organization`, e não existe partilha implícita entre organizações.[cite:5]

Uma organização representa a entidade dona da biblioteca ou rede bibliotecária, por exemplo:

- uma pessoa com biblioteca pessoal;
- um escritório de advogados;
- um município;
- um agrupamento escolar.

### 3.2 Library é a unidade bibliotecária interna

Cada `Organization` pode conter uma ou mais `Library`.

`Library` representa uma biblioteca concreta, polo, unidade física ou unidade operacional dentro da organização. Este conceito deve cobrir, sem subclasses obrigatórias iniciais:

- a biblioteca pessoal padrão de um utilizador;
- uma biblioteca de escritório;
- uma biblioteca municipal específica;
- uma biblioteca escolar dentro de uma rede.

A escolha de `Library` é preferida a `Branch` porque é semanticamente mais neutra e mais adequada ao tipo de produto que Tomos pretende ser.

### 3.3 Location é a localização operacional e física

Cada `Library` pode conter uma ou mais `Location`.

`Location` representa a localização física ou operacional relevante para inventário e circulação, por exemplo:

- depósito;
- sala de leitura;
- reservas;
- estante temática;
- coleção especial;
- localização virtual/online, se esse caso vier a ser necessário.

No FOLIO, a localização participa diretamente em inventário, pedidos e circulação. Tomos deve preservar essa aprendizagem, mas com uma árvore interna mais simples.[web:77][web:76][web:44]

### 3.4 Estrutura aprovada

A estrutura aprovada é:

```text
Organization
└── Library
    └── Location
```

Invariantes:

1. Uma `Library` pertence exatamente a uma `Organization`.
2. Uma `Location` pertence exatamente a uma `Library`.
3. Uma `Location` herda indiretamente a `Organization` através da `Library`.
4. Nenhum recurso operacional pode referenciar simultaneamente `Organization` e `Library` de organizações diferentes.
5. Nenhum pedido pode atravessar organizações através de `Library` ou `Location`.

### 3.5 Não introduzir Campus nesta fase

O FOLIO usa uma hierarquia `Institution → Campus → Library → Location`. Tomos não deve copiar essa estrutura integral nesta fase. `Campus` não resolve um problema atual do produto e acrescentaria complexidade prematura.[web:77][web:82]

Se no futuro surgir necessidade real de representar um nível intermédio, essa necessidade deve ser resolvida por uma decisão própria, não por antecipação abstrata.

### 3.6 ServicePoint fica reservado para circulação

O FOLIO associa localizações e service points às operações de circulação e atribui service points a utilizadores de staff.[web:31][web:83]

Tomos não deve introduzir `ServicePoint` neste momento como parte do núcleo institucional. O conceito fica reservado para a fase de circulação, quando existirem check-in, checkout, pickup e fluxos operacionais que o justifiquem.

### 3.7 Caso da biblioteca pessoal

Uma organização pessoal deve poder funcionar com:

- uma `Library` padrão;
- uma `Location` padrão.

Esses defaults podem ser criados automaticamente ou via onboarding, mas essa decisão é de produto e implementação. O importante é que o modelo estrutural suporte o caso simples sem sacrificar o caso institucional.

## 4. Consequências para o modelo

### 4.1 Recursos físicos e de inventário

Recursos que representem posse, localização ou circulação devem ser ligados a `Library` e/ou `Location` quando fizer sentido. Isso inclui, no mínimo, o futuro modelo de `Holding` e os futuros domínios de circulação.[web:76][web:78]

### 4.2 Recursos bibliográficos

Recursos puramente bibliográficos não precisam de ser ligados diretamente a `Library` ou `Location` se pertencerem ao nível organizacional. A decisão sobre inventário físico é tratada separadamente na cadeia `Work → Edition → Holding → Item`.

### 4.3 Autorização

A autorização continua a ser validada por `OrganizationMembership`. `Library` e `Location` refinam o contexto operacional, mas não substituem a fronteira de tenancy nem a membership organizacional.[cite:5]

## 5. Não objetivos

Esta decisão não define:

- regras detalhadas de circulação;
- `ServicePoint`;
- `Campus`;
- consórcios;
- papéis por `Library`;
- permissões por `Location`;
- modelo detalhado de inventário.

Esses temas podem depender desta estrutura, mas exigem decisões próprias.

## 6. Critérios de aceitação

A decisão fica implementada quando:

- `Organization`, `Library` e `Location` existem no modelo de domínio com ownership inequívoco;
- `Library` e `Location` não são modeladas como organizações independentes;
- não existe `Campus` introduzido sem decisão própria;
- o schema impede relações cross-organization inválidas;
- documentação e contratos já refletem esta estrutura;
- futuras decisões de inventário e circulação podem referenciar esta cadeia sem ambiguidade.

## 7. Regra final

Sempre que o código atual estiver em conflito com esta decisão, a resposta preferida é reescrever o modelo ou os contratos e não preservar atalhos ou conceitos provisórios apenas porque já existem.[cite:1][cite:3]
