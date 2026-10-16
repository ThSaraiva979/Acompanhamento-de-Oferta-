import { randomBytes, createHash } from 'node:crypto'
const env = process.argv[2]
if(!['preview','production'].includes(env)) {
  console.error('Uso: node scripts/owner-activation.mjs preview | production --confirm-production')
  process.exit(1)
}
if(env==='production' && process.argv[3]!=='--confirm-production') {
  console.error('Produção requer confirmação explícita: --confirm-production')
  process.exit(1)
}
const token=randomBytes(32).toString('hex')
const hash=createHash('sha256').update(token).digest('hex')
const expires=Math.floor(Date.now()/1000)+30*60
const db=env==='preview'?'acompanhamento-ofertas-preview':'acompanhamento-ofertas-db'
console.log('Ambiente escolhido: '+env+' / D1: '+db)
console.log('NÃO coloque o código a seguir em Git, mensagens ou logs.')
console.log('CÓDIGO DE ATIVAÇÃO (válido por 30 minutos; exiba ao proprietário em canal seguro):\n'+token)
console.log('SQL a executar com conta autorizada do Cloudflare no banco indicado:')
console.log("INSERT OR IGNORE INTO users(username,display_name,role,is_active,must_change_password) VALUES('Thiago Saraiva','Thiago Saraiva','OWNER',1,0);")
console.log(`INSERT INTO owner_activations(token_hash,expires_at) SELECT '${hash}',${expires} WHERE EXISTS (SELECT 1 FROM users WHERE role='OWNER' AND password_hash IS NULL);`)
console.log('A senha real será definida somente pelo proprietário no site, após entrar com este código.')
