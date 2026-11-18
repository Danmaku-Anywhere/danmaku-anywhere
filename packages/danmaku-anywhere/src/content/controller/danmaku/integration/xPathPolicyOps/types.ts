export interface MediaInfoParseResult {
  // The bare show title used for searching, with the season taken out
  searchTitle: string
  // The original full title as it was found
  originalTitle: string
  // The season as written on the page, such as "S2", "第二季" or "2"
  season?: string
  episode?: number
  episodeTitle?: string
}

export interface ExtractorMatch {
  value: number | string
  // The actual substring matched
  raw: string
  index: number
  groups?: Record<string, string>
  regex?: string
}
