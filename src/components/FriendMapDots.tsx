"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Lock } from "@phosphor-icons/react"

interface Friend {
  id: string
  username: string
  avatar: string
  lat: number
  lng: number
  venueId?: string
  venueName?: string
  visibility?: "everyone" | "friends" | "limited"
}

interface FriendMapDotsProps {
  friends: Friend[]
  latLngToPixel: (lat: number, lng: number) => { x: number; y: number }
  zoom: number
}

interface Cluster {
  friends: Friend[]
  x: number
  y: number
}

const DOT_SIZE = 28
const CLUSTER_DISTANCE = 36

function getEnergyBorderColor(venueId?: string): string {
  // Provide a visual cue if the friend is at a venue
  if (venueId) return "#f59e0b" // amber for checked-in
  return "#6b7280" // gray for roaming
}

function clusterFriends(
  friends: Friend[],
  latLngToPixel: (lat: number, lng: number) => { x: number; y: number }
): Cluster[] {
  const positions = friends.map((f) => ({
    friend: f,
    pixel: latLngToPixel(f.lat, f.lng),
  }))

  const used = new Set<number>()
  const clusters: Cluster[] = []

  for (let i = 0; i < positions.length; i++) {
    if (used.has(i)) continue

    const cluster: Friend[] = [positions[i].friend]
    let cx = positions[i].pixel.x
    let cy = positions[i].pixel.y
    used.add(i)

    for (let j = i + 1; j < positions.length; j++) {
      if (used.has(j)) continue
      const dx = positions[j].pixel.x - cx
      const dy = positions[j].pixel.y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < CLUSTER_DISTANCE) {
        cluster.push(positions[j].friend)
        used.add(j)
        // Recalculate center
        cx = (cx * (cluster.length - 1) + positions[j].pixel.x) / cluster.length
        cy = (cy * (cluster.length - 1) + positions[j].pixel.y) / cluster.length
      }
    }

    clusters.push({ friends: cluster, x: cx, y: cy })
  }

  return clusters
}

export default function FriendMapDots({
  friends,
  latLngToPixel,
  zoom: _zoom,
}: FriendMapDotsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const clusters = useMemo(
    () => clusterFriends(friends, latLngToPixel),
    [friends, latLngToPixel]
  )

  return (
    <g className="friend-map-dots">
      {clusters.map((cluster) => {
        const primary = cluster.friends[0]
        const isCluster = cluster.friends.length > 1
        const isHovered = cluster.friends.some((f) => f.id === hoveredId)

        return (
          <g key={primary.id} transform={`translate(${cluster.x}, ${cluster.y})`}>
            {/* Breathing animation wrapper */}
            <motion.g
              animate={{
                scale: [0.95, 1.05, 0.95],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {/* Avatar circle */}
              <clipPath id={`clip-${primary.id}`}>
                <circle cx={0} cy={0} r={DOT_SIZE / 2 - 2} />
              </clipPath>

              {/* Border circle */}
              <circle
                cx={0}
                cy={0}
                r={DOT_SIZE / 2}
                fill={getEnergyBorderColor(primary.venueId)}
                stroke="white"
                strokeWidth={1.5}
              />

              {/* Avatar image */}
              <image
                href={primary.avatar}
                x={-(DOT_SIZE / 2 - 2)}
                y={-(DOT_SIZE / 2 - 2)}
                width={DOT_SIZE - 4}
                height={DOT_SIZE - 4}
                clipPath={`url(#clip-${primary.id})`}
                style={{ pointerEvents: "none" }}
              />

              {/* Privacy indicator */}
              {primary.visibility === "limited" && (
                <g transform={`translate(${DOT_SIZE / 2 - 4}, ${-(DOT_SIZE / 2 - 4)})`}>
                  <circle cx={0} cy={0} r={6} fill="#1f2937" />
                  <foreignObject x={-5} y={-5} width={10} height={10}>
                    <Lock size={10} weight="fill" color="white" />
                  </foreignObject>
                </g>
              )}

              {/* Cluster badge */}
              {isCluster && (
                <g transform={`translate(${DOT_SIZE / 2 - 2}, ${DOT_SIZE / 2 - 2})`}>
                  <circle cx={0} cy={0} r={9} fill="#6366f1" stroke="white" strokeWidth={1} />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={10}
                    fontWeight="bold"
                  >
                    +{cluster.friends.length - 1}
                  </text>
                </g>
              )}
            </motion.g>

            {/* Hover/tap target (invisible, larger area) */}
            <circle
              cx={0}
              cy={0}
              r={DOT_SIZE / 2 + 6}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredId(primary.id)}
              onMouseLeave={() => setHoveredId(null)}
              onTouchStart={() => setHoveredId(primary.id)}
              onTouchEnd={() => setHoveredId(null)}
            />

            {/* Tooltip */}
            {isHovered && (
              <g transform={`translate(0, ${-(DOT_SIZE / 2 + 12)})`}>
                <rect
                  x={-60}
                  y={-24}
                  width={120}
                  height={isCluster ? 20 + cluster.friends.length * 16 : 28}
                  rx={6}
                  fill="rgba(0,0,0,0.85)"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={0.5}
                />
                {isCluster ? (
                  cluster.friends.map((friend, i) => (
                    <text
                      key={friend.id}
                      x={0}
                      y={-10 + i * 16}
                      textAnchor="middle"
                      fill="white"
                      fontSize={11}
                    >
                      {friend.username}
                      {friend.venueName ? ` at ${friend.venueName}` : ""}
                    </text>
                  ))
                ) : (
                  <text
                    x={0}
                    y={-8}
                    textAnchor="middle"
                    fill="white"
                    fontSize={11}
                  >
                    {primary.username}
                    {primary.venueName ? ` at ${primary.venueName}` : ""}
                  </text>
                )}
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}
