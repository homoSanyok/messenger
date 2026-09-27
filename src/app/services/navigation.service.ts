import { create } from 'zustand'

export type NavigationSection = 'chat' | 'settings'
export type SettingsPage = 'theme' | 'account'

interface NavigationState {
  selected: NavigationSection
  settingsPage: SettingsPage | null
  select: (section: NavigationSection) => void
  selectSettingsPage: (page: SettingsPage) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  selected: 'chat',
  settingsPage: null,
  select: (section) => set({ selected: section, settingsPage: null }),
  selectSettingsPage: (page) => set({ selected: 'settings', settingsPage: page }),
}))
