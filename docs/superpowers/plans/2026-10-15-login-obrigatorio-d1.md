# Login obrigatório no Cloudflare D1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proteger todas as páginas e APIs de promoções por usuário/senha sem e-mail, com um único proprietário `Thiago Saraiva` capaz de importar e gerenciar outras contas.

**Architecture:** Cloudflare Worker autentica e autoriza cada operação com sessões em cookie HTTP-only e dados do D1; React só renderiza o dashboard depois de `GET /api/auth/me` válido. Migração aditiva e fluxo de ativação inicial por código de uso único, sem senha embutida ou chave de importação.

**Tech Stack:** React 19, Vite 8, TypeScript, Cloudflare Workers + D1, Web Crypto API, Vitest 5, Testing Library, Wrangler 4, Node.js 22.

**Spec:** `docs/superpowers/specs/2026-10-15-login-obrigatorio-d1-design.md`

## Global Constraints

- **Login obrigatório para todos**, somente usuário e senha; nenhuma consulta às promoções sem sessão.
- **Exatamente um proprietário:** login e nome exibido `Thiago Saraiva`, papel `OWNER`; só ele pode importar promoções e gerenciar `VIEWER`.
- Nenhum cadastro público, e-mail, senha padrão, segundo proprietário ou dependência de login de terceiros.
- Senhas: PBKDF2-HMAC-SHA256 com salt aleatório, **600.000 iterações iniciais** medidas no preview, versões/custo persistidos; 12 a 128 caracteres UTF-8.
- Sessão: token aleatório de 256 bits, apenas SHA-256 no D1, cookie `__Host-ao_session` (`HttpOnly; Secure; SameSite=Strict; Path=/`), validade máxima 12h; sem token em localStorage.
- Ativação inicial: código aleatório de 256 bits, hash guardado no D1, validade **30 minutos**, uso único, sem senha pelo chat, ativação uma vez e nunca reaberta.
- Toda mutação com sessão e `Origin` estritamente de mesma origem (incluindo login e ativação, com prevenção de CSRF); `Cache-Control: no-store`. Limite de tentativas de login e ativação.
- Falha no D1 nega autorização; remoção da autenticação por `IMPORT_TOKEN` somente após nova proteção testada.
- Não alterar nem apagar promoções existentes durante migração; importação continua `replace-all` transacional com até **1.000 registros**.
- A `main` e a produção ficam intactas até aprovação do PR, testes completos e preparação da ativação.
- `wrangler.toml` mantém nomes/IDs do Worker existente `acompanhamento-de-oferta` e dos bancos D1 já vinculados; usar banco preview separado.

## Review Focus

1. **Login com nome que tem espaço e diferenças de caixa:** `Thiago Saraiva` autenticado por busca com `COLLATE NOCASE`, sem criar segundo OWNER. Cobrir nas Tasks 1, 3 e 4.
2. **Duas ativações simultâneas/replay:** só uma transação conclui; código consumido ou expirado não pode ativar novamente. Cobrir na Task 3.
3. **Sessão revogada ou usuário desativado durante uso:** o Worker rejeita na primeira requisição posterior; cliente volta ao login. Cobrir Tasks 4, 5, 6 e 7.
4. **Cliente alterado, cookie forjado, Origin diferente e cabeçalho Authorization antigo:** não há leitura/escrita sem sessão, nem importação por token legado. Cobrir Tasks 2, 5, 6 e 8.
5. **Primeira publicação sem proprietário ativado, Worker Free CPU para PBKDF2 e dados D1 existentes:** não publicar sem benchmark, rollback documentado, ativação pronta e verificação de linhas preservadas. Cobrir Tasks 2 e 9.

---

## File and Interface Map

