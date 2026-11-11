/** Reusable multimap; the registry remains the sole owner of cross-index writes. */
export class SocketIndex<Key> {
  private readonly entries = new Map<Key, Set<string>>()

  add(key: Key, socketId: string): void {
    const ids = this.entries.get(key) ?? new Set<string>()
    ids.add(socketId)
    this.entries.set(key, ids)
  }

  remove(key: Key, socketId: string): void {
    const ids = this.entries.get(key)
    if (!ids) return
    ids.delete(socketId)
    if (ids.size === 0) this.entries.delete(key)
  }

  ids(key: Key): string[] {
    return [...(this.entries.get(key) ?? [])]
  }

  count(key: Key): number {
    return this.entries.get(key)?.size ?? 0
  }

  size(): number {
    return this.entries.size
  }
}
