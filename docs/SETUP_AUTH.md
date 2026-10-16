# Login e administração — configuração e testes

A implementação da autenticação obrigatória está em desenvolvimento na branch `feat/login-obrigatorio-d1`. **Não está pronta para produção até todos os testes e revisão de segurança passarem.**

## Papéis
- `OWNER` único: **Thiago Saraiva**. Pode consultar tudo, importar planilhas e criar/desativar/redefinir usuários.
- `VIEWER`: consulta dados após fazer login; não tem permissão de importação nem de administração.

## D1 e migração
O arquivo `migrations/0002_auth.sql` adiciona `users`, `sessions`, `owner_activations` e `login_attempts` sem alterar as tabelas de promoções.
Inicialmente aplicar somente no D1 **preview**, distinto de produção:
```bash
npx wrangler d1 execute acompanhamento-ofertas-preview --remote --file migrations/0002_auth.sql
```
Confira `sqlite_master` e a preservação de promoções. Não rodar no banco de produção sem avaliação explícita e procedimento de rollback.

## Preparar ativação inicial
Uma pessoa autorizada com acesso ao Cloudflare gera o código **somente em terminal local seguro**, sem colocá-lo em chats, arquivos versionados ou logs:
```bash
node scripts/owner-activation.mjs preview
```
O script gera um código de 256 bits válido por 30 minutos e imprime duas instruções SQL: criar OWNER pendente e armazenar hash do código. Execute as instruções SQL no banco indicado usando Wrangler ou console D1. Ao acessar o preview, clique em **Primeiro acesso do administrador**, informe o código e escolha sua senha. A senha nunca aparece no script e é armazenada com PBKDF2 + salt no D1. O código só pode ser usado uma vez.
**Não** iniciar produção sem validar todo esse fluxo em preview.

Se o código expirar, gere um novo, sem remover o proprietário pendente. Se a senha for perdida após ativação, a recuperação exigirá intervenção administrativa no Cloudflare, com revogação de sessões. Não há recuperação por e-mail.

## Verificações antes de publicar
```bash
npm install
npm test
npm run build
npm audit --audit-level=high
```
Verificar na API **preview**: visitante recebe 401 em `/api/promocoes`; OWNER autentica, importa e cria usuários; VIEWER consulta, mas recebe 403 em importação e administração; logout expira sessão; atualização de senha exige atual; tentativa com token `IMPORT_TOKEN` legado não funciona.
Medir o tempo de PBKDF2 600.000 iterações no Worker preview e revisar limites de CPU da conta.

## Produção e rollback
Publicar somente após PR aprovado e testes verdes. Em produção, aplicar migração aditiva, preparar a conta OWNER pendente e seu código temporário por canal seguro, confirmar janelas e avisar pessoas afetadas, só então publicar o Worker. Validar entrada e leitura antes de remover `IMPORT_TOKEN` das configurações do Cloudflare. Não acessar, expor, reaproveitar ou exportar os tokens de sessão. Em caso de erro, reverter versão do Worker e preservar tabelas e dados existentes.

**Atenção:** uma importação real substitui todas as promoções; usar apenas dados de teste no preview.
