import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { users, messages, type User, type InsertUser, type Message, type MessageWithUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
// modify the interface with any CRUD methods
// you might need
const PostgresSessionStore = connectPg(session);
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getMessages(): Promise<MessageWithUser[]>;
  createMessage(content: string, userId: string): Promise<MessageWithUser>;
  sessionStore: session.Store;
}
export class MemStorage implements IStorage {
  private users: Map<string, User>;
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  constructor() {
    this.users = new Map();
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  async getMessages(): Promise<MessageWithUser[]> {
    const result = await db
      .select({
        id: messages.id,
        content: messages.content,
        userId: messages.userId,
        createdAt: messages.createdAt,
        user: {
          id: users.id,
          username: users.username,
        },
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .orderBy(messages.createdAt)
      .limit(100);
    return result as MessageWithUser[];
  }
  async createMessage(content: string, userId: string): Promise<MessageWithUser> {
    const [message] = await db
      .insert(messages)
      .values({ content, userId })
      .returning();
    const user = await this.getUser(userId);
    
    return {
      ...message,
      user: {
        id: user!.id,
        username: user!.username,
      },
    };
  }
}
export const storage = new MemStorage();
export const storage = new DatabaseStorage();
