export type StoredMedia = {
  url: string
  downloadUrl?: string
  pathname: string
  contentType: string
  sizeBytes: number
}

export interface MediaPlugin {
  saveLeadPhoto(input: { leadId: string; file: File }): Promise<StoredMedia>
}
