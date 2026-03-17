import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Megaphone, Users, Crown, UsersThree, Trash } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Venue, Pulse } from '@/lib/types'
import {
  type Campaign, type VenuePlatformAccount, type PlanTier,
  isPlanFeatureAvailable, getCampaignROI, getCampaignCTR, PLAN_CONFIG,
} from '@/lib/venue-platform'
import { GuestCRM } from '@/components/GuestCRM'

// ---------------------------------------------------------------------------
// Campaigns Tab
// ---------------------------------------------------------------------------

interface CampaignsTabProps {
  campaigns: Campaign[]
  onCreateCampaign: () => void
}

export function CampaignsTab({ campaigns, onCreateCampaign }: CampaignsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Campaigns</h3>
        <button
          onClick={onCreateCampaign}
          className="text-xs text-accent hover:underline"
        >
          + New Campaign
        </button>
      </div>

      {campaigns.map(campaign => {
        const roi = getCampaignROI(campaign)
        const ctr = getCampaignCTR(campaign)
        const spentPct = campaign.budget > 0 ? Math.round((campaign.spent / campaign.budget) * 100) : 0

        return (
          <Card key={campaign.id} className="p-4 bg-card/80 border-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xs font-bold text-foreground">{campaign.name}</h4>
                <p className="text-[10px] text-muted-foreground capitalize">{campaign.type.replace('_', ' ')}</p>
              </div>
              <Badge
                variant="outline"
                className={`text-[9px] ${
                  campaign.status === 'active' ? 'text-green-400 border-green-400/30' :
                  campaign.status === 'completed' ? 'text-blue-400 border-blue-400/30' :
                  campaign.status === 'paused' ? 'text-yellow-400 border-yellow-400/30' :
                  'text-muted-foreground'
                }`}
              >
                {campaign.status}
              </Badge>
            </div>

            {/* Budget progress */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>${campaign.spent} spent</span>
                <span>${campaign.budget} budget</span>
              </div>
              <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, spentPct)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xs font-bold text-foreground">{campaign.impressions.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">Impressions</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{campaign.clicks}</p>
                <p className="text-[9px] text-muted-foreground">Clicks</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{ctr}%</p>
                <p className="text-[9px] text-muted-foreground">CTR</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{roi}x</p>
                <p className="text-[9px] text-muted-foreground">ROI</p>
              </div>
            </div>
          </Card>
        )
      })}

      {campaigns.length === 0 && (
        <Card className="p-6 bg-card/80 border-border text-center">
          <Megaphone size={32} weight="thin" className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No campaigns yet</p>
        </Card>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Guests Tab
// ---------------------------------------------------------------------------

interface GuestsTabProps {
  venue: Venue
  pulses: Pulse[]
  account: VenuePlatformAccount
  onUpgradePlan: (plan: PlanTier) => void
}

export function GuestsTab({ venue, pulses, account, onUpgradePlan }: GuestsTabProps) {
  const users = useMemo(() => {
    const userIds = new Set(pulses.filter(p => p.venueId === venue.id).map(p => p.userId))
    return Array.from(userIds).map(id => ({ id, username: `user_${id.slice(-4)}` }))
  }, [pulses, venue.id])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {isPlanFeatureAvailable(account.plan, 'crm') ? (
        <GuestCRM venueId={venue.id} pulses={pulses} users={users} />
      ) : (
        <Card className="p-6 bg-card/80 border-border text-center">
          <Users size={32} weight="thin" className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium mb-1">Guest CRM</p>
          <p className="text-xs text-muted-foreground mb-3">
            Track guest visits, spending, and preferences with Pro
          </p>
          <button
            onClick={() => onUpgradePlan('pro')}
            className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro — $99/mo
          </button>
        </Card>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Team Tab
// ---------------------------------------------------------------------------

interface TeamTabProps {
  account: VenuePlatformAccount
  showAddMember: boolean
  onSetShowAddMember: (show: boolean) => void
  newMemberName: string
  onSetNewMemberName: (name: string) => void
  newMemberEmail: string
  onSetNewMemberEmail: (email: string) => void
  newMemberRole: 'manager' | 'staff'
  onSetNewMemberRole: (role: 'manager' | 'staff') => void
  onAddTeamMember: () => void
  onRemoveTeamMember: (userId: string) => void
}

export function TeamTab({
  account,
  showAddMember,
  onSetShowAddMember,
  newMemberName,
  onSetNewMemberName,
  newMemberEmail,
  onSetNewMemberEmail,
  newMemberRole,
  onSetNewMemberRole,
  onAddTeamMember,
  onRemoveTeamMember,
}: TeamTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Team Members</h3>
          <p className="text-[10px] text-muted-foreground">
            {account.teamMembers.length}/{PLAN_CONFIG[account.plan].maxTeamMembers} members
          </p>
        </div>
        <button
          onClick={() => onSetShowAddMember(true)}
          className="text-xs text-accent hover:underline"
        >
          + Add Member
        </button>
      </div>

      {/* Add member form */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4 bg-card/80 border-border space-y-2">
              <Input
                placeholder="Name"
                value={newMemberName}
                onChange={(e) => onSetNewMemberName(e.target.value)}
                className="h-8 text-xs bg-background"
              />
              <Input
                placeholder="Email"
                value={newMemberEmail}
                onChange={(e) => onSetNewMemberEmail(e.target.value)}
                className="h-8 text-xs bg-background"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onSetNewMemberRole('manager')}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                    newMemberRole === 'manager'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  Manager
                </button>
                <button
                  onClick={() => onSetNewMemberRole('staff')}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                    newMemberRole === 'staff'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  Staff
                </button>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => onSetShowAddMember(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={onAddTeamMember}
                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team list */}
      {account.teamMembers.map(member => (
        <Card key={member.userId} className="p-3 bg-card/80 border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              {member.role === 'owner' ? (
                <Crown size={18} className="text-yellow-400" />
              ) : (
                <UsersThree size={18} className="text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">{member.name}</p>
              <p className="text-[10px] text-muted-foreground">{member.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] capitalize">{member.role}</Badge>
              {member.role !== 'owner' && (
                <button
                  onClick={() => onRemoveTeamMember(member.userId)}
                  className="p-1 hover:bg-destructive/20 rounded transition-colors"
                >
                  <Trash size={12} className="text-destructive" />
                </button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </motion.div>
  )
}
