# Design — login obrigatório com usuário e senha (Cloudflare D1)

**Projeto:** Acompanhamento de Ofertas (React, Vite, TypeScript, Cloudflare Workers + D1)  
**Data:** 2026-10-15  
**Branch de preparação:** `design/login-obrigatorio-d1`  
**Estado:** especificação para revisão; **não implementada nem publicada**.

## 1. Objetivo e decisões confirmadas

O aplicativo exigirá **nome de usuário e senha, sem e-mail, de todas as pessoas**. Não haverá dashboard público nem cadastro aberto. A antiga chave de importação deixará de ser solicitada e de autorizar operações.

Existe uma única conta proprietária/administradora principal, com o nome de exibição e login **Thiago Saraiva**. **Somente essa conta** poderá cadastrar, desativar, redefinir o acesso de outros usuários e importar planilhas. Usuários comuns poderão consultar promoções, filtros, lojas, vigências, indicadores e relatórios depois do login. Eles não poderão importar nem administrar usuários.

O projeto e o D1 existentes serão preservados; nenhuma base de promoções será apagada ou substituída durante a migração de autenticação. A mudança fica numa branch para testes e avaliação antes da produção.

## 2. Abordagem escolhida

Reaproveitar Cloudflare Worker + D1 e adicionar autenticação própria com sessão por cookie protegido. Uma solução de login apenas no React seria insegura (a API continuaria aberta). Um serviço terceirizado imporia nova dependência e poderia envolver e-mail; por isso a autenticação será verificada **em toda requisição relevante no Worker**, com usuários e sessões em D1.

Três unidades com responsabilidade delimitada:

- `worker/auth.ts`: verificação de senhas, criação/verificação/revogação de sessões, identidade e autorização. Todas as rotas de dados consultam a sessão no servidor.
- `worker/users.ts`: administração de usuários permitida exclusivamente ao proprietário.
- `src/auth-api.ts`, `src/Login.tsx` e pequenas mudanças em `src/App.tsx`, estilos e importação: estado de sessão, formulário de login, rota para ativação inicial, mudança de senha, logout e gestão de usuários.

`worker/index.ts` integra as rotas e mantém o restante da aplicação. Os componentes atuais, filtros, temas e dashboard permanecem.

## 3. Modelo de dados D1

Migração aditiva, sem modificar `products`, `stores`, `promotions`, `import_batches`:

- `users`: `id` inteiro PK; `username` texto único com comparação sem diferenciação de maiúsculas; `display_name`; `role` ('OWNER' | 'VIEWER'); `password_hash`, `password_salt`, `password_iterations` (nulos somente antes da ativação); `is_active`; `must_change_password`; `created_at`, `updated_at`. Uma restrição/index único impede mais de um proprietário.
- `sessions`: `id`, `user_id` FK, `token_hash` único, `created_at`, `expires_at`, `revoked_at`; índices para sessão e expiração.
- `login_attempts`: identificador de origem/usuário com hash, contagem e janela/expiração, usados para limitar tentativas no servidor.
- `owner_activations`: hash de código aleatório de ativação inicial, expiração curta (30 min), `consumed_at`. O código é usado **somente uma vez** e nunca guardado em texto claro. Não é chave de importação nem senha permanente.

`Thiago Saraiva` será provisionado como `OWNER` pendente, não utilizável até a primeira definição de senha. Regras de autorização usam `id` e `role` do banco, nunca um nome enviado pelo navegador; o único `OWNER` não pode ser excluído, desativado, renomeado por outro usuário nem convertido em `VIEWER`. A coluna do login será definida para aceitar `Thiago Saraiva` com espaço, sem depender de e-mail.

## 4. Criação segura da conta ADM e recuperação

**Sem enviar senha por chat e sem usar senha padrão.** O fluxo inicial terá uma tela "Ativar administrador" exclusiva para o usuário preprovisionado:

