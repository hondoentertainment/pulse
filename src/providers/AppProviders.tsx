import { ReactNode } from 'react'
import { Toaster } from 'sonner'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <>
      <Toaster position="top-center" theme="dark" />
      {children}
    </>
  )
}
