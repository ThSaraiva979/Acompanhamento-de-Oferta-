export interface Statement {
  bind(...params: (string | number | null)[]): Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}
export interface AuthDB {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<Array<{ meta?: { changes?: number } }>>
}
export type Role = 'OWNER' | 'VIEWER'
export interface SafeUser {
  id: number
  username: string
  displayName: string
  role: Role
  mustChangePassword: boolean
}
export interface UserRecord {
  id: number
  username: string
  display_name: string
  role: Role
  password_hash: string | null
  password_salt: string | null
  password_iterations: number | null
  is_active: number
  must_change_password: number
}
