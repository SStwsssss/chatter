import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { MessageWithUser, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { queryClient } from "@/lib/queryClient";
import { LogOut, Send, Users } from "lucide-react";

export default function ChatPage() {
  const { user, logoutMutation } = useAuth();
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showUsersMobile, setShowUsersMobile] = useState(false);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/messages"],
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "message") {
        queryClient.setQueryData<MessageWithUser[]>(["/api/messages"], (old = []) => [
          ...old,
          data.payload,
        ]);
      } else if (data.type === "users") {
        setOnlineUsers(data.payload);
      } else if (data.type === "user_joined") {
        setOnlineUsers((prev) => {
          if (prev.find((u) => u.id === data.payload.id)) return prev;
          return [...prev, data.payload];
        });
      } else if (data.type === "user_left") {
        setOnlineUsers((prev) => prev.filter((u) => u.id !== data.payload.id));
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (!message.trim() || !socket || !isConnected) return;

    socket.send(
      JSON.stringify({
        type: "message",
        content: message.trim(),
      })
    );

    setMessage("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const charCount = message.length;
  const maxChars = 1000;

  return (
    <div className="h-screen flex bg-background">
      <aside className="hidden md:flex flex-col w-72 border-r-2 border-foreground">
        <div className="p-6 border-b-2 border-foreground">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
            LOGGED IN AS
          </div>
          <div className="font-bold uppercase tracking-wide truncate">
            {user?.username}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-muted">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              <Users className="w-3 h-3" />
              ONLINE ({onlineUsers.length})
            </div>
          </div>
          <div className="divide-y divide-muted">
            {onlineUsers.map((onlineUser) => (
              <div
                key={onlineUser.id}
                className="p-4 flex items-center gap-3"
                data-testid={`user-item-${onlineUser.id}`}
              >
                <span className="w-2 h-2 bg-foreground" aria-label="Online" />
                <span className="font-mono text-sm uppercase tracking-wide truncate">
                  {onlineUser.username}
                </span>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <div className="p-4 text-muted-foreground font-mono text-xs uppercase">
                NO USERS ONLINE
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t-2 border-foreground">
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
            className="w-full border-2 border-foreground font-bold uppercase tracking-widest text-xs h-auto py-3"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {logoutMutation.isPending ? "LOGGING OUT..." : "LOGOUT"}
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="p-6 border-b-2 border-foreground flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold uppercase tracking-wide text-xl">CHAT</h1>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <span
                className={`w-2 h-2 ${isConnected ? "bg-foreground" : "border-2 border-foreground"}`}
              />
              {isConnected ? "CONNECTED" : "DISCONNECTED"}
            </div>
          </div>
          
          <div className="md:hidden flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowUsersMobile(!showUsersMobile)}
              className="border-2 border-foreground"
              data-testid="button-toggle-users"
            >
              <Users className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout-mobile"
              className="border-2 border-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {showUsersMobile && (
          <div className="md:hidden border-b-2 border-foreground p-4 bg-muted">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              ONLINE ({onlineUsers.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {onlineUsers.map((onlineUser) => (
                <span
                  key={onlineUser.id}
                  className="font-mono text-xs uppercase tracking-wide bg-background px-2 py-1 border-2 border-foreground flex items-center gap-1"
                >
                  <span className="w-2 h-2 bg-foreground" />
                  {onlineUser.username}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-foreground border-t-transparent animate-spin mx-auto mb-4" />
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  LOADING MESSAGES
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-6 opacity-20">
                  <span className="font-bold">[ ]</span>
                </div>
                <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground mb-2">
                  NO MESSAGES YET
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  BE THE FIRST TO START THE CONVERSATION
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-0">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`py-6 ${index !== messages.length - 1 ? "border-b border-muted" : ""}`}
                  data-testid={`message-item-${msg.id}`}
                >
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-mono font-bold text-sm uppercase tracking-wide">
                      {msg.user.username}
                    </span>
                    <span className="font-mono text-xs font-light text-muted-foreground">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-6 border-t-2 border-foreground">
          <div className="max-w-4xl mx-auto">
            <div className="flex border-2 border-foreground">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, maxChars))}
                onKeyDown={handleKeyDown}
                placeholder="TYPE YOUR MESSAGE..."
                data-testid="input-message"
                className="flex-1 min-h-16 max-h-32 resize-none border-0 text-base focus-visible:ring-0 bg-transparent"
                disabled={!isConnected}
                aria-label="Chat messages"
              />
              <Button
                onClick={sendMessage}
                disabled={!message.trim() || !isConnected}
                data-testid="button-send"
                className="border-0 border-l-2 border-foreground px-6 bg-foreground text-background font-bold uppercase tracking-widest text-xs disabled:opacity-50 h-auto"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 mr-2" />
                SEND
              </Button>
            </div>
            <div className="flex justify-between mt-2">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                ENTER TO SEND, SHIFT+ENTER FOR NEW LINE
              </span>
              <span className={`font-mono text-xs ${charCount > maxChars * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>
                {charCount}/{maxChars}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
