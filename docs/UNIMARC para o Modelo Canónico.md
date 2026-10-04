# UNIMARC para o Modelo Canónico

## Escopo e critério

Este relatório classifica campos e subcampos do **UNIMARC Bibliográfico, edição online 1.1.0 (2024, versão oficial endossada em 2025)** para orientar um modelo canónico bibliográfico de uma aplicação portuguesa. A classificação não é uma propriedade normativa do UNIMARC: é uma decisão de modelação baseada em quatro critérios: frequência transversal entre tipos de recursos, valor para pesquisa e apresentação, preservação semântica na conversão e capacidade de exportação para outros formatos.

O UNIMARC foi criado pela IFLA para facilitar o intercâmbio internacional de dados bibliográficos e funciona como formato portador de informação, não como um esquema de domínio completo. A norma cobre monografias, publicações continuadas, cartografia, música, gravações sonoras, materiais gráficos, vídeo, recursos electrónicos, livros raros e recursos arquivísticos.[^1][^2]

A classificação usa três níveis:

- **Essencial e comum** — deve ter representação explícita no modelo canónico.
- **Importante mas variável** — deve ter estruturas repetíveis e normalizadas, mas não necessariamente uma coluna ou propriedade simples.
- **Raro ou específico** — deve ser conservado no registo original, numa extensão ou num mapa de conversão; só merece representação explícita quando o produto suportar o tipo de recurso ou quando for necessário para uma conversão concreta.

A distinção entre “essencial” e “importante” não significa que os campos UNIMARC com estatuto `M` sejam todos obrigatórios na aplicação. No manual, `M` significa obrigatório em cada registo, `MA` obrigatório quando aplicável e disponível, e `O` opcional. Os campos universalmente obrigatórios no formato incluem `001`, `100`, `200` e `801`; no entanto, um modelo de produto pode tratar `001` e `801` como proveniência técnica e não como dados bibliográficos apresentados ao utilizador.[^3][^1]

## Princípio de modelação

O modelo canónico não deve copiar etiquetas como `200$a` ou `210$c`. Deve representar semântica: `title`, `contributors`, `publication`, `physicalDescription`, `subjects`, `identifiers` e `provenance`. O adaptador UNIMARC conserva a relação exacta entre a semântica canónica e a etiqueta/subcampo de origem.

Isto é especialmente importante porque uma conversão UNIMARC–MARC 21 não é, em geral, uma substituição um-para-um: a Library of Congress define regras específicas para indicadores, pontuação, subcampos, nomes, títulos e campos de controlo.  Portanto, a retenção de dados raros deve privilegiar a perda mínima e a reversibilidade, não a criação de dezenas de propriedades de negócio.[^4][^5][^6][^7]

## Resumo por blocos

| Bloco | Conteúdo UNIMARC | Decisão recomendada |
|---|---|---|
| Record Label e 00- | Estrutura, controlo e identificadores do registo | Guardar parcialmente em proveniência técnica |
| 0-- | Identificação do recurso | Essencial para identificadores; resto variável |
| 1-- | Dados codificados | Essencial para idioma/tipo/data; resto condicional |
| 2-- | Descrição bibliográfica | Essencial para título, edição, publicação e descrição física |
| 3-- | Notas | Estrutura repetível; resumo, conteúdos e notas gerais têm prioridade |
| 4-- | Ligações entre recursos | Estrutura de relações; importante, não uma lista plana |
| 5-- | Títulos relacionados/variantes | Importante e repetível; variantes de título são muito úteis |
| 6-- | Assuntos, classificações e história bibliográfica | Estrutura repetível; classificações e assuntos separados |
| 7-- | Responsabilidades intelectuais | Essencial como estrutura repetível de agentes e funções |
| 8-- | Uso internacional e localização electrónica | Proveniência, acesso e holdings; parte é essencial para recursos digitais |
| 9-- | Uso nacional | Extensão preservada, não núcleo internacional |

A própria organização oficial divide o formato nestes blocos funcionais e descreve o bloco 2 como informação descritiva, o 3 como notas, o 4 como ligações, o 5 como títulos relacionados, o 6 como análise de assunto/história bibliográfica e o 7 como responsabilidades.[^8][^1]

## Essencial e comum

### Identificação, controlo e proveniência

