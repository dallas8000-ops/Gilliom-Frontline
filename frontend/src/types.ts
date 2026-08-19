export type Severity = 'low' | 'medium' | 'high'
export type IncidentStatus = 'open' | 'closed'

export interface CustodyEntry {
  id: number
  text: string
  author_name: string
  created_at: string
}

export interface Incident {
  case_id: string
  title: string
  location: string
  category: string
  severity: Severity
  status: IncidentStatus
  description: string
  reported_by_name: string
  created_at: string
  log: CustodyEntry[]
}

export interface IncidentInput {
  title: string
  location: string
  category: string
  severity: Severity
  description: string
}

export interface ParsedIntake {
  title: string
  location: string
  category: string
  severity: Severity
  description: string
}