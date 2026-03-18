// ABOUTME: Drizzle ORM schema for Postgres (Neon). Used by cloud/SaaS deployment.
// ABOUTME: All tables include user_id for multi-tenancy. Better Auth manages users/sessions/accounts.

import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

// --- Better Auth tables (managed by Better Auth, defined here for Drizzle awareness) ---

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Application tables (multi-tenant, scoped by user_id) ---

export const bookmarks = pgTable(
  "bookmarks",
  {
    tweetId: text("tweet_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    authorId: text("author_id"),
    authorName: text("author_name"),
    authorUsername: text("author_username"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    folderId: text("folder_id"),
    folderName: text("folder_name"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    newsletteredAt: timestamp("newslettered_at", { withTimezone: true }),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>(),
    mediaUrl: text("media_url"),
    urlTitle: text("url_title"),
    urlDescription: text("url_description"),
    urlImage: text("url_image"),
    expandedUrl: text("expanded_url"),
    starred: boolean("starred").notNull().default(false),
    needToRead: boolean("need_to_read").notNull().default(false),
    hidden: boolean("hidden").default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tweetId, table.userId] }),
    index("bookmarks_user_id_idx").on(table.userId),
    index("bookmarks_folder_id_idx").on(table.userId, table.folderId),
    index("bookmarks_synced_at_idx").on(table.userId, table.syncedAt),
    index("bookmarks_author_idx").on(table.userId, table.authorUsername),
    index("bookmarks_newslettered_at_idx").on(table.userId, table.newsletteredAt),
    index("bookmarks_starred_idx").on(table.userId, table.starred),
    index("bookmarks_need_to_read_idx").on(table.userId, table.needToRead),
    index("bookmarks_hidden_idx").on(table.userId, table.hidden),
    foreignKey({
      columns: [table.folderId, table.userId],
      foreignColumns: [folders.id, folders.userId],
      name: "bookmarks_folder_fk",
    }),
  ]
);

export const folders = pgTable(
  "folders",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.userId] }),
  ]
);

export const syncLog = pgTable(
  "sync_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    bookmarksFetched: integer("bookmarks_fetched").notNull().default(0),
    bookmarksNew: integer("bookmarks_new").notNull().default(0),
  },
  (table) => [
    index("sync_log_user_synced_idx").on(table.userId, table.syncedAt),
  ]
);

export const newsletterLog = pgTable(
  "newsletter_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    bookmarkCount: integer("bookmark_count").notNull().default(0),
  },
  (table) => [
    index("newsletter_log_user_sent_idx").on(table.userId, table.sentAt),
  ]
);

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // X API tokens — encrypted at rest via shared/encryption.ts when ENCRYPTION_KEY is set
  xAccessToken: text("x_access_token"),
  xRefreshToken: text("x_refresh_token"),
  xTokenExpiresAt: timestamp("x_token_expires_at", { withTimezone: true }),
  xUserId: text("x_user_id"),
  xUsername: text("x_username"),
  // Newsletter settings
  newsletterEmail: text("newsletter_email"),
  newsletterEnabled: boolean("newsletter_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull().unique(),
    name: text("name").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("api_keys_user_id_idx").on(table.userId),
    index("api_keys_key_hash_idx").on(table.keyHash),
  ]
);

// --- Cloud infrastructure tables (rate limiting and sync locking) ---

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  windowSeconds: integer("window_seconds").notNull().default(60),
});

export const syncLocks = pgTable("sync_locks", {
  userId: text("user_id").primaryKey(),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