| Campo/subcampo | Semântica canónica | Decisão |
|---|---|---|
| `001` | Identificador do registo | `recordId` de origem; não confundir com ISBN |
| `003` | Identificador persistente do registo | `recordPersistentId` |
| `005` | Identificador de versão/data de revisão | `recordVersion` ou `updatedAt` de origem |
| `010$a` | ISBN válido | `identifiers[]`, tipo `isbn` |
| `010$b` | Qualificação do ISBN | `identifier.qualifier` |
| `010$z` | ISBN erróneo | `identifiers[]`, estado `invalid` |
| `011$a` | ISSN | `identifiers[]`, tipo `issn` |
| `011$b` | Qualificação do ISSN | `identifier.qualifier` |
| `013$a` | ISMN | `identifiers[]`, tipo `ismn` |
| `015$a` | Número internacional de relatório técnico | `identifiers[]`, tipo `technicalReport` |
| `016$a` | ISRC | `identifiers[]`, tipo `isrc` |
| `017$a` | Outro identificador normalizado | `identifiers[]`, com tipo/origem |
| `020$a` | Número de bibliografia nacional | `identifiers[]`, tipo `nationalBibliography` |
| `021$a` | Número de depósito legal | `identifiers[]`, tipo `legalDeposit` |
| `022$a` | Número de publicação governamental | `identifiers[]`, tipo `governmentPublication` |
| `033$a` | Identificador persistente de outro sistema | `identifiers[]`, tipo e sistema |
| `035$a` | Outro identificador de sistema | `identifiers[]`, origem e valor |
| `071$a` | Número do editor | `identifiers[]`, tipo `publisherNumber` |
| `072$a` | UPC | `identifiers[]`, tipo `upc` |
| `073$a` | EAN | `identifiers[]`, tipo `ean` |
| `100$a` | Dados gerais de processamento | `recordProcessing` estruturado; nunca perder o original |
| `101$a` | Língua do recurso | `languages[]` |
| `102$a` | País de publicação/produção | `publication.country` |
| `200$a` | Título próprio | `title.main` |
| `200$d` | Título paralelo | `title.parallel[]` |
| `200$e` | Outra informação de título | `title.other` ou `title.subtitle` |
| `200$f` | Primeira menção de responsabilidade | `contributors[]`, função/contribuição preservada |
| `200$g` | Menções subsequentes de responsabilidade | `contributors[]` |
| `205$a` | Menção de edição | `edition.statement` |
| `210$a` | Lugar de publicação/distribuição | `publication.places[]` |
| `210$c` | Editor/distribuidor | `publication.publishers[]` |
| `210$d` | Data de publicação/distribuição | `publication.date` ou intervalo |
| `215$a` | Extensão e indicação específica | `physicalDescription.extent` |
| `215$c` | Outras indicações físicas | `physicalDescription.otherDetails` |
| `215$d` | Dimensões | `physicalDescription.dimensions` |
| `215$e` | Material acompanhante | `physicalDescription.accompanyingMaterial[]` |
| `225$a` | Título da colecção/série | `series[].title` |
| `225$v` | Número de volume dentro da série | `series[].volume` |
| `300$a` | Nota geral | `notes[]`, tipo `general` |
| `330$a` | Resumo/abstract | `summary` e, se repetido, `summaries[]` |
| `327$a` | Nota de conteúdos | `contents` ou `notes[]`, tipo `contents` |
| `500$a` | Título preferido de acesso | `work.preferredTitle` quando disponível |
| `517$a` | Outras variantes de título | `title.variants[]` |
| `600$a` / `601$a` / `602$a` | Pessoa, colectividade ou família como assunto | `subjects[]`, entidade nomeada |
| `605$a` / `606$a` / `607$a` | Título, termo tópico ou entidade geográfica como assunto | `subjects[]` |
| `610$a` | Termo de assunto não controlado | `subjects[]`, `authorityControlled=false` |
| `675$a` | CDU/UDC | `classifications[]`, sistema `UDC` |
| `676$a` | Dewey | `classifications[]`, sistema `DDC` |
| `680$a` | Library of Congress Classification | `classifications[]`, sistema `LCC` |
| `686$a` | Outra classificação | `classifications[]`, sistema indicado |
| `700$a` | Pessoa como responsabilidade principal | `contributors[]`, `entityType=person`, `role=primary` |
| `701$a` | Pessoa como co-responsabilidade principal | `contributors[]`, `role=co-primary` |
| `702$a` | Pessoa como responsabilidade secundária | `contributors[]`, `role=contributor` |
| `710$a` | Colectividade como responsabilidade principal | `contributors[]`, `entityType=corporateBody` |
| `711$a` | Colectividade como co-responsabilidade principal | `contributors[]` |
| `712$a` | Colectividade como responsabilidade secundária | `contributors[]` |
| `801$a/$b/$c/$g` | País, agência, data e regras de catalogação | `provenance.cataloguingAgencies[]` |
| `856$u` | URI de acesso | `accessLinks[]`, tipo e finalidade |

