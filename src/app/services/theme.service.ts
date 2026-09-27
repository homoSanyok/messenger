import { create } from 'zustand'
import { useLoginStore } from './login.service'

export type Theme = 'dark' | 'light' | undefined

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'messenger.theme'

function readTheme(idInstance: string | null): Theme {
  if (idInstance === null) return undefined

  try {
    const theme = sessionStorage.getItem(`${STORAGE_KEY}.${idInstance}`)
    return theme === 'dark' || theme === 'light' ? theme : undefined
  } catch {
    return undefined
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readTheme(useLoginStore.getState().idInstance),
  setTheme: (theme) => {
    const { idInstance } = useLoginStore.getState()

    try {
      if (idInstance !== null) {
        const storageKey = `${STORAGE_KEY}.${idInstance}`

        if (theme === undefined) {
          sessionStorage.removeItem(storageKey)
        } else {
          sessionStorage.setItem(storageKey, theme)
        }
      }
    } catch {
      // Apply the theme for this page even when browser storage is unavailable.
    }

    set({ theme })
  },
}))

useLoginStore.subscribe((state, previousState) => {
  if (state.idInstance !== previousState.idInstance) {
    useThemeStore.setState({ theme: readTheme(state.idInstance) })
  }
})
