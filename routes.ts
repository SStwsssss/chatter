import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import type { User } from "@shared/schema";
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  user?: Pick<User, "id" | "username">;
  isAlive?: boolean;
}
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api
  setupAuth(app);
  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)
  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    const messages = await storage.getMessages();
    res.json(messages);
  });
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const connectedUsers = new Map<string, AuthenticatedWebSocket>();
  function broadcastUserList() {
    const users = Array.from(connectedUsers.values())
      .filter((ws) => ws.user)
      .map((ws) => ws.user);
    const message = JSON.stringify({
      type: "users",
      payload: users,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  function broadcastMessage(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    const cookies = req.headers.cookie;
    if (!cookies) {
      ws.close(1008, "No session cookie");
      return;
    }
    const sessionIdMatch = cookies.match(/connect\.sid=([^;]+)/);
    if (!sessionIdMatch) {
      ws.close(1008, "No session ID");
      return;
    }
    const sessionId = decodeURIComponent(sessionIdMatch[1]).split(".")[0].replace("s:", "");
    storage.sessionStore.get(sessionId, async (err, session) => {
      if (err || !session || !session.passport?.user) {
        ws.close(1008, "Invalid session");
        return;
      }
      const userId = session.passport.user;
      const user = await storage.getUser(userId);
      if (!user) {
        ws.close(1008, "User not found");
        return;
      }
      ws.userId = user.id;
      ws.user = { id: user.id, username: user.username };
      if (connectedUsers.has(user.id)) {
        const existingWs = connectedUsers.get(user.id);
        existingWs?.close(1000, "Replaced by new connection");
      }
      connectedUsers.set(user.id, ws);
      broadcastMessage("user_joined", ws.user);
      broadcastUserList();
      ws.on("message", async (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === "message" && parsed.content) {
            const content = parsed.content.trim().slice(0, 1000);
            
            if (content && ws.userId) {
              const message = await storage.createMessage(content, ws.userId);
              broadcastMessage("message", message);
            }
          }
        } catch (e) {
          console.error("WebSocket message error:", e);
        }
      });
      ws.on("close", () => {
        if (ws.userId) {
          connectedUsers.delete(ws.userId);
          broadcastMessage("user_left", { id: ws.userId });
          broadcastUserList();
        }
      });
      ws.on("pong", () => {
        ws.isAlive = true;
      });
    });
  });
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on("close", () => {
    clearInterval(pingInterval);
  });
  return httpServer;
}