O campo `200$a` é obrigatório no manual para todos os registos e o manual identifica-o como o título próprio; `210` contém lugar, editor e data de publicação; `215` contém extensão, outros detalhes físicos, dimensões e material acompanhante.  A documentação portuguesa de mapeamento RNOD confirma a centralidade prática de `101$a`, `102$a`, `010$a`, `011$a`, `200$a`, `200$e`, `200$f`, `200$g`, `210$a`, `210$c`, `210$d`, `215$a`, `215$c`, `215$d`, `300$a`, `330$a`, `675$a`, `610$a` e dos campos de responsabilidade `700`–`722`.[^9][^10][^11]

### Subcampos de controlo transversais

Estes subcampos não devem ser ignorados, mesmo quando não forem propriedades visíveis no domínio:

| Subcampo | Função | Tratamento |
|---|---|---|
| `$0` | Identificador de registo bibliográfico | `authorityLink`/`bibliographicLink` |
| `$1` | Dados de ligação incorporados | estrutura de relação ou raw field |
| `$2` | Fonte do sistema, código ou vocabulário | `sourceScheme` |
| `$3` | Identificador de autoridade ou standard number | `authorityId`/`standardId` |
| `$4` | Código de função/relator | `role.code` |
| `$5` | Instituição à qual o campo se aplica | `institutionId` |
| `$6` | Ligação entre campos | `fieldLink` |
| `$7` | Alfabeto/escrita | `script` |
| `$8` | Materiais especificados | `materialsSpecified` |
| `$R` | URI de objecto do mundo real | `realWorldObjectUri` |

O manual define estes subcampos como mecanismos transversais para identificadores, autoridades, relações, instituições, scripts e fontes de códigos; `$6` e `$7` são particularmente importantes para representações paralelas e alfabetos alternativos.[^3]

## Importante mas variável

### Título e descrição

| Campo/subcampo | Informação | Estrutura recomendada |
|---|---|---|
| `200$b` | Designação geral do material | `resourceType`/`materialDesignation` |
| `200$c` | Título por outro autor | `title.additional[]` |
| `200$h` | Número de parte | `title.part.number` |
| `200$i` | Nome da parte | `title.part.name` |
| `200$j` | Datas inclusivas | `coverage.dateRange` |
| `200$k` | Datas predominantes/bulk dates | `coverage.bulkDate` |
| `200$r` | Informação de página de título antiga | `titlePageInformation` |
| `200$v` | Designação de volume | `title.part.volume` |
| `200$z` | Língua do título paralelo | `title.parallel[].language` |
| `203$a/$b/$c` | Forma de conteúdo, tipo de media e tipo de suporte | `contentForm`, `mediaType`, `carrierType` |
| `204$a` | Designação geral do material, quando usada | fallback de `resourceType` |
| `205$b/$f` | Outras indicações e responsabilidade da edição | `edition.otherStatements`, `edition.contributors[]` |
| `225$d/$e/$f/$h/$i/$v/$x` | Títulos paralelos, responsabilidades, parte e ISSN da série | `series[]` repetível |
| `410`–`464` | Relações série, suplemento, parte, conjunto | `relatedResources[]` |
| `510`–`545` | Títulos paralelos, coberturas, variantes, títulos fornecidos | `title.variants[]` com tipo |

### Publicação e materialidade

