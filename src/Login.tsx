import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, UserRound, ShieldCheck } from 'lucide-react'
import { activateOwner, changePassword, login, type AuthUser } from './auth-api'

export function Login({ onAuthenticated, setupStatus }: {
  onAuthenticated:(user:AuthUser)=>void
  setupStatus:'pending'|'complete'
}) {
  const [username,setUsername]=useState('Thiago Saraiva')
  const [password,setPassword]=useState('')
  const [reveal,setReveal]=useState(false)
  const [activation,setActivation]=useState(false)
  const [code,setCode]=useState('')
  const [confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  async function submit(event:FormEvent) {
    event.preventDefault()
    setMessage('')
    if(activation && password!==confirm) {setMessage('As senhas precisam ser iguais.');return}
    setBusy(true)
    try {
      if(activation) {
        await activateOwner(code.trim(),password)
        setActivation(false)
        setCode('')
        setConfirm('')
        setPassword('')
        setMessage('Administrador ativado. Entre com seu usuário e senha.')
      } else {
        onAuthenticated(await login(username.trim(),password))
      }
    } catch(err) {setMessage(err instanceof Error?err.message:'Falha ao entrar.')}
    finally {setBusy(false)}
  }
  return <main className="auth-screen">
    <div className="auth-decoration" aria-hidden="true"><div className="auth-orb"/></div>
    <section className="auth-card" aria-label="Acesso ao Acompanhamento de Ofertas">
      <div className="auth-logo"><span>AO</span><div>Acompanhamento <strong>de Ofertas</strong></div></div>
      <div className="auth-heading"><div className="auth-icon"><ShieldCheck size={25}/></div>
        <h1>{activation?'Ativar administrador':'Bem-vindo de volta'}</h1>
        <p>{activation?'Defina a senha da conta principal':'Entre com suas credenciais para acessar as promoções.'}</p>
      </div>
      <form onSubmit={submit} className="auth-form">
        {!activation && <label>Usuário<div className="auth-field"><UserRound size={18}/><input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required maxLength={64}/></div></label>}
        {activation && <label>Código de ativação<div className="auth-field"><LockKeyhole size={18}/><input value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" required placeholder="Código de uso único"/></div></label>}
        <label>{activation?'Nova senha':'Senha'}<div className="auth-field"><LockKeyhole size={18}/><input type={reveal?'text':'password'} autoComplete={activation?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={activation?12:undefined}/><button type="button" onClick={()=>setReveal(x=>!x)} aria-label={reveal?'Ocultar senha':'Mostrar senha'}>{reveal?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        {activation && <label>Confirmar nova senha<div className="auth-field"><LockKeyhole size={18}/><input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={12}/></div></label>}
        {message && <p role="alert" className="auth-alert">{message}</p>}
        <button className="primary auth-submit" type="submit" disabled={busy}>{busy?'Aguarde...':activation?'Ativar minha conta':'Entrar'}</button>
      </form>
      {setupStatus==='pending' && <button type="button" className="auth-link" onClick={()=>{setActivation(v=>!v);setMessage('');setPassword('')}}>{activation?'Voltar ao login':'Primeiro acesso do administrador'}</button>}
      <p className="auth-footer">Acesso protegido · Cloudflare D1</p>
    </section>
  </main>
}
export function ChangePassword({ onChanged }: {onChanged:()=>void}) {
  const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  async function submit(event:FormEvent) {
    event.preventDefault()
    if(password!==confirm){setMessage('As senhas precisam ser iguais.');return}
    setBusy(true)
    try{await changePassword(current,password);onChanged()}catch(err){setMessage(err instanceof Error?err.message:'Falha ao mudar senha.')}
    finally{setBusy(false)}
  }
  return <main className="auth-screen"><section className="auth-card"><div className="auth-heading"><h1>Defina sua nova senha</h1><p>Por segurança, substitua a senha temporária antes de acessar.</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label>Senha atual<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required/></label>
      <label>Nova senha<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <label>Confirme a senha<input type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
      {message && <p role="alert">{message}</p>}
      <button className="primary auth-submit" disabled={busy}>{busy?'Aguarde...':'Salvar nova senha'}</button>
    </form></section></main>
}
