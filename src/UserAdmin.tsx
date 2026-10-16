import { useEffect, useState, type FormEvent } from 'react'
import { createViewer, listUsers, updateViewer, type SafeUser } from './auth-api'
export default function UserAdmin() {
  const [rows,setRows]=useState<SafeUser[]>([])
  const [username,setUsername]=useState(''),[name,setName]=useState('')
  const [temporary,setTemporary]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  async function reload() {setRows(await listUsers())}
  useEffect(()=>{void reload().catch(()=>setMessage('Não foi possível carregar os usuários.'))},[])
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setMessage('');setTemporary('')
    try {const x=await createViewer(username.trim(),name.trim());setTemporary(x.temporaryPassword);setUsername('');setName('');await reload();setMessage('Usuário criado com senha temporária.')}
    catch(e){setMessage(e instanceof Error?e.message:'Falha ao criar usuário.')}
    finally{setBusy(false)}
  }
  async function modify(id:number,action:'activate'|'deactivate'|'reset-password') {
    setBusy(true);setMessage('');setTemporary('')
    try {const x=await updateViewer(id,action);if(x.temporaryPassword)setTemporary(x.temporaryPassword);await reload();setMessage('Operação concluída.')}
    catch(e){setMessage(e instanceof Error?e.message:'Falha na operação.')}
    finally {setBusy(false)}
  }
  return <section className="panel user-admin">
    <h2>Gerenciar usuários</h2><p>Somente o administrador principal pode adicionar e gerenciar acessos.</p>
    <form onSubmit={submit} className="user-admin-form">
      <label>Usuário<input required minLength={3} maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Nome de acesso"/></label>
      <label>Nome completo<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da pessoa"/></label>
      <button type="submit" className="primary" disabled={busy}>Criar usuário</button>
    </form>
    {temporary && <div className="auth-temporary" role="status"><b>Senha temporária (exibida apenas agora)</b><code>{temporary}</code><p>Compartilhe por um canal privado. Ela deverá ser trocada no primeiro login.</p><button type="button" onClick={()=>setTemporary('')}>Ocultar senha</button></div>}
    {message && <div className="notice" role="status">{message}</div>}
    <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Permissões</th></tr></thead><tbody>
      {rows.map(u=><tr key={u.id}><td>{u.displayName}</td><td>{u.username}</td><td>{u.role==='OWNER'?'Administrador principal':'Consulta'}</td><td>{u.role==='OWNER'?'Conta protegida':<div className="user-actions"><button disabled={busy} onClick={()=>void modify(u.id,'reset-password')}>Redefinir senha</button><button disabled={busy} onClick={()=>void modify(u.id,'deactivate')}>Desativar</button><button disabled={busy} onClick={()=>void modify(u.id,'activate')}>Reativar</button></div>}</td></tr>)}
    </tbody></table></div>
  </section>
}
