export function formatDate(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatLongDate(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** « il y a 3 j », « dans 2 j », « aujourd'hui » */
export function relativeDays(iso?: string): string {
  if (!iso) return ""
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - start.getTime()) / 86_400_000)
  if (diff === 0) return "aujourd'hui"
  if (diff === 1) return "demain"
  if (diff === -1) return "hier"
  return diff > 0 ? `dans ${diff} j` : `il y a ${-diff} j`
}

export function initials(firstName = "", lastName = ""): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}