| Arquivo | Responsabilidade |
| --- | --- |
| `migrations/0002_auth.sql` | Acrescentar tabelas/índices/constraints sem alterar promoções |
| `worker/db.ts` | Interfaces tipadas mínimas para D1 `prepare/bind/first/all/run/batch` |
| `worker/crypto.ts` | Hash de senha, comparação constante, geração/hash de token, parsing/serialização de cookie |
| `worker/auth.ts` | Ativação do proprietário, login, identificação de sessão, troca de senha, logout, rate limiting |
| `worker/users.ts` | Criar/listar/desativar/reativar/redefinir `VIEWER`; proteger único `OWNER` |
| `worker/index.ts` | Roteamento, autenticação antes de GET de promoções, RBAC em import, sem chave legada |
| `scripts/owner-activation.mjs` | Geração operacional local de comando/código de ativação (sem persistir segredo no Git) |
| `src/auth-api.ts` | `getSession/login/logout/activate/changePassword/adminUsers` usando cookies |
| `src/Login.tsx` | UI de login e ativação |
| `src/UserAdmin.tsx` | UI `OWNER` para administrar `VIEWER` e senhas temporárias |
| `src/App.tsx` | Gate de sessão, renderização por papel, troca de senha, logout e remoção da chave de importação |
| `src/promotions-api.ts` | GET/import por sessão-cookie e tratamento de 401/403 |
| `src/styles.css` | Estilos de login/admin responsivos, respeitando tema |
| `docs/SETUP_AUTH.md` | Provisionamento, benchmark, testes, publicação, recuperação manual e rollback |
| `*.test.ts(x)` correspondentes | Comprovação TDD dos contratos e casos de risco |

Reutilizar `src/prices.ts` e componentes existentes. Preservar `worker/index.test.ts`, `src/App.test.tsx` e `src/promotions-api.test.ts`, ajustando somente expectativas que mudaram por causa da autenticação.

## Task 1: D1 schema e contrato tipado

**Files:** Create `migrations/0002_auth.sql`, `worker/db.ts`, `worker/db.test.ts`; maintain `migrations/0001_init.sql` unchanged.

**Interfaces:**
- `export interface AuthDB` com `prepare(sql): Statement`, `batch(statements)`; `Statement.bind(...values)`, `first<T>()`, `all<T>()`, `run()`.
- Tabelas `users`, `sessions`, `owner_activations`, `login_attempts` conforme spec.
- Índice único parcial `UNIQUE` para impedir outro `role='OWNER'`; `users.username TEXT NOT NULL COLLATE NOCASE UNIQUE`; `password_hash/salt/iterations` nulos só antes de ativação; `must_change_password` booleano CHECK.

- [ ] **1.1 RED:** Adicionar `worker/db.test.ts`: verificar migração cria quatro tabelas novas e impede um segundo `OWNER` e login duplicado com capitalização diferente (`Thiago Saraiva` e `thiago saraiva`); verificar que `products/stores/promotions/import_batches` continuam com esquema e dados intactos usando SQLite local de teste, se disponível.
- [ ] **1.2 Verify RED:** `npm test -- worker/db.test.ts`; esperado: falha por migração ausente/assertions não cumpridas.
- [ ] **1.3 GREEN:** Criar arquivo de migração aditiva, índices de sessão e expiração, tipos de D1. Não inserir senha nem OWNER automaticamente no SQL público.
- [ ] **1.4 Verify GREEN:** `npm test -- worker/db.test.ts`; verificar esquema aplicando `npx wrangler d1 migrations apply acompanhamento-ofertas-db --local` e consultando `sqlite_master`.
- [ ] **1.5 Commit:** `git add migrations/0002_auth.sql worker/db.ts worker/db.test.ts && git commit -m "feat(auth): add D1 users and sessions schema"`.

## Task 2: Credenciais e cookies criptográficos

**Files:** Create `worker/crypto.ts`, `worker/crypto.test.ts`.

**Interfaces:**
- `hashPassword(password: string, iterations?: number): Promise<{hash:string,salt:string,iterations:number}>`.
- `verifyPassword(password: string, record:{hash:string,salt:string,iterations:number}): Promise<boolean>`.
- `newSecret(): string`, `digestSecret(secret:string):Promise<string>`.
- `makeSessionCookie(token:string,maxAgeSeconds:number):string`, `expireSessionCookie():string`, `readSessionCookie(request:Request):string|null`.
- Validar comprimento de senha em bytes UTF-8, não apenas `.length`; `crypto.subtle` disponível no Worker.

