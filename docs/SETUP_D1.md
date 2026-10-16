# Integração D1 — operações

O banco `acompanhamento-ofertas-db` está criado na conta Cloudflare e contém as tabelas `products`, `stores`, `promotions` e `import_batches`. O repositório tem o identificador em `wrangler.toml`; ele não é um segredo.

## Antes de publicar a branch

1. Confira que está usando o Worker existente `acompanhamento-de-oferta`, e não um novo `acompanhamento-de-ofertas`.
2. No terminal, autentique o Wrangler (`npx wrangler login`) com a mesma conta Cloudflare.
3. Aplique a migração registrada no repositório: `npx wrangler d1 migrations apply acompanhamento-ofertas-db --remote`. O script usa `IF NOT EXISTS`, portanto é seguro mesmo com as tabelas já criadas inicialmente.
4. Para a nova versão com login obrigatório, siga primeiro `docs/SETUP_AUTH.md`. O segredo legado `IMPORT_TOKEN` deve ser removido somente após a autenticação e a importação autenticada serem validadas em produção.
5. Rode `npm install`, `npm test` e `npm run build`.
6. Publique com `npm run deploy` apenas depois da revisão do PR. O deploy da branch não é automático.

## Usando a aplicação

Depois do login, o navegador busca os dados de `GET /api/promocoes`. A base começa vazia; não há amostras apresentadas como dados reais. Apenas o administrador principal pode usar a aba **Importar planilha** para selecionar uma planilha `.xlsx`, `.xls` ou `.csv`. O navegador interpreta a primeira aba, envia até 1.000 linhas para `POST /api/promocoes/import` e atualiza o dashboard somente se D1 confirmar a transação.

**Atenção:** cada importação substitui as promoções anteriores, não as acumula. O histórico `import_batches` registra data e quantidade importada, não uma cópia integral do arquivo. Não há recuperação automática de linhas substituídas.

## Preview isolado (GitHub / Workers Builds)

O Cloudflare Workers Builds usa `wrangler preview` para branches e PRs, que requer `[[previews.d1_databases]]`. O build de preview no Cloudflare deve usar **`npm run build`** antes de **`npx wrangler preview`** (a configuração foi ajustada na conta). A configuração aponta para o banco **acompanhamento-ofertas-preview**, separado do banco de produção, com o mesmo esquema e inicialmente vazio. Importações de teste não devem atingir a base real.

## Ambiente local

- `npm run dev` inicia só o Vite e **não** disponibiliza `/api`.
- Para testar API e SPA juntos, use `npm run build` e `npx wrangler dev` com D1 local. Inicialize o banco local com `npx wrangler d1 migrations apply acompanhamento-ofertas-db --local`.
- Para testar a importação local, configure usuários, ativação e sessões na base D1 local. A chave antiga não autoriza novas importações nesta branch.

## Segurança

Todas as APIs de promoções exigem uma sessão válida em cookie protegido; a importação e a administração exigem o papel `OWNER`. Somente o servidor decide permissões. Não se utiliza a antiga chave de importação na aplicação.
