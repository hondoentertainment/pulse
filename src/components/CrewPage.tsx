import { useMemo, useState } from 'react'
import { User, Venue } from '@/lib/types'
import { Crew, CrewCheckIn, createCrew, getUserCrews, getActiveCrewCheckIns, initiateCrewCheckIn, confirmCrewCheckIn, buildCrewActivityFeed } from '@/lib/crew-mode'
import { CrewPanel } from '@/components/CrewPanel'
import { CaretLeft, UsersThree, Plus } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface CrewPageProps {
  currentUser: User
  allUsers: User[]
  crews: Crew[]
  crewCheckIns: CrewCheckIn[]
  venues: Venue[]
  onBack: () => void
  onCrewsUpdate: (crews: Crew[]) => void
  onCheckInsUpdate: (checkIns: CrewCheckIn[]) => void
}

export function CrewPage({
  currentUser,
  allUsers,
  crews,
  crewCheckIns,
  venues,
  onBack,
  onCrewsUpdate,
  onCheckInsUpdate
}: CrewPageProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [crewName, setCrewName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  const userCrews = useMemo(
    () => getUserCrews(crews, currentUser.id),
    [crews, currentUser.id]
  )

  const handleCreateCrew = () => {
    if (!crewName.trim()) {
      toast.error('Enter a crew name')
      return
    }
    if (selectedMembers.length < 1) {
      toast.error('Select at least 1 friend')
      return
    }
    const result = createCrew(crewName, currentUser.id, selectedMembers)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    onCrewsUpdate([...crews, result])
    setShowCreate(false)
    setCrewName('')
    setSelectedMembers([])
    toast.success(`Crew "${crewName}" created!`)
  }

  const handleConfirmCheckIn = (checkInId: string, energyRating: 'dead' | 'chill' | 'buzzing' | 'electric') => {
    const updated = crewCheckIns.map(ci =>
      ci.id === checkInId ? confirmCrewCheckIn(ci, currentUser.id, energyRating) : ci
    )
    onCheckInsUpdate(updated)
    toast.success('Check-in confirmed!')
  }

  const friendUsers = allUsers.filter(u => currentUser.friends.includes(u.id))

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <UsersThree size={24} weight="fill" className="text-primary" />
            <h1 className="text-xl font-bold">Crews</h1>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="ml-auto p-2 hover:bg-muted rounded-lg"
          >
            <Plus size={20} weight="bold" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Create Crew Form */}
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-card rounded-xl p-4 border border-primary/30 space-y-3"
          >
            <h3 className="font-bold">New Crew</h3>
            <input
              value={crewName}
              onChange={e => setCrewName(e.target.value)}
              placeholder="Crew name..."
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Select friends:</p>
              <div className="flex flex-wrap gap-2">
                {friendUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedMembers(prev =>
                      prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                    )}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      selectedMembers.includes(u.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {u.username}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreateCrew}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
            >
              Create Crew
            </button>
          </motion.div>
        )}

        {/* Crew List */}
        {userCrews.map((crew, i) => {
          const members = crew.memberIds.map(id => {
            const user = allUsers.find(u => u.id === id)
            return { id, username: user?.username || 'Unknown', profilePhoto: user?.profilePhoto }
          })
          const activeCheckIn = crewCheckIns.find(ci =>
            ci.crewId === crew.id && ci.status === 'active'
          )
          const venueNames: Record<string, string> = {}
          for (const v of venues) venueNames[v.id] = v.name
          const feed = buildCrewActivityFeed(crew, crewCheckIns, venueNames)

          return (
            <motion.div
              key={crew.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <CrewPanel
                crew={crew}
                activeCheckIn={activeCheckIn}
                activityFeed={feed}
                members={members}
                currentUserId={currentUser.id}
                onConfirmCheckIn={(energyRating) => {
                  if (activeCheckIn) {
                    handleConfirmCheckIn(activeCheckIn.id, energyRating)
                  }
                }}
              />
            </motion.div>
          )
        })}

        {userCrews.length === 0 && !showCreate && (
          <div className="text-center py-12 space-y-3">
            <UsersThree size={48} className="mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">No crews yet</p>
            <p className="text-sm text-muted-foreground/70">Create a crew with your friends to check in together</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
            >
              Create Your First Crew
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
