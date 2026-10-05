Updated todo list

Vou começar por ler a memória do repositório e os documentos de contexto.   

Read 

Read memory 

Read , lines 1 to 600



Read 

Searched for files matching `c:\Users\jcche\projects\folio\folio-api\**\*architecture*.md`, no matches

Fetched `resource`

Ran terminal command: cd c:\Users\jcche\projects\folio\folio-api; git status --short | Select-Object -First 30; git branch --show-current; Get-ChildItem -Recurse src -File | Where-Object { $_.Name -notmatch 'spec' } | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '','') + '  ' + (Get-Content $_.FullName | Measure-Object -Line).Lines }

Read 

Read 

Estado do git limpo, branch `main`. Agora leio os ficheiros principais da API (módulos, items, membership, auth).     

Read 

Read 

Read 

Read 

Read 

No matches found. Your search pattern might be excluded completely by either the search.exclude settings or .*ignore files.
If you believe that it should have results, you can check into the .*ignore files and the exclude setting (here are some excluded patterns for reference:[**/node_modules,**/bower_components,**/*.code-search,**/.dart_tool]).
Then if you want to include those files you can call the tool again by setting "includeIgnoredFiles" to true.

Read 

Read 

Read 

Ran terminal command: cd c:\Users\jcche\projects\folio\folio-api; Select-String -Path prisma\schema.prisma -Pattern '^(model|enum) ' | ForEach-Object { "$($_.LineNumber): $($_.Line)" }; (Get-Content prisma\schema.prisma | Measure-Object -Line).Lines; Get-ChildItem prisma\migrations | Select-Object -ExpandProperty Name

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

No matches found. Your search pattern might be excluded completely by either the search.exclude settings or .*ignore files.
If you believe that it should have results, you can check into the .*ignore files and the exclude setting (here are some excluded patterns for reference:[**/node_modules,**/bower_components,**/*.code-search,**/.dart_tool]).
Then if you want to include those files you can call the tool again by setting "includeIgnoredFiles" to true.

Read 

Read 

Read 

Ran terminal command: cd c:\Users\jcche\projects\folio\folio-api; Get-ChildItem -Recurse src,test -Include *.ts | Select-String -Pattern 'throttl|helmet|correlation|requestId|request-id|AuditEvent|console\.(log|warn|error)|maxContentLength|json\(\{|ThrottlerModule' | ForEach-Object { "$($_.Path.Replace((Get-Location).Path+'',''))`:$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 30; "--- deps"; Select-String -Path package.json -Pattern '"@nestjs|"prisma|"@prisma|axios|argon2|class-valid|sharp|file-type|vitest|helmet|throttler' | ForEach-Object { $_.Line.Trim() }; "--- tests"; Get-ChildItem -Recurse src,test -Include *.spec.ts,*.e2e-spec.ts,*.test.ts | ForEach-Object { $_.FullName.Replace((Get-Location).Path+'','') }

Ran terminal command: cd c:\Users\jcche\projects\folio\folio-api; Get-ChildItem -Recurse src,test -Include *.ts | Select-String -Pattern 'ItemsService|items/|prisma\.item\.|\bitem\b.*delete' | ForEach-Object { "$($_.Path.Replace((Get-Location).Path+'',''))`:$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 40

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Ran terminal command: cd c:\Users\jcche\projects\folio\folio-api; Select-String -Path src\contributors\contributors.controller.ts,src\external-identifiers\external-identifiers.controller.ts -Pattern '@Body' | ForEach-Object { "$($_.Path.Split('')[-1]):$($_.LineNumber): $($_.Line.Trim())" }; "---spec"; Get-Content src\ownership.service.spec.ts | Select-Object -Skip 50 -First 80

Ran terminal command: cd c:\Users\jcche\projects\folio; Select-String -Path folio-api\src\catalogues\porbase.parser.ts -Pattern '856|unmapped|SUPPORTED|KNOWN_TAGS|reason:' | Select-Object -First 25 | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }; "--- fixture"; Select-String -Path folio-api\src\catalogues\fixtures\porbase-9789724426495.txt -Pattern '856' -List | ForEach-Object { $_.Path }; "--- sample 856 in porbase xml dump"; Select-String -Path folio-app\marcXchange_porbase\bibliographics_1_to_55966.xml -Pattern 'tag="856"' -Context 0,4 -List | Select-Object -First 1 | ForEach-Object { $_.Line; $_.Context.PostContext }; "--- count 856 lines in first file"; (Select-String -Path folio-app\marcXchange_porbase\bibliographics_1_to_55966.xml -Pattern 'tag="856"' | Measure-Object).Count

Ran terminal command: cd c:\Users\jcche\projects\folio; $r = Get-Content "c:\Users\jcche\AppData\Roaming\Code\User\workspaceStorage\4f7a1192280940df939d1d4d0d74eab5\GitHub.copilot-chat\chat-session-resources\3abe19ea-4795-432e-8363-82fa3817860b\toolu_01BrgLKCVKFBCp9qyWR6C8YP__vscode-1791147729718\content.txt"; $r | ForEach-Object { if ($_.Length -gt 220) { $_.Substring(0,220) } else { $_ } } | Select-Object -First 50

Ran terminal command: cd c:\Users\jcche\projects\folio; $p='folio-app\marcXchange_porbase\bibliographics_1_to_55966.xml'; $t=[IO.File]::ReadAllText((Resolve-Path $p)); "len=$($t.Length)"; $m=[regex]::Matches($t,'<mx:datafield tag="856"[^>]*>.*?</mx:datafield>'); "856 count=$($m.Count)"; $m | Select-Object -First 4 | ForEach-Object { $_.Value.Substring(0,[Math]::Min(300,$_.Value.Length)) }; "--- parser 856/unmapped"; Select-String -Path folio-api\src\catalogues\porbase.parser.ts -Pattern "'856'|\b856\b|unmapped" | Select-Object -First 12 | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }

Ran terminal command: git status --short | Select-Object -First 10; git branch --show-current; Get-ChildItem -Recurse lib -File -Include *.dart,*.arb | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\lib','') + '  ' + (Get-Content $_.FullName | Measure-Object -Line).Lines }; "--- tests"; Get-ChildItem -Recurse test -File | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\test','') }

The `cd` was dropped; retrying with an absolute path. 

Ran terminal command: git status --short | Select-Object -First 10; git branch --show-current; Get-ChildItem -Recurse lib -File -Include *.dart,*.arb | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\lib','') + '  ' + (Get-Content $_.FullName | Measure-Object -Line).Lines }; "--- tests"; Get-ChildItem -Recurse test -File | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\test','') }

Ran terminal command: $root='c:\Users\jcche\projects\folio\folio-app'; git -C $root status --short | Select-Object -First 10; git -C $root branch --show-current; Get-ChildItem -Recurse "$root\lib" -File | ForEach-Object { $_.FullName.Replace("$root\lib",'') + '  ' + (Get-Content $_.FullName | Measure-Object -Line).Lines }; "--- tests"; Get-ChildItem -Recurse "$root\test" -File | ForEach-Object { $_.FullName.Replace("$root\test",'') }

Ran terminal command: $root='c:\Users\jcche\projects\folio\folio-app\lib'; foreach ($f in 'core\network\api_client.dart','core\network\api_error.dart','core\network\auth_interceptor.dart','core\storage\token_storage.dart','core\config\app_environment.dart','main.dart','app.dart','routing\app_router.dart') { "===== $f"; Get-Content "$root\$f" }

Read 

Ran terminal command: $root='c:\Users\jcche\projects\folio\folio-app\lib\features'; foreach ($f in 'auth\presentation\auth_controller.dart','auth\data\auth_repository.dart','library\controller\library_detail_controller.dart','library\controller\library_controller.dart','library\data\library_api.dart','library\data\library_repository.dart') { "===== $f"; Get-Content "$root\$f" }

Read 

Ran terminal command: Get-Content c:\Users\jcche\projects\folio\folio-app\lib\features\auth\presentation\auth_controller.dart | Select-Object -Skip 14 -First 125

Ran terminal command: Get-Content c:\Users\jcche\projects\folio\folio-app\lib\features\auth\presentation\auth_controller.dart | Select-Object -Skip 135 -First 30; "=====PAGE"; Get-Content c:\Users\jcche\projects\folio\folio-app\lib\features\library\presentation\library_detail_page.dart

Read 

Ran terminal command: $root='c:\Users\jcche\projects\folio\folio-app\lib\features\library\data'; Get-Content "$root\marcxchange_downloader_web.dart"; "===="; Get-Content "$root\marcxchange_downloader_stub.dart"; "===="; Get-Content "$root\marcxchange_downloader.dart"; "==== catalogue_api"; Get-Content c:\Users\jcche\projects\folio\folio-app\lib\features\catalogue\data\catalogue_api.dart | Select-Object -First 100