| Campo/subcampo | Informação | Estrutura recomendada |
|---|---|---|
| `210$b` | Endereço do editor/distribuidor | `publication.agents[].address` |
| `210$e/$f/$g/$h` | Impressão: lugar, endereço, impressor, data | `production.imprint[]` |
| `211$a` | Data projectada de publicação | `publication.projectedDate` |
| `214$a/$b/$c/$d/$e/$f/$g/$h/$j` | Produção, publicação e distribuição detalhadas | `publication.events[]` com tipo |
| `215` repetido | Múltiplas unidades físicas | `physicalDescriptions[]` |
| `230$a` | Área específica de recurso electrónico | `electronicResource` |
| `231$a`–`231$e` | Características de ficheiro digital | `digitalFileCharacteristics` |
| `251$a`–`251$e` | Organização e ordenação de materiais | `arrangement` |
| `283$a`–`283$b` | Tipo de suporte/carrier | `carrierDetails` |
| `856$a/$b/$d/$f/$u/$x/$z` | Localização, URI, notas públicas/privadas | `accessLinks[]` |
| `857$a/$u/$x/$z` | Localização electrónica de arquivo | `archivalAccess[]` |

### Notas e conteúdo enriquecido

| Campo/subcampo | Informação | Estrutura recomendada |
|---|---|---|
| `301$a` | Nota sobre identificadores | `notes[]`, tipo `identifier` |
| `302$a` | Nota sobre dados codificados | `notes[]`, tipo `codedData` |
| `303$a` | Nota descritiva geral | `notes[]`, tipo `description` |
| `304$a` | Nota sobre título/responsabilidade | `notes[]`, tipo `titleResponsibility` |
| `305$a` | Nota sobre edição | `notes[]`, tipo `edition` |
| `306$a` | Nota sobre publicação/distribuição | `notes[]`, tipo `publication` |
| `307$a` | Nota sobre descrição física | `notes[]`, tipo `physicalDescription` |
| `308$a` | Nota sobre série | `notes[]`, tipo `series` |
| `310$a` | Nota sobre encadernação | `notes[]`, tipo `binding` |
| `316$a/$5` | Nota específica do exemplar | `itemNotes[]` |
| `317$a/$5` | Proveniência do exemplar | `itemProvenance[]` |
| `318$a` | Acção sobre o exemplar | `itemActions[]` |
| `320$a` | Bibliografias/índices internos | `notes[]`, tipo `internalBibliography` |
| `321$a/$u` | Índices/referências externos | `notes[]`, tipo `externalIndex` |
| `326$a/$b` | Frequência de publicação | `frequency` |
| `328$a/$b/$c/$d/$e/$f/$g` | Nota de dissertação | `thesis` |
| `332$a` | Citação preferida | `preferredCitation` |
| `333$a` | Público-alvo | `audience` |
| `334$a` | Prémios | `awards[]` |
| `335$a` | Localização de originais/reproduções | `originalsReproductions` |
| `336$a` | Tipo de recurso electrónico em nota | `electronicResource.notes` |
| `337$a` | Requisitos de sistema | `systemRequirements[]` |
| `338$a` | Financiamento | `funding[]` |
| `345$a/$b/$c` | Informação de aquisição | `acquisition` |
| `346$a` | Acumulação/frequência de uso | `accruals` |
| `371$a/$b/$c/$d` | Política de serviço | `servicePolicy` |

O `327` merece uma estrutura própria: além de texto livre em `$a`, o formato permite títulos hierárquicos em `$b`–`$i`, sequências de páginas em `$p`, URI em `$u` e informação adicional em `$z`. Guardar apenas texto concatenado destruiria informação útil para mostrar índices e conteúdos estruturados.[^12]

### Responsabilidades e assuntos

| Campo/subcampo | Informação | Estrutura recomendada |
|---|---|---|
| `600`–`607` | Assuntos com pessoa, colectividade, família, título ou lugar | `subjects[]` com `kind`, `parts`, `authorityId`, `source` |
| `608$a/$2` | Forma, género ou características físicas | `genres[]`/`subjects[]`, com vocabulário |
| `610$a` repetido | Assuntos não controlados | `subjects[]`, `controlled=false` |
| `617$a` | Nome geográfico hierárquico | `subjects[]`, estrutura hierárquica |
| `620$a/$d/$e/$f` | Lugar/data de publicação ou execução | `events[]` |
| `621$a/$d/$e/$f` | Lugar/data de proveniência | `provenance.events[]` |
| `623$a` | Personagem | `characters[]` |
| `626$a` | Detalhes técnicos de acesso electrónico | `accessTechnicalDetails` |
| `631$a` | Ocupação | `subjects[]`, tipo `occupation` |
| `632$a` | Função | `subjects[]`, tipo `function` |
| `660$a` | Área geográfica codificada | `geographicCodes[]` |
| `661$a` | Período temporal codificado | `temporalCodes[]` |
| `670$a/$b` | PRECIS | `subjectSystems[]`, sistema `PRECIS` |
| `700`–`703` | Pessoas e relações principais/secundárias | `contributors[]` |
| `710`–`713` | Colectividades e relações | `contributors[]` |
| `716` | Marca | `contributors[]` ou `entities[]`, tipo `trademark` |
| `720`–`723` | Famílias e outras responsabilidades | `contributors[]` |
| `$4` em 7-- | Código de função | `contributor.role.code` |
| `$3` em 7-- | Ligação a autoridade | `contributor.authorityId` |

