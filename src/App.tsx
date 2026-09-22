import { useMemo, useRef, useState, type ReactNode } from 'react'
import * as XLSX from 'xlsx'
import { BarChart3, CalendarDays, ChevronDown, Clock3, LayoutDashboard, Search, Settings, ShoppingBag, Store, Tag, Upload, FileSpreadsheet, CheckCircle2, SlidersHorizontal } from 'lucide-react'

type Status='ATIVA'|'BREVE'|'ENCERRADA'
type Promotion={code:string;name:string;oldPrice:string;price:string;store:string;start:string;end:string;detail:string;status:Status}
type Tab='dashboard'|'promocoes'|'lojas'|'vigencias'|'importar'|'config'

const sample:Promotion[]=[
{code:'789456',name:'Coca-Cola 2L',oldPrice:'R$ 12,99',price:'R$ 8,99',store:'Loja Centro',start:'20/09/2026',end:'30/09/2026',detail:'10 dias restantes',status:'ATIVA'},
{code:'123789',name:'Arroz Tipo 1 5kg',oldPrice:'R$ 29,90',price:'R$ 24,90',store:'Loja Norte',start:'25/09/2026',end:'05/10/2026',detail:'3 dias para iniciar',status:'BREVE'},
{code:'456321',name:'Café Torrado 500g',oldPrice:'R$ 18,90',price:'R$ 14,99',store:'Loja Sul',start:'18/09/2026',end:'28/09/2026',detail:'6 dias restantes',status:'ATIVA'},
{code:'987654',name:'Detergente 500ml',oldPrice:'R$ 3,49',price:'R$ 2,49',store:'Loja Centro',start:'01/09/2026',end:'20/09/2026',detail:'Encerrada',status:'ENCERRADA'}]

const nav:[Tab,string,ReactNode][]=[
['dashboard','Visão geral',<LayoutDashboard/>],['promocoes','Promoções',<Tag/>],['lojas','Lojas',<Store/>],
['vigencias','Vigências',<CalendarDays/>],['importar','Importar planilha',<Upload/>],['config','Configurações',<Settings/>]
]

