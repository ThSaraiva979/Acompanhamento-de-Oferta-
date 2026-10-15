# Integração D1 — operações

O banco `acompanhamento-ofertas-db` está criado na conta Cloudflare e contém as tabelas `products`, `stores`, `promotions` e `import_batches`. O repositório tem o identificador em `wrangler.toml`; ele não é um segredo.

## Antes de publicar a branch

1. Confira que está usando o Worker existente `acompanhamento-de-oferta`, e não um novo `acompanhamento-de-ofertas`.
2. No terminal, autentique o Wrangler (`npx wrangler login`) com a mesma conta Cloudflare.
3. Aplique a migração registrada no repositório: `npx wrangler d1 migrations apply acompanhamento-ofertas-db --remote`. O script usa `IF NOT EXISTS`, portanto é seguro mesmo com as tabelas já criadas inicialmente.
4. Configure o segredo **somente no Cloudflare**: `npx wrangler secret put IMPORT_TOKEN`, usando uma chave longa e aleatória. **Nunca** coloque essa chave no Git, no arquivo `wrangler.toml` ou no frontend. O Worker já existe; execute esse comando contra `acompanhamento-de-oferta`.
5. Rode `npm install`, `npm test` e `npm run build`.
6. Publique com `npm run deploy` apenas depois da revisão do PR. O deploy da branch não é automático.

## Usando a aplicação

Ao acessar o dashboard, o navegador busca os dados de `GET /api/promocoes`. A base começa vazia; não há amostras apresentadas como dados reais. Na aba **Importar planilha**, informe a chave e selecione uma planilha `.xlsx`, `.xls` ou `.csv`. O navegador interpreta a primeira aba, envia até 1.000 linhas para `POST /api/promocoes/import` e atualiza o dashboard somente se D1 confirmar a transação.

**Atenção:** cada importação substitui as promoções anteriores, não as acumula. O histórico `import_batches` registra data e quantidade importada, não uma cópia integral do arquivo. Não há recuperação automática de linhas substituídas.

## Preview isolado (GitHub / Workers Builds)

O Cloudflare Workers Builds usa `wrangler preview` para branches e PRs, que requer `[[previews.d1_databases]]`. A configuração aponta para o banco **acompanhamento-ofertas-preview**, separado do banco de produção, com o mesmo esquema e inicialmente vazio. Importações de teste não devem atingir a base real.

## Ambiente local

- `npm run dev` inicia só o Vite e **não** disponibiliza `/api`.
- Para testar API e SPA juntos, use `npm run build` e `npx wrangler dev` com D1 local. Inicialize o banco local com `npx wrangler d1 migrations apply acompanhamento-ofertas-db --local`.
- Para testar a importação local, configure `IMPORT_TOKEN` em um arquivo `.dev.vars` **ignorado pelo Git** (ex.: `IMPORT_TOKEN=uma-chave-local`).

## Segurança

A API GET é pública. A API POST valida `Authorization: Bearer <IMPORT_TOKEN>` no servidor; a chave é mantida somente em memória no navegador durante o formulário. **Não use a mesma chave em sites externos ou envie a chave para terceiros.** Se precisar de contas e permissões por usuário, a próxima evolução recomendada é Cloudflare Access.
