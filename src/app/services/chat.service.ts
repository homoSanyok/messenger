import { create } from 'zustand'
import { useLoginStore } from './login.service'

export interface Chat {
  id: string
  phoneNumber: string
  title: string
  lastMessage: string
}

export interface CreateChatInput {
  phoneNumber: string
}

interface ChatState {
  chats: Chat[]
  selectedChat: Chat | null
  createChat: (input: CreateChatInput) => Chat
  selectChat: (chat: Chat | null) => void
  setLastMessage: (chatId: string, lastMessage: string) => void
}

const STORAGE_KEY = 'messenger.chats'

function normalizePhoneNumber(value: string): string {
  const phoneNumber = value.trim().replace(/[\s()-]/g, '')

  if (!/^\+?[1-9]\d{6,14}$/.test(phoneNumber)) {
    throw new Error('Введите номер с кодом страны: от 7 до 15 цифр.')
  }

  return `+${phoneNumber.replace(/^\+/, '')}`
}

function readChats(idInstance: string | null): Chat[] {
  if (idInstance === null) return []

  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(`${STORAGE_KEY}.${idInstance}`) ?? '[]')

    if (!Array.isArray(stored)) return []

    return stored.filter((chat): chat is Chat => (
      typeof chat === 'object' && chat !== null &&
      typeof chat.id === 'string' &&
      typeof chat.phoneNumber === 'string' &&
      /^\+[1-9]\d{6,14}$/.test(chat.phoneNumber) &&
      typeof chat.title === 'string' &&
      typeof chat.lastMessage === 'string'
    ))
  } catch {
    return []
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: readChats(useLoginStore.getState().idInstance),
  selectedChat: null,
  createChat: ({ phoneNumber: value }) => {
    const { idInstance } = useLoginStore.getState()

    if (idInstance === null) {
      throw new Error('Войдите в аккаунт, чтобы создать чат.')
    }

    const phoneNumber = normalizePhoneNumber(value)
    const existingChat = get().chats.find((chat) => chat.phoneNumber === phoneNumber)

    if (existingChat) {
      set({ selectedChat: existingChat })
      return existingChat
    }

    const chat: Chat = {
      id: phoneNumber,
      phoneNumber,
      title: phoneNumber,
      lastMessage: '',
    }
    const chats = [chat, ...get().chats]

    try {
      sessionStorage.setItem(`${STORAGE_KEY}.${idInstance}`, JSON.stringify(chats))
    } catch {
      throw new Error('Не удалось сохранить чат. Проверьте доступ к хранилищу браузера и попробуйте снова.')
    }

    set({ chats, selectedChat: chat })
    return chat
  },
  selectChat: (chat) => set({ selectedChat: chat }),
  setLastMessage: (chatId, lastMessage) => {
    const { idInstance } = useLoginStore.getState()
    const current = get().chats.find((chat) => chat.id === chatId)
    if (idInstance === null || !current || current.lastMessage === lastMessage) return

    const updatedChat = { ...current, lastMessage }
    const chats = get().chats.map((chat) => chat.id === chatId ? updatedChat : chat)

    try {
      sessionStorage.setItem(`${STORAGE_KEY}.${idInstance}`, JSON.stringify(chats))
    } catch {
      // A preview cache failure must not interrupt message synchronization or sending.
    }

    set({
      chats,
      selectedChat: get().selectedChat?.id === chatId ? updatedChat : get().selectedChat,
    })
  },
}))

useLoginStore.subscribe((state, previousState) => {
  if (state.idInstance !== previousState.idInstance) {
    useChatStore.setState({ chats: readChats(state.idInstance), selectedChat: null })
  }
})
