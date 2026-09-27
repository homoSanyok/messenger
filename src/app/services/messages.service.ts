import { create } from 'zustand';

import { useChatStore } from './chat.service';
import { useLoginStore } from './login.service';

export interface Message {
  id: string;
  chatId: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
}

interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
}

interface ChatMessages {
  apiChatId: string | null;
  messages: Message[];
  pendingMessages: Message[];
  status: 'syncing' | 'ready' | 'error';
  sending: boolean;
  error: string | null;
}

interface MessagesState {
  byChat: Record<string, ChatMessages>;
  startSynchronization: (chatId: string) => () => void;
  sendMessage: (chatId: string, text: string) => Promise<void>;
}

interface HistoryPage {
  messages: Message[];
  ids: Set<string>;
}

interface Synchronization {
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

const API_URL = 'https://3100.api.green-api.com';
const HISTORY_COUNT = 20;
const JOURNAL_MINUTES = 1440;
const POLL_INTERVAL = 10_000;
const REQUEST_TIMEOUT = 30_000;
const chatIds = new Map<string, string>();
const synchronizations = new Map<string, Synchronization>();
const sends = new Map<string, AbortController>();
let sessionVersion = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getCredentials(): Credentials {
  const { idInstance, apiTokenInstance } = useLoginStore.getState();
  if (!idInstance || !apiTokenInstance) throw new Error('Войдите в аккаунт, чтобы открыть чат.');
  return { idInstance, apiTokenInstance };
}

async function request(
  credentials: Credentials,
  method: 'checkAccount' | 'getChatHistory' | 'lastIncomingMessages' | 'lastOutgoingMessages' | 'sendMessage',
  signal: AbortSignal,
  body?: Record<string, unknown>,
  query?: Record<string, string>,
): Promise<unknown> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, REQUEST_TIMEOUT);
  const { idInstance, apiTokenInstance } = credentials;
  const search = query ? `?${new URLSearchParams(query)}` : '';

  try {
    const response = await fetch(
      `${API_URL}/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(apiTokenInstance)}${search}`,
      {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('GREEN-API отклонил запрос. Проверьте данные входа и доступ к инстансу.');
      }
      if (response.status === 429) throw new Error('Слишком много запросов к GREEN-API. Повторите чуть позже.');
      throw new Error(`Не удалось выполнить ${method} (HTTP ${response.status}).`);
    }

    const data: unknown = await response.json();
    signal.throwIfAborted();
    return data;
  } catch (cause) {
    signal.throwIfAborted();
    if (controller.signal.aborted) throw new Error('GREEN-API не ответил за 30 секунд. Попробуйте снова.');
    if (cause instanceof TypeError) throw new Error('Не удалось связаться с GREEN-API. Проверьте соединение.');
    if (cause instanceof SyntaxError) throw new Error('GREEN-API вернул некорректный ответ.');
    throw cause;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

function normalizePhoneNumber(value: string | number) {
  return String(value).replace(/\D/g, '');
}

async function resolveChatId(credentials: Credentials, phoneNumber: string, signal: AbortSignal) {
  const phone = normalizePhoneNumber(phoneNumber);
  const key = `messenger.chat-id.${encodeURIComponent(credentials.idInstance)}.${phone}`;
  const cached = chatIds.get(key);
  if (cached) return cached;

  try {
    const stored = sessionStorage.getItem(key);
    if (stored && /^-?\d+$/.test(stored)) {
      chatIds.set(key, stored);
      return stored;
    }
  } catch {
    // Keep the in-memory session cache available if browser storage is blocked.
  }

  const data = await request(credentials, 'checkAccount', signal, { phoneNumber: Number(phone) });
  if (!isRecord(data) || typeof data.exist !== 'boolean') {
    throw new Error('GREEN-API не смог проверить аккаунт. Проверьте авторизацию инстанса и повторите позже.');
  }
  if (!data.exist) throw new Error('Для этого номера не найден аккаунт MAX.');
  if (typeof data.chatId !== 'string' || !/^-?\d+$/.test(data.chatId)) {
    throw new Error('GREEN-API вернул некорректный идентификатор чата.');
  }

  const chatId = data.chatId;
  signal.throwIfAborted();
  chatIds.set(key, chatId);
  try {
    sessionStorage.setItem(key, chatId);
  } catch {
    // The ID is still cached for subsequent openings in this running session.
  }
  return chatId;
}

function parseMessage(value: unknown, chatId: string): Message | null {
  if (
    !isRecord(value) ||
    typeof value.idMessage !== 'string' ||
    (value.type !== 'incoming' && value.type !== 'outgoing') ||
    typeof value.timestamp !== 'number' ||
    !Number.isFinite(value.timestamp) ||
    value.chatId !== chatId
  )
    return null;

  const extended = isRecord(value.extendedTextMessage) ? value.extendedTextMessage.text : undefined;
  const text = value.isDeleted === true
    ? 'Сообщение удалено'
    : typeof value.textMessage === 'string' ? value.textMessage : extended;
  if (typeof text !== 'string') return null;

  const date = new Date(value.timestamp * 1000);
  if (Number.isNaN(date.getTime())) return null;

  return {
    id: value.idMessage,
    chatId,
    text,
    direction: value.type,
    createdAt: date.toISOString(),
  };
}

function parseHistory(entries: unknown[], chatId: string): HistoryPage {
  const ids = new Set<string>();
  const messages = new Map<string, Message>();
  for (const entry of entries) {
    if (!isRecord(entry) || entry.chatId !== chatId) continue;
    if (typeof entry.idMessage === 'string') ids.add(entry.idMessage);
    const message = parseMessage(entry, chatId);
    if (message) messages.set(message.id, message);
  }

  return {
    messages: [...messages.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .slice(-HISTORY_COUNT),
    ids,
  };
}

async function getHistory(credentials: Credentials, chatId: string, signal: AbortSignal): Promise<HistoryPage> {
  const data = await request(credentials, 'getChatHistory', signal, { chatId, count: HISTORY_COUNT });
  if (!Array.isArray(data)) throw new Error('GREEN-API вернул некорректную историю чата.');
  return parseHistory(data, chatId);
}

async function getJournalMessages(
  credentials: Credentials,
  chatId: string,
  signal: AbortSignal,
): Promise<HistoryPage> {
  const query = { minutes: String(JOURNAL_MINUTES) };
  const incoming = await request(credentials, 'lastIncomingMessages', signal, undefined, query);
  if (!Array.isArray(incoming)) throw new Error('GREEN-API вернул некорректный журнал входящих сообщений.');
  const outgoing = await request(credentials, 'lastOutgoingMessages', signal, undefined, query);
  if (!Array.isArray(outgoing)) throw new Error('GREEN-API вернул некорректный журнал исходящих сообщений.');
  return parseHistory([...incoming, ...outgoing], chatId);
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  const updateChat = (chatId: string, state: ChatMessages) => {
    set((current) => ({ byChat: { ...current.byChat, [chatId]: state } }));
  };

  return {
    byChat: {},
    startSynchronization: (chatId) => {
      synchronizations.get(chatId)?.stop();
      const controller = new AbortController();
      const version = sessionVersion;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let apiChatId: string | null = null;
      let synchronized = false;
      let running = false;
      let cycleController: AbortController | undefined;
      let failures = 0;
      const active = () => !controller.signal.aborted && version === sessionVersion;

      updateChat(chatId, {
        apiChatId: null,
        messages: [],
        pendingMessages: [],
        status: 'syncing',
        sending: sends.has(chatId),
        error: null,
      });

      const stop = () => {
        controller.abort();
        cycleController?.abort();
        clearTimeout(timer);
        if (synchronizations.get(chatId)?.stop !== stop) return;
        synchronizations.delete(chatId);
        // History only lives in memory while this chat is open.
        set((state) => {
          const byChat = { ...state.byChat };
          delete byChat[chatId];
          return { byChat };
        });
      };

      const schedule = () => {
        clearTimeout(timer);
        if (!active() || running || sends.has(chatId)) return;
        timer = setTimeout(() => void synchronize(), Math.min(POLL_INTERVAL * 2 ** failures, 30_000));
      };

      const pause = () => {
        clearTimeout(timer);
        cycleController?.abort();
      };

      const applyHistory = (page: HistoryPage, replace: boolean) => {
        const current = get().byChat[chatId];
        // An accepted send may take time to appear in the server's history.
        const pendingMessages = current.pendingMessages.filter((message) => !page.ids.has(message.id));
        // Initial history replaces the old state; daily journals update it without losing older messages.
        const byId = new Map<string, Message>();
        if (!replace) {
          for (const message of current.messages) byId.set(message.id, message);
        }
        for (const id of page.ids) byId.delete(id);
        for (const message of [...page.messages, ...pendingMessages]) byId.set(message.id, message);
        const messages = [...byId.values()]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
          .slice(-HISTORY_COUNT);
        synchronized = true;
        updateChat(chatId, {
          ...current,
          apiChatId,
          messages: JSON.stringify(messages) === JSON.stringify(current.messages) ? current.messages : messages,
          pendingMessages,
          status: 'ready',
          error: null,
        });
        useChatStore.getState().setLastMessage(chatId, messages[messages.length - 1]?.text ?? '');
      };

      const synchronize = async () => {
        if (!active() || running || sends.has(chatId)) return;
        running = true;
        const cycle = new AbortController();
        cycleController = cycle;
        const cycleActive = () => active() && !cycle.signal.aborted;
        try {
          const credentials = getCredentials();
          if (apiChatId === null) {
            const chat = useChatStore.getState().chats.find((item) => item.id === chatId);
            if (!chat) throw new Error('Выбранный чат не найден.');
            apiChatId = await resolveChatId(credentials, chat.phoneNumber, cycle.signal);
            if (!cycleActive()) return;
          }

          const replace = !synchronized;
          const page = replace
            ? await getHistory(credentials, apiChatId, cycle.signal)
            : await getJournalMessages(credentials, apiChatId, cycle.signal);
          if (!cycleActive()) return;
          applyHistory(page, replace);
          failures = 0;
        } catch (cause) {
          if (!cycleActive()) return;
          failures += 1;
          const current = get().byChat[chatId];
          updateChat(chatId, {
            ...current,
            status: synchronized ? 'ready' : 'error',
            error: cause instanceof Error ? cause.message : 'Не удалось обновить сообщения.',
          });
        } finally {
          running = false;
          cycleController = undefined;
          // Sending pauses the cycle; its completion starts a fresh interval.
          schedule();
        }
      };

      synchronizations.set(chatId, { stop, pause, resume: schedule });
      void synchronize();
      return stop;
    },
    sendMessage: async (chatId, value) => {
      const text = value.trim();
      if (!text) return;
      if (text.length > 4000) throw new Error('Сообщение должно быть не длиннее 4000 символов.');
      const credentials = getCredentials();
      const chat = get().byChat[chatId];
      if (!chat || chat.status !== 'ready' || !chat.apiChatId || sends.has(chatId)) {
        throw new Error('Дождитесь загрузки сообщений и попробуйте снова.');
      }

      const version = sessionVersion;
      const controller = new AbortController();
      sends.set(chatId, controller);
      synchronizations.get(chatId)?.pause();
      updateChat(chatId, { ...chat, sending: true });

      try {
        const data = await request(credentials, 'sendMessage', controller.signal, {
          chatId: chat.apiChatId,
          message: text,
          typingTime: 1000,
        });
        if (!isRecord(data) || typeof data.idMessage !== 'string' || !data.idMessage) {
          throw new Error('GREEN-API не подтвердил отправку сообщения.');
        }
        if (version !== sessionVersion || controller.signal.aborted) return;

        useChatStore.getState().setLastMessage(chatId, text);
        const current = get().byChat[chatId];
        if (!current || current.messages.some((message) => message.id === data.idMessage)) return;
        const message: Message = {
          id: data.idMessage,
          chatId: chat.apiChatId,
          text,
          direction: 'outgoing',
          createdAt: new Date().toISOString(),
        };
        updateChat(chatId, {
          ...current,
          messages: [...current.messages, message].slice(-HISTORY_COUNT),
          pendingMessages: [...current.pendingMessages, message],
        });
      } finally {
        if (sends.get(chatId) === controller) sends.delete(chatId);
        const current = get().byChat[chatId];
        if (version === sessionVersion) {
          if (current) updateChat(chatId, { ...current, sending: false });
          synchronizations.get(chatId)?.resume();
        }
      }
    },
  };
});

useLoginStore.subscribe((state, previous) => {
  if (state.idInstance !== previous.idInstance || state.apiTokenInstance !== previous.apiTokenInstance) {
    sessionVersion += 1;
    synchronizations.forEach((synchronization) => synchronization.stop());
    sends.forEach((controller) => controller.abort());
    synchronizations.clear();
    sends.clear();
    chatIds.clear();
    useMessagesStore.setState({ byChat: {} });
  }
});
