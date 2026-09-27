import { create } from 'zustand'

interface LoginCredentials {
  idInstance: string
  apiTokenInstance: string
}

interface LoginState {
  idInstance: string | null
  apiTokenInstance: string | null
  login: (credentials: LoginCredentials) => void
  logout: () => void
}

const STORAGE_KEY = 'messenger.login'
const emptyCredentials = { idInstance: null, apiTokenInstance: null }

function readCredentials(): LoginCredentials | typeof emptyCredentials {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')

    if (
      typeof stored === 'object' && stored !== null &&
      'idInstance' in stored && typeof stored.idInstance === 'string' && stored.idInstance.trim() &&
      'apiTokenInstance' in stored && typeof stored.apiTokenInstance === 'string' && stored.apiTokenInstance.trim()
    ) {
      return {
        idInstance: stored.idInstance.trim(),
        apiTokenInstance: stored.apiTokenInstance.trim(),
      }
    }
  } catch {
    // An unavailable or invalid session starts at the login page.
  }

  return emptyCredentials
}

export const useLoginStore = create<LoginState>((set) => ({
  ...readCredentials(),
  login: (credentials) => {
    const idInstance = credentials.idInstance.trim()
    const apiTokenInstance = credentials.apiTokenInstance.trim()

    if (!idInstance || !apiTokenInstance) {
      throw new Error('Введите idInstance и apiTokenInstance.')
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ idInstance, apiTokenInstance }))
    } catch {
      throw new Error('Не удалось сохранить данные входа. Проверьте доступ к хранилищу браузера.')
    }

    set({ idInstance, apiTokenInstance })
  },
  logout: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      throw new Error('Не удалось удалить данные входа. Проверьте доступ к хранилищу браузера.')
    }

    set(emptyCredentials)
  },
}))
