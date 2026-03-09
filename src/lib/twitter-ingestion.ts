import { SocialPost, TrackedHashtag } from './types'

export interface TwitterSearchParams {
  hashtag: string
  maxResults?: number
  sinceId?: string
}

export interface TwitterAPIConfig {
  bearerToken?: string
  rateLimitRemaining: number
  rateLimitReset: number
}

export class TwitterIngestionService {
  private config: TwitterAPIConfig
  private isSimulatedMode: boolean = true
  private lastPostId: number = 1000000

  constructor(bearerToken?: string) {
    this.config = {
      bearerToken,
      rateLimitRemaining: 450,
      rateLimitReset: Date.now() + 15 * 60 * 1000
    }
    
    this.isSimulatedMode = !bearerToken
  }

  async fetchRecentPosts(params: TwitterSearchParams): Promise<SocialPost[]> {
    if (this.isSimulatedMode) {
      return this.simulateFetchPosts(params)
    }

    if (this.config.rateLimitRemaining <= 0) {
      const waitTime = this.config.rateLimitReset - Date.now()
      if (waitTime > 0) {
        throw new Error(`Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)}s`)
      }
      this.config.rateLimitRemaining = 450
      this.config.rateLimitReset = Date.now() + 15 * 60 * 1000
    }

    return []
  }

  private simulateFetchPosts(params: TwitterSearchParams): SocialPost[] {
    const postCount = Math.floor(Math.random() * 8) + 2
    const posts: SocialPost[] = []
    const now = Date.now()

    const hashtagKeywords: Record<string, string[]> = {
      'nightlife': [
        'Amazing night at',
        'Energy is unreal at',
        'This place is electric',
        'Vibes are immaculate',
        'Cannot believe this crowd',
        'Best night out in ages',
        'Dance floor is packed',
        'DJ is killing it'
      ],
      'brunch': [
        'Perfect brunch spot',
        'Best mimosas in the city',
        'Brunch goals',
        'Weekend vibes',
        'Pancakes are incredible',
        'Such a cute brunch place',
        'Great coffee and food',
        'Brunch crew assembled'
      ],
      'livemusic': [
        'Band is fire tonight',
        'Amazing performance',
        'Live music hits different',
        'Vocals are insane',
        'Best show this year',
        'Crowd going wild',
        'This guitarist is incredible',
        'Encore encore encore'
      ],
      'default': [
        'Great spot',
        'Loving the atmosphere',
        'Had to check this place out',
        'Highly recommend',
        'Such good vibes',
        'This place delivers',
        'Worth the hype',
        'New favorite spot'
      ]
    }

    const keywords = hashtagKeywords[params.hashtag.toLowerCase()] || hashtagKeywords['default']

    for (let i = 0; i < postCount; i++) {
      const minutesAgo = Math.random() * 15
      const timestamp = new Date(now - minutesAgo * 60 * 1000)
      
      const keyword = keywords[Math.floor(Math.random() * keywords.length)]
      const text = `${keyword} #${params.hashtag}`

      const post: SocialPost = {
        id: `sim-${this.lastPostId++}`,
        postId: `${Date.now()}-${i}`,
        text,
        timestamp: timestamp.toISOString(),
        likes: Math.floor(Math.random() * 50) + 5,
        replies: Math.floor(Math.random() * 10),
        reposts: Math.floor(Math.random() * 15),
        hashtag: params.hashtag,
        createdAt: new Date().toISOString()
      }

      if (Math.random() > 0.7) {
        const venues = [
          { id: 'place-123', name: 'Downtown District' },
          { id: 'place-456', name: 'Arts Quarter' },
          { id: 'place-789', name: 'Marina Bay' }
        ]
        const randomVenue = venues[Math.floor(Math.random() * venues.length)]
        post.placeId = randomVenue.id
        post.placeName = randomVenue.name
      }

      posts.push(post)
    }

    this.config.rateLimitRemaining--
    
    return posts
  }

  async pollHashtag(
    hashtag: TrackedHashtag,
    existingPostIds: Set<string>
  ): Promise<SocialPost[]> {
    try {
      const params: TwitterSearchParams = {
        hashtag: hashtag.hashtag,
        maxResults: 100,
        sinceId: hashtag.lastPolledAt
      }

      const posts = await this.fetchRecentPosts(params)
      
      const newPosts = posts.filter(post => !existingPostIds.has(post.postId))
      
      return newPosts
    } catch (error) {
      console.error(`Error polling hashtag ${hashtag.hashtag}:`, error)
      return []
    }
  }

  getRateLimitStatus(): { remaining: number; resetAt: number } {
    return {
      remaining: this.config.rateLimitRemaining,
      resetAt: this.config.rateLimitReset
    }
  }

  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (error instanceof Error && error.message.includes('Rate limit')) {
          throw error
        }
        
        const backoffMs = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }
}

export function deduplicatePosts(
  existingPosts: SocialPost[],
  newPosts: SocialPost[]
): SocialPost[] {
  const existingIds = new Set(existingPosts.map(p => p.postId))
  return newPosts.filter(post => !existingIds.has(post.postId))
}

export function filterEnglishPosts(posts: SocialPost[]): SocialPost[] {
  return posts.filter(post => {
    const textSample = post.text.slice(0, 100)
    const englishChars = (textSample.match(/[a-zA-Z]/g) || []).length
    const totalChars = textSample.replace(/\s/g, '').length
    
    return totalChars === 0 || (englishChars / totalChars) > 0.6
  })
}

export function excludeRetweets(posts: SocialPost[]): SocialPost[] {
  return posts.filter(post => 
    !post.text.toLowerCase().startsWith('rt @') &&
    !post.text.toLowerCase().includes('retweeting')
  )
}

export function processIngestedPosts(posts: SocialPost[]): SocialPost[] {
  let processed = posts
  processed = excludeRetweets(processed)
  processed = filterEnglishPosts(processed)
  return processed
}
