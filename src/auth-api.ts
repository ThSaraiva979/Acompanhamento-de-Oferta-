export type Role = 'OWNER' | 'VIEWER'
export interface AuthUser { id:number; username:string; displayName:string; role:Role; mustChangePassword:boolean }
export interface SafeUser extends AuthUser {}
type SetupStatus = 'pending' | 'complete'
async function api<T>(path:string, options?:RequestInit):Promise<T> {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options})
  if(!response.ok) {
    if(response.status===401) throw new Error('Usuário ou senha inválidos, ou sessão expirada.')
    if(response.status===403) throw new Error('Acesso não autorizado.')
    if(response.status===429) throw new Error('Muitas tentativas. Aguarde alguns minutos.')
    throw new Error('Não foi possível concluir a operação.')
  }
  return response.json() as Promise<T>
}
function json(body:unknown):RequestInit {
  return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}
}
export async function getSession():Promise<AuthUser|null> {
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})
  if(response.status===401) return null
  if(!response.ok) throw new Error('Serviço de autenticação indisponível.')
  const body=await response.json() as {user:AuthUser}
  if(!body?.user?.role) throw new Error('Resposta de autenticação inválida.')
  return body.user
}
export async function getSetupStatus():Promise<SetupStatus> {
  const data=await api<{status:SetupStatus}>('/api/auth/setup-status')
  return data.status
}
export async function login(username:string,password:string):Promise<AuthUser> {
  const data=await api<{user:AuthUser}>('/api/auth/login',json({username,password}))
  return data.user
}
export async function activateOwner(code:string,password:string):Promise<void> {
  await api('/api/auth/activate-owner',json({code,password}))
}
export async function logout():Promise<void> {
  await api('/api/auth/logout',{method:'POST'})
}
export async function changePassword(currentPassword:string,newPassword:string):Promise<void> {
  await api('/api/auth/change-password',json({currentPassword,newPassword}))
}
export async function listUsers():Promise<SafeUser[]> {
  return (await api<{users:SafeUser[]}>('/api/admin/users')).users
}
export async function createViewer(username:string,displayName:string):Promise<{user:SafeUser;temporaryPassword:string}> {
  return api('/api/admin/users',json({username,displayName}))
}
export async function updateViewer(id:number,action:'activate'|'deactivate'|'reset-password'):Promise<{success:boolean;temporaryPassword?:string}> {
  return api('/api/admin/users/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})})
}
