const site = 'https://feat-login-obrigatorio-d1-acompanhamento-de-oferta.thiagodasilvasaraiva979.workers.dev'
const cases=[
  {path:'/api/auth/setup-status',expected:200},
  {path:'/api/auth/me',expected:401},
  {path:'/api/promocoes',expected:401},
]
let failed=false
for(const test of cases) {
  try {
    const response=await fetch(site+test.path,{headers:{Accept:'application/json'}})
    const body=await response.text()
    console.log('GET '+test.path+': HTTP '+response.status+' / '+body.slice(0,180))
    if(response.status!==test.expected)failed=true
    if(test.path==='/api/auth/setup-status' && !['pending','complete'].includes(JSON.parse(body).status))failed=true
  }catch(err){console.error(test.path,err);failed=true}
}
try {
 const resp=await fetch(site+'/api/promocoes/import',{
  method:'POST',
  headers:{Origin:site,'Content-Type':'application/json',Authorization:'Bearer not-a-valid-key'},
  body:JSON.stringify({promotions:[]}),
 })
 console.log('POST /api/promocoes/import (old key): HTTP '+resp.status)
 if(resp.status!==401)failed=true
}catch(err){console.error('Old key test',err);failed=true}
for(const test of [
 {path:'/api/auth/me',cookie:'__Host-ao_session='+'c'.repeat(64),expected:401},
]) {
 try {
  const response=await fetch(site+test.path,{headers:{Cookie:test.cookie}})
  console.log('GET '+test.path+' forged cookie: '+response.status)
  if(response.status!==test.expected)failed=true
 }catch(err){console.error(err);failed=true}
}
for(const test of [
 {path:'/api/auth/login',origin:'https://attacker.example',body:{username:'Thiago Saraiva',password:'any'},expected:403},
 {path:'/api/auth/activate-owner',origin:site,body:{code:'invalid',password:'SenhaSegura12345!'},expected:400},
]) {
 try {
  const response=await fetch(site+test.path,{method:'POST',headers:{Origin:test.origin,'Content-Type':'application/json'},body:JSON.stringify(test.body)})
  console.log('POST '+test.path+' security: '+response.status)
  if(response.status!==test.expected)failed=true
 }catch(err){console.error(err);failed=true}
}
if(failed)process.exitCode=1