A estrutura de agente deve ser repetível e tipada porque o UNIMARC separa responsabilidade principal, co-responsabilidade e responsabilidade secundária, além de distinguir pessoa, colectividade e família. A conversão MARC 21 da Library of Congress confirma que a tradução de nomes exige regras específicas para subcampos, funções e pontuação; portanto, concatenar `$a`, `$b`, `$d`, `$f` e `$g` num único texto não é suficiente para conversão de qualidade.[^5][^13]

## Raro ou específico

“Raro” aqui significa **fora do núcleo bibliográfico geral**, não “sem valor”. Estes campos devem ser preservados para conversão, investigação ou suporte futuro, mas não precisam de propriedades de primeira classe no modelo inicial.

### Dados codificados de tipos especiais

| Campos | Subcampos principais | Tratamento recomendado |
|---|---|---|
| `105` | `$a` | Raw coded data; textual language |
| `106` | `$a` | Raw coded data; textual resource form |
| `110` | `$a`–`$b` | Continuing resources |
| `111` | `$a` | Serials physical data |
| `115` | `$a`–`$b` | Projection/video/motion picture |
| `116` | `$a` | Graphics |
| `117` | `$a` | Three-dimensional artefacts |
| `120`–`124` | `$a` e dados codificados | Cartographic resources |
| `125`–`128` | `$a`–`$b` | Sound recordings and music |
| `127` | `$a` | Duration of sound |
| `128` | `$a`–`$b` | Musical work/performance |
| `130` | `$a` | Microform physical data |
| `131` | `$a` | Cartographic coded data |
| `135` | `$a` | Electronic resources |
| `140` | `$a` | Antiquarian materials |
| `141` | `$a` | Item-specific attributes |
| `145`–`146` | `$a`–`$b` | Medium of performance |
| `181` | `$a`–`$b` | Content form |
| `182` | `$a` | Media type |
| `183` | `$a` | Carrier type |

Para livros correntes, estes dados são frequentemente opcionais; para música, cartografia, vídeo, som, recursos electrónicos e materiais raros, podem tornar-se essenciais. O manual cobre explicitamente esses tipos de material, pelo que não se deve deitar fora a ocorrência original só porque o núcleo da aplicação começa com monografias impressas.[^14][^15]

### Relações e títulos especializados

| Campos | Subcampos nucleares | Tratamento |
|---|---|---|
| `410`–`413` | `$1`, `$t`, `$x`, `$v` e dados de título incorporados | Relações de série/excerto; `relatedResources[]` |
| `421`–`425` | `$1`, títulos e identificadores | Suplementos, parent e actualizações |
| `430`–`448` | `$1`, `$t`, `$x` | História de publicações continuadas |
| `451`–`464` | `$1`, `$t`, `$x` | Outras edições, traduções, reproduções, conjuntos e partes |
| `470` | `$1` e título da obra revista | Recurso revisto |
| `481`–`482` | `$1`, `$t` | Encadernação/conjunto físico |
| `488` | `$1`, `$t` | Outra obra relacionada |
| `518`–`532` | `$a`, `$d`, `$e`, `$f`, `$g`, `$h`, `$i`, `$j`, `$k`, `$l`, `$m` | Variantes especializadas e títulos de publicações continuadas |
| `540`–`545` | `$a`, `$b`, `$d`, `$e`, `$f`, `$g` | Títulos fornecidos/traduzidos pelo catalogador |
| `560` | `$a` | Título artificial |

Estas relações não devem ser reduzidas a texto em `notes`. Para exportar para MARC 21 ou construir navegação entre recursos, é necessário conservar pelo menos tipo de relação, identificador ligado, título ligado e os subcampos incorporados. O bloco 4-- existe precisamente para ligar entidades ou recursos bibliográficos, e o manual descreve uma técnica de campos incorporados que não aparecem como entradas independentes no directório.[^1][^4]

