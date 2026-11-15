export function timeAgo(timestamp: string): string {
  const now = Date.now()
  const diffMs = now - new Date(timestamp).getTime()

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) {
    return `${seconds} seconds ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minutes ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hours ago`
  }

  const days = Math.floor(hours / 24)
  return `${days} days ago`
}
