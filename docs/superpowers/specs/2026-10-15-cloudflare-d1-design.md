# Integração Cloudflare D1 — especificação

**Data:** 2026-10-15

## Objetivo
Persistir as promoções importadas do Excel no D1 e exibi-las no dashboard React/Vite/TypeScript sem mudar as telas existentes. Conservar o Worker publicado até revisão da branch.

## Arquitetura
Worker `acompanhamento-de-oferta` servirá o SPA via binding `ASSETS`, com exceção das rotas `/api/*` que terão precedência. D1 `acompanhamento-ofertas-db` ficará disponível como `env.DB`. A aplicação carrega `GET /api/promocoes` ao abrir e importa por `POST /api/promocoes/import`.

## Persistência
Tabelas `products(code,name)`, `stores(id,name)`, `promotions(id,product_code,store_id,old_price,price,start_date,end_date,detail,status)` e `import_batches(id,imported_at,row_count)`. Chaves estrangeiras e índices por produto, loja e status. Migração SQL versionada. Nova importação completa substitui registros atuais, mantendo histórico dos totais importados e fazendo exclusão + inserção em um único `DB.batch` transacional.

## Autenticação e erros
Leitura pública. Escrita autorizada apenas por `Authorization: Bearer <token>` comparado a segredo `IMPORT_TOKEN` configurado no Worker, nunca no bundle. Sem segredo, endpoint retorna 503; sem credencial válida, 401. Validar formato, status e limites antes da transação; falhas não destroem dados existentes. Respostas da API usam JSON sem dados de exceções internas; não habilitar CORS irrestrito.

## UX
Sem dados de exemplo fingindo ser persistidos. Indicadores, tabela, filtros, lojas e vigências alimentados pela API. Upload da primeira aba Excel reaproveita o parser atual, requer chave de importação e só atualiza interface após confirmação de gravação. Chave existe apenas em memória, nunca localStorage. Exibir falhas de carregamento e de importação.

## Operação
Worker atual será mantido com nome singular `acompanhamento-de-oferta`. Wrangler aponta D1 criado. Branch separada + PR. Executar migração remota e configurar segredo antes de publicar frontend/API. Verificar testes de unidade, build e conectividade. Produção não será redeployada automaticamente.

## Fora do escopo
Histórico integral de preços, autenticação de múltiplos usuários, upload acima de 1.000 linhas e recomputação diária automática de status.
