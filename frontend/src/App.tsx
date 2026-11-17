import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpRight, Bot, Check, ChevronDown, CircleHelp, Clock3, Globe2, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Moon, Plus, Radar, Search, Settings2, ShieldAlert, ShieldCheck, Sparkles, Sun, X } from 'lucide-react'
import { API, api, Incident, Preferences, Scan, Summary, User } from './api'
import './brand.css'

type Page = 'overview' | 'scan' | 'incidents' | 'assistant' | 'settings'
type AuthResult = { access_token: string; expires_at: string; user: User }
type ChatLine = { role: 'user' | 'assistant'; text: string }

const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'scan', label: 'URL analysis', icon: Radar },
  { id: 'incidents', label: 'Incidents', icon: ShieldAlert }, { id: 'assistant', label: 'AI analyst', icon: Bot }, { id: 'settings', label: 'Settings', icon: Settings2 },
]
const emptySummary: Summary = { websites_monitored: 0, scans_total: 0, high_risk_scans: 0, open_incidents: 0, recent_scans: [] }

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('cs_token') || '')
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>('overview')
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [scans, setScans] = useState<Scan[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [preferences, setPreferences] = useState<Preferences>({ theme: 'dark', protection_enabled: true, sync_extension: false, ollama_model: '', retention_days: 90 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [scanUrl, setScanUrl] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [latestScan, setLatestScan] = useState<Scan | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [chatLines, setChatLines] = useState<ChatLine[]>([{ role: 'assistant', text: 'I can explain scan evidence and suggest defensive next steps. Ask a question, or analyze a URL first and choose a recent scan.' }])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)

  const refresh = useCallback(async (currentToken: string) => {
    setLoading(true); setError('')
    try {
      const [me, home, scanRows, incidentRows, prefs] = await Promise.all([
        api<User>('/auth/me', currentToken), api<Summary>('/dashboard/summary', currentToken), api<Scan[]>('/scans?limit=50', currentToken),
        api<Incident[]>('/incidents', currentToken), api<Preferences>('/settings', currentToken),
      ])
      setUser(me); setSummary(home); setScans(scanRows); setIncidents(incidentRows); setPreferences(prefs)
    } catch (e) {
      localStorage.removeItem('cs_token'); setToken(''); setUser(null); setError(e instanceof Error ? e.message : 'Could not connect to the API.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (token) void refresh(token); else setLoading(false) }, [token, refresh])
  useEffect(() => { if (toast) { const id = window.setTimeout(() => setToast(''), 3000); return () => clearTimeout(id) } }, [toast])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const applyTheme = () => { document.documentElement.dataset.theme = preferences.theme === 'system' ? (media.matches ? 'light' : 'dark') : preferences.theme }
    applyTheme()
    if (preferences.theme === 'system') media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [preferences.theme])

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    const data = new FormData(event.currentTarget)
    const payload = authMode === 'login'
      ? { login: String(data.get('login')), password: String(data.get('password')) }
      : { full_name: String(data.get('full_name')), username: String(data.get('username')), email: String(data.get('email')), password: String(data.get('password')) }
    try {
      const result = await api<AuthResult>(`/auth/${authMode === 'login' ? 'login' : 'register'}`, undefined, { method: 'POST', body: JSON.stringify(payload) })
      localStorage.setItem('cs_token', result.access_token); setToken(result.access_token); setUser(result.user); setToast('Signed in securely')
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed') }
  }

  const logout = async () => {
    try { if (token) await api('/auth/logout', token, { method: 'POST' }) } catch { /* local sign-out still succeeds */ }
    localStorage.removeItem('cs_token'); setToken(''); setUser(null); setToast('Signed out')
  }

  const runScan = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!scanUrl.trim()) return
    setScanBusy(true); setError(''); setLatestScan(null)
    try {
      const result = await api<Scan & { detections?: unknown[] }>('/scans', token, { method: 'POST', body: JSON.stringify({ url: scanUrl.trim() }) })
      setLatestScan(result); setScanUrl(''); setToast(`Analysis complete · ${result.risk_level.toLowerCase()} risk`)
      await refresh(token)
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis could not be completed') }
    finally { setScanBusy(false) }
  }

  const updateIncident = async (incident: Incident, status: string) => {
    try { await api(`/incidents/${incident.id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) }); setIncidents(await api<Incident[]>('/incidents', token)); setSummary(await api<Summary>('/dashboard/summary', token)); setToast(`Incident ${status.toLowerCase()}`) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update incident') }
  }

  const sendChat = async (event: FormEvent) => {
    event.preventDefault(); const message = chatInput.trim(); if (!message) return
    setChatInput(''); setChatLines(lines => [...lines, { role: 'user', text: message }]); setChatBusy(true)
    try {
      const reply = await api<{ response: string; model: string }>('/assistant/chat', token, { method: 'POST', body: JSON.stringify({ message, scan_id: latestScan?.id }) })
      setChatLines(lines => [...lines, { role: 'assistant', text: reply.response }])
    } catch (e) { setChatLines(lines => [...lines, { role: 'assistant', text: e instanceof Error ? e.message : 'Local AI is unavailable. Check the Ollama service.' }]) }
    finally { setChatBusy(false) }
  }

  const updatePreference = async (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch }; setPreferences(next)
    try { const saved = await api<Preferences>('/settings', token, { method: 'PATCH', body: JSON.stringify(patch) }); setPreferences(saved); setToast('Settings saved') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save settings') }
  }

  const copyToken = async () => {
    try { await navigator.clipboard.writeText(token); setToast('Session token copied. Store it only in your own extension profile.') }
    catch { setToast('Clipboard access was unavailable') }
  }

  if (loading && token && !user) return <div className="boot"><LoaderCircle className="spin" size={24} /> Connecting to CyberShield</div>
  if (!token || !user) return <AuthPage mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} error={error} />

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><img className="brand-logo" src="/cybershield-shield.png" alt="" /></div><div><strong>CyberShield</strong><span>AI SECURITY CENTER</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setError('') }}><item.icon size={18} /><span>{item.label}</span>{item.id === 'incidents' && summary.open_incidents > 0 && <b className="nav-count">{summary.open_incidents}</b>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="protection-card"><div className="protection-top"><span className="pulse-dot" />{preferences.protection_enabled ? 'Protection preference on' : 'Protection preference off'}</div><small>Local rule engine ready</small><button onClick={() => void updatePreference({ protection_enabled: !preferences.protection_enabled })}>{preferences.protection_enabled ? 'Pause protection' : 'Resume protection'}</button></div>
      <button className="profile" onClick={() => void logout()}><div className="avatar">{user.full_name.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user.full_name}</strong><small>{user.email}</small></div><LogOut size={16} /></button>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb"><span>Workspace</span><span className="slash">/</span><strong>{nav.find(item => item.id === page)?.label}</strong></div><div className="top-actions"><span className="api-status"><span className="status-dot" />API connected</span><button className="icon-button theme-toggle" title="Switch theme" onClick={() => void updatePreference({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })}>{preferences.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><div className="top-avatar">{user.full_name.slice(0, 1).toUpperCase()}</div></div></header>
      <div className="content-area">
        {error && <div className="error-banner"><AlertTriangle size={16} />{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
        {page === 'overview' && <Overview summary={summary} onNavigate={setPage} onOpenScan={scan => { setLatestScan(scan); setPage('scan') }} />}
        {page === 'scan' && <ScanPage scans={scans} latest={latestScan} url={scanUrl} setUrl={setScanUrl} busy={scanBusy} onSubmit={runScan} />}
        {page === 'scan' && <ReportDownloads />}
        {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={updateIncident} />}
        {page === 'assistant' && <AssistantPage lines={chatLines} input={chatInput} setInput={setChatInput} busy={chatBusy} onSubmit={sendChat} onNew={() => setChatLines([{ role: 'assistant', text: 'I can explain scan evidence and suggest defensive next steps. Ask a question, or analyze a URL first and choose a recent scan.' }])} />}
        {page === 'settings' && <SettingsPage preferences={preferences} update={updatePreference} copyToken={copyToken} />}
      </div>
    </main>
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
  </div>
}

function AuthPage({ mode, setMode, onSubmit, error }: { mode: 'login' | 'register'; setMode: (mode: 'login' | 'register') => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string }) {
  return <div className="auth-shell"><div className="auth-visual"><div className="auth-logo"><div className="brand-mark"><img className="brand-logo" src="/cybershield-shield.png" alt="" /></div><strong>CyberShield</strong></div><div className="auth-hero"><img className="auth-hero-logo" src="/cybershield-logo.png" alt="CyberShield Detection System — Detect, Protect, Stay Safe" /><div className="eyebrow"><span className="pulse-dot" /> PRIVACY-FIRST BROWSER DEFENSE</div><h1>Clarity when<br /><em>risk is hidden.</em></h1><p>Understand suspicious URLs with explainable signals and keep your investigation data on your own machine.</p><div className="hero-grid"><div><ShieldCheck size={18} /><span>Local-first analysis</span></div><div><LockKeyhole size={18} /><span>Private by design</span></div><div><Activity size={18} /><span>Evidence-led alerts</span></div></div></div><div className="auth-foot">CYBERSHIELD <span>·</span> DEFENSIVE SECURITY WORKSPACE</div></div><div className="auth-panel"><form className="auth-form" onSubmit={onSubmit}><div className="auth-form-icon"><ShieldCheck size={20} /></div><div className="eyebrow">SECURE WORKSPACE</div><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p className="muted">{mode === 'login' ? 'Sign in to continue to your security center.' : 'Your browser activity stays on this device.'}</p>{mode === 'register' && <><label>Full name<input name="full_name" required maxLength={120} placeholder="Alex Morgan" autoComplete="name" /></label><label>Username<input name="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_.-]+" placeholder="alex.morgan" autoComplete="username" /></label><label>Email address<input name="email" type="email" required placeholder="you@example.com" autoComplete="email" /></label></>}{mode === 'login' && <label>Email or username<input name="login" required placeholder="you@example.com" autoComplete="username" /></label>}<label>Password<input name="password" type="password" required minLength={mode === 'register' ? 10 : 1} maxLength={128} placeholder={mode === 'register' ? 'At least 10 characters' : 'Enter your password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>{error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}<button className="primary-button auth-submit" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}<ArrowUpRight size={17} /></button><div className="auth-switch">{mode === 'login' ? 'New to CyberShield?' : 'Already have an account?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></div><div className="auth-privacy"><LockKeyhole size={13} /> Passwords are hashed locally by the API. Never enter a real site's password here.</div></form></div></div>
}

function Overview({ summary, onNavigate, onOpenScan }: { summary: Summary; onNavigate: (page: Page) => void; onOpenScan: (scan: Scan) => void }) {
  const cards = [
    { label: 'Websites monitored', value: summary.websites_monitored, icon: Globe2, tone: 'mint', foot: 'Unique domains analyzed' },
    { label: 'URL checks', value: summary.scans_total, icon: Radar, tone: 'blue', foot: 'Persisted in your workspace' },
    { label: 'High risk findings', value: summary.high_risk_scans, icon: AlertTriangle, tone: 'orange', foot: 'High or critical rule matches' },
    { label: 'Open incidents', value: summary.open_incidents, icon: ShieldAlert, tone: 'violet', foot: 'Awaiting your review' },
  ]
  const riskCounts = useMemo(() => ['Critical', 'High', 'Medium', 'Low', 'Safe'].map(level => ({ level, count: summary.recent_scans.filter(scan => scan.risk_level === level).length })), [summary.recent_scans])
  const maxRisk = Math.max(1, ...riskCounts.map(item => item.count))
  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">SECURITY OVERVIEW</div><h1>Good to see you.</h1><p>Here’s the latest activity in your local security workspace.</p></div><button className="primary-button" onClick={() => onNavigate('scan')}><Plus size={17} /> Analyze a URL</button></div>
    <div className="stat-grid">{cards.map(card => <div className="stat-card" key={card.label}><div className={`stat-icon ${card.tone}`}><card.icon size={18} /></div><div className="stat-label">{card.label}</div><div className="stat-value">{card.value.toLocaleString()}</div><div className="stat-foot">{card.foot}</div></div>)}</div>
    <div className="overview-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent analysis</h2><p>Latest URL checks from your workspace</p></div><button className="text-button" onClick={() => onNavigate('scan')}>View all <ArrowUpRight size={14} /></button></div>{summary.recent_scans.length ? <div className="scan-list">{summary.recent_scans.slice(0, 6).map(scan => <button className="scan-row" key={scan.id} onClick={() => onOpenScan(scan)}><div className={`risk-glyph ${riskTone(scan.risk_level)}`}><RiskIcon level={scan.risk_level} /></div><div className="scan-row-main"><strong>{scan.domain}</strong><span>{new Date(scan.created_at).toLocaleString()}</span></div><RiskBadge value={scan.risk_level} /><div className="score-mini"><b>{scan.risk_score}</b><small>/100</small></div><ArrowUpRight size={15} className="row-arrow" /></button>)}</div> : <EmptyState icon={Radar} title="No URL checks yet" copy="Analyze a URL to create your first explainable security result." action="Analyze a URL" onClick={() => onNavigate('scan')} />}</section>
      <section className="panel distribution-panel"><div className="panel-heading"><div><h2>Risk distribution</h2><p>Across the latest six scans</p></div><div className="live-label"><span className="status-dot" /> RULE-BASED</div></div>{summary.recent_scans.length ? <div className="distribution">{riskCounts.map(item => <div className="distribution-row" key={item.level}><div className="distribution-name"><span className={`legend-dot ${riskTone(item.level)}`} />{item.level}</div><div className="bar-track"><div className={`bar-fill ${riskTone(item.level)}`} style={{ width: `${item.count / maxRisk * 100}%` }} /></div><b>{item.count}</b></div>)}<div className="chart-note"><CircleHelp size={14} /> Rule matches are advisory and may be false positives.</div></div> : <div className="quiet-empty"><Radar size={23} /><p>Risk insights appear after your first analysis.</p></div>}</section></div>
    <div className="info-strip"><div className="info-symbol"><Sparkles size={17} /></div><div><strong>Evidence first, AI second.</strong><p>Every score is driven by local rules. Optional Ollama analysis can explain results without sending data to a hosted provider.</p></div><button className="text-button" onClick={() => onNavigate('assistant')}>Open AI analyst <ArrowUpRight size={14} /></button></div>
  </div>
}

function ScanPage({ scans, latest, url, setUrl, busy, onSubmit }: { scans: Scan[]; latest: Scan | null; url: string; setUrl: (value: string) => void; busy: boolean; onSubmit: (event: FormEvent) => void }) {
  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">LOCAL RULE ENGINE</div><h1>URL analysis</h1><p>Inspect URL patterns without fetching the target website.</p></div><div className="offline-pill"><span className="status-dot" /> Offline analysis</div></div><section className="scan-hero panel"><div className="scan-hero-icon"><Radar size={21} /></div><h2>Check a suspicious URL</h2><p>Only the URL string is evaluated. This tool does not visit the site, follow redirects, or submit credentials.</p><form className="scan-form" onSubmit={onSubmit}><div className="url-input-wrap"><Globe2 size={17} /><input aria-label="URL to analyze" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/login" /></div><button className="primary-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Radar size={17} />}{busy ? 'Analyzing' : 'Analyze URL'}</button></form><div className="scan-hints"><span><Check size={13} /> Punycode and Unicode signals</span><span><Check size={13} /> Lookalike domain patterns</span><span><Check size={13} /> Redirect parameters</span><span><Check size={13} /> Risky download suffixes</span></div></section>
    {latest && <ScanResult scan={latest} />}
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Analysis history</h2><p>Recent checks stored under your account</p></div><a className="text-button link-button" href={`${API}/reports/scans.csv`} onClick={event => { event.preventDefault(); void downloadReport(`${API}/reports/scans.csv`, 'cybershield-scans.csv') }}>Export CSV <ArrowDownToLine size={14} /></a></div>{scans.length ? <ScanTable scans={scans} /> : <EmptyState icon={Search} title="Nothing analyzed yet" copy="Your results will appear here after the first URL check." />}</section>
  </div>
}

function ScanResult({ scan }: { scan: Scan }) {
  return <section className={`result-card ${riskTone(scan.risk_level)}`}><div className="result-head"><div className={`risk-glyph large ${riskTone(scan.risk_level)}`}><RiskIcon level={scan.risk_level} /></div><div className="result-title"><div className="eyebrow">URL ANALYSIS RESULT</div><h2>{scan.domain}</h2><p>{scan.url}</p></div><div className="result-score"><strong>{scan.risk_score}</strong><span>/ 100</span><RiskBadge value={scan.risk_level} /></div></div><div className="result-meta"><span>Confidence <b>{Math.round(scan.confidence * 100)}%</b></span><span>Rule matches <b>{Math.max(0, scan.evidence.length - (scan.risk_level === 'Safe' ? 1 : 0))}</b></span><span>Checked <b>{new Date(scan.created_at).toLocaleTimeString()}</b></span></div><div className="evidence-grid"><div><h3>Signals observed</h3><ul>{scan.evidence.map((line, index) => <li key={index}><span className="evidence-bullet" />{line}</li>)}</ul></div><div><h3>Recommended next steps</h3><ul>{scan.recommendations.map((line, index) => <li key={index}><span className="evidence-bullet advice" />{line}</li>)}</ul></div></div><div className="advisory-note"><CircleHelp size={15} /> This is an advisory URL-only analysis. A low score does not prove a site is safe.</div></section>
}

function ScanTable({ scans }: { scans: Scan[] }) {
  return <div className="table-scroll"><table><thead><tr><th>WEBSITE</th><th>RISK</th><th>SCORE</th><th>CONFIDENCE</th><th>CHECKED</th></tr></thead><tbody>{scans.map(scan => <tr key={scan.id}><td><div className="domain-cell"><span className={`table-dot ${riskTone(scan.risk_level)}`} /><div><strong>{scan.domain}</strong><small>{scan.url}</small></div></div></td><td><RiskBadge value={scan.risk_level} /></td><td><strong>{scan.risk_score}</strong><span className="muted"> / 100</span></td><td>{Math.round(scan.confidence * 100)}%</td><td>{new Date(scan.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
}

function IncidentsPage({ incidents, onUpdate }: { incidents: Incident[]; onUpdate: (incident: Incident, status: string) => void }) {
  const [filter, setFilter] = useState('All')
  const visible = incidents.filter(item => filter === 'All' || item.status === filter)
  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">INVESTIGATION QUEUE</div><h1>Incidents</h1><p>Review high-risk URL findings and record your resolution.</p></div><div className="incident-total"><strong>{incidents.length}</strong><span>total records</span></div></div><section className="panel table-panel"><div className="panel-heading"><div><h2>Incident records</h2><p>Automatically created for high and critical rule matches</p></div><div className="select-wrap"><select value={filter} onChange={event => setFilter(event.target.value)}><option>All</option><option>New</option><option>Investigating</option><option>Confirmed</option><option>False Positive</option><option>Resolved</option><option>Archived</option></select><ChevronDown size={14} /></div></div>{visible.length ? <div className="incident-list">{visible.map(item => <article className="incident-card" key={item.id}><div className={`incident-icon ${riskTone(item.severity)}`}><ShieldAlert size={18} /></div><div className="incident-copy"><div className="incident-title-line"><strong>{item.title}</strong><RiskBadge value={item.severity} /></div><div className="incident-domain">{item.domain} <span>·</span> {item.incident_key} <span>·</span> {new Date(item.created_at).toLocaleString()}</div><p>{item.summary}</p>{item.notes.length > 0 && <div className="note-preview"><strong>Latest note:</strong> {item.notes[item.notes.length - 1].note}</div>}</div><div className="incident-action"><div className="select-wrap"><select aria-label="Update incident status" value={item.status} onChange={event => onUpdate(item, event.target.value)}><option>New</option><option>Investigating</option><option>Confirmed</option><option>False Positive</option><option>Resolved</option><option>Archived</option></select><ChevronDown size={14} /></div></div></article>)}</div> : <EmptyState icon={ShieldCheck} title="No incidents in this view" copy="High and critical URL findings create reviewable incidents automatically." />}</section><div className="info-strip"><div className="info-symbol"><LockKeyhole size={17} /></div><div><strong>User-controlled response</strong><p>CyberShield records findings and status changes. It does not delete website content or alter browser data.</p></div></div></div>
}

function AssistantPage({ lines, input, setInput, busy, onSubmit, onNew }: { lines: ChatLine[]; input: string; setInput: (text: string) => void; busy: boolean; onSubmit: (event: FormEvent) => void; onNew: () => void }) {
  return <div className="page-stack assistant-page"><div className="page-heading"><div><div className="eyebrow">LOCAL OLLAMA · OPTIONAL</div><h1>AI security analyst</h1><p>Get plain-language explanations of defensive security signals.</p></div><div className="offline-pill"><span className="status-dot muted-dot" /> Local model required</div></div><section className="panel chat-panel"><div className="chat-top"><div className="chat-avatar"><Bot size={20} /></div><div><strong>CyberShield analyst</strong><span><span className="status-dot muted-dot" /> Data stays with configured local Ollama</span></div><button className="icon-button" title="New conversation" onClick={onNew}><Plus size={17} /></button></div><div className="chat-messages">{lines.map((line, index) => <div className={`chat-message ${line.role}`} key={index}><div className="chat-line-avatar">{line.role === 'assistant' ? <Sparkles size={15} /> : 'You'}</div><div className="chat-bubble">{line.text}</div></div>)}{busy && <div className="chat-message assistant"><div className="chat-line-avatar"><Sparkles size={15} /></div><div className="chat-bubble typing"><span /><span /><span /></div></div>}</div><form className="chat-compose" onSubmit={onSubmit}><textarea value={input} onChange={event => setInput(event.target.value)} maxLength={4000} placeholder="Ask about a scan result or defensive best practices…" rows={2} /><button className="primary-button" disabled={busy || !input.trim()}><ArrowUpRight size={17} /> Send</button><small>Only your message and an explicitly selected scan summary are sent to the local model.</small></form></section></div>
}

function SettingsPage({ preferences, update, copyToken }: { preferences: Preferences; update: (patch: Partial<Preferences>) => void; copyToken: () => void }) {
  const [model, setModel] = useState(preferences.ollama_model)
  const [retention, setRetention] = useState(String(preferences.retention_days))
  useEffect(() => { setModel(preferences.ollama_model); setRetention(String(preferences.retention_days)) }, [preferences.ollama_model, preferences.retention_days])
  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">PREFERENCES</div><h1>Settings</h1><p>Choose how your local workspace behaves.</p></div></div><section className="panel settings-panel"><div className="settings-section"><div className="settings-icon"><Sun size={18} /></div><div className="settings-copy"><h2>Appearance</h2><p>Choose a dashboard color theme.</p></div><div className="theme-choice">{['dark', 'light', 'system'].map(theme => <button key={theme} className={preferences.theme === theme ? 'chosen' : ''} onClick={() => update({ theme })}>{theme[0].toUpperCase() + theme.slice(1)}</button>)}</div></div><div className="settings-section"><div className="settings-icon mint"><ShieldCheck size={18} /></div><div className="settings-copy"><h2>Protection status</h2><p>Stored as an account preference; the extension has its own local control.</p></div><Toggle checked={preferences.protection_enabled} onChange={checked => update({ protection_enabled: checked })} /></div><div className="settings-section"><div className="settings-icon blue"><Activity size={18} /></div><div className="settings-copy"><h2>Extension sync</h2><p>This toggle is an account preference. Configure URL analysis and local Ollama in the extension options.</p></div><Toggle checked={preferences.sync_extension} onChange={checked => update({ sync_extension: checked })} /></div><div className="settings-section"><div className="settings-icon violet"><Bot size={18} /></div><div className="settings-copy"><h2>Local AI model</h2><p>Leave blank to use the model configured on the API.</p></div><input className="settings-input" value={model} onChange={event => setModel(event.target.value)} onBlur={() => { if (model !== preferences.ollama_model) update({ ollama_model: model }) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} placeholder="llama3.1:8b" /></div><div className="settings-section"><div className="settings-icon orange"><Clock3 size={18} /></div><div className="settings-copy"><h2>Activity retention</h2><p>Retention preference for future cleanup jobs. Current records are preserved.</p></div><div className="number-input"><input type="number" min={1} max={3650} value={retention} onChange={event => setRetention(event.target.value)} onBlur={() => { const days = Number(retention); if (days && days !== preferences.retention_days) update({ retention_days: days }) }} /><span>days</span></div></div></section><section className="panel extension-settings"><div className="extension-copy"><div className="eyebrow">BROWSER EXTENSION</div><h2>Connect your extension</h2><p>The session token is a bearer credential. Copy it only into the extension options on your own browser profile.</p></div><button className="secondary-button" onClick={copyToken}><LockKeyhole size={15} /> Copy session token</button></section><div className="settings-foot"><LockKeyhole size={14} /> Extension URL analysis is opt-in. The local API stores URL scans and sends scan evidence only to the configured loopback Ollama service.</div></div>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) { return <button role="switch" aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span /></button> }
function EmptyState({ icon: Icon, title, copy, action, onClick }: { icon: typeof Radar; title: string; copy: string; action?: string; onClick?: () => void }) { return <div className="empty-state"><div className="empty-icon"><Icon size={20} /></div><strong>{title}</strong><p>{copy}</p>{action && onClick && <button className="secondary-button" onClick={onClick}>{action} <ArrowUpRight size={14} /></button>}</div> }
function RiskIcon({ level }: { level: string }) { return level === 'Safe' ? <ShieldCheck size={17} /> : level === 'Low' || level === 'Medium' ? <CircleHelp size={17} /> : <ShieldAlert size={17} /> }
function RiskBadge({ value }: { value: string }) { return <span className={`risk-badge ${riskTone(value)}`}><span />{value}</span> }
function riskTone(value: string) { return value.toLowerCase().replaceAll(' ', '-') }

async function downloadReport(url: string, filename: string) {
  try {
    const token = localStorage.getItem('cs_token') || ''
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error('Report download failed. Sign in again and retry.')
    const blob = await response.blob(); const href = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = href; anchor.download = filename; anchor.click(); URL.revokeObjectURL(href)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Report download failed')
  }
}

function ReportDownloads() {
  const download = async (kind: 'pdf' | 'xlsx') => {
    try { await downloadReport(`${API}/reports/scans.${kind}`, `cybershield-scans.${kind}`) }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Report download failed') }
  }
  return <section className="panel extension-settings"><div className="extension-copy"><div className="eyebrow">REPORT EXPORTS</div><h2>Download analysis report</h2><p>Export the scans stored under your account as a portable PDF report or spreadsheet.</p></div><div className="report-actions"><button className="secondary-button" onClick={() => void download('pdf')}><ArrowDownToLine size={14} /> PDF</button><button className="secondary-button" onClick={() => void download('xlsx')}><ArrowDownToLine size={14} /> Excel</button></div></section>
}

export default App