1. Operador autorizado com acesso ao Cloudflare cria, por ferramenta administrativa, um código aleatório de 256 bits, guarda **somente seu hash** no D1 e fornece o código único ao proprietário. Prazo: **30 minutos**.
2. O proprietário abre o site, informa o código uma única vez e escolhe uma senha própria na página HTTPS. A senha viaja apenas ao Worker por HTTPS e não aparece em logs, repositório ou mensagens.
3. `POST /api/auth/activate-owner` verifica o código, a expiração, o proprietário pendente e a inexistência de proprietário já ativo; ativa a conta de forma atômica e consome o código. Depois disso o endpoint não permite novos cadastros, mesmo com outro código.
4. Com a conta ativada, o proprietário utiliza a tela normal de login. Não há cadastro público.

O código único é apenas para configuração inicial: **não** aparece em nenhuma importação futura. Se expirar antes do uso, o operador pode emitir outro código por ferramenta administrativa autenticada do Cloudflare. Se o proprietário perder a senha, a recuperação será um procedimento administrativo seguro via Cloudflare (com revogação de sessões), **sem botão de recuperação por e-mail** e sem endpoint público de redefinição.

**Regra de publicação:** não substituir a versão de produção até a migração, o provisionamento do proprietário e os testes de ativação, login e logout serem realizados em preview; planejar janela curta de ativação na produção para não bloquear quem precisa acessar.

## 5. Segurança e sessão

