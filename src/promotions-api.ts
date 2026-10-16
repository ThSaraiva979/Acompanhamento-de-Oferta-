export type Status = 'ATIVA' | 'BREVE' | 'ENCERRADA'

export type Promotion = {
  code: string
  name: string
  oldPrice: string
  price: string
  store: string
  start: string
  end: string
  detail: string
  status: Status
}

export async function loadPromotions(): Promise<Promotion[]> {
  const response = await fetch('/api/promocoes', { cache: 'no-store', credentials:'same-origin' })
  if (response.status===401) throw new Error('Sessão expirada. Entre novamente.')
  if (!response.ok) throw new Error('Não foi possível conectar ao banco de dados.')
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('promotions' in body) ||
    !Array.isArray((body as { promotions: unknown }).promotions)) {
    throw new Error('Resposta inválida do servidor.')
  }
  return (body as { promotions: Promotion[] }).promotions
}

export async function savePromotions(promotions: Promotion[]): Promise<number> {
  const response = await fetch('/api/promocoes/import', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promotions }),
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessão expirada. Entre novamente.')
    if (response.status === 403) throw new Error('Você não tem permissão para importar.')
    if (response.status === 503) throw new Error('O servidor não está configurado para importar promoções.')
    if (response.status === 413) throw new Error('Planilha muito grande para importar.')
    if (response.status === 400) throw new Error('Planilha inválida. Verifique seus campos e o limite de 1.000 linhas.')
    throw new Error('Erro ao salvar no banco de dados. A importação não foi concluída.')
  }
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('count' in body) ||
    typeof (body as { count: unknown }).count !== 'number') {
    throw new Error('O servidor não confirmou o salvamento.')
  }
  return (body as { count: number }).count
}