### Assuntos e classificações especializadas

| Campos | Subcampos principais | Tratamento |
|---|---|---|
| `620` | `$a`–`$j` | Lugar/data de publicação, performance ou origem |
| `623` | `$a` | Personagens |
| `626` | `$a`–`$u` | Detalhes técnicos de acesso electrónico |
| `631`–`632` | `$a`, `$x`, `$y`, `$z` | Ocupação/função |
| `660`–`661` | `$a` | Códigos geográficos/temporais |
| `670` | `$a`, `$b`, `$2` | PRECIS |
| `675` | `$a`, `$v`, `$z` | UDC detalhado |
| `676` | `$a`, `$v`, `$z` | DDC detalhado |
| `680` | `$a`, `$v`, `$z` | LCC detalhado |
| `686` | `$a`, `$b`, `$2` | Outros esquemas |
| `740`–`742` | `$a`–`$i` | Títulos convencionais legais/religiosos |

As classificações devem ser mantidas separadas dos assuntos: um código `675$a` não é um termo tópico `606$a`. Cada ocorrência deve levar o sistema, a notação, a edição/versão quando disponível e a fonte (`$2`).

### Uso internacional, holdings e nacional

| Campo | Subcampos principais | Tratamento |
|---|---|---|
| `802` | `$a` | ISSN International Centre |
| `830` | `$a` | Nota geral do catalogador |
| `850` | `$a` | Instituição detentora |
| `852` | `$a`–`$j` | Localização e cota |
| `886` | `$a`–`$v` | Dados não convertidos da fonte |
| `9--` | Definidos nacionalmente | Extensão nacional preservada como campos desconhecidos |

`886` é especialmente importante para conversões: se uma informação da fonte não tem correspondência UNIMARC, deve ser preservada em vez de ser descartada. O bloco 9-- não deve ser interpretado como interoperável por defeito; o significado depende do acordo nacional ou local.

## Campos que não devem ser confundidos

### `001` não é identificador bibliográfico do recurso

`001` identifica o registo dentro do sistema que o criou. Um ISBN em `010$a`, um ISSN em `011$a` ou um identificador persistente em `003` têm semânticas diferentes. O modelo deve ter uma lista de identificadores com `type`, `value`, `qualifier`, `source` e `validity`, em vez de uma propriedade genérica `id`.

### `200$f/$g` não substitui `700`–`702`

`200$f` e `200$g` são menções transcritas de responsabilidade como aparecem na fonte. Os campos `700`–`702` são pontos de acesso estruturados a agentes. O modelo deve conservar ambos: uma forma transcrita para fidelidade descritiva e agentes estruturados para pesquisa e relações.

### `210` não é apenas editor e ano

A publicação pode conter lugar, editor, distribuidor, fabricante, impressor, diferentes datas e eventos repetidos. O modelo canónico deve usar uma lista de eventos/agentes de publicação, mesmo que a UI inicial mostre apenas editor e data.

### `215` não é apenas número de páginas

`215$a` pode descrever extensão e tipo de unidade; `215$c` descreve detalhes físicos; `215$d` dimensões; `215$e` material acompanhante. A propriedade `pages` perderia mapas, volumes, folhas, suportes e material adicional.

### `300` não deve absorver tudo

Notas semânticas específicas, como resumo (`330`), conteúdos (`327`), dissertação (`328`), requisitos de sistema (`337`) e proveniência de exemplar (`317`), devem permanecer tipadas. Uma lista de texto livre pode coexistir como fallback, mas não deve substituir as estruturas com valor de pesquisa ou conversão.

## Proposta de modelo canónico mínimo

A primeira versão do modelo pode ser organizada assim:

```text
BibliographicRecord
├── recordIdentity
│   ├── sourceRecordId
│   ├── persistentRecordId
│   └── version
├── resourceType
├── titles
│   ├── main
│   ├── parallel[]
│   ├── other[]
│   └── variants[]
├── responsibilities
│   ├── statementOfResponsibility[]
│   └── agents[]
├── identifiers[]
├── languages[]
├── publication
│   ├── places[]
│   ├── agents[]
│   ├── dates[]
│   └── events[]
├── edition
├── physicalDescription
├── series[]
├── subjects[]
├── classifications[]
├── summary
├── contents[]
├── notes[]
├── relatedResources[]
├── accessLinks[]
├── itemData[]
├── provenance
│   ├── cataloguingAgencies[]
│   ├── sourceFormat
│   ├── sourceSystem
│   └── retrievedAt
└── preservation
    ├── rawRecord
    ├── rawFormat
    └── unmappedFields[]
```

