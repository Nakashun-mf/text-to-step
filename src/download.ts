export function downloadBuffer(buffer: ArrayBuffer, filename: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
