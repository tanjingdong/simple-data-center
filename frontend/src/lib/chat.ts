export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string // ISO
}

const MESSAGES_KEY = 'pim-chat-messages'

// 读取本地聊天记录(无则空数组)
export function loadChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY)
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 追加一条消息并持久化,返回新列表
export function appendChatMessage(
  messages: ChatMessage[],
  message: ChatMessage
): ChatMessage[] {
  const next = [...messages, message]
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(next.slice(-200)))
  return next
}

// 清空聊天记录
export function clearChatMessages() {
  localStorage.removeItem(MESSAGES_KEY)
}
