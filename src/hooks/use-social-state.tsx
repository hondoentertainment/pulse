import { createContext, useContext } from 'react'
import type { User } from '@/lib/types'
import { Crew, CrewCheckIn } from '@/lib/crew-mode'

export interface SocialState {
  // Crews
  crews: Crew[] | undefined
  setCrews: (fn: ((c: Crew[] | undefined) => Crew[]) | Crew[]) => void
  crewCheckIns: CrewCheckIn[] | undefined
  setCrewCheckIns: (fn: ((c: CrewCheckIn[] | undefined) => CrewCheckIn[]) | CrewCheckIn[]) => void

  // User (shared — needed for social features)
  currentUser: User | undefined
  setCurrentUser: (fn: ((u: User | undefined) => User) | User) => void
}

export const SocialContext = createContext<SocialState | null>(null)

export function useSocialState(): SocialState {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error('useSocialState must be used within SocialProvider')
  return ctx
}