- [ ] **2.1 RED:** Testar hash único por salt, senha correta/incorreta, UTF-8 e limites de 12/128 caracteres, entropia/tamanho token, cookie `HttpOnly/Secure/SameSite=Strict/Path=/`, expiração e cookie adulterado.
- [ ] **2.2 Verify RED:** `npm test -- worker/crypto.test.ts`; esperado: falta módulo e testes falham.
- [ ] **2.3 GREEN:** Implementar funções com Web Crypto e comparação em tempo constante dos bytes de hash; não logar senhas ou tokens.
- [ ] **2.4 Verify GREEN:** `npm test -- worker/crypto.test.ts`; comparar tempo/custo PBKDF2 (600k) no Wrangler preview antes de considerar concluída a entrega.
- [ ] **2.5 Commit:** `git add worker/crypto.ts worker/crypto.test.ts && git commit -m "feat(auth): implement password and cookie primitives"`.

## Task 3: Ativação única de Thiago Saraiva

**Files:** Create `worker/auth.ts`, `worker/auth.test.ts`, `scripts/owner-activation.mjs`; read `worker/db.ts` and `worker/crypto.ts`.

**Interfaces:**
- `activateOwner(request:Request,db:AuthDB):Promise<Response>`.
- `getOwnerSetupStatus(db:AuthDB):Promise<'pending'|'complete'>` para `GET /api/auth/setup-status` (informação não sensível).
- Script operacional sem dados secretos em arquivo, saída única com código e comando de provisionamento D1 (parâmetro preview/produção explícito, confirmação para produção). Não criar endpoint público que gere códigos.
- Ativação é commit condicional/atômico: token_hash corresponde, `consumed_at IS NULL`, `expires_at > CURRENT_TIMESTAMP`, único OWNER pendente, nenhum OWNER ativo; rollback integral se falhar.

- [ ] **3.1 RED:** Testar ativação com código válido, vencido, reutilizado, incorreto e ativação simultânea; garantir nome `Thiago Saraiva`, único OWNER e senha nunca recuperável em texto claro. Testar setup-status após conclusão.
- [ ] **3.2 Verify RED:** `npm test -- worker/auth.test.ts`; esperado: endpoints/funções inexistentes.
- [ ] **3.3 GREEN:** Implementar apenas ativação/status e script de operação; manter script sem senha e não inserir tokens em logs/commits.
- [ ] **3.4 Verify GREEN:** `npm test -- worker/auth.test.ts`; rodar script sem escrita em produção; validar transação contra banco D1 local.
- [ ] **3.5 Commit:** `git add worker/auth.ts worker/auth.test.ts scripts/owner-activation.mjs && git commit -m "feat(auth): add one-time owner activation"`.

## Task 4: Login, sessões, logout, troca de senha e antiforça-bruta

**Files:** Modify `worker/auth.ts`, `worker/auth.test.ts`; use `worker/db.ts` and `worker/crypto.ts`.

**Interfaces:**
- `login(request:Request,db:AuthDB):Promise<Response>`.
- `getSession(request:Request,db:AuthDB):Promise<{id:number;username:string;displayName:string;role:'OWNER'|'VIEWER';mustChangePassword:boolean}|null>`.
- `logout(request:Request,db:AuthDB):Promise<Response>`, `changePassword(request:Request,db:AuthDB,userId:number):Promise<Response>`.
- `getMe(user):Response`; toda falha de sessão/usuário desativado retorna 401; senha temporária exige troca antes de demais dados.
- `login_attempts` usa hash de identificador IP+usuário e janela com expiração, aplica atraso/bloqueio temporário proporcional sem trancar o proprietário permanentemente.

