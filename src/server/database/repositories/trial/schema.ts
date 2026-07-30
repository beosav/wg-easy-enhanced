import { relations, sql } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { client } from '../client/schema';

export const trial = sqliteTable('trial_installations', {
  id: int().primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  requestIpHash: text('request_ip_hash').notNull(),
  clientId: int('client_id')
    .notNull()
    .unique()
    .references(() => client.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  campaign: text(),
  startedAt: text('started_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  expiresAt: text('expires_at').notNull(),
  lastSeenAt: text('last_seen_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const trialRelations = relations(trial, ({ one }) => ({
  client: one(client, {
    fields: [trial.clientId],
    references: [client.id],
  }),
}));