function App(){
 const [tab,setTab]=useState<Tab>('dashboard'),[data,setData]=useState<Promotion[]>(sample),[q,setQ]=useState(''),[store,setStore]=useState(''),[status,setStatus]=useState(''),[message,setMessage]=useState(''),[compact,setCompact]=useState(false)
 const inputRef=useRef<HTMLInputElement>(null)
 const filtered=useMemo(()=>data.filter(p=>(!q||`${p.code} ${p.name}`.toLowerCase().includes(q.toLowerCase()))&&(!store||p.store===store)&&(!status||p.status===status)),[data,q,store,status])
 const stores=useMemo(()=>Array.from(new Set(data.map(p=>p.store))),[data])
 const active=data.filter(p=>p.status==='ATIVA').length, soon=data.filter(p=>p.status==='BREVE').length
 const title={dashboard:'Visão geral',promocoes:'Promoções',lojas:'Lojas',vigencias:'Vigências',importar:'Importar planilha',config:'Configurações'}[tab]
 const subtitle={dashboard:'Acompanhe suas promoções de forma simples e visual.',promocoes:'Consulte, filtre e acompanhe todas as ofertas.',lojas:'Visão consolidada das lojas participantes.',vigencias:'Visualize as ofertas organizadas por período.',importar:'Carregue uma planilha para atualizar as promoções.',config:'Personalize o comportamento do aplicativo.'}[tab]

 function importFile(file:File){
  setMessage('Lendo planilha...')
  const reader=new FileReader()
  reader.onload=e=>{
   try{
    const wb=XLSX.read(e.target?.result,{type:'array'}), ws=wb.Sheets[wb.SheetNames[0]]
    const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:''})
    const find=(r:Record<string,unknown>,keys:string[])=>{const k=Object.keys(r).find(x=>keys.some(y=>x.toLowerCase().trim()===y||x.toLowerCase().includes(y)));return k?String(r[k]??''):''}
    const imported:Promotion[]=rows.map((r,i)=>{
      const s=find(r,['status'])||'ATIVA', st=(s.toUpperCase().includes('ENC')?'ENCERRADA':s.toUpperCase().includes('BRE')?'BREVE':'ATIVA') as Status
      return {code:find(r,['código','codigo','cod'])||String(i+1),name:find(r,['nome','produto','descrição','descricao'])||'Produto sem nome',oldPrice:find(r,['preço anterior','preco anterior','preço normal','preco normal'])||'',price:find(r,['preço','preco','valor'])||'',store:find(r,['loja','filial'])||'Não informada',start:find(r,['início','inicio','data inicial'])||'',end:find(r,['fim','final','data final','vigência','vigencia'])||'',detail:'Importada da planilha',status:st}
    }).filter(p=>p.name!=='Produto sem nome'||p.code!=='')
    if(imported.length){setData(imported);setMessage(`${imported.length} promoções importadas com sucesso.`);setTab('promocoes')}else setMessage('A planilha não possui linhas reconhecíveis.')
   }catch{setMessage('Não foi possível ler a planilha. Verifique o arquivo.')}
  }
  reader.readAsArrayBuffer(file)
 }
 return <div className={`app ${compact?'compact':''}`}>
  <aside className="sidebar"><div className="brand"><div className="brand-mark">AO</div><div>Acompanhamento <span>de Ofertas</span></div></div>
   <nav>{nav.map(([id,label,icon])=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setMessage('')}}>{icon}{label}</button>)}</nav>
   <div className="sidebar-footer">Dados carregados: <strong>{data.length}</strong><br/>Protótipo v0.2.0</div>
  </aside>
  <main><header><div><h1>{title}</h1><p>{subtitle}</p></div><button className="primary" onClick={()=>{setTab('importar');setMessage('')}}><Upload size={17}/>Importar planilha</button></header>
   {tab==='dashboard'&&<Dashboard data={data} active={active} soon={soon} setTab={setTab}/>}
   {tab==='promocoes'&&<Promocoes data={data} filtered={filtered} q={q} setQ={setQ} store={store} setStore={setStore} status={status} setStatus={setStatus} stores={stores}/>}
   {tab==='lojas'&&<Lojas data={data} stores={stores}/>}
   {tab==='vigencias'&&<Vigencias data={data}/>}
   {tab==='importar'&&<section className="panel import-panel"><div className="upload-box" onClick={()=>inputRef.current?.click()}><FileSpreadsheet size={44}/><h2>Importe sua planilha</h2><p>Excel (.xlsx, .xls) ou CSV. A primeira aba será utilizada.</p><button className="primary">Selecionar arquivo</button><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>e.target.files?.[0]&&importFile(e.target.files[0])}/></div>{message&&<div className="notice"><CheckCircle2 size={18}/>{message}</div>}<div className="mapping"><h3>Colunas reconhecidas automaticamente</h3><p>Código interno · Nome/Produto · Preço · Preço anterior · Vigência · Loja · Status</p></div></section>}
   {tab==='config'&&<section className="panel settings-panel"><div className="setting"><div><b>Modo compacto</b><span>Reduz o espaçamento da tabela para mostrar mais promoções.</span></div><button className={compact?'switch on':'switch'} onClick={()=>setCompact(!compact)}><i/></button></div><div className="setting"><div><b>Atualização dos dados</b><span>Os dados permanecem no navegador até uma nova importação.</span></div><SlidersHorizontal size={20}/></div></section>}
  </main></div>
}