- [ ] **4.1 RED:** Testar login inválido sem cookie, login válido com cookie HTTP-only, `/me` com identidade, cookie manipulado, sessão expirada/revogada, proprietário pendente, usuário inativo, logout e redefinição de senha revogando sessões; testar limites de tentativas.
- [ ] **4.2 Verify RED:** `npm test -- worker/auth.test.ts`; falha esperada dos novos casos.
- [ ] **4.3 GREEN:** Implementar as funções e consultas D1 parametrizadas; negar acesso após limite de tentativas, evitar enumeração de nomes e persistência de credenciais no navegador.
- [ ] **4.4 Verify GREEN:** `npm test -- worker/auth.test.ts`; `npm test` após integração da Task 5.
- [ ] **4.5 Commit:** `git add worker/auth.ts worker/auth.test.ts && git commit -m "feat(auth): add sessions login and password changes"`.

## Task 5: Fechar os acessos à API e eliminar IMPORT_TOKEN

**Files:** Modify `worker/index.ts`, `worker/index.test.ts`, `src/promotions-api.ts`, `src/promotions-api.test.ts`.

**Interfaces:**
- `GET /api/auth/setup-status` (somente `pending|complete`), `POST /api/auth/activate-owner`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/change-password`.
- `GET /api/promocoes` requer sessão com senha definida; `POST /api/promocoes/import` requer `role=OWNER` e Origin mesma origem; VIEWER => 403; sem cookie => 401.
- `loadPromotions():Promise<Promotion[]>`, `savePromotions(promotions:Promotion[]):Promise<number>`, `fetch` com `credentials:'same-origin'`, sem parâmetro `token` ou Authorization antigo. Em 401 informar sessão expirada, em 403 informar permissão negada.

- [ ] **5.1 RED:** No `worker/index.test.ts`, garantir 401 sem login (até com `Authorization: Bearer IMPORT_TOKEN`), 403 para VIEWER importando, sucesso para OWNER, origem externa bloqueada, rotas de autenticação corretas; no `src/promotions-api.test.ts` conferir cookies implícitos e ausência do header de chave.
- [ ] **5.2 Verify RED:** `npm test -- worker/index.test.ts src/promotions-api.test.ts`; falha nos casos de autorização.
- [ ] **5.3 GREEN:** Centralizar gate antes de ler/gravar D1; reutilizar `importPromotions` após autenticação, sem fallback para chave antiga; garantir que cookie não é token JavaScript.
- [ ] **5.4 Verify GREEN:** `npm test -- worker/index.test.ts src/promotions-api.test.ts`; `npm run build`.
- [ ] **5.5 Commit:** `git add worker/index.ts worker/index.test.ts src/promotions-api.ts src/promotions-api.test.ts && git commit -m "feat(auth): require sessions on promotions API"`.

## Task 6: Administração exclusiva de usuários

**Files:** Create `worker/users.ts`, `worker/users.test.ts`; Modify `worker/index.ts`, `worker/index.test.ts`.

**Interfaces:**
- `listUsers(db:AuthDB):Promise<SafeUser[]>`; `createViewer(db:AuthDB,username:string,displayName:string):Promise<{user:SafeUser;temporaryPassword:string}>`; `updateViewer(db:AuthDB,id:number,action:'activate'|'deactivate'|'reset-password'):Promise<Response>`.
- `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id` exigem proprietário e proteção de Origin em mutações.
- `SafeUser` nunca inclui hash/salt/sessão. `temporaryPassword` gerada por crypto, retornada **uma única vez** ao OWNER no POST ou reset; usuário entra com `must_change_password=1`.

- [ ] **6.1 RED:** Testar 401 sem cookie, 403 VIEWER, proprietário criando somente VIEWER, usernames duplicados case-insensitive, impossibilidade de criar outro OWNER, de alterar/desativar o OWNER, revogação de sessões ao desativar/redefinir, senha temporária não exposta em GET nem persistida em texto claro.
- [ ] **6.2 Verify RED:** `npm test -- worker/users.test.ts worker/index.test.ts`; falhas esperadas.
- [ ] **6.3 GREEN:** Implementar queries parametrizadas/controle no servidor e roteamento; checar usuário ativo a cada requisição.
- [ ] **6.4 Verify GREEN:** `npm test -- worker/users.test.ts worker/index.test.ts`.
- [ ] **6.5 Commit:** `git add worker/users.ts worker/users.test.ts worker/index.ts worker/index.test.ts && git commit -m "feat(auth): add owner-only user management"`.

## Task 7: Tela de login e gate de sessão no React

**Files:** Create `src/auth-api.ts`, `src/auth-api.test.ts`, `src/Login.tsx`, `src/Login.test.tsx`; Modify `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`.

**Interfaces:**
- `AuthUser={id:number;username:string;displayName:string;role:'OWNER'|'VIEWER';mustChangePassword:boolean}`.
- `getSession():Promise<AuthUser|null>` (401=>null, erro rede=>erro), `login(username,password):Promise<AuthUser>`, `logout():Promise<void>`, `activateOwner(code,password):Promise<void>`, `changePassword(currentPassword,newPassword):Promise<void>`, `getSetupStatus():Promise<'pending'|'complete'>`.
- `<Login onAuthenticated={...} setupStatus={...}/>` recebe ações, controla usuário/senha apenas em memória, exibe/oculta senha, ativação pending, mensagens genéricas e feedback acessível.
- `App` usa `'checking'|'guest'|'authenticated'|'change-password'`; **não monta** o dashboard ou dispara `loadPromotions` até autorização; eventos 401 fazem logout visual.

- [ ] **7.1 RED:** `src/auth-api.test.ts`: formato das requisições, cookies, 401 e erros; `src/Login.test.tsx`: login por usuário/senha, ativação pendente e senha oculta; `src/App.test.tsx`: guest vê somente login e fetch não consulta promoções, autenticação libera dashboard, expirou=>login, modo escuro preservado.
- [ ] **7.2 Verify RED:** `npm test -- src/auth-api.test.ts src/Login.test.tsx src/App.test.tsx`; testes novos falham como esperado.
- [ ] **7.3 GREEN:** Implementar frontend, estado de autenticação, página de ativação e mudança obrigatória da senha temporária, mantendo estilo, filtros e navegação existentes.
- [ ] **7.4 Verify GREEN:** `npm test -- src/auth-api.test.ts src/Login.test.tsx src/App.test.tsx`; `npm run build`.
- [ ] **7.5 Commit:** `git add src/auth-api.ts src/auth-api.test.ts src/Login.tsx src/Login.test.tsx src/App.tsx src/App.test.tsx src/styles.css && git commit -m "feat(auth): add mandatory login screen and session gate"`.

## Task 8: Gerenciar usuários e importar sem chave na UI

**Files:** Create `src/UserAdmin.tsx`, `src/UserAdmin.test.tsx`; Modify `src/App.tsx`, `src/App.test.tsx`, `src/promotions-api.ts`, `src/styles.css`, `src/auth-api.ts`.

**Interfaces:**
- `listUsers():Promise<SafeUser[]>`, `createViewer(username,displayName):Promise<{user:SafeUser;temporaryPassword:string}>`, `updateViewer(id,action):Promise<...>`.
- Aba `Usuários` só quando `role=OWNER`; aba e botão `Importar planilha` só para OWNER; nenhum `importToken` no DOM, estado ou chamadas.
- Exibir senha temporária uma só vez para OWNER com instrução de entrega segura ao usuário, nunca salvá-la no armazenamento local e limpar ao sair/fechar modal.
- `Sair` revoga sessão; perfil `VIEWER` somente leitura.

- [ ] **8.1 RED:** Testar OWNER vendo administração/importação, VIEWER não vendo controles nem conseguindo importar por chamada direta, criação/desativação e reset dos usuários, senha temporária apenas após criação/reset, formulário de planilha sem chave.
- [ ] **8.2 Verify RED:** `npm test -- src/UserAdmin.test.tsx src/App.test.tsx`; expected failures for owner controls.
- [ ] **8.3 GREEN:** Implementar componentes e eliminar todas as referências visuais ao `IMPORT_TOKEN`; garantir que mesmo com UI maliciosa Worker rejeita VIEWER.
- [ ] **8.4 Verify GREEN:** `npm test -- src/UserAdmin.test.tsx src/App.test.tsx`; `npm run build`.
- [ ] **8.5 Commit:** `git add src/UserAdmin.tsx src/UserAdmin.test.tsx src/App.tsx src/App.test.tsx src/auth-api.ts src/promotions-api.ts src/styles.css && git commit -m "feat(auth): add owner user administration and remove import key UI"`.

## Task 9: Preview, segurança, operações e entrega em PR

**Files:** Create `docs/SETUP_AUTH.md`; update `docs/SETUP_D1.md`, test files, optionally CI workflow for preview smoke.

**Interfaces:** Script `scripts/owner-activation.mjs` com modo explícito `preview|production`, sem escrever senha/código em logs permanentes; roteiro operacional comprovável.

- [ ] **9.1 RED:** Escrever testes de integração e smoke no preview: visitante => GET 401; login errado => sem cookie; OWNER => GET 200 e importação de planilha temporária no **preview**; VIEWER => GET 200, import 403; logout e desativação => 401. Cobrir Origin e replay de ativação.
- [ ] **9.2 Verify RED:** Reproduzir pelo menos um cenário falho usando API preview antes de finalizar; documentar erro observado, sem tocar produção.
- [ ] **9.3 GREEN:** Adicionar documentação e testes/smoke; corrigir apenas problemas comprovados; aplicar `0002_auth.sql` no D1 preview, não criar segundo OWNER em produção; medir custo CPU PBKDF2. Confirmar que o Worker preview usa banco D1 de teste, não o banco real.
- [ ] **9.4 Verify GREEN:** `npm install`, `npm test`, `npm run build`, `npm audit --audit-level=high`, `npx wrangler d1 migrations apply acompanhamento-ofertas-db --local`; smoke preview autenticado + logout; histórico de promoções preview preservado após migração.
- [ ] **9.5 Commit:** `git add docs/SETUP_AUTH.md docs/SETUP_D1.md && git commit -m "docs(auth): describe secure rollout and recovery"`; criar PR contra `main` com riscos explicitados. **Não mesclar automaticamente**.
- [ ] **9.6 Gate de produção (somente após avaliação e autorização):** migrar D1 produção sem alterar registros; provisionar OWNER pendente; gerar código único no ambiente autorizado; publicar Worker após testes verdes, conferir acesso real, orientar proprietário a definir senha na UI; revogar/remover o segredo antigo `IMPORT_TOKEN` do Cloudflare apenas após a nova importação funcionar; conferir logs/erros/rollback.

## Final Quality Gate

- [ ] A API das promoções responde 401 a visitantes, mesmo com chave legada.
- [ ] Uma única conta OWNER, `Thiago Saraiva`; somente OWNER cria contas/viewers e importa.
- [ ] Nenhum token/código/senha em Git, logs ou localStorage.
- [ ] `npm test` e `npm run build` verdes; auditoria sem vulnerabilidades altas/críticas; preview autenticado validado.
- [ ] Dados promocionais preexistentes preservados, preview e produção separados.
- [ ] Ativação inicial da conta preparada antes de trocar Worker publicado, com rollback testado.
- [ ] PR revisado e aprovado antes de merge; **nenhum deploy de produção autorizado por este plano isoladamente**.

## Execution Handoff

Revisar este plano com o proprietário. Execução recomendada: **subagent-driven**, por ser autenticação e controle de acesso com impacto potencial em dados reais. Se subagentes não estiverem disponíveis neste ambiente, usar **native** com tarefas sequenciais, gates de revisão/CI e aprovação explícita antes de publicar. A escolha deve ser confirmada pelo usuário; preparar plano não implica autorização de execução ou merge.
