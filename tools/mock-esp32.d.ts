export interface MockEsp32State {
  deviceId: string
  humidity: number
  temperature: number
  timestamp: number
  valid: boolean
  error: string | undefined
  auto: boolean
  frozen: boolean
  failing: boolean
  delayMs: number
  corrupt: 'none' | 'malformed' | 'out-of-range'
}
export interface MockEsp32 {
  state: MockEsp32State
  sample(): void
  listen(port?: number, host?: string): Promise<number>
  close(): Promise<void>
}
export function createMockEsp32(opts?: { now?: () => number; sampleMs?: number; random?: () => number }): MockEsp32
