import { Venue } from './types'

export const MOCK_VENUES: Venue[] = [
  {
    id: 'venue-1',
    name: 'The Electric Lounge',
    location: {
      lat: 40.7580,
      lng: -73.9855,
      address: '234 W 42nd St, New York, NY'
    },
    pulseScore: 0,
    category: 'Nightclub'
  },
  {
    id: 'venue-2',
    name: 'Midnight Rooftop',
    location: {
      lat: 40.7589,
      lng: -73.9851,
      address: '456 Broadway, New York, NY'
    },
    pulseScore: 0,
    category: 'Bar'
  },
  {
    id: 'venue-3',
    name: 'Neon Underground',
    location: {
      lat: 40.7571,
      lng: -73.9862,
      address: '789 8th Ave, New York, NY'
    },
    pulseScore: 0,
    category: 'Club'
  },
  {
    id: 'venue-4',
    name: 'Pulse Dance Hall',
    location: {
      lat: 40.7595,
      lng: -73.9845,
      address: '321 W 44th St, New York, NY'
    },
    pulseScore: 0,
    category: 'Dance Club'
  },
  {
    id: 'venue-5',
    name: 'Vibe Café',
    location: {
      lat: 40.7563,
      lng: -73.9870,
      address: '567 9th Ave, New York, NY'
    },
    pulseScore: 0,
    category: 'Café'
  },
  {
    id: 'venue-6',
    name: 'The Frequency',
    location: {
      lat: 40.7602,
      lng: -73.9840,
      address: '890 W 45th St, New York, NY'
    },
    pulseScore: 0,
    category: 'Music Venue'
  }
]

export const SIMULATED_USER_LOCATION = {
  lat: 40.7580,
  lng: -73.9855
}

export function getSimulatedLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        coords: {
          latitude: SIMULATED_USER_LOCATION.lat,
          longitude: SIMULATED_USER_LOCATION.lng,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      } as GeolocationPosition)
    }, 100)
  })
}
