import { useMemo, useRef, useState, type ReactNode } from 'react'
import * as XLSX from 'xlsx'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  LayoutDashboard,
  Search,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Tag,
  Upload,
  CheckCircle2,
} from 'lucide-react'

type Status = 'ATIVA' | 'BREVE' | 'ENCERRADA'
type Tab = 'dashboard' | 'promocoes' | 'lojas' | 'vigencias' | 'importar' | 'config'

type Promotion = {
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

const sample: Promotion[] = [
  { code: '789456', name: 'Coca-Cola 2L', oldPrice: 'R$ 12,99', price: 'R$ 8,99', store: 'Loja Centro', start: '20/09/2026', end: '30/09/2026', detail: '10 dias restantes', status: 'ATIVA' },
  { code: '123789', name: 'Arroz Tipo 1 5kg', oldPrice: 'R$ 29,90', price: 'R$ 24,90', store: 'Loja Norte', start: '25/09/2026', end: '05/10/2026', detail: '3 dias para iniciar', status: 'BREVE' },
  { code: '456321', name: 'Café Torrado 500g', oldPrice: 'R$ 18,90', price: 'R$ 14,99', store: 'Loja Sul', start: '18/09/2026', end: '28/09/2026', detail: '6 dias restantes', status: 'ATIVA' },
  { code: '987654', name: 'Detergente 500ml', oldPrice: 'R$ 3,49', price: 'R$ 2,49', store: 'Loja Centro', start: '01/09/2026', end: '20/09/2026', detail: 'Encerrada', status: 'ENCERRADA' },
]

const nav: [Tab, string, ReactNode][] = [
  ['dashboard', 'Visão geral', <LayoutDashboard />],
  ['promocoes', 'Promoções', <Tag />],
  ['lojas', 'Lojas', <Store />],
  ['vigencias', 'Vigências', <CalendarDays />],
  ['importar', 'Importar planilha', <Upload />],
  ['config', 'Configurações', <Settings />],
]

function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [data, setData] = useState<Promotion[]>(sample)
  const [q, setQ] = useState('')
  const [store, setStore] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [compact, setCompact] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(
    () =>
      data.filter(
        (p) =>
          (!q || `${p.code} ${p.name}`.toLowerCase().includes(q.toLowerCase())) &&
          (!store || p.store === store) &&
          (!status || p.status === status),
      ),
    [data, q, store, status],
  )

  const stores = useMemo(() => Array.from(new Set(data.map((p) => p.store))), [data])
  const active = data.filter((p) => p.status === 'ATIVA').length
  const soon = data.filter((p) => p.status === 'BREVE').length

  const title: Record<Tab, string> = {
    dashboard: 'Visão geral',
    promocoes: 'Promoções',
    lojas: 'Lojas',
    vigencias: 'Vigências',
    importar: 'Importar planilha',
    config: 'Configurações',
  }

  const subtitle: Record<Tab, string> = {
    dashboard: 'Acompanhe suas promoções de forma simples e visual.',
    promocoes: 'Consulte, filtre e acompanhe todas as ofertas.',
    lojas: 'Visão consolidada das lojas participantes.',
    vigencias: 'Visualize as ofertas organizadas por período.',
    importar: 'Carregue uma planilha para atualizar as promoções.',
    config: 'Personalize o comportamento do aplicativo.',
  }

  function importFile(file: File) {
    setMessage('Lendo planilha...')
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

        const find = (row: Record<string, unknown>, keys: string[]) => {
          const key = Object.keys(row).find((x) => {
            const normalized = x.toLowerCase().trim()
            return keys.some((candidate) => normalized === candidate || normalized.includes(candidate))
          })
          return key ? String(row[key] ?? '') : ''
        }

        const imported: Promotion[] = rows
          .map((row, index) => {
            const rawStatus = find(row, ['status']) || 'ATIVA'
            const upper = rawStatus.toUpperCase()
            const parsedStatus: Status = upper.includes('ENC') ? 'ENCERRADA' : upper.includes('BRE') ? 'BREVE' : 'ATIVA'

            return {
              code: find(row, ['código', 'codigo', 'cod']) || String(index + 1),
              name: find(row, ['nome', 'produto', 'descrição', 'descricao']) || 'Produto sem nome',
              oldPrice: find(row, ['preço anterior', 'preco anterior', 'preço normal', 'preco normal']) || '',
              price: find(row, ['preço', 'preco', 'valor']) || '',
              store: find(row, ['loja', 'filial']) || 'Não informada',
              start: find(row, ['início', 'inicio', 'data inicial']) || '',
              end: find(row, ['fim', 'final', 'data final', 'vigência', 'vigencia']) || '',
              detail: 'Importada da planilha',
              status: parsedStatus,
            }
          })
          .filter((p) => p.name !== 'Produto sem nome' || p.code !== '')

        if (imported.length) {
          setData(imported)
          setMessage(`${imported.length} promoções importadas com sucesso.`)
          setTab('promocoes')
        } else {
          setMessage('A planilha não possui linhas reconhecíveis.')
        }
      } catch {
        setMessage('Não foi possível ler a planilha. Verifique o arquivo.')
      }
    }

    reader.readAsArrayBuffer(file)
  }

  return (
    <div className={`app ${compact ? 'compact' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AO</div>
          <div>
            Acompanhamento <span>de Ofertas</span>
          </div>
        </div>

        <nav>
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'active' : ''}
              onClick={() => {
                setTab(id)
                setMessage('')
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          Dados carregados: <strong>{data.length}</strong>
          <br />
          Protótipo v0.2.1
        </div>
      </aside>

      <main>
        <header>
          <div>
            <h1>{title[tab]}</h1>
            <p>{subtitle[tab]}</p>
          </div>

          <button
            type="button"
            className="primary"
            onClick={() => {
              setTab('importar')
              setMessage('')
            }}
          >
            <Upload size={17} />
            Importar planilha
          </button>
        </header>

        {tab === 'dashboard' && (
          <>
            <section className="stats">
              <Stat icon={<Tag />} value={String(active)} label="Promoções ativas" />
              <Stat icon={<ShoppingBag />} value={String(new Set(data.map((p) => p.code)).size)} label="Produtos em oferta" />
              <Stat icon={<Store />} value={String(stores.length)} label="Lojas participantes" />
              <Stat icon={<Clock3 />} value={String(soon)} label="Vencendo em breve" />
            </section>

            <PromotionPanel
              filtered={filtered}
              q={q}
              setQ={setQ}
              store={store}
              setStore={setStore}
              status={status}
              setStatus={setStatus}
              stores={stores}
            />
          </>
        )}

        {tab === 'promocoes' && (
          <PromotionPanel
            filtered={filtered}
            q={q}
            setQ={setQ}
            store={store}
            setStore={setStore}
            status={status}
            setStatus={setStatus}
            stores={stores}
          />
        )}

        {tab === 'lojas' && <Lojas data={data} stores={stores} />}
        {tab === 'vigencias' && <Vigencias data={data} />}

        {tab === 'importar' && (
          <section className="panel import-panel">
            <div className="upload-box" onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet size={44} />
              <h2>Importe sua planilha</h2>
              <p>Excel (.xlsx, .xls) ou CSV. A primeira aba será utilizada.</p>
              <button type="button" className="primary">
                Selecionar arquivo
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
              />
            </div>

            {message && (
              <div className="notice">
                <CheckCircle2 size={18} />
                {message}
              </div>
            )}

            <div className="mapping">
              <h3>Colunas reconhecidas automaticamente</h3>
              <p>Código interno · Nome/Produto · Preço · Preço anterior · Vigência · Loja · Status</p>
            </div>
          </section>
        )}

        {tab === 'config' && (
          <section className="panel settings-panel">
            <div className="setting">
              <div>
                <b>Modo compacto</b>
                <span>Reduz o espaçamento da tabela para mostrar mais promoções.</span>
              </div>
              <button type="button" className={compact ? 'switch on' : 'switch'} onClick={() => setCompact(!compact)}>
                <i />
              </button>
            </div>
            <div className="setting">
              <div>
                <b>Atualização dos dados</b>
                <span>Os dados permanecem no navegador até uma nova importação.</span>
              </div>
              <SlidersHorizontal size={20} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function PromotionPanel({
  filtered,
  q,
  setQ,
  store,
  setStore,
  status,
  setStatus,
  stores,
}: {
  filtered: Promotion[]
  q: string
  setQ: (value: string) => void
  store: string
  setStore: (value: string) => void
  status: string
  setStatus: (value: string) => void
  stores: string[]
}) {
  const [analytics, setAnalytics] = useState(false)

  const statusSummary = (['ATIVA', 'BREVE', 'ENCERRADA'] as Status[]).map((item) => ({
    label: item,
    value: filtered.filter((p) => p.status === item).length,
  }))

  const storeSummary = stores
    .map((item) => ({
      label: item,
      value: filtered.filter((p) => p.store === item).length,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)

  const prices = filtered.map((p) => parseMoney(p.price)).filter((value) => value > 0)
  const discounts = filtered
    .map((p) => {
      const oldPrice = parseMoney(p.oldPrice)
      const promoPrice = parseMoney(p.price)
      return oldPrice > 0 && promoPrice > 0 && oldPrice > promoPrice ? ((oldPrice - promoPrice) / oldPrice) * 100 : 0
    })
    .filter((value) => value > 0)

  const averagePrice = prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : 0
  const averageDiscount = discounts.length ? discounts.reduce((sum, value) => sum + value, 0) / discounts.length : 0
  const maxStatus = Math.max(1, ...statusSummary.map((item) => item.value))
  const maxStore = Math.max(1, ...storeSummary.map((item) => item.value))

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Promoções</h2>
          <span>{filtered.length} registros exibidos</span>
        </div>
        <button
          type="button"
          className={analytics ? 'ghost analytics-active' : 'ghost'}
          onClick={() => setAnalytics((current) => !current)}
        >
          <BarChart3 size={16} />
          {analytics ? 'Ocultar análise' : 'Visão analítica'}
        </button>
      </div>

      <div className="filters">
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou produto..." />
        </div>
        <Select value={store} setValue={setStore} options={stores} placeholder="Todas as lojas" />
        <Select value={status} setValue={setStatus} options={['ATIVA', 'BREVE', 'ENCERRADA']} placeholder="Todos os status" />
      </div>

      {analytics && (
        <div className="analytics-view">
          <div className="analytics-kpis">
            <div className="analytics-kpi">
              <span>Registros analisados</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="analytics-kpi">
              <span>Preço médio promocional</span>
              <strong>{averagePrice ? formatMoney(averagePrice) : '—'}</strong>
            </div>
            <div className="analytics-kpi">
              <span>Desconto médio</span>
              <strong>{averageDiscount ? `${averageDiscount.toFixed(1)}%` : '—'}</strong>
            </div>
            <div className="analytics-kpi">
              <span>Lojas no filtro</span>
              <strong>{new Set(filtered.map((p) => p.store)).size}</strong>
            </div>
          </div>

          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-card-head">
                <div>
                  <h3>Status das promoções</h3>
                  <p>Distribuição dos registros exibidos</p>
                </div>
              </div>
              <div className="bar-list">
                {statusSummary.map((item) => (
                  <div className="bar-row" key={item.label}>
                    <div className="bar-row-top">
                      <span>{item.label === 'BREVE' ? 'Vencendo em breve' : item.label === 'ATIVA' ? 'Ativas' : 'Encerradas'}</span>
                      <b>{item.value}</b>
                    </div>
                    <div className="bar-track">
                      <div
                        className={`bar-fill status-${item.label.toLowerCase()}`}
                        style={{ width: `${(item.value / maxStatus) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-card">
              <div className="analytics-card-head">
                <div>
                  <h3>Promoções por loja</h3>
                  <p>Quantidade por unidade no filtro atual</p>
                </div>
              </div>
              <div className="bar-list">
                {storeSummary.length ? (
                  storeSummary.map((item) => (
                    <div className="bar-row" key={item.label}>
                      <div className="bar-row-top">
                        <span>{item.label}</span>
                        <b>{item.value}</b>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill store-bar" style={{ width: `${(item.value / maxStore) * 100}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="analytics-empty">Nenhum dado disponível para os filtros atuais.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Table rows={filtered} />
    </section>
  )
}

function parseMoney(value: string) {
  if (!value) return 0
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function Lojas({ data, stores }: { data: Promotion[]; stores: string[] }) {
  return (
    <section className="store-grid">
      {stores.map((store) => {
        const rows = data.filter((p) => p.store === store)
        const active = rows.filter((p) => p.status === 'ATIVA').length

        return (
          <article className="store-card" key={store}>
            <div className="store-icon">
              <Store />
            </div>
            <h2>{store}</h2>
            <p>{rows.length} promoções cadastradas</p>
            <div className="store-meta">
              <span>
                Ativas <b>{active}</b>
              </span>
              <span>
                Produtos <b>{new Set(rows.map((p) => p.code)).size}</b>
              </span>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function Vigencias({ data }: { data: Promotion[] }) {
  const ordered = [...data].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <section className="panel">
      <div className="timeline">
        {ordered.map((p) => (
          <div className="timeline-item" key={p.code}>
            <div className="dot" />
            <div>
              <b>{p.name}</b>
              <span>
                {p.start} → {p.end} · {p.store}
              </span>
            </div>
            <Badge status={p.status} />
          </div>
        ))}
      </div>
    </section>
  )
}

function Table({ rows }: { rows: Promotion[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Preço promocional</th>
            <th>Loja</th>
            <th>Vigência</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.code}>
              <td>
                <b>{p.name}</b>
                <small>Código: {p.code}</small>
              </td>
              <td>
                <del>{p.oldPrice}</del>
                <strong>{p.price}</strong>
              </td>
              <td>
                <span className="store">
                  <Store size={15} />
                  {p.store}
                </span>
              </td>
              <td>
                {p.start} → {p.end}
                <small>{p.detail}</small>
              </td>
              <td>
                <Badge status={p.status} />
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="empty">
                Nenhuma promoção encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function Select({
  value,
  setValue,
  options,
  placeholder,
}: {
  value: string
  setValue: (value: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <label className="select">
      <select value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown size={16} />
    </label>
  )
}

function Badge({ status }: { status: Status }) {
  return <span className={`badge ${status.toLowerCase()}`}>● {status}</span>
}

export default App
