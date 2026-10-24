// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const players=sqliteTable('players',{id:text('id').primaryKey(),userId:text('user_id').notNull().unique(),nickname:text('nickname').notNull().unique(),status:text('status').notNull().default('pending'),createdAt:text('created_at').notNull()});
export const competitions=sqliteTable('competitions',{id:text('id').primaryKey(),name:text('name').notNull(),kind:text('kind').notNull(),mode:integer('mode').notNull(),status:text('status').notNull().default('open'),createdAt:text('created_at').notNull()});
export const entries=sqliteTable('entries',{id:text('id').primaryKey(),competitionId:text('competition_id').notNull().references(()=>competitions.id),playerId:text('player_id').notNull().references(()=>players.id),partnerId:text('partner_id').references(()=>players.id),team:text('team').notNull()});
export const matches=sqliteTable('matches',{id:text('id').primaryKey(),competitionId:text('competition_id').notNull().references(()=>competitions.id),homeId:text('home_id').notNull().references(()=>entries.id),awayId:text('away_id').notNull().references(()=>entries.id),homeScore:integer('home_score'),awayScore:integer('away_score'),round:integer('round').notNull(),status:text('status').notNull().default('scheduled')});
export const audit=sqliteTable('audit',{id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),createdAt:text('created_at').notNull()});
