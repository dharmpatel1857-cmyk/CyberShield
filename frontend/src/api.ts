export const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api/v1'

export type User = { id: number; full_name: string; username: string; email: string; role: string }
export type Scan = {
  id: number; url: string; domain: string; risk_level: string; risk_score: number; confidence: number
  evidence: string[]; recommendations: string[]; page_metadata: Record<string, unknown>; created_at: string
}
export type Incident = {
  id: number; incident_key: string; domain: string; title: string; severity: string; status: string
  summary: string; created_at: string; notes: { id: number; note: string; created_at: string }[]
}
export type Summary = { websites_monitored: number; scans_total: number; high_risk_scans: number; open_incidents: number; recent_scans: Scan[] }
export type Preferences = { theme: string; protection_enabled: boolean; sync_extension: boolean; ollama_model: string; retention_days: number }

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API}${path}`, { ...init, headers })
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try { const body = await response.json(); detail = body.detail || detail } catch { /* non-JSON response */ }
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
