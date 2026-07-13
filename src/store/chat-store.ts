import { create } from 'zustand';

interface ChatState {
  activeConversationId: string | null;
  onlineUsers: Set<string>;
  typingUsers: Map<string, Set<string>>; // conversationId -> Set<userId>
  unreadCounts: Map<string, number>; // conversationId -> count
  mobileShowChat: boolean; // mobile: show chat window vs list

  setActiveConversation: (id: string | null) => void;
  setOnlineUsers: (users: Set<string>) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setTypingUser: (conversationId: string, userId: string, isTyping: boolean) => void;
  setUnreadCount: (conversationId: string, count: number) => void;
  decrementUnread: (conversationId: string) => void;
  setMobileShowChat: (show: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  onlineUsers: new Set<string>(),
  typingUsers: new Map<string, Set<string>>(),
  unreadCounts: new Map<string, number>(),
  mobileShowChat: false,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  addOnlineUser: (userId) => {
    const updated = new Set(get().onlineUsers);
    updated.add(userId);
    set({ onlineUsers: updated });
  },

  removeOnlineUser: (userId) => {
    const updated = new Set(get().onlineUsers);
    updated.delete(userId);
    set({ onlineUsers: updated });
  },

  setTypingUser: (conversationId, userId, isTyping) => {
    const updated = new Map(get().typingUsers);
    const users = new Set(updated.get(conversationId) || []);
    if (isTyping) {
      users.add(userId);
    } else {
      users.delete(userId);
    }
    if (users.size === 0) {
      updated.delete(conversationId);
    } else {
      updated.set(conversationId, users);
    }
    set({ typingUsers: updated });
  },

  setUnreadCount: (conversationId, count) => {
    const updated = new Map(get().unreadCounts);
    if (count <= 0) {
      updated.delete(conversationId);
    } else {
      updated.set(conversationId, count);
    }
    set({ unreadCounts: updated });
  },

  decrementUnread: (conversationId) => {
    const updated = new Map(get().unreadCounts);
    const current = updated.get(conversationId) || 0;
    if (current <= 1) {
      updated.delete(conversationId);
    } else {
      updated.set(conversationId, current - 1);
    }
    set({ unreadCounts: updated });
  },

  setMobileShowChat: (show) => set({ mobileShowChat: show }),
}));
