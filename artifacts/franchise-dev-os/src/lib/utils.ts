import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isThisYear } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase()
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (isNaN(d.getTime())) return "—"
  return isThisYear(d) ? format(d, "MMM d") : format(d, "MMM d, yyyy")
}

export function getTaskDateColor(
  dueDate: Date | string | null | undefined,
  status?: string,
): "destructive" | "warning" | "muted" {
  if (!dueDate || status === "Complete") return "muted"
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate
  if (isNaN(d.getTime())) return "muted"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return "destructive"
  if (diff <= 7) return "warning"
  return "muted"
}
