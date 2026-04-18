import { useMemo } from 'react'
import { Venue } from '@/lib/types'
import { getEnergyColor, type VenueCluster, type VenueRenderPoint } from './shared'

interface MapClusterSVGProps {
  clusters: VenueCluster[]
  expandedClusterId: string | null
  expandedCluster: VenueCluster | null
  expandedClusterNodes: Array<VenueRenderPoint & { sx: number; sy: number }>
  accessibilityMode: boolean
  zoom: number
  isCameraMoving: boolean
}

export function MapClusterSVG({
  clusters,
  expandedClusterId,
  expandedCluster,
  expandedClusterNodes,
  accessibilityMode,
  zoom,
}: MapClusterSVGProps) {
  return (
    <>
      {clusters.map((cluster) => {
        const clusterSize = Math.min(42, 20 + cluster.venues.length * 1.8)
        const clusterColor = getEnergyColor(cluster.maxPulseScore)
        const isExpanded = expandedClusterId === cluster.id
        return (
          <g key={cluster.id} className="pointer-events-none">
            <circle
              cx={cluster.x}
              cy={cluster.y}
              r={clusterSize * 1.35}
              fill={clusterColor}
              opacity={isExpanded ? 0.1 : 0.22}
            />
            <circle
              cx={cluster.x}
              cy={cluster.y}
              r={clusterSize}
              fill={clusterColor}
              stroke="oklch(0.98 0 0 / 0.85)"
              strokeWidth={2}
              filter={`drop-shadow(0 0 8px ${clusterColor})`}
              opacity={isExpanded ? 0.4 : 1}
            />
            <text
              x={cluster.x}
              y={cluster.y + 4}
              textAnchor="middle"
              fill="white"
              fontSize={Math.max(10, Math.min(15, clusterSize * 0.45))}
              fontWeight="700"
            >
              {cluster.venues.length}
            </text>
          </g>
        )
      })}

      {expandedCluster && expandedClusterNodes.map((node) => (
        <g key={`expanded-${node.venue.id}`}>
          <line
            x1={expandedCluster.x}
            y1={expandedCluster.y}
            x2={node.sx}
            y2={node.sy}
            stroke="oklch(0.92 0 0 / 0.35)"
            strokeWidth={1.5}
          />
          <circle
            cx={node.sx}
            cy={node.sy}
            r={Math.max(11, (accessibilityMode ? 14 : 12) * zoom * 0.5)}
            fill={getEnergyColor(node.venue.pulseScore)}
            stroke="white"
            strokeWidth={1.5}
          />
        </g>
      ))}
    </>
  )
}

interface MapClusterHitAreasProps {
  clusters: VenueCluster[]
  expandedClusterId: string | null
  expandedClusterNodes: Array<VenueRenderPoint & { sx: number; sy: number }>
  zoom: number
  isCameraMoving: boolean
  onClusterClick: (cluster: VenueCluster) => void
  onExpandedVenueClick: (venue: Venue) => void
}

export function MapClusterHitAreas({
  clusters,
  expandedClusterId: _expandedClusterId,
  expandedClusterNodes,
  zoom: _zoom,
  isCameraMoving,
  onClusterClick,
  onExpandedVenueClick,
}: MapClusterHitAreasProps) {
  return (
    <>
      {clusters.map((cluster) => (
        <div
          key={`cluster-hit-${cluster.id}`}
          className="absolute pointer-events-none"
          style={{
            left: cluster.x,
            top: cluster.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <button
            className="pointer-events-auto relative z-20 cursor-pointer rounded-full"
            aria-label={`Zoom into cluster of ${cluster.venues.length} venues`}
            onClick={() => onClusterClick(cluster)}
          >
            <div className="w-14 h-14" />
          </button>
          {!isCameraMoving && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10">
              <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-2 py-1 shadow-lg">
                <p className="text-[10px] font-semibold text-foreground">
                  {cluster.venues.length} venues
                </p>
              </div>
            </div>
          )}
        </div>
      ))}

      {expandedClusterNodes.map((node) => (
        <div
          key={`expanded-hit-${node.venue.id}`}
          className="absolute pointer-events-none"
          style={{
            left: node.sx,
            top: node.sy,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <button
            className="pointer-events-auto relative z-30 cursor-pointer rounded-full"
            aria-label={`Open ${node.venue.name}`}
            onClick={() => onExpandedVenueClick(node.venue)}
          >
            <div className="w-11 h-11" />
          </button>
        </div>
      ))}
    </>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExpandedClusterNodes(expandedCluster: VenueCluster | null) {
  return useMemo(() => {
    if (!expandedCluster) return [] as Array<VenueRenderPoint & { sx: number; sy: number }>
    const total = expandedCluster.venues.length
    const radius = Math.min(110, Math.max(48, 34 + total * 5))
    return expandedCluster.venues.map((point, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2
      return {
        ...point,
        sx: expandedCluster.x + radius * Math.cos(angle),
        sy: expandedCluster.y + radius * Math.sin(angle)
      }
    })
  }, [expandedCluster])
}
