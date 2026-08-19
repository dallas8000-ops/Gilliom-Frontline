import type { Incident, IncidentInput, IncidentStatus, ParsedIntake } from './types'

export function csrfToken(): string {
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrftoken='))
    ?.split('=')[1] ?? ''
  return decodeURIComponent(value)
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const api = {
  incidents: () => request<Incident[]>('/api/incidents/'),
  createIncident: (input: IncidentInput) => request<Incident>('/api/incidents/', {
    method: 'POST', body: JSON.stringify(input),
  }),
  addNote: (caseId: string, text: string) => request<Incident>(
    `/api/incidents/${encodeURIComponent(caseId)}/notes/`,
    { method: 'POST', body: JSON.stringify({ text }) },
  ),
  setStatus: (caseId: string, status: IncidentStatus) => request<Incident>(
    `/api/incidents/${encodeURIComponent(caseId)}/status/`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  ),
  parseIntake: (rawText: string) => request<ParsedIntake>('/api/parse/', {
    method: 'POST', body: JSON.stringify({ rawText }),
  }),
}