function Dashboard({data,active,soon,setTab}:{data:Promotion[];active:number;soon:number;setTab:(t:Tab)=>void}){return <><section className="stats"><Stat icon={<Tag/>} value={String(active)} label="Promoções ativas"/><Stat icon={<ShoppingBag/>} value={String(new Set(data.map(p=>p.code)).size)} label="Produtos em oferta"/><Stat icon={<Store/>} value={String(new Set(data.map(p=>p.store)).size)} label="Lojas participantes"/><Stat icon={<Clock3/>} value={String(soon)} label="Vencendo em breve"/></section><section className="panel"><div className="panel-head"><div><h2>Atalhos</h2><span>Acesse rapidamente as áreas do sistema.</span></div></div><div className="shortcut-grid"><button onClick={()=>setTab('promocoes')}><Tag/>Ver promoções<strong>{data.length} registros</strong></button><button onClick={()=>setTab('lojas')}><Store/>Ver lojas<strong>{new Set(data.map(p=>p.store)).size} lojas</strong></button><button onClick={()=>setTab('vigencias')}><CalendarDays/>Ver vigências<strong>Calendário de ofertas</strong></button><button onClick={()=>setTab('importar')}><Upload/>Importar dados<strong>Excel ou CSV</strong></button></div></section></>}

function Promocoes({filtered,q,setQ,store,setStore,status,setStatus,stores}:{data:Promotion[];filtered:Promotion[];q:string;setQ:(v:string)=>void;store:string;setStore:(v:string)=>void;status:string;setStatus:(v:string)=>void;stores:string[]}){return <section className="panel"><div className="panel-head"><div><h2>Promoções</h2><span>{filtered.length} registros exibidos</span></div><button className="ghost"><BarChart3 size={16}/>Visão analítica</button></div><div className="filters"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por código ou produto..."/></div><Select value={store} setValue={setStore} options={stores} placeholder="Todas as lojas"/><Select value={status} setValue={setStatus} options={['ATIVA','BREVE','ENCERRADA']} placeholder="Todos os status"/></div><Table rows={filtered}/></section>}

function Lojas({data,stores}:{data:Promotion[];stores:string[]}){return <section className="store-grid">{stores.map(s=>{const rows=data.filter(p=>p.store===s),active=rows.filter(p=>p.status==='ATIVA').length;return <article className="store-card" key={s}><div className="store-icon"><Store/></div><h2>{s}</h2><p>{rows.length} promoções cadastradas</p><div className="store-meta"><span>Ativas <b>{active}</b></span><span>Produtos <b>{new Set(rows.map(p=>p.code)).size}</b></span></div></article>})}</section>}

function Vigencias({data}:{data:Promotion[]}){const ordered=[...data].sort((a,b)=>a.start.localeCompare(b.start));return <section className="panel"><div className="timeline">{ordered.map(p=><div className="timeline-item" key={p.code}><div className="dot"/><div><b>{p.name}</b><span>{p.start} → {p.end} · {p.store}</span></div><Badge status={p.status}/></div>)}</div></section>}

function Table({rows}:{rows:Promotion[]}){return <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Preço promocional</th><th>Loja</th><th>Vigência</th><th>Status</th></tr></thead><tbody>{rows.map(p=><tr key={p.code}><td><b>{p.name}</b><small>Código: {p.code}</small></td><td><del>{p.oldPrice}</del><strong>{p.price}</strong></td><td><span className="store"><Store size={15}/>{p.store}</span></td><td>{p.start} → {p.end}<small>{p.detail}</small></td><td><Badge status={p.status}/></td></tr>)}{!rows.length&&<tr><td colSpan={5} className="empty">Nenhuma promoção encontrada.</td></tr>}</tbody></table></div>}
function Stat({icon,value,label}:{icon:ReactNode;value:string;label:string}){return <div className="stat"><div className="stat-icon">{icon}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>}
function Select({value,setValue,options,placeholder}:{value:string;setValue:(v:string)=>void;options:string[];placeholder:string}){return <label className="select"><select value={value} onChange={e=>setValue(e.target.value)}><option value="">{placeholder}</option>{options.map(o=><option key={o}>{o}</option>)}</select><ChevronDown size={16}/></label>}
function Badge({status}:{status:Status}){return <span className={`badge ${status.toLowerCase()}`}>● {status==='ATIVA'?'ATIVA':status==='BREVE'?'BREVE':'ENCERRADA'}</span>}
export default App