Ran terminal command: $root='c:\Users\jcche\projects\folio\folio-app'; Get-Content "$root\lib\features\catalogue\data\catalogue_api.dart" | Select-Object -Skip 100; "=== grep porbase paths"; Select-String -Path "$root\lib\**\*.dart","$root\test\**\*.dart" -Pattern "catalogues/porbase|import-preview" -Recurse | ForEach-Object { "$($_.Path.Replace($root,''))`:$($_.LineNumber)" } | Select-Object -First 10; "=== bibliographicRecord/rawContent in app"; Get-ChildItem -Recurse "$root\lib" -Filter *.dart | Select-String -Pattern "rawContent|856|coverUrl|cover" | ForEach-Object { "$($_.Path.Replace($root,''))`:$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 20; "=== l10n.yaml"; Get-Content "$root\l10n.yaml"

Ran terminal command: $api='c:\Users\jcche\projects\folio\folio-api'; Get-ChildItem -Recurse "$api\src\catalogues\dto" -Filter catalogue-import.dto.ts | Select-String -Pattern "pageCount|rawContent|MaxLength|ArrayMaxSize|Max\(|IsUrl|class Catalogue" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 60; "=== localization: hardcoded strings candidate scan"; $app='c:\Users\jcche\projects\folio\folio-app\lib'; Get-ChildItem -Recurse $app -Filter *.dart | Where-Object { $_.FullName -notmatch 'generated' } | Select-String -Pattern "Text\(\s*'[A-Za-zÀ-ú]|label:\s*'[A-Za-zÀ-ú]|tooltip:\s*'|hintText:\s*'|labelText:\s*'|content:\s*Text\('" | ForEach-Object { "$($_.Path.Replace($app,''))`:$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 25

Ran terminal command: $d='c:\Users\jcche\projects\folio\folio-app\lib\l10n'; $k=@{}; foreach($f in 'app_en','app_pt','app_pt_PT'){ $j=Get-Content "$d\$f.arb" -Raw -Encoding UTF8 | ConvertFrom-Json; $k[$f]=($j.PSObject.Properties.Name | Where-Object {$_ -notlike '@*'}) }; foreach($f in $k.Keys){ "$f keys=$($k[$f].Count)" }; "missing in pt vs en: " + (($k['app_en'] | Where-Object { $_ -notin $k['app_pt'] }) -join ', '); "missing in pt_PT vs en: " + (($k['app_en'] | Where-Object { $_ -notin $k['app_pt_PT'] }) -join ', '); "extra in pt_PT vs pt: " + (($k['app_pt_PT'] | Where-Object { $_ -notin $k['app_pt'] }) -join ', '); "--- delete keys"; Select-String -Path "$d\app_en.arb" -Pattern 'deleteItem|"items"|itemStatus' | ForEach-Object { $_.Line.Trim() }; "--- supportedLocales"; Select-String -Path "$d\generated\app_localizations.dart" -Pattern "Locale\(" | Select-Object -First 6 | ForEach-Object { $_.Line.Trim() }; "--- l10n tests"; Select-String -Path c:\Users\jcche\projects\folio\folio-app\test\features\library\library_detail_test.dart -Pattern "testWidgets|test\(|group\(" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }

Ran terminal command: Get-Content c:\Users\jcche\projects\folio\folio-app\lib\l10n\localization_extensions.dart; "=== tests 315-345, 415-466"; $t=Get-Content c:\Users\jcche\projects\folio\folio-app\test\features\library\library_detail_test.dart; $t[314..346]; $t[414..466]

Read 

Ran terminal command: $api='c:\Users\jcche\projects\folio\folio-api'; Get-ChildItem -Recurse "$api\src" -Filter *.ts | Where-Object { $_.Name -notmatch 'spec' } | Select-String -Pattern "MaxLength|ArrayMaxSize|@Length|@Max\(" | ForEach-Object { "$($_.Path.Replace($api,''))`:$($_.LineNumber)" } | Select-Object -First 10; "--- done grep bounds"; Get-Content "$api\src\catalogues\dto\catalogue-import.dto.ts" | Select-Object -Skip 452 -First 50; "--- unmappedReason"; Get-Content "$api\src\catalogues\porbase.parser.ts" | Select-Object -Skip 845 -First 50; "--- env example"; Get-Content "$api\.env.example"; "--- docs"; Get-ChildItem "$api\docs","$api\.design-decisions" -Recurse -File | ForEach-Object { $_.FullName.Replace($api,'') }

Ran terminal command: $app='c:\Users\jcche\projects\folio\folio-app\lib'; Get-ChildItem -Recurse $app -Filter *.dart | Where-Object { $_.FullName -notmatch 'generated' } | Select-String -Pattern "LogInterceptor|debugPrint|\bprint\(|dart:io|dart:html|catch \(_\)" | ForEach-Object { "$($_.Path.Replace($app,''))`:$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 40; "--- usages of API paths"; Get-ChildItem -Recurse $app -Filter *_api.dart | Select-String -Pattern "'/[a-z]" | ForEach-Object { "$($_.Path.Split('')[-1]):$($_.Line.Trim())" }; "--- org"; Get-Content "$app\features\organizations\data\organization_api.dart"; Get-Content "$app\features\organizations\presentation\organization_provider.dart"

Ran terminal command: $app='c:\Users\jcche\projects\folio\folio-app'; Select-String -Path "$app\lib\features\library\presentation\library_page.dart","$app\lib\features\library\controller\library_controller.dart" -Pattern "cursor|hasMore|loadMore|nextCursor" | ForEach-Object { "$($_.Path.Split('')[-1]):$($_.LineNumber): $($_.Line.Trim())" }; "--- app deps"; Select-String -Path "$app\pubspec.yaml" -Pattern "dio|riverpod|go_router|secure_storage|mobile_scanner|sdk:" | ForEach-Object { $_.Line.Trim() }; "--- CONTEXT mentions of delete/roles"; Select-String -Path "$app\CONTEXT.md" -Pattern "cursor|paginação|hasMore" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 8

Ran terminal command: $app='c:\Users\jcche\projects\folio\folio-app\lib\features\library'; Select-String -Path "$app\presentation\library_item_tile.dart","$app\domain\library_models.dart","$app\presentation\library_page.dart" -Pattern "items|ItemDetail|status" | ForEach-Object { "$($_.Path.Split('')[-1]):$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 15; "--- last two api spec/test for item delete coverage on API"; Select-String -Path c:\Users\jcche\projects\folio\folio-api\test\*.ts -Pattern "items" | Select-Object -First 5 | ForEach-Object { "$($_.Path.Split('')[-1]):$($_.LineNumber): $($_.Line.Trim())" }

Ran terminal command: Get-Content c:\Users\jcche\projects\folio\folio-api\src\contributors\contributors.service.ts | Select-Object -Skip 186 -First 30

Ran terminal command: $api='c:\Users\jcche\projects\folio\folio-api\src'; $app='c:\Users\jcche\projects\folio\folio-app\lib'; function g($p,$pat){ Select-String -Path $p -Pattern $pat | ForEach-Object { "$($_.Path.Split('')[-1]):$($_.LineNumber): $($_.Line.Trim())" } }; g "$api\items\items.service.ts" 'data: \{ \.\.\.data|\.\.\.data,|async remove|async update|async create'; g "$api\items\items.controller.ts" '@Body\(\)'; g "$api\works\works.service.ts" 'deleteMany|Promise\.all|async update|async create|async remove'; g "$api\catalogues\porbase-import.service.ts" 'findMany\(\)|async persistContributors|persistContributors\(|rawContent: input|safeReparse'; g "$api\contributors\contributors.service.ts" 'assertAnyWorkAccess\(|private async assertAnyWorkAccess'; g "$api\bibliographic-records\bibliographic_records.service.ts" 'async update|async create|data \}|data\)'; g "$api\auth\auth.module.ts" 'JWT_SECRET'; g "$api\auth\jwt.strategy.ts" 'JWT_SECRET'; g "$api\main.ts" 'isDevelopment|useGlobalPipes|useGlobalFilters'; g "$api\common\api-exception.filter.ts" 'function codeFor|function mapHttpException|return API_ERROR_CODES.DUPLICATE_EDITION|return API_ERROR_CODES.INVALID_REFRESH_TOKEN'; g "$api\auth\auth.service.ts" 'findUnique\(\{ where: \{ email|passwordMatches'; g "$api\catalogues\catalogues.controller.ts" 'search\(|import\('; g "$api\catalogues\porbase\porbase.provider.ts" 'searchPreview'; g "$api\catalogues\catalogues.module.ts" 'maxRedirects|timeout'; g "$api\catalogues\dto\catalogue-import.dto.ts" 'rawContent!'; g "$api\catalogues\porbase.parser.ts" 'function unmappedReason|function collectUnmappedTextFields'; g "$api\exports\exports.service.ts" 'async exportMarcXchange|assertWorkAccess'; g "$api\users\users.controller.ts" '@Post\(\)'; g "$api\editions\editions.service.ts" 'async update|async remove|async create'
"=== app"; g "$app\core\network\api_client.dart" 'catch \(_\)|_refreshTokens\(\)|writeAccessToken|writeRefreshToken|_refreshInFlight \?\?='; g "$app\features\auth\data\auth_repository.dart" 'Future<void> logout|deleteAccessToken|_api.logout|AUTH_INVALID_ACCESS_TOKEN'; g "$app\features\auth\presentation\auth_controller.dart" 'Future<void> logout|Future<void> clearSession|_incrementSessionGeneration\(\)'; g "$app\features\library\controller\library_detail_controller.dart" 'Future<void> load|Future<void> exportMarcXchange|Future<LibraryFailureKind\?> deleteItem|clearSession|return LibraryFailureKind.notFound'; g "$app\features\library\presentation\library_detail_page.dart" 'deleteItemFailure|l10n.itemStatus|showDialog|tooltip: l10n.deleteItem'; g "$app\features\library\data\marcxchange_downloader_web.dart" 'readAccessToken|dart:html'; g "$app\features\catalogue\data\catalogue_api.dart" "translat|'pageCount'|'schema'|'source':"; g "$app\routing\app_router.dart" 'ref.watch\(authControllerProvider\)'

Read 

Created memory file 

# Revisão arquitectural Folio — pré Iteration 1J

Revisão read-only. Nenhum ficheiro, schema, migration, contrato ou documento foi alterado, e não foi feito nenhum comando git de escrita. Os dois repositórios estão em `main`, sem alterações pendentes. Também não executei testes nem `flutter analyze`: as conclusões vêm de leitura de código e de contagens sobre o dump PORBASE. Caminhos `../folio-api/...` apontam para o repositório irmão.

---

## 1. Resumo executivo

- **Arquitectura base:** o desenho é coerente (monólito modular, `Organization` como tenant, canónico → mapper → `MarcRecord` → serializer). A tenancy por Organization está de facto implementada: não existe `userId` como owner e os caminhos `Work`, `Edition`, `Export` e `Import` verificam membership.
- **Delete de Item:** `DELETE /items/:id` é de facto Item-only, com membership e role `STAFF` verificados. O comportamento está correcto, mas sem nenhum teste de `remove` na API.
- **Backend:** os controllers de Items, Contributors e BibliographicRecords não validam o body (usam `interface`, não classe, e o `ValidationPipe` global salta tipos `Object`). Isto permite mass-assignment, incluindo mover Items para outra Organization.
- **Flutter:** o logout, as session-generation guards e o delete estão bem desenhados e testados. Há três falhas reais por baixo, no `ApiClient`/export:
  - o export ignora o refresh e força logout;
  - uma falha no retry causa logout;
  - um refresh em curso pode repor tokens depois do logout.
- **Capas:** a API ainda não está pronta para storage. Faltam a abstracção de storage, um serviço de aquisição, um cliente HTTP “untrusted” e testes do parser sem rede. Nada disto é difícil, mas deve vir antes de qualquer download.
- **Recomendação:** **GO condicional.** Corrigir B1–B6 (secção 8) antes de implementar capas; os restantes findings podem acompanhar a 1J.

---

## 2. Conformidade com CONTEXT/AGENTS

| Área | CONTEXT/AGENTS diz | Código faz | Estado |
|---|---|---|---|
| Tenancy | Organization é a única fronteira. `Work.userId` e `Item.userId` não existem; a escrita exige STAFF+; nunca aceitar `userId` do body. | Confirmado no `schema.prisma`. Reads e writes passam por `OrganizationMembershipService`. Mas `PUT /items/:id` aceita `organizationId` do body (`items.service.ts:50-67`). `Contributor` não tem `organizationId` e é reutilizado globalmente (`porbase-import.service.ts:527`). | **divergente** |
| Auth | JWT 15 min, refresh Argon2id rotativo e de uso único, `/auth/me`, logout best-effort. | Conforme (`auth.service.ts`). O segredo JWT tem fallback fixo `'folio-development-secret'` em `auth.module.ts:13` e `jwt.strategy.ts:13`. O código `AUTH_INVALID_ACCESS_TOKEN`, usado em `auth_repository.dart:126`, não existe na API. | **parcialmente divergente** |
| Delete Item | `DELETE /items/:itemId` com confirmação, só o Item, pending e logout-safe. | Conforme. API: `items.service.ts:69`. Flutter: `library_detail_controller.dart:160`. Sem testes API para `remove`. | **conforme** (lacuna de testes) |
| Contributions | Canónicas ou fallback legado por alvo, sem mistura; o cliente não controla tags nem partes. | Exclusão por alvo implementada (`editions.service.ts` `contributionViews`). No import, tag, indicadores e `sourceParts` vêm do cliente (validados só em forma, `contributions.service.ts`). O Flutter infere WORK/EDITION por `contains('translat')` (`catalogue_api.dart:108`). | **divergente** (regra de domínio no cliente) |
| Export | Canónico → mapper → serializer; sem `rawContent`; MARCXchange. | Conforme: `exports.service.ts` e `unimarc-local.mapper.ts`. O ID é validado como cuid/uuid. Os warnings do mapper não saem do serviço (como documentado). | **conforme** |
| Import | Preview sem persistência; confirmação explícita e transaccional; `source`, `schema` e `sourceId` atribuídos pelo servidor. | Conforme: uma única `$transaction`, `source`/`sourceId` do servidor. `rawContent`, `remoteId` e `format` são ecoados do cliente (limitação documentada). O Flutter ainda envia `schema` e `source` (`catalogue_api.dart:129-130`), que o DTO descarta. O app CONTEXT diz que `pageCount` não é enviado, mas `catalogue_api.dart:65` envia-o. | **conforme** (com dívida) |
| Flutter state | Isolamento por superfície, limpeza no logout, sessionGeneration. | Conforme em controllers. O `ApiClient`/token storage não participam na geração (F2–F4 abaixo). | **parcialmente divergente** |
| Localization | Sem strings hardcoded; mapeamento por `code`. | Quase conforme. Resíduos: `'STATEMENT'` (`editable_import_preview_form.dart:261`) é um código, não texto UI. `l10n.itemStatus(item.status)` mostra o enum cru. `app_pt_PT.arb` tem menos 12 chaves que `app_pt.arb` (herda de `pt`, funcional). | **conforme** (resíduos) |
| Endpoints (app CONTEXT) | Lista `GET /catalogues/porbase/search`, `POST /catalogues/porbase/import-preview` e `POST /catalogues/porbase/import`. | O código usa `POST /catalogues/search` e `POST /catalogues/import` (`catalogue_api.dart`); o API CONTEXT confirma que as rotas PORBASE foram removidas. | **divergente** (doc do app desactualizada) |
| Paginação (app CONTEXT) | “Paginação e limites” concluídos (Fase 0). | `GET /works` é pedido uma só vez, sem cursor. O estado guarda `nextCursor`, mas nada o usa (`library_api.dart`). | **divergente** |

---

## 3. Findings

Esforço: S = pequeno e localizado, M = vários ficheiros, L = estrutural.

### P0

**API-P0-1 — JWT com segredo por defeito**
- **Repo/ficheiro:** api — `auth.module.ts:13`, `jwt.strategy.ts:13`.
- **Evidência:** `process.env.JWT_SECRET ?? 'folio-development-secret'`. Se a variável faltar em produção, o servidor arranca e aceita JWTs forjados com `sub` arbitrário.
- **Impacto:** bypass total de autenticação (fail-open).
- **Recomendação:** falhar no arranque se `JWT_SECRET` faltar ou for curto. Admitir um valor de desenvolvimento só com `NODE_ENV=development` explícito.
- **Bloqueia 1J:** sim. **Esforço:** S.
- **Testes:** arranque sem segredo falha; arranque com segredo curto falha.

### P1

**API-P1-1 — Mass-assignment em Items**
- **Repo/ficheiro:** api — `items.controller.ts:38` e `items.controller.ts:45`, `items.service.ts:46` e `items.service.ts:63`.
- **Evidência:**
  - o body é tipado `ItemInput` (interface), logo o `ValidationPipe` global (`main.ts:66`) não valida;
  - o `update` faz `{...data}` para o Prisma sem filtrar;
  - se o body não trouxer `editionId`, um `organizationId` do cliente passa directo;
  - `status` é `String` livre.
- **Impacto:** um STAFF move Items para uma Organization onde não é membro (injecção cross-tenant) e quebra o invariante `Item.organizationId = Edition.work.organizationId`. `id`/`createdAt` também são sobrescrevíveis.
- **Recomendação:** DTOs de classe (`CreateItemDto`/`UpdateItemDto`) com whitelist e `status` como enum. Um Item não muda de Edition nem de Organization. Aplicar o mesmo padrão a `ContributorInput` e `BibliographicRecordInput`.
- **Bloqueia 1J:** sim. **Esforço:** M.
- **Testes:** `PUT` com `organizationId` alheio é ignorado ou rejeitado; campos extra são removidos; um READER recebe 403.

**API-P1-2 — Contributors legados são globais**
- **Repo/ficheiro:** api — `porbase-import.service.ts:527`, `contributors.service.ts:189`, schema `Contributor` (sem `organizationId`).
- **Evidência:**
  - `transaction.contributor.findMany()` carrega todos os Contributors de todas as organizações para cada contributor importado;
  - reutiliza por nome entre organizações;
  - `assertAnyWorkAccess` aceita o acesso a *qualquer* uma das organizações ligadas.
- **Impacto:**
  - o utilizador de uma organização pode renomear ou apagar um Contributor partilhado e afectar outra organização (violação de tenancy);
  - leitura de tabela completa por contributor, com custo cada vez maior.
- **Recomendação:** curto prazo, não reutilizar Contributors entre organizações (criar sempre), ou resolver por organização através das relações. Estrutural, aposentar o fluxo legado para o import, que já tem `contributions` canónicas.
- **Bloqueia 1J:** sim (tenancy). **Esforço:** M.
- **Testes:** importar o mesmo autor em duas organizações não partilha linhas; `PUT`/`DELETE` de um Contributor não afecta a outra organização.

**API-P1-3 — `PUT /works/:id` com `editions` apaga em cascata**
- **Repo/ficheiro:** api — `works.service.ts:250`.
- **Evidência:** `edition.deleteMany({ workId })` seguido de `edition.create`. O schema tem `Item.edition onDelete: Cascade`, e `BibliographicRecord` é `SetNull`.
- **Impacto:**
  - um update “de metadados” elimina todos os Items, ExternalIdentifiers, Contributions e títulos das edições;
  - os `BibliographicRecord` ficam órfãos, com `rawContent` e sem tenant;
  - contradiz a regra “delete de Item é Item-only” do mesmo modelo de dados.
- **Recomendação:** retirar `editions` do `UpdateWorkDto` (as edições têm endpoint próprio) ou torná-lo um upsert por id. O Flutter actual não chama `PUT /works`.
- **Bloqueia 1J:** não, mas deve entrar antes da exposição pública. **Esforço:** S–M.
- **Testes:** `PUT /works` não elimina Items nem Records.

**API-P1-4 — Códigos de erro derivados do texto da mensagem**
- **Repo/ficheiro:** api — `api-exception.filter.ts:203` (`codeFor`).
- **Evidência:**
  - o `code` é inferido por `message.includes(...)`;
  - qualquer 409 sem código específico vira `CONFLICT_DUPLICATE_EDITION` (`api-exception.filter.ts:234`);
  - o 401 do guard JWT (`Unauthorized`) vira `AUTH_INVALID_REFRESH_TOKEN` (`api-exception.filter.ts:212`);
  - o 403 depende de a mensagem conter “role”.
- **Impacto:** o contrato estável depende de prosa em inglês, e o Flutter ramifica sobre esses códigos. Para capas surgem erros novos (tipo MIME, tamanho, SSRF) que seriam mal classificados.
- **Recomendação:** os services lançam `ApiException` com `code`; o filtro só mapeia o resto. Adicionar `AUTH_INVALID_ACCESS_TOKEN` e usá-lo no guard JWT.
- **Bloqueia 1J:** sim, para os códigos de capas. **Esforço:** M.
- **Testes:** um 409 genérico não vira “duplicate edition”; um 401 de access token devolve `AUTH_INVALID_ACCESS_TOKEN`; o delete devolve 404 `RESOURCE_NOT_FOUND`.

**API-P1-5 — Sem testes de Item `remove`/`update` e sem rate limiting/limites**
- **Repo/ficheiro:** api — não existe `items.service.spec.ts`. `ownership.service.spec.ts` só cobre `findById`.
- **Evidência:**
  - o delete mais crítico da 1I não tem teste na API;
  - não há throttling, helmet, request-id nem auditoria;
  - o DTO de import não tem `MaxLength`/`ArrayMaxSize` (nem `rawContent`); só o limite por defeito do body-parser protege.
- **Impacto:** regressões silenciosas de autorização; superfície aberta a abuso de `POST /users`, `/auth/login` e `/catalogues/search`, que acorda a PORBASE para qualquer utilizador autenticado.
- **Recomendação:** testes de service para Items (secção 12) e `@nestjs/throttler` nos endpoints de auth, signup e catálogo. Limites explícitos nos DTOs de import.
- **Bloqueia 1J:** testes sim; throttling não, mas recomendado. **Esforço:** M.

**APP-P1-1 — Export MARCXchange ignora o refresh**
- **Repo/ficheiro:** app — `marcxchange_downloader_web.dart:17`, `library_detail_controller.dart:131`.
- **Evidência:** o downloader usa `dart:html` directamente com `readAccessToken()`, fora do `ApiClient`. Um 401 chama `clearSession()` sem tentar refresh.
- **Impacto:** passados 15 min de sessão, o export desloga o utilizador apesar de o refresh token ser válido. No não-web o `stub` falha sempre.
- **Recomendação:** passar o download pelo `AuthHttpClient` (Dio com `responseType: bytes`), com o refresh partilhado. Isolar só o “save file” por plataforma. O mesmo canal servirá para imagens de capa.
- **Bloqueia 1J:** sim (padrão de download autenticado reutilizado). **Esforço:** M.
- **Testes:** 401 → refresh → retry bem-sucedido; 401 persistente → logout.

**APP-P1-2 — O `ApiClient` desloga em qualquer falha do retry**
- **Repo/ficheiro:** app — `api_client.dart:75`.
- **Evidência:** `catch (_) { await onUnauthorized(); }` cobre o refresh e também `_dio.fetch(request)` do retry. Um 404/500/timeout do pedido repetido desloga.
- **Impacto:** o delete pode ser enviado depois do refresh e, se falhar (rede, 404), o utilizador é deslogado em vez de ver o erro.
- **Recomendação:** só chamar `onUnauthorized` quando o refresh falha por 401/403 do `/auth/refresh`. Erros de retry propagam-se como `DioException`.
- **Bloqueia 1J:** não. **Esforço:** S.
- **Testes:** retry com 500 propaga e não desloga; refresh por timeout não desloga.

**APP-P1-3 — Refresh em curso pode repor tokens depois do logout**
- **Repo/ficheiro:** app — `api_client.dart:97-98`, `auth_repository.dart:96-107`.
- **Evidência:**
  - `_refreshTokens` escreve os tokens sem verificar a `sessionGeneration`;
  - o `logout()` só apaga os tokens locais depois de `await _api.logout(...)`, que tem timeout de até ~20 s;
  - dois acontecimentos podem repor a sessão: um refresh a terminar depois do `delete`, e o tab/app a fechar durante a janela do logout.
- **Impacto:** sessão “zombie” após logout. É a única falha da protecção anti-stale que escapa aos guards de controller.
- **Recomendação:** apagar os tokens locais primeiro e chamar o servidor depois, com o token capturado. O `ApiClient` descarta o resultado do refresh se a geração mudou.
- **Bloqueia 1J:** não, mas é pré-requisito de segurança. **Esforço:** S–M.
- **Testes:** logout durante um refresh em curso não deixa tokens no storage; logout com a rede lenta apaga imediatamente.

**APP-P1-4 — Biblioteca só mostra a primeira página**
- **Repo/ficheiro:** app — `library_api.dart` (`fetchWorks` sem cursor), `library_controller.dart`.
- **Evidência:** `nextCursor` e `hasMore` são guardados e nunca usados. A API limita a 25 por defeito.
- **Impacto:** um utilizador com mais de 25 obras não vê as restantes, o que é perda de funcionalidade e não perda de dados.
- **Recomendação:** `loadMore` com `cursor` e guarda de geração, mais um teste.
- **Bloqueia 1J:** não. **Esforço:** S–M.

### P2

| ID | Repo | Evidência | Impacto / recomendação | Bloqueia 1J | Esforço |
|---|---|---|---|---|---|
| API-P2-1 | api | `main.ts:12`: `isDevelopment = NODE_ENV !== 'production'` e a lista de origens de produção é fixa (`https://app.fol.io`). Sem `NODE_ENV` abre CORS para redes privadas. | Inverter o default (produção por omissão) e ler as origens do ambiente. | não | S |
| API-P2-2 | api | `Item.status` é `String` livre (`schema.prisma`); o Flutter mostra o valor cru (`l10n.itemStatus(status)`). | Enum de estado e localização no Flutter. | não | S |
| API-P2-3 | api | `PUT /editions/:id` actualiza escalares mas não `EditionTitle`/`EditionLanguage` (fonte canónica). | Reads mostram títulos canónicos desactualizados. Sincronizar a projecção ou rejeitar. | não | M |
| API-P2-4 | api | `BibliographicRecord` tem `PUT` com `rawContent` editável e `workId`/`editionId` novos sem validação de ownership (`bibliographic_records.service.ts:55-61`). | Viola “rawContent imutável” e permite reatribuir um Record a uma edição alheia. Tornar o Record read-only por HTTP, ou DTO sem `rawContent`/relações. | não | S |
| API-P2-5 | api | `WorksService.create`: `Promise.all` de `edition.create` fora de transacção (`works.service.ts:195`); `PUT /works` pode mover um Work de Organization sem mover Items, ExternalIdentifiers ou Agents. | Estados parciais e invariantes de tenant quebrados. Transacção; proibir a mudança de Organization. | não | S–M |
| API-P2-6 | api | `rawContent` do preview é ecoado do cliente, e a proveniência confia nele (documentado). `BibliographicRecord` não tem hash nem organização. | Um record pode divergir dos campos estruturados. Para capas, **nunca** aceitar `coverUrl` do cliente (secção 7). | não | M |
| API-P2-7 | api | O login só verifica o hash se o utilizador existe (`auth.service.ts:19-25`); `POST /users` sem throttling. | Timing e enumeração por email. Hash fictício e throttling. | não | S |
| API-P2-8 | api | Sem request/correlation id, auditoria, nem `maxContentLength` no cliente PORBASE (`catalogues.module.ts:24-25` só tem timeout e `maxRedirects: 0`). | Pouca rastreabilidade; uma resposta enorme pode esgotar a memória. | não | M |
| API-P2-9 | api | `BibliographicRecord` tem uma só linha por import e `remoteId` sem unicidade. | Várias fontes futuras exigirão `contentHash`, `acquiredAt`, `parserVersion` (já previstos no CONTEXT). | não | M |
| APP-P2-1 | app | `library_detail_page.dart:122`: a mesma mensagem para qualquer falha de delete. Em 404 ou 403 o Item fica na lista sem refresh. | Mapear `LibraryFailureKind` para mensagens; em `notFound` recarregar o detalhe. | não | S |
| APP-P2-2 | app | O diálogo de delete é genérico e a tile mostra apenas estado e label (`library_detail_page.dart:239`). | Com vários Items sem label, o utilizador não sabe qual remove. Incluir identificação (label, localização) no diálogo. | não | S |
| APP-P2-3 | app | `library_detail_controller.dart:66-74`: `load()` repõe o estado com `LibraryDetailState(loading)` e perde `deletingItemIds`. Não há token de pedido: um `load()` anterior ao delete, a chegar depois, repõe o Item apagado. | Risco de rollback visual e de duplo DELETE (o segundo devolve 404). Pedido com contador de sequência e preservação de `deletingItemIds` (secção 6). | não | S |
| APP-P2-4 | app | Após apagar o último Item, a Edition continua; a importação do mesmo ISBN devolve 409 `CONFLICT_DUPLICATE_EDITION` e o Flutter não tem “adicionar exemplar”. | O utilizador não consegue recuperar a cópia. Fluxo “adicionar exemplar” (`POST /items` existe) ou importar para uma Edition existente. | não | M |
| APP-P2-5 | app | `dart:html` com `dart.library.html` em `marcxchange_downloader.dart`. | Incompatível com Wasm e sem suporte mobile. Resolve-se em APP-P1-1. | não | M |
| APP-P2-6 | app | O app CONTEXT lista endpoints PORBASE antigos e paginação como concluída. | Doc desactualizada (secção 2). | não | S |

### P3

- Router recriado em cada mudança de `authControllerProvider` (`app_router.dart:14`); usar `refreshListenable`.
- `app_pt_PT.arb` com 12 chaves em falta face a `app_pt.arb` (funcional por herança, mas frágil).
- O spinner de delete sem `semanticsLabel`; o tooltip `deleteItem` cobre o botão normal.
- Tokens na Web ficam no storage do browser (limitação do `flutter_secure_storage` na Web); aceitável com CSP e sessões curtas.
- `GET /works` inclui todas as relações canónicas por obra (payload pesado); considerar uma projecção de lista.

---

## 4. Problemas concretos das iterações recentes

1. **1I (delete de Item):** a API não tem testes de `remove`. O mass-assignment em `PUT /items` abre uma via de mover Items entre organizações, o que contradiz a regra “Item-only”.
2. **1I-FLUTTER.2:** a protecção contra duplo delete é perdida se `load()` correr durante o pedido. O feedback é único e não distingue 403 de 404.
3. **Logout/stale:** controllers com guard; `ApiClient`, refresh e storage sem guard (APP-P1-2 e APP-P1-3).
4. **Contributions Phase 1:** a regra WORK/EDITION por `contains('translat')` no cliente contradiz “não inferir scope do papel”. O caminho legado partilha Contributors entre organizações.
5. **Import:** a `Organization` por defeito (primeira membership OWNER) é usada pelo import, enquanto `GET /works` mostra todas as organizações do utilizador. Com várias organizações, o que o utilizador importa pode não aparecer onde espera. Limitação conhecida (sem “organização activa”).

---

## 5. Análise do delete de Item

| Aspecto | Resultado |
|---|---|
| Endpoint | `DELETE /items/:id` (`items.controller.ts`). Devolve o Item removido com 200. |
| Service | `ItemsService.remove` → `findById` (404 se inexistente, membership da organização do Item) → `assertRole(STAFF)` → `prisma.item.delete`. |
| Autorização | READER recebe 403 (código `AUTHORIZATION_WRITE_ROLE_REQUIRED`, derivado da mensagem). Outra Organization: 403 `AUTHORIZATION_MEMBERSHIP_REQUIRED`. |
| Inexistente | 404 `RESOURCE_NOT_FOUND`. |
| Existe mas é de outra Organization | 403, e não 404. Distingue “existe” de “não existe” (enumeração leve; com cuid é de baixo risco). |
| Transacção/FK | Um único `delete`; nenhum modelo aponta para Item (sem Loan). Sem efeitos laterais. |
| Edition/Work/Record | Intactos. O Item tem `onDelete: Cascade` a partir da Edition, não o contrário. |
| Realmente Item-only? | **Sim.** Mas `PUT /works` com `editions` e `DELETE /editions` apagam Items em cascata (API-P1-3). |
| Contrato de erro | Consistente, mas os códigos de 403/404 dependem do texto (API-P1-4). |
| Testes | Flutter: cancelamento, sucesso, falha, pending e logout stale. API: nenhum. |

---

## 6. Análise do estado Flutter e do logout

**Bem feito**
- Cada superfície tem a sua família Riverpod (`catalogueControllerProvider(CatalogueFlow.*)`).
- O logout incrementa a geração e limpa catálogo, biblioteca, todas as entradas de detalhe activas e a configuração da organização (`auth_controller.dart:137`).
- Todos os controllers verificam a geração antes de escrever estado.
- O delete só actualiza a lista depois de a API confirmar, e mantém os outros Items. A resposta tardia de um logout é descartada (teste em `library_detail_test.dart:315`).
- O erro de rede e o erro HTTP são separados por `code` antes do estado HTTP, em `AuthRepository` e `LibraryRepository`.

**Lacunas**
- **Refresh pós-logout:** ver APP-P1-3. O storage é apagado depois da chamada de rede, e o refresh pode reescrever tokens.
- **Rollback por `load()` concorrente:** ver APP-P2-3. O `load()` reconstrói o estado do zero, sem sequência. Um `load()` iniciado antes do delete e concluído depois repõe o Item. O export e o delete não se sobrepõem de forma destrutiva, porque ambos fundem com `state.detail`; o risco é do `load()`.
- **Delete e `load()`:** o `deleteItem` devolve `notFound` quando o Item não está na lista ou já está a ser apagado. A UI mostra “falha” num toque duplicado legítimo.
- **Mensagem única de falha:** ver APP-P2-1.
- **Acessibilidade do botão:** o botão tem `tooltip` (rótulo semântico) e fica `onPressed: null` durante o pedido; adequado. O spinner não tem rótulo.
- **Strings:** o delete usa chaves ARB (`deleteItem*`); sem hardcoding.
- **Item status:** `l10n.itemStatus(item.status)` apresenta o enum cru.
- **Consumo exclusivo da API Folio:** confirmado, os `*_api.dart` só chamam `/auth`, `/catalogues`, `/works`, `/editions`, `/items`, `/organizations`. O export web usa a mesma base da API.

---

## 7. Arquitectura recomendada para capas

### Estado actual
- O parser PORBASE não trata `856`: cai em `UnmappedSourceField` (`porbase.parser.ts:849`, `unmappedReason` devolve `UNSUPPORTED`). O `rawContent` já está persistido.
- Num dump PORBASE local (`bibliographics_1_to_55966.xml`) há 1632 campos `856`. Os valores incluem `http://rnod.bnportugal.gov.pt/ImagesBN/winlibimg.aspx?...` (HTTP sem TLS), `https://purl.pt/37597` (objecto digital, **não imagem**) e `https://purl.pt/37597/service/media/cover/low` (imagem). **O `856` não é um campo “capa”**: é um link electrónico genérico. `ind2` e a URL só dão pistas.

### Responsabilidade
- **Owner: a Edition.** A capa descreve a manifestação, partilhada por todos os Items. O Item pode ter uma foto própria no futuro (estado físico), mas isso é outro conceito.
- A API de leitura devolve `coverUrl` relativa (`/editions/:id/cover`), nunca a URL PORBASE. O Flutter não contacta a origem (consistente com AGENTS).

### Modelo de dados (migration aditiva)
```
CoverCandidate            (candidata, proveniência)
  id, editionId, organizationId
  sourceUrl (texto), sourceTag='856', sourceRecordId?
  status: PENDING | ACQUIRED | REJECTED | FAILED | EXPIRED
  failureReason?, attempts, lastAttemptAt, nextAttemptAt?
  createdAt, updatedAt

CoverAsset                (ficheiro adquirido, deduplicável)
  id, organizationId
  contentHash (sha256), mimeType, byteSize, width, height
  storageKey, storageBackend
  createdAt
  @@unique([organizationId, contentHash])

EditionCover              (selecção activa)
  editionId @unique, coverAssetId, selectedFromCandidateId?
  updatedAt
```
- Mantém o domínio canónico livre de infraestrutura: `storageKey` e `storageBackend` ficam no `CoverAsset`, nunca na Edition.
- `organizationId` desnormalizado para o endpoint de imagem e a limpeza, com o mesmo invariante que `ExternalIdentifier`.
- **Access links / `coverUrl`:** é um campo calculado no DTO de leitura (`coverUrl` ou `null`); nenhuma coluna guarda URLs públicas.

### Camadas
```
CoversController (fino)                      GET /editions/:id/cover
  → CoverQueryService     → membership da Organization da Edition
  → StorageService (interface)  put/get/delete/exists
        LocalFileSystemStorage (dev)   S3CompatibleStorage (prod)

CoverAcquisitionService (application service)
  → CoverCandidateExtractor     856 do rawContent persistido
  → SafeHttpFetcher             (SSRF, timeout, tamanho, MIME)
  → ImageValidator              (magic bytes, dimensões)
  → StorageService + repositório CoverAsset
```
- **Onde vive a validação SSRF:** num `SafeHttpFetcher` próprio, em `src/common/net/` ou `src/covers/`, **não** no `PorbaseAdapter` actual, que é um cliente de confiança para um host fixo. O módulo HTTP de PORBASE usa `HttpModule` global do módulo `Catalogues`, que é adequado para um host conhecido, não para URLs derivados de dados.
- **Políticas do fetcher:**
  - só `https` (e `http` apenas por lista explícita se o BNP não suportar TLS);
  - allowlist de hosts por configuração; a resolução DNS é feita uma vez e o IP resolvido é validado e usado na ligação (evita DNS rebinding);
  - bloquear loopback, link-local, ranges privados, metadados cloud (`169.254.169.254`), IPv6 equivalente e portas fora de 80/443;
  - redirecionamentos manuais, no máximo 3, validando cada salto de novo (o `maxRedirects: 0` actual deve manter-se para a PORBASE e ser controlado à parte para capas);
  - `timeout` total curto, `maxContentLength` (por exemplo 5 MB) com leitura em *stream* e corte, e `Accept: image/*`;
  - validar MIME pelos *magic bytes* (JPEG, PNG, WebP), nunca pelo `Content-Type` nem pela extensão; limitar dimensões; reprocessar a imagem para eliminar metadados é opcional;
  - não seguir cookies nem enviar credenciais.
- **O `rawContent` nunca viaja para a decisão de rede:** o extractor lê o `856` do `rawContent` **já persistido**, como o import já faz para `unmappedFields` (`safeReparseUnmappedFields`). Um `coverUrl` enviado pelo cliente é ignorado.

### Quando descarregar
- **Fora do import.** O import é uma transacção sobre PostgreSQL, com timeout de 15 s para o pedido HTTP, e não deve esperar por IO externo.
- Dentro da transacção do import grava-se só a `CoverCandidate` (`PENDING`) extraída do `rawContent`.
- Um passo posterior (job) faz o download. Na primeira versão pode ser um processamento *fire-and-forget* após o commit com retry limitado e idempotente, tolerando reinício. Quando houver a infra de jobs do CONTEXT (Fase 2), passa para fila.
- **A falha de capa nunca bloqueia o import:** o import conclui e a capa fica `PENDING`/`FAILED` com `failureReason` e `nextAttemptAt` (backoff). O Flutter mostra um placeholder.

### Endpoint de imagem e tenancy
- `GET /editions/:editionId/cover`, protegido por JWT: carrega a Edition, faz `assertWorkAccess(userId, edition.work)` (como o export) e só então lê o `CoverAsset` via `StorageService`.
- Resposta com `Content-Type` do `mimeType` validado, `X-Content-Type-Options: nosniff`, `ETag` = `contentHash` e `Cache-Control: private, max-age=…`. Nunca se expõe `storageKey` nem URLs assinadas por defeito. Em produção, URLs assinadas curtas são uma otimização posterior.
- **Flutter:** o `Image.network` do Flutter envia headers por `headers:`; é preferível um `NetworkImage` com `Authorization` através de um provider no `library`, ou obter os bytes pelo `AuthHttpClient` (o mesmo canal que o export, APP-P1-1). `coverUrl` é relativa à API.

### Cache, actualização e deduplicação
- `ETag`/`If-None-Match` no endpoint e cache privada no cliente.
- Actualização manual (“procurar capa de novo”) cria nova candidata; se o hash coincidir, reaproveita o `CoverAsset`.
- Deduplicação por `(organizationId, contentHash)`: duas edições com a mesma imagem partilham o ficheiro (contagem de referências por `EditionCover`).
- **Órfãos:** um job de limpeza apaga `CoverAsset` sem `EditionCover` há mais de N dias e remove o ficheiro **depois** da linha (ordem para evitar referências penduradas). A remoção de Edition/Work deve libertar as referências (hoje o `DELETE` em cascata não conhece o storage).
- **PORBASE em baixo:** a capa já adquirida continua a servir-se do storage; a candidata falhada entra em backoff e é descartada (`EXPIRED`) após o limite de tentativas. Nunca se faz *proxy* em tempo real da origem.

### Testes sem PORBASE online
- Fixtures de `856` (os do dump acima e o fixture `porbase-9789724426495.txt`).
- Um `FakeHttpFetcher` e um `InMemoryStorage` injectados por interface.
- Testes do `SafeHttpFetcher` com um servidor HTTP local e *stubs* de DNS: loopback, redirect para IP privado, resposta enorme, MIME falso, timeout.

### Respostas explícitas (Foco antes de capas)
1. **Pronta para storage sem misturar domínio e infra?** Ainda não. Falta `StorageService`, o módulo de capas e o fetcher; as entidades canónicas estão limpas e não têm campos de infraestrutura, o que ajuda.
2. **Existe application service para aquisição?** Não. `CataloguesModule` é só pesquisa e import; criar `CoverAcquisitionService`.
3. **Onde vive o SSRF?** No `SafeHttpFetcher`, partilhado e testado em isolamento, nunca no controller nem no `PorbaseAdapter`.
4. **Como o endpoint respeita tenancy?** Pela membership da Organization da Edition, o mesmo critério do export.
5. **Download síncrono ou posterior?** Posterior ao commit do import.
6. **Como evitar que a capa bloqueie o import?** A candidata grava-se na transacção; o download corre depois e a sua falha só altera o estado da candidata.
7. **`coverUrl` sem URL PORBASE?** Campo calculado `/editions/:id/cover`; a origem fica só em `CoverCandidate.sourceUrl`, que não é exposto.
8. **Testar sem PORBASE?** Fixtures, fakes injectados e servidor local para o fetcher.
9. **Migration?** Aditiva: `CoverCandidate`, `CoverAsset`, `EditionCover` e os enums, com índices por `organizationId`. Sem alteração a tabelas existentes. A base de desenvolvimento pode ser reposta (CONTEXT).
10. **O que fica para depois?** Fila de jobs, URLs assinadas e object storage em produção, selecção manual entre candidatas, fotos por Item, reprocessamento de imagens e *thumbnails*.

---

## 8. Backlog mínimo antes da Iteration 1J

| # | Item | Findings | Bloqueia |
|---|---|---|---|
| B1 | `JWT_SECRET` obrigatório e remover o fallback | API-P0-1 | sim |
| B2 | DTOs de classe e whitelist para Items (e Contributors, BibliographicRecords sem `rawContent` nem relações editáveis) | API-P1-1, API-P2-4 | sim |
| B3 | Isolar Contributors por Organization no import legado; remover `findMany()` global | API-P1-2 | sim |
| B4 | Códigos de erro por `ApiException` e `AUTH_INVALID_ACCESS_TOKEN` no guard JWT | API-P1-4 | sim |
| B5 | Testes API de `ItemsService.remove/update/create` | API-P1-5 | sim |
| B6 | Download autenticado pelo `ApiClient` (refresh) e retry sem logout indevido | APP-P1-1, APP-P1-2 | sim |
| B7 | Logout: apagar tokens primeiro e guarda de geração no refresh | APP-P1-3 | recomendado |
| B8 | `PUT /works` sem `editions` destrutivo | API-P1-3 | recomendado |
| B9 | Paginação “carregar mais” na biblioteca | APP-P1-4 | não |
| B10 | Throttling e limites de DTO de import | API-P1-5 | recomendado |

---

## 9. Riscos aceites (para esta fase)

- Uma sessão de refresh por utilizador (múltiplos dispositivos invalidam-se).
- `rawContent` e `remoteId` ecoados do cliente: a proveniência é do utilizador revisor, não do servidor, até haver snapshot de preview.
- Access token não revogável durante 15 min após logout.
- Sem “organização activa”: o import vai sempre para a primeira Organization OWNER.
- Roles não projectados em `/auth/me`: o botão de delete aparece a READER e falha com 403.
- Armazenamento de tokens na Web pelo `flutter_secure_storage`.
- Item sem fluxo de “adicionar exemplar” no Flutter (APP-P2-4), enquanto o delete é Item-only.
- Base de desenvolvimento descartável (CONTEXT) dispensa compatibilidade de dados para a migration das capas.

---

## 10. Recomendação go/no-go

**GO condicional** para a Iteration 1J, desde que B1–B6 estejam concluídos.

- **Porquê não NO-GO:** o domínio canónico, a tenancy por Organization, o pipeline mapper/serializer e o delete de Item estão correctos no essencial; as falhas são localizadas e de baixo esforço.
- **Porquê condicional:** B1 é um fail-open de autenticação; B2 e B3 são rupturas reais da fronteira de tenancy; B4 e B6 são pré-requisitos directos do desenho de capas (erros estáveis e download autenticado com refresh).

---

## 11. Ordem exacta das próximas tarefas

1. **B1** — `JWT_SECRET` obrigatório e testes de arranque.
2. **B5** — escrever primeiro os testes de Items (caracterizam o comportamento actual e falham onde há mass-assignment).
3. **B2** — DTOs de Items (e dos outros dois controllers); os testes de B5 passam.
4. **B3** — Contributors por Organization no import legado, com teste de isolamento.
5. **B4** — `ApiException` com `code` nos services; `AUTH_INVALID_ACCESS_TOKEN`; actualizar o `CONTEXT.md` da API com o novo código.
6. **B8** — retirar `editions` destrutivo de `PUT /works`.
7. **B7 + APP-P1-2** — `ApiClient`: sem logout em falha de retry, guarda de geração no refresh, logout com apagar-primeiro.
8. **B6** — download autenticado pelo `ApiClient` (bytes), com teste de 401 → refresh → retry.
9. **B10** — throttling e limites de DTO.
10. **Contrato de capas** — migration aditiva e interface `StorageService` com `InMemoryStorage` para testes, sem download ainda.
11. **Parser** — extractor de `856` a partir do `rawContent` persistido, com testes de fixtures.
12. **`SafeHttpFetcher`** com a bateria SSRF/tamanho/MIME.
13. **`CoverAcquisitionService`**, depois `GET /editions/:id/cover`, depois `coverUrl` no DTO de leitura, e só no fim a UI Flutter.
14. **B9**, **APP-P2-1/2/3** e as correcções de documentação (secção 2) em paralelo, sem bloquear.

---

## 12. Testes recomendados

**API**
- Items: `PUT` com `organizationId` alheio é ignorado ou rejeitado; campos extra removidos; `status` inválido recusado; `remove` por READER → 403; por outra Organization → 403; Item inexistente → 404 `RESOURCE_NOT_FOUND`; `remove` não toca em Edition, Work nem Record.
- Contributors: importar o mesmo autor em duas organizações não partilha linhas; `PUT`/`DELETE` não afecta a outra organização.
- Works: `PUT /works` com `editions` não apaga Items (ou é rejeitado).
- Records: `PUT` não altera `rawContent` nem muda a relação para uma edição alheia.
- Erros: um 409 genérico não vira `CONFLICT_DUPLICATE_EDITION`; um 401 do guard devolve `AUTH_INVALID_ACCESS_TOKEN`; um 403 de role e de membership têm códigos distintos sem depender do texto.
- Arranque: falha sem `JWT_SECRET`; `NODE_ENV` ausente não abre o CORS de desenvolvimento.
- Capas (quando existirem): extractor de `856` com os fixtures; `SafeHttpFetcher` (loopback, redirect para IP privado, DNS rebinding, tamanho, MIME falso, timeout); `GET /editions/:id/cover` com READER permitido e não-membro 403; import com PORBASE indisponível conclui sem capa.

**Flutter**
- `ApiClient`: 401 → refresh → retry; retry com 500 não desloga; refresh por timeout não desloga; logout durante refresh em curso não deixa tokens no storage; logout com rede lenta apaga imediatamente.
- Detalhe: `load()` iniciado antes do delete e concluído depois não repõe o Item; `deletingItemIds` sobrevive a `load()`; falha 404 recarrega a lista; falha 403 e erro de rede mostram mensagens distintas; o diálogo identifica o Item com vários Items.
- Export: 401 → refresh → sucesso; 401 persistente → logout.
- Biblioteca: `loadMore` com cursor e guarda de geração.
- Localização: teste de paridade de chaves entre `app_en`, `app_pt` e `app_pt_PT`; o status do Item é localizado.

Created 6 todos


# Após correr correcções

Updated todo list

Vou verificar o estado real do código antes de opinar. Na API confirmo os pontos P0/P1 e os P2 em aberto; no app faço apenas leitura dos ficheiros relevantes para validar os APP-P1.   

Ran terminal command:  cd /home/folio/projects/folio/folio-app && git status --short --branch | head -5; grep -n "onUnauthorized\|generation\|Generation\|catch" lib/core/network/api_client.dart | head -40; echo ---; grep -n "deleteAccessToken\|deleteRefreshToken\|_api.logout\|clear" lib/features/auth/data/auth_repository.dart | head; echo ---; ls lib/features/library/data | head -20; grep -rn "dart:html\|readAccessToken" lib/features/library/data | head

   

No matches found. Your search pattern might be excluded completely by either the search.exclude settings or .*ignore files.
If you believe that it should have results, you can check into the .*ignore files and the exclude setting (here are some excluded patterns for reference:[**/node_modules,**/bower_components,**/*.code-search]).
Then if you want to include those files you can call the tool again by setting "includeIgnoredFiles" to true.

Searched for regex `@Body\(\) body: (Partial<)?(ContributorInput|BibliographicRecordInput|ExternalIdentifierInput|EditionInput)|isDevelopment|JWT_SECRET|Promise\.all` (`**/src/**/*.ts`), 25 results

Searched for regex `856|maxContentLength|maxRedirects|timeout|HttpModule` (`**/src/catalogues/**/*.ts`), 12 results

Read 

Read , lines 1 to 70

Ran terminal command:  cd /home/folio/projects/folio/folio-app && sed -n 1,60p lib/features/library/data/marcxchange_downloader_web.dart; grep -n "exportMarcXchange\|ResponseType.bytes\|responseType" -r lib/features/library | head; sed -n 90,125p lib/features/auth/data/auth_repository.dart

Searched for regex `throw new (BadRequestException|ForbiddenException|NotFoundException|ConflictException|UnauthorizedException)` (`**/src/**/*.ts`), 34 results

Ran terminal command:  cd /home/folio/projects/folio/folio-app && grep -rn "ResponseType\|fetchMarcXchange\|marcxchange" lib --include=*.dart -i | grep -v "l10n/\|generated" | head -15; sed -n 100,135p lib/features/library/controller/library_detail_controller.dart

Ran terminal command:  cd /home/folio/projects/folio/folio-app && sed -n 66,175p lib/core/network/api_client.dart

# Revisão curta pré-1J (capas)

Li o código da API e, só em leitura, os ficheiros relevantes do app. Não voltei a correr testes; os números de build e testes são os que indicou.

## 1. P0/P1

| Finding | Estado | Evidência e ressalva |
|---|---|---|
| API-P0-1 JWT_SECRET | **Resolvido** | `jwt.configuration.ts` falha sem segredo ou com menos de 32 bytes. Só `NODE_ENV=test` tem segredo de teste. |
| API-P1-1 Items | **Resolvido** | DTOs de classe, whitelist no service e `organizationId` derivado da Edition. Os controllers de **Contributors e BibliographicRecords continuam com `interface`**. |
| API-P1-2 Contributors | **Resolvido no import** | O import só escreve Contributions/Agents. As linhas legadas partilhadas ficam como dados históricos, e as operações HTTP exigem acesso a todas as organizações ligadas. |
| API-P1-3 PUT /works | **Resolvido** | O DTO é scalar-only (`title`, `subtitle`) e o service já não apaga Editions. |
| API-P1-4 Códigos por texto | **Parcial** | O filtro já não infere códigos de texto, e Auth, Items, membership, Organizations e catálogo usam `ApiException`. Mas **34 pontos de `throw` em 11 ficheiros** ainda usam exceções Nest simples (Editions, Works, BibliographicRecords, Contributions, ExternalIdentifiers, Exports, Users). Dão agora códigos genéricos. Por exemplo, "Edition not found" passou de `EDITION_NOT_FOUND` para `RESOURCE_NOT_FOUND`. |
| APP-P1-1 Export | **Resolvido** | O downloader usa o cliente partilhado; a classe de plataforma só grava o ficheiro. Existe `getBytes` para reutilizar nas capas. |
| APP-P1-2 Retry | **Resolvido** | O retry só termina a sessão se falhar com 401. Qualquer outro erro do retry propaga-se, e o refresh só termina a sessão com 401/403. |
| APP-P1-3 Refresh pós-logout | **Resolvido** | O logout apaga os tokens locais antes de chamar o servidor. O refresh descarta o resultado se a geração mudou e limpa os tokens se o logout ocorreu durante a escrita. |

Duas correcções ao seu sumário:
- B4 não cobre "todos os services".
- Verifique se o Flutter ramifica sobre `EDITION_NOT_FOUND`. Não verifiquei, e pode ter regredido silenciosamente.

## 2. Arquitectura de capas

**Separação domínio/infra: correcta, com quatro ajustes.**
- O domínio fica livre de storage, e `CoverAsset` guarda `storageKey` e backend.
- `CoverCandidate` deve ligar ao `BibliographicRecord`, porque é proveniência. Com restrição única `(bibliographicRecordId, hash da URL)`, a re-extracção é idempotente.
- Acrescentar o estado `ACQUIRING`. A reclamação de uma candidata faz-se com UPDATE condicional (`PENDING→ACQUIRING`), para não haver downloads duplicados com várias instâncias.
- As chaves de storage são geradas pelo servidor, nunca derivadas de input, e o `StorageService` valida-as contra path traversal.
- A deduplicação por `(organizationId, contentHash)` está bem. Deduplicar entre organizações revelaria a existência da imagem.

**Extractor a ler o `rawContent` persistido: sim, mas essa fonte não é uma fronteira de confiança.**
- O `rawContent` vem **do cliente** no import (limitação documentada).
- Hoje o `PUT /bibliographic-records/:id` ainda o permite alterar e reatribuir a outra Edition (API-P2-4).
- Um STAFF controla, portanto, os URLs que o servidor irá descarregar.
- A defesa real é o `SafeHttpFetcher` com **allowlist obrigatória**.
- O `856` deve passar a ser parseado como "localização electrónica" estruturada (`$u`, `$q` MIME, `$y` texto). Assim sai dos "não mapeados" e as candidatas criam-se na transacção do import.
- Regra de classificação: só se descarrega quando o MIME indica imagem ou o URL corresponde a um padrão registado para o host (por exemplo `/service/media/cover/`). Caso contrário a candidata fica `REJECTED(NOT_IMAGE_LINK)` sem pedido de rede. Um `purl.pt/37597` é um objecto digital, não uma imagem.

**Download assíncrono: sim.**
- A candidata grava-se no commit do import e o download corre depois.
- Um fire-and-forget em processo perde-se num restart, por isso precisa de um varrimento de `PENDING` com `nextAttemptAt` no arranque. Não precisa de fila.
- Com retry limitado e backoff, uma falha nunca bloqueia o import.

**SSRF: a descrição actual não é suficiente. Falta:**
- **Ligar ao IP validado.** Validar o IP no `lookup` do agente HTTP, no momento da ligação. Resolver antes e pedir depois por hostname deixa um TOCTOU (DNS rebinding).
- **Allowlist de hosts obrigatória** (BNP e purl), mais esquema https. `http` apenas por host explicitamente listado, e como o conteúdo pode ser adulterado em trânsito, a validação por magic bytes e o `nosniff` passam a ser obrigatórios.
- **Redirects manuais** (máx. 3), revalidando host e IP em cada salto. O comportamento de redirect de `purl.pt` deve ser testado, porque determina a allowlist final.
- **Proxy desligado** (`proxy: false`), para variáveis `HTTP(S)_PROXY` não contornarem a validação.
- **Intervalos bloqueados:** loopback, link-local (169.254/16), privados, CGNAT (100.64/10), `::ffff:` mapeado, `fc00::/7`, `fe80::/10`, `0.0.0.0`, URLs com userinfo, e portas fora de 80/443.
- **Limites:** tamanho do corpo cortado em stream e depois de descompressão, limite de dimensão/pixels antes de descodificar (bomba de descompressão), timeout total e de ligação, concorrência global e por host.
- **Testes com servidor local:** só aceita hosts de teste via configuração de teste, nunca por flag em produção.

**Endpoint de imagem e tenancy: sim, se copiar o padrão do export.**
- Pipe de ID cuid + `assertWorkAccess` **antes** de ler o storage.
- `Content-Type` vem do `mimeType` validado, nunca da origem. Mais `nosniff` e `Cache-Control: private`.
- O `ETag` só é comparado depois da autorização.
- Nunca se expõe `storageKey` nem o URL de origem.
- Sem capa devolve 404 com código próprio (`COVER_NOT_FOUND`).
- O `coverUrl` no DTO de leitura deve ser `null` quando não há `EditionCover`, para a grelha não gerar tempestades de 404.

**CORS vs ETag: o que falta.** O CORS actual só permite os headers `Content-Type` e `Authorization`.
- Pedidos condicionais da Web (`If-None-Match`) falham no preflight.
- É preciso `allowedHeaders` com `If-None-Match` e `exposedHeaders: ['ETag']`.

**O que falta antes de implementar:**
1. **Decisão de licenciamento.** Guardar capas da BNP implica termos de reutilização. É uma decisão de produto, não técnica, e deve estar tomada antes de `.3`.
2. **Configuração:** `COVER_ALLOWED_HOSTS`, limites e raiz de storage, em `.env.example`.
3. **Códigos de erro `COVER_*` explícitos** (nenhum erro de capa deve usar texto).
4. **Limpeza de órfãos.** O delete em cascata de uma Edition remove as linhas, mas não os ficheiros, e `CoverAsset` não tem FK para a Edition.
5. **Fixtures de `856` copiadas** para o repositório da API. O dump actual está no repositório do app.
6. **A migration é aditiva, mas precisa de aprovação explícita.** A BD de desenvolvimento é partilhada, e não se deve aplicar sem instrução.

## 3. Riscos residuais

**Subir antes de `1J-API.2`:**
- **API-P2-4 (BibliographicRecord editável): passa a bloqueante.** Tornar `rawContent` e relações imutáveis por HTTP, ou o record read-only. É a entrada do extractor.

**Antes de `1J-API.5` (endpoint):**
- Conversão dos 34 `throw` para `ApiException`, pelo menos nos caminhos de Editions e Exports, para o endpoint de capa não ficar inconsistente com o export.
- **Throttling/concorrência (B10).** Não bloqueia `.0–.3`, mas **deve existir antes de activar `.4` fora de desenvolvimento**, porque cada import passa a gerar pedidos de saída.
- CORS: `If-None-Match` e `ETag`, como acima.

**Durante a 1J, sem bloquear:**
- **API-P2-1 CORS em produção:** inverter o default (produção por omissão e origens por ambiente). Esforço S. Fazer já, porque o JWT já falha sem segredo, mas o CORS ainda abre redes privadas se `NODE_ENV` faltar.
- **APP-P2-3 (rollback por `load()`) e APP-P2-1/2:** fazer **antes** de `1J-FLUTTER.1`. A apresentação de capas acrescenta pedidos assíncronos no mesmo ecrã e agrava a corrida existente.
- **APP-P1-4 (paginação):** em paralelo. Relevante para a grelha de capas.

**Fora da 1J:**
- **API-P2-3 (PUT /editions não actualiza o canónico): subir de prioridade.** Desde 1G o export prefere títulos e línguas canónicos, logo uma edição de título por `PUT` deixa de aparecer no MARCXchange. Agendar logo a seguir à 1J. Se o app ainda não chama `PUT /editions`, o impacto actual é baixo.
- **API-P2-2 (Item.status como String):** exige migration; manter separada da migration das capas.
- **API-P2-5 (WorksService.create sem transacção):** correcção pequena, independente.
- Contributors com `interface` no controller (o service já filtra campos).

## 4. Recomendação

**GO condicional.**

- **GO imediato** para `1J-API.0` e `1J-API.1`.
- **`1J-API.2` só depois** de tornar o `BibliographicRecord` imutável por HTTP.
- **`1J-API.3` depende** da decisão de licenciamento e da lista de hosts.
- **`1J-API.4` só se activa fora de desenvolvimento** com throttling e limite de concorrência.

Nenhum destes requisitos é grande. O único realmente bloqueante é a imutabilidade do `BibliographicRecord`.

## 5. Ordem da 1J (ajustada)

```text
Gate    BibliographicRecord read-only por HTTP (rawContent e relações);
        códigos COVER_* definidos; CORS (If-None-Match/ETag + default prod)
1J-API.0  Migration: CoverCandidate (ligada a BibliographicRecord, ACQUIRING,
          única por URL), CoverAsset, EditionCover        [aprovação explícita]
1J-API.1  StorageService + InMemoryStorage + LocalFsStorage (chaves do servidor)
1J-API.2  Parser 856 estruturado + extractor + classificação (REJECTED sem fetch)
          + candidatas criadas na transacção do import
1J-API.3  SafeHttpFetcher (allowlist, IP pinning, redirects, proxy off, limites)
          + ImageValidator (magic bytes, dimensões)        [após decisão de licenças]
1J-API.4  CoverAcquisitionService (claim atómico, backoff, varrimento de PENDING)
          [activar fora de dev só com throttling/concorrência]
1J-API.5  GET /editions/:id/cover (tenancy, ETag, nosniff, 404 COVER_NOT_FOUND)
1J-API.6  coverUrl no DTO de leitura (null sem EditionCover)
APP-P2-1/2/3  Feedback de delete e corrida do load() (antes do FLUTTER.1)
1J-FLUTTER.0  getBytes + cache por ETag (o getBytes já existe)
1J-FLUTTER.1  Apresentação com placeholder
```

Em relação à sua ordem, o `ImageValidator` fica explícito em `.3`, e o gate inicial e os APP-P2 são novos.

Created 5 todos