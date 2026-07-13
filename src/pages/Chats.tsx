import { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { MessageSquare, Shield } from 'lucide-react';
import { useConversations, usePresence } from '@/hooks/use-chat';
import type { ConversationWithMeta } from '@/hooks/use-chat';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { NewGroupDialog } from '@/components/chat/NewGroupDialog';
import { AdminMonitorView } from '@/components/chat/AdminMonitorView';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import { useIsMobile } from '@/hooks/use-mobile';

type ViewTab = 'chats' | 'admin';

export default function Chats() {
  const { profile } = useAuthStore();
  const isMobile = useIsMobile();
  const {
    activeConversationId,
    setActiveConversation,
    mobileShowChat,
    setMobileShowChat,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'dms' | 'groups'>('all');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>('chats');
  const [adminViewConversation, setAdminViewConversation] = useState<ConversationWithMeta | null>(null);

  // Initialize presence tracking
  usePresence();

  const { data: conversations = [], isLoading } = useConversations();

  const isCompanyAdmin = profile?.platform_role === 'company_admin';

  // Find active conversation object
  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [activeConversationId, conversations]);

  const handleSelectConversation = useCallback(
    (conversation: ConversationWithMeta) => {
      setActiveConversation(conversation.id);
      if (isMobile) {
        setMobileShowChat(true);
      }
    },
    [isMobile, setActiveConversation, setMobileShowChat]
  );

  const handleConversationCreated = useCallback(
    (conversationId: string) => {
      setActiveConversation(conversationId);
      if (isMobile) {
        setMobileShowChat(true);
      }
    },
    [isMobile, setActiveConversation, setMobileShowChat]
  );

  const handleAdminViewConversation = useCallback(
    (conversation: ConversationWithMeta) => {
      setAdminViewConversation(conversation);
      if (isMobile) {
        setMobileShowChat(true);
      }
    },
    [isMobile]
  );

  // Mobile: show either list or chat
  if (isMobile) {
    return (
      <>
        <Helmet>
          <title>Chats | FastestHR</title>
        </Helmet>

        <div className="h-[calc(100vh-8rem)] -mx-4 -mt-4 flex flex-col">
          {mobileShowChat ? (
            viewTab === 'admin' && adminViewConversation ? (
              <ChatWindow conversation={adminViewConversation} isAdminView />
            ) : (
              <ChatWindow conversation={activeConversation} />
            )
          ) : (
            <div className="flex flex-col h-full">
              {/* Tab switcher for admin */}
              {isCompanyAdmin && (
                <div className="flex border-b border-border shrink-0">
                  <button
                    onClick={() => setViewTab('chats')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
                      viewTab === 'chats'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 inline mr-1.5" />
                    My Chats
                  </button>
                  <button
                    onClick={() => setViewTab('admin')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
                      viewTab === 'admin'
                        ? 'border-amber-500 text-amber-600'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Shield className="h-4 w-4 inline mr-1.5" />
                    Admin Monitor
                  </button>
                </div>
              )}

              {viewTab === 'chats' ? (
                <ConversationList
                  conversations={conversations}
                  isLoading={isLoading}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  activeConversationId={activeConversationId}
                  onSelect={handleSelectConversation}
                  onNewChat={() => setNewChatOpen(true)}
                  onNewGroup={() => setNewGroupOpen(true)}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              ) : (
                <AdminMonitorView onViewConversation={handleAdminViewConversation} />
              )}
            </div>
          )}
        </div>

        <NewChatDialog
          open={newChatOpen}
          onOpenChange={setNewChatOpen}
          onConversationCreated={handleConversationCreated}
        />
        <NewGroupDialog
          open={newGroupOpen}
          onOpenChange={setNewGroupOpen}
          onConversationCreated={handleConversationCreated}
        />
      </>
    );
  }

  // Desktop: two-panel layout
  return (
    <>
      <Helmet>
        <title>Chats | FastestHR</title>
      </Helmet>

      <div className="h-[calc(100vh-5.5rem)] -mx-6 -mt-6 flex">
        {/* Left panel */}
        <div className="w-80 lg:w-96 shrink-0 flex flex-col">
          {/* Tab switcher for admin */}
          {isCompanyAdmin && (
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setViewTab('chats')}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
                  viewTab === 'chats'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-4 w-4 inline mr-1.5" />
                My Chats
              </button>
              <button
                onClick={() => setViewTab('admin')}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
                  viewTab === 'admin'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Shield className="h-4 w-4 inline mr-1.5" />
                Monitor
              </button>
            </div>
          )}

          {viewTab === 'chats' ? (
            <ConversationList
              conversations={conversations}
              isLoading={isLoading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeConversationId={activeConversationId}
              onSelect={handleSelectConversation}
              onNewChat={() => setNewChatOpen(true)}
              onNewGroup={() => setNewGroupOpen(true)}
              filter={filter}
              onFilterChange={setFilter}
            />
          ) : (
            <AdminMonitorView onViewConversation={handleAdminViewConversation} />
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-border">
          {viewTab === 'admin' && adminViewConversation ? (
            <ChatWindow conversation={adminViewConversation} isAdminView />
          ) : (
            <ChatWindow conversation={activeConversation} />
          )}
        </div>
      </div>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onConversationCreated={handleConversationCreated}
      />
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onConversationCreated={handleConversationCreated}
      />
    </>
  );
}