- Password hashing com `crypto.subtle` PBKDF2-HMAC-SHA256, salt aleatório único por conta, parâmetros versionados e custo inicial de **600.000 iterações** (medir desempenho e limite de CPU do Worker no preview antes de publicar; ajustar explicitamente, se necessário, com testes). Nunca armazenar senha em texto puro nem compará-la no frontend.
- Sessão: token aleatório de 256 bits; D1 guarda apenas SHA-256 do token; navegador recebe cookie `__Host-ao_session` com `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, duração máxima de 12 horas. Não guardar token/senha no `localStorage`.
- `POST /api/auth/logout` revoga a sessão no D1 e limpa cookie. Desativar usuário e redefinir senha revoga suas sessões anteriores. Senha trocada pelo próprio usuário exige senha atual.
- Login apresenta erro genérico para usuário/senha incorretos; limitador por combinação de IP e login com expiração reduz força bruta, sem permitir bloqueio permanente arbitrário. Não revelar hashes, tokens ou dados pessoais nas mensagens de erro.
- Toda mutação exige sessão válida + cabeçalhos/Origin de mesma origem (proteção CSRF); não habilitar CORS público com credenciais. Respostas com `Cache-Control: no-store`; segurança HTTPS obrigatória em produção.
- Falha no banco **nega acesso** (fail closed). Sem fallback para dados demo, `IMPORT_TOKEN` ou permissões concedidas só por estado React.
- Rate limiting de login e ativação testado em preview; impor tamanho máximo do corpo JSON e senha (mínimo 12, máximo 128 caracteres UTF-8) e validação de nome de usuário.

## 6. Contrato da API e permissões

| Endpoint | Sem sessão | VIEWER | OWNER |
| --- | --- | --- | --- |
| `POST /api/auth/login` | Permitido com usuário/senha | Permitido | Permitido |
| `POST /api/auth/activate-owner` | Apenas código de uso único e proprietário ainda pendente | Negado | Negado |
| `GET /api/auth/me` | 401 | Perfil próprio | Perfil próprio |
| `POST /api/auth/logout` | 401 | Própria sessão | Própria sessão |
| `POST /api/auth/change-password` | 401 | Própria conta | Própria conta |
| `GET /api/promocoes` | 401 | Permitido | Permitido |
| `POST /api/promocoes/import` | 401 | 403 | Permitido sem chave |
| `GET /api/admin/users` | 401 | 403 | Permitido |
| `POST /api/admin/users` | 401 | 403 | Criar apenas VIEWER |
| `PATCH /api/admin/users/:id` | 401 | 403 | Desativar/reativar ou redefinir VIEWER |

O proprietário poderá criar usuários com senha temporária gerada aleatoriamente pelo servidor e exibida **uma única vez** ao proprietário por HTTPS. O usuário comum deverá trocá-la no primeiro login antes de consultar dados. Não existe autoinscrição e nenhum usuário pode criar outra conta `OWNER`. Usuários não podem editar suas permissões.

As operações de importação permanecem transacionais, com limite atual de 1.000 linhas e comportamento **substituir todas as promoções**. A autorização ocorre **antes** de qualquer operação de escrita; não pode restar um caminho alternativo protegido pela antiga `IMPORT_TOKEN`.

## 7. Interface

- Enquanto `GET /api/auth/me` é verificado, mostrar tela neutra de carregamento; quando 401, mostrar tela exclusiva de login, sem montar dashboard com dados protegidos.
- Tela visualmente coerente com o site (cores, marca AO, modo claro/escuro): campos "Usuário" e "Senha", opção de visualizar senha, "Entrar", mensagens de erro genéricas, estado de carregamento.
- Para proprietário pendente, exibir ativação inicial (código de uso único + nova senha + confirmação), sem criar conta livremente. Não exibir essa opção depois da ativação.
- Usuário logado vê nome, perfil e "Sair". Proprietário vê navegação "Usuários" para criar, desativar e redefinir VIEWER; somente proprietário vê "Importar planilha". O Worker reforça todas as permissões mesmo se a UI for manipulada.
- Se a sessão expirar ou uma chamada responder 401, retornar à tela de login. A importação nunca pede a chave antiga.

## 8. Testes e condições de aceite

Testes unitários e de integração, com D1 local/preview quando aplicável:

1. Sem login, `GET /api/promocoes` responde **401** e a aplicação mostra somente login; rotas desconhecidas não vazam dados.
2. Login inválido não cria sessão; senha correta cria cookie protegido e `GET /api/auth/me` retorna perfil adequado.
3. Usuário comum autenticado pode listar promoções, mas recebe **403** ao importar e ao administrar usuários.
4. Proprietário autenticado pode importar e cadastrar VIEWER, jamais outro OWNER; usuário criado troca a senha temporária.
5. Logout, expiração, desativação e mudança de senha invalidam sessões adequadas.
6. Ativação do proprietário requer token não expirado e de uso único, não há bootstrap repetível nem cadastro público.
7. Ausência de cookie, CSRF, corpo inválido, rate limiting e indisponibilidade de D1 não permitem escrita nem exposição.
8. Telas de login, troca de senha, importação autorizada, gerenciamento e modo claro/escuro têm testes de interface.
9. `npm test`, `npm run build`, `npm audit` sem vulnerabilidades relevantes; preview valida API autenticada, persistência e navegação real.
10. Produção é publicada somente após comprovação dos controles e com procedimento de ativação preparado; remover `IMPORT_TOKEN` do Worker e do Cloudflare **somente quando a nova importação autenticada tiver sido verificada**, sem deixar aceitação legada.

## 9. Fora do escopo

Recuperação por e-mail, OAuth, login social, autoinscrição, autenticação multifator e múltiplos administradores. Podem ser estudados futuramente, mas não fazem parte desta primeira entrega.

## 10. Sequência de implantação e rollback

1. Criar branch de implementação após aprovação desta especificação e do plano; aplicar migrações apenas ao D1 **preview**.
2. Implementar proteção no servidor, interface e testes; criar proprietário de teste no preview e exercitar o fluxo completo.
3. Preparar migração aditiva no D1 produção e criação pendente do único proprietário sem interromper o Worker atual.
4. Após aceite e checks verdes, disponibilizar versão autenticada, emitir código de ativação de curta duração, orientar definição da senha na própria página e conferir importação autenticada.
5. Remover o segredo antigo `IMPORT_TOKEN` apenas depois da verificação, preservando dados existentes.
6. Se houver falha, reverter deploy do Worker para versão anterior; manter schema aditivo e dados intactos. Avaliar e executar rotação de credenciais envolvidas antes de reabrir importação legada.

A aprovação desta especificação **não autoriza** publicação direta em `main`: haverá plano, implementação, revisão de PR e verificação de preview antes de qualquer merge.