A lista `unmappedFields[]` deve conservar `tag`, indicadores, subcampos, valor bruto e origem. Isso permite criar novos mapeamentos para MARC 21 sem alterar imediatamente o domínio. A informação original é particularmente importante porque a especificação da Library of Congress inclui procedimentos especiais e campos de destino diferentes para várias classes de materiais.[^7][^16]

## Prioridade de implementação

### Núcleo inicial

Implementar primeiro identificadores, título, responsabilidades, edição, publicação, descrição física, idioma, tipo de recurso, séries, resumo, notas, assuntos, classificações, relações, links e proveniência. Este conjunto cobre a maioria dos livros e publicações correntes e mantém informação suficiente para pesquisa, apresentação, importação e exportação.

### Segunda camada

Adicionar títulos variantes, conteúdos estruturados, relações entre recursos, dados de exemplar, agentes de publicação múltiplos, notas tipadas, acesso electrónico detalhado e informação de aquisição. Estes campos são muito valiosos, mas requerem estruturas repetíveis e uma UI que saiba apresentá-los.

### Extensões por tipo de recurso

Só criar propriedades de primeira classe para cartografia, música, som, vídeo, recursos electrónicos, numismática, livros antigos ou arquivos quando o produto tiver um fluxo para esse material. Até lá, conservar `1--`, `2--`, `3--` e `886` específicos no original e expô-los através de extensões.

## Conclusão

O modelo canónico deve adoptar explicitamente o núcleo semântico de `0--`, `1--`, `2--`, `3--`, `6--`, `7--` e `8--`, mas não deve transformar cada campo UNIMARC numa propriedade de negócio. O núcleo mais importante é `200`, `010`/`011`/outros identificadores, `210`, `215`, `225`, `300`/`327`/`330`, `6--`, `675`/`676`/`680`/`686`, `7--`, `801` e `856`.

Para conversões futuras, a preservação dos subcampos de controlo, relações `4--`, títulos variantes `5--`, dados codificados especializados `1--`, dados de exemplar e `886` é mais importante do que tentar normalizar tudo imediatamente. A implementação deve separar sempre: dados canónicos, dados de autoridade/proveniência e representação original UNIMARC.

A referência normativa principal deve ser a edição online oficial mais recente da IFLA, actualmente 1.1.0 para o manual analisado; a página da IFLA indica que as edições online são publicadas como PDF e actualizadas por versões.  A documentação portuguesa da Biblioteca Nacional e os mapeamentos nacionais são úteis para validar prioridades de uso em Portugal, mas não substituem o manual IFLA.[^17][^18][^19][^1]

---

## References

