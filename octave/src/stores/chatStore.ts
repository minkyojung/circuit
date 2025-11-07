/**
 * Chat Store - Zustand store for conversation and message state
 *
 * Centralizes state previously scattered across ChatPanel component
 */

import { create } from 'zustand';
import type { Message } from '@/types/conversation';

// @ts-ignore
const ipcRenderer = window.electron.ipcRenderer;

interface ChatStore {
  // Conversation state
  conversationId: string | null;
  messages: Message[];
  isLoadingConversation: boolean;

  // Input state
  input: string;

  // Sending state
  isSending: boolean;
  isCancelling: boolean;
  pendingAssistantMessageId: string | null;

  // UI state
  copiedMessageId: string | null;
  openReasoningId: string | null;

  // Actions - Conversation
  setConversationId: (id: string | null) => void;
  loadConversation: (workspaceId: string, conversationId?: string | null) => Promise<void>;

  // Actions - Messages
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;

  // Actions - Input
  setInput: (input: string) => void;

  // Actions - Sending
  setIsSending: (sending: boolean) => void;
  setIsCancelling: (cancelling: boolean) => void;
  setPendingAssistantMessageId: (id: string | null) => void;

  // Actions - UI
  setCopiedMessageId: (id: string | null) => void;
  setOpenReasoningId: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  conversationId: null,
  messages: [],
  isLoadingConversation: true,
  input: '',
  isSending: false,
  isCancelling: false,
  pendingAssistantMessageId: null,
  copiedMessageId: null,
  openReasoningId: null,

  // Conversation actions
  setConversationId: (id) => set({ conversationId: id }),

  loadConversation: async (workspaceId: string, conversationId?: string | null) => {
    set({ isLoadingConversation: true });

    try {
      let targetConversationId = conversationId;

      // If no conversation ID provided, get or create one
      if (!targetConversationId) {
        const result = await ipcRenderer.invoke('conversation:get-or-create', workspaceId);
        if (result.success && result.conversation) {
          targetConversationId = result.conversation.id;
        } else {
          console.error('[chatStore] Failed to get/create conversation:', result.error);
          set({ isLoadingConversation: false });
          return;
        }
      }

      // Load messages for the conversation
      const messagesResult = await ipcRenderer.invoke('message:list', targetConversationId);
      if (messagesResult.success && messagesResult.messages) {
        set({
          conversationId: targetConversationId,
          messages: messagesResult.messages,
          isLoadingConversation: false
        });
      } else {
        console.error('[chatStore] Failed to load messages:', messagesResult.error);
        set({
          conversationId: targetConversationId,
          messages: [],
          isLoadingConversation: false
        });
      }
    } catch (error) {
      console.error('[chatStore] Error loading conversation:', error);
      set({ isLoadingConversation: false });
    }
  },

  // Message actions
  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),

  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((msg) => msg.id !== id)
  })),

  clearMessages: () => set({ messages: [] }),

  // Input actions
  setInput: (input) => set({ input }),

  // Sending actions
  setIsSending: (sending) => set({ isSending: sending }),
  setIsCancelling: (cancelling) => set({ isCancelling: cancelling }),
  setPendingAssistantMessageId: (id) => set({ pendingAssistantMessageId: id }),

  // UI actions
  setCopiedMessageId: (id) => set({ copiedMessageId: id }),
  setOpenReasoningId: (id) => set({ openReasoningId: id }),
}));
