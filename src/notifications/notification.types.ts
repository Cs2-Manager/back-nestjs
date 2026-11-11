export interface NotificationResource {
  type: 'invitation' | 'team' | 'grenade_proposal' | 'team_lineup'
  id: number
  team_id: number
  path: string
}

export interface NotificationMetadata {
  team_name: string
  team_tag: string | null
  actor_username: string
  role?: string
  map_name?: string
  lineup_type?: string
  lineup_title?: string
}

export interface NotificationPayload {
  id: string
  event_id: string
  notification_id?: number
  event_type: string
  created_at: string
  title: string
  message: string
  resource: NotificationResource
  metadata: NotificationMetadata
}