1. [UNIMARC Bibliographic Format Manual 1.1.0](https://repository.ifla.org/items/3ee7253f-27d6-4095-a20a-2b16012df776/full) - |dc.description.abstract|The UNIMARC bibliographic format is the backbone of a set of standards for ...

2. [UNIMARC formats and related documentation](https://www.ifla.org/publications/unimarc-formats-and-related-documentation/) - The UNIMARC Bibliographic format was first created and proposed by IFLA in 1977, with the title
UNIM...

3. [3 Format structure - UNIMARC](https://unimarc.org.ua/ifla/biblio2023/2023n1_0_0_UNIMARC_3_Format_structure_10-15.pdf) - Data Field (001- to 999) layout: 
Indicators 
Subfield Identifier 
Other Subfields 
...
Other data f...

4. [UNIMARC to MARC 21 Conversion Specification–August ...](https://www.loc.gov/marc/unimarctomarc21_2xx5xx.pdf) - SECTION II
UNIMARC TO MARC21 CONVERSION CHARTS
(IN SEQUENCE BY UNIMARC FIELD)
(Field 200 to 545)
UNI...

5. [UNIMARC to MARC 21 Conversion Charts ( ...](https://www.loc.gov/marc/unimarctomarc21_6xx8xx.pdf) - SECTION III
UNIMARC TO MARC21 CONVERSION CHARTS
(IN SEQUENCE BY UNIMARC FIELD)
(Field 600 to 802)
UN...

6. [UNIMARC to MARC 21 Conversion Specification–August ...](https://www.loc.gov/marc/unimarctomarc21_0xx1xx.pdf) - SECTION I
UNIMARC TO MARC 21 CONVERSION CHARTS
(IN SEQUENCE BY UNIMARC FIELD)
(RECORD LABEL, DIRECTO...

7. [UNIMARC to MARC 21 Conversion Specifications (Library of Congress)](https://www.loc.gov/marc/unimarctomarc21_intro.pdf) - UNIMARC TO MARC 21 CONVERSION SPECIFICATIONS
(Version 3.0)
Prepared by the 
Network Development and ...

8. [TEMA 6 – O FORMATO UNIMARC](https://www.alpiarca.pt/biblioteca/mp/imagens/Tema6FormatoUnimarc.pdf) - A estrutura do formato UNIMARC, tal como em qualquer versão do formato MARC, é 
composta por três el...

9. [0-- IDENTIFICATION BLOCK](https://www.transition-bibliographique.fr/wp-content/uploads/2025/05/B_2_ORGANIZATION_OF_THE_MANUAL_eng.pdf) - UNIMARC Bibliographic Format Manual (online ed., 1.1.0, 2024) 
...
Publisher or Bookline Identifier ...

10. [IFLA UNIMARC Manual](https://cdn.ifla.org/wp-content/uploads/files/assets/uca/unimarc_updates/BIBLIOGRAPHIC/u-b_200_update.pdf) - This field contains the title along with any other title information and statements of responsibilit...

11. [1](https://rnod.bnportugal.gov.pt/rnod/_client/Docs/MAPEAMENTO_UNIMARC_RNOD_ESE_20150311.pdf) - CAMPOS RNOD 
FORMATO EUROPEANA 
...
Elemento (Descrição) 
Valor 
Preenchimento 
Obrig./Facult.
REGIS...

12. [327 CONTENTS NOTE - unimarc.org.ua](https://unimarc.org.ua/ifla/biblio2024/2024n1_1_0_UNIMARC_327_Contents_note_384-389.pdf) - UNIMARC Bibliographic Format Manual (online ed., 1.1.0, 2024) 
...
This field contains a note descri...

13. [UNIMARC to MARC 21 Procedures and Punctuation Checks (Library of Congress)](https://loc.gov/marc/unimarctomarc21_procedures.pdf) - UNIMARC to MARC 21 Conversion Specifications–August 2001
PROCEDURE 1:  PERSONAL NAMES
1. Convert ind...

14. [[PDF] 115 CODED DATA FIELD: VISUAL PROJECTIONS, VIDEO ...](https://www.transition-bibliographique.fr/wp-content/uploads/2025/05/B115_eng.pdf) - UNIMARC Bibliographic Format Manual (online ed., 1.1.0, 2024) 
...
Subfields & Occurrence 
Field/Sub...

15. [UNIMARC Bibliographic Format Manual 1.1.0](https://repository.ifla.org/items/cd4be6b4-46a6-43e7-86bf-d14a5cfed916/full) - # UNIMARC Bibliographic Format Manual 1.1.0
...
|dc.description.abstract|The UNIMARC bibliographic f...

16. [UNIMARC to MARC 21 Conversion Specifications](https://www.loc.gov/marc/unimarctomarc21.html) - This document contains detailed specifications for conversion of bibliographic data from the UNIMARC...

17. [UNIMARC Bibliographic Format Manual (online ed.)](https://www.ifla.org/unimarc-updates/unimarc-bibliographic-format-manual-online-ed/) - The online edition is published as the latest version in PDF format.
...
|Version|File|Release Date|...

18. [Manual UNIMARC](https://www.dgsi.pt/bpjl.nsf/83cbe9acef94db5a8025730800549412/86db2d17a64ca52680258b80002d9397?OpenDocument) - |**IFLA Manual UNIMARC : formato bibliográfico / IFLA ; coord.
da trad.
e rev. téc.
Rosa Maria Galvã...

19. [UNIMARC](https://www.bnportugal.gov.pt/index.php?option=com_content&view=article&id=492&Itemid=542&lang=pt) - A família de formatos UNIMARC (bibliográfico, autoridades, existências e de classificação) é gerida ...

