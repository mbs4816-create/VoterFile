import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== USERS & AUTHENTICATION ====================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  externalId: varchar('external_id', { length: 255 }).unique(), // OIDC subject ID (optional for password auth)
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }), // For email/password auth
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  profileImageUrl: text('profile_image_url'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== ORGANIZATIONS (Multi-tenant) ====================

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique(),
  description: text('description'),
  settings: json('settings').$type<OrganizationSettings>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type OrganizationSettings = {
  defaultListType?: string;
  enableEmailCampaigns?: boolean;
  sendgridApiKey?: string;
};

export const organizationMembers = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull().default('volunteer'), // admin, manager, volunteer
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, pending, inactive
  permissions: json('permissions').$type<MemberPermissions>().default({}),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  orgUserIdx: uniqueIndex('org_user_idx').on(table.organizationId, table.userId),
}));

export type MemberPermissions = {
  canManageVoters?: boolean;
  canManageLists?: boolean;
  canManageScripts?: boolean;
  canManageTeam?: boolean;
  canSendEmails?: boolean;
  canImportData?: boolean;
  canExportData?: boolean;
};

export const teamInvitations = pgTable('team_invitations', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('volunteer'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== VOTERS ====================

export const voters = pgTable('voters', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Original voter file ID for deduplication
  stateVoterId: varchar('state_voter_id', { length: 50 }),
  legacyId: varchar('legacy_id', { length: 50 }),
  
  // Name fields
  firstName: varchar('first_name', { length: 100 }),
  middleName: varchar('middle_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  nameSuffix: varchar('name_suffix', { length: 20 }),
  
  // Address fields
  houseNumber: varchar('house_number', { length: 20 }),
  streetName: varchar('street_name', { length: 255 }),
  unitType: varchar('unit_type', { length: 20 }),
  unitNumber: varchar('unit_number', { length: 20 }),
  address2: varchar('address_2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 2 }).default('MN'),
  zipCode: varchar('zip_code', { length: 10 }),
  
  // Mailing address (if different)
  mailAddress: varchar('mail_address', { length: 255 }),
  mailCity: varchar('mail_city', { length: 100 }),
  mailState: varchar('mail_state', { length: 2 }),
  mailZipCode: varchar('mail_zip_code', { length: 10 }),
  
  // Contact info
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  
  // Demographics
  dobYear: integer('dob_year'),
  gender: varchar('gender', { length: 10 }),
  party: varchar('party', { length: 50 }),
  
  // Geographic/Political districts
  countyCode: varchar('county_code', { length: 10 }),
  countyName: varchar('county_name', { length: 100 }),
  stateMcdCode: varchar('state_mcd_code', { length: 20 }),
  mcdName: varchar('mcd_name', { length: 100 }),
  precinctCode: varchar('precinct_code', { length: 20 }),
  precinctName: varchar('precinct_name', { length: 100 }),
  wardCode: varchar('ward_code', { length: 10 }),
  
  // Districts
  schoolDistrict: varchar('school_district', { length: 20 }),
  schoolSubDistrict: varchar('school_sub_district', { length: 20 }),
  judicialDistrict: varchar('judicial_district', { length: 10 }),
  legislativeDistrict: varchar('legislative_district', { length: 10 }),
  stateSenateDistrict: varchar('state_senate_district', { length: 10 }),
  congressionalDistrict: varchar('congressional_district', { length: 10 }),
  commissionerDistrict: varchar('commissioner_district', { length: 10 }),
  parkDistrict: varchar('park_district', { length: 20 }),
  soilWaterDistrict: varchar('soil_water_district', { length: 20 }),
  hospitalDistrict: varchar('hospital_district', { length: 20 }),
  
  // Campaign tracking
  supportLevel: integer('support_level'), // 1=Strong Support, 5=Strong Oppose
  notes: text('notes'),
  
  // Voter file metadata
  registrationDate: date('registration_date'),
  permanentAbsentee: boolean('permanent_absentee').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('voters_org_idx').on(table.organizationId),
  stateVoterIdIdx: index('voters_state_id_idx').on(table.organizationId, table.stateVoterId),
  nameIdx: index('voters_name_idx').on(table.lastName, table.firstName),
  cityIdx: index('voters_city_idx').on(table.organizationId, table.city),
  zipIdx: index('voters_zip_idx').on(table.organizationId, table.zipCode),
  countyIdx: index('voters_county_idx').on(table.organizationId, table.countyCode),
  precinctIdx: index('voters_precinct_idx').on(table.organizationId, table.precinctCode),
  congressionalIdx: index('voters_congressional_idx').on(table.organizationId, table.congressionalDistrict),
  legislativeIdx: index('voters_legislative_idx').on(table.organizationId, table.legislativeDistrict),
  senateDstIdx: index('voters_senate_idx').on(table.organizationId, table.stateSenateDistrict),
  supportIdx: index('voters_support_idx').on(table.organizationId, table.supportLevel),
}));

// ==================== ELECTION HISTORY ====================

export const electionHistory = pgTable('election_history', {
  id: serial('id').primaryKey(),
  voterId: integer('voter_id').notNull().references(() => voters.id, { onDelete: 'cascade' }),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  electionDate: date('election_date').notNull(),
  electionDescription: varchar('election_description', { length: 255 }),
  electionType: varchar('election_type', { length: 50 }), // STG, STP, MG, MP, etc.
  votingMethod: varchar('voting_method', { length: 20 }), // A=Absentee, M=Mail, P=In Person, N=Unknown
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  voterIdx: index('election_voter_idx').on(table.voterId),
  orgIdx: index('election_org_idx').on(table.organizationId),
  dateIdx: index('election_date_idx').on(table.electionDate),
  typeIdx: index('election_type_idx').on(table.electionType),
}));

// ==================== VOTER LISTS ====================

export const voterLists = pgTable('voter_lists', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('custom'), // canvass, phonebank, mailing, custom
  
  isPublic: boolean('is_public').default(true),
  
  // Filter criteria for dynamic lists
  filterCriteria: json('filter_criteria').$type<ListFilterCriteria>(),
  isDynamic: boolean('is_dynamic').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('lists_org_idx').on(table.organizationId),
}));

export type ListFilterCriteria = {
  congressionalDistrict?: string[];
  legislativeDistrict?: string[];
  stateSenateDistrict?: string[];
  county?: string[];
  city?: string[];
  zipCode?: string[];
  supportLevel?: number[];
  hasPhone?: boolean;
  hasEmail?: boolean;
};

export const voterListMembers = pgTable('voter_list_members', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').notNull().references(() => voterLists.id, { onDelete: 'cascade' }),
  voterId: integer('voter_id').notNull().references(() => voters.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  addedBy: integer('added_by').references(() => users.id),
}, (table) => ({
  listVoterIdx: uniqueIndex('list_voter_idx').on(table.listId, table.voterId),
}));

export const listAccessPermissions = pgTable('list_access_permissions', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').notNull().references(() => voterLists.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  canEdit: boolean('can_edit').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  listUserIdx: uniqueIndex('list_user_idx').on(table.listId, table.userId),
}));

// ==================== INTERACTIONS ====================

export const interactions = pgTable('interactions', {
  id: serial('id').primaryKey(),
  voterId: integer('voter_id').notNull().references(() => voters.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  type: varchar('type', { length: 50 }).notNull(), // canvass, phone, email, sms, other
  result: varchar('result', { length: 50 }), // contacted, not_home, moved, refused, busy, wrong_number, etc.
  supportLevel: integer('support_level'), // 1-5 scale captured during interaction
  
  notes: text('notes'),
  duration: integer('duration'), // seconds for phone calls
  
  scriptId: integer('script_id').references(() => scripts.id),
  listId: integer('list_id').references(() => voterLists.id),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  voterIdx: index('interactions_voter_idx').on(table.voterId),
  userIdx: index('interactions_user_idx').on(table.userId),
  orgIdx: index('interactions_org_idx').on(table.organizationId),
  dateIdx: index('interactions_date_idx').on(table.createdAt),
}));

// ==================== SCRIPTS ====================

export const scripts = pgTable('scripts', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // canvass, phone
  
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('scripts_org_idx').on(table.organizationId),
}));

// ==================== CUSTOM FIELDS ====================

export const customFieldDefinitions = pgTable('custom_field_definitions', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  fieldLabel: varchar('field_label', { length: 255 }).notNull(),
  fieldType: varchar('field_type', { length: 50 }).notNull(), // text, number, boolean, date, select
  options: json('options').$type<string[]>(), // for select type
  isRequired: boolean('is_required').default(false),
  sortOrder: integer('sort_order').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('custom_fields_org_idx').on(table.organizationId),
  nameIdx: uniqueIndex('custom_fields_name_idx').on(table.organizationId, table.fieldName),
}));

export const customFieldValues = pgTable('custom_field_values', {
  id: serial('id').primaryKey(),
  fieldDefinitionId: integer('field_definition_id').notNull().references(() => customFieldDefinitions.id, { onDelete: 'cascade' }),
  voterId: integer('voter_id').notNull().references(() => voters.id, { onDelete: 'cascade' }),
  
  value: text('value'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fieldVoterIdx: uniqueIndex('field_voter_idx').on(table.fieldDefinitionId, table.voterId),
}));

// ==================== EMAIL CAMPAIGNS ====================

export const emailTemplates = pgTable('email_templates', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  htmlContent: text('html_content').notNull(),
  textContent: text('text_content'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('email_templates_org_idx').on(table.organizationId),
}));

export const emailCampaigns = pgTable('email_campaigns', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by').notNull().references(() => users.id),
  templateId: integer('template_id').references(() => emailTemplates.id),
  listId: integer('list_id').references(() => voterLists.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  fromName: varchar('from_name', { length: 255 }),
  fromEmail: varchar('from_email', { length: 255 }),
  
  status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, scheduled, sending, sent, cancelled
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  
  // Stats
  totalRecipients: integer('total_recipients').default(0),
  totalSent: integer('total_sent').default(0),
  totalOpened: integer('total_opened').default(0),
  totalClicked: integer('total_clicked').default(0),
  totalBounced: integer('total_bounced').default(0),
  totalUnsubscribed: integer('total_unsubscribed').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('email_campaigns_org_idx').on(table.organizationId),
}));

export const emailEvents = pgTable('email_events', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id').notNull().references(() => emailCampaigns.id, { onDelete: 'cascade' }),
  voterId: integer('voter_id').references(() => voters.id, { onDelete: 'set null' }),
  
  eventType: varchar('event_type', { length: 50 }).notNull(), // sent, opened, clicked, bounced, unsubscribed
  eventData: json('event_data'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  campaignIdx: index('email_events_campaign_idx').on(table.campaignId),
}));

// ==================== IMPORT JOBS ====================

export const importJobs = pgTable('import_jobs', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  type: varchar('type', { length: 50 }).notNull(), // voters, election_history
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, processing, completed, failed
  
  fileName: varchar('file_name', { length: 255 }),
  totalRows: integer('total_rows').default(0),
  processedRows: integer('processed_rows').default(0),
  successRows: integer('success_rows').default(0),
  errorRows: integer('error_rows').default(0),
  
  columnMapping: json('column_mapping').$type<Record<string, string>>(),
  errors: json('errors').$type<ImportError[]>().default([]),
  
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('import_jobs_org_idx').on(table.organizationId),
}));

export type ImportError = {
  row: number;
  field?: string;
  message: string;
};

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  interactions: many(interactions),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  voters: many(voters),
  lists: many(voterLists),
  scripts: many(scripts),
  emailCampaigns: many(emailCampaigns),
  importJobs: many(importJobs),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const votersRelations = relations(voters, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [voters.organizationId],
    references: [organizations.id],
  }),
  electionHistory: many(electionHistory),
  interactions: many(interactions),
  listMemberships: many(voterListMembers),
  customFieldValues: many(customFieldValues),
}));

export const electionHistoryRelations = relations(electionHistory, ({ one }) => ({
  voter: one(voters, {
    fields: [electionHistory.voterId],
    references: [voters.id],
  }),
  organization: one(organizations, {
    fields: [electionHistory.organizationId],
    references: [organizations.id],
  }),
}));

export const voterListsRelations = relations(voterLists, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [voterLists.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [voterLists.createdBy],
    references: [users.id],
  }),
  members: many(voterListMembers),
  accessPermissions: many(listAccessPermissions),
}));

export const voterListMembersRelations = relations(voterListMembers, ({ one }) => ({
  list: one(voterLists, {
    fields: [voterListMembers.listId],
    references: [voterLists.id],
  }),
  voter: one(voters, {
    fields: [voterListMembers.voterId],
    references: [voters.id],
  }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  voter: one(voters, {
    fields: [interactions.voterId],
    references: [voters.id],
  }),
  user: one(users, {
    fields: [interactions.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [interactions.organizationId],
    references: [organizations.id],
  }),
  script: one(scripts, {
    fields: [interactions.scriptId],
    references: [scripts.id],
  }),
  list: one(voterLists, {
    fields: [interactions.listId],
    references: [voterLists.id],
  }),
}));

export const scriptsRelations = relations(scripts, ({ one }) => ({
  organization: one(organizations, {
    fields: [scripts.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [scripts.createdBy],
    references: [users.id],
  }),
}));

// ==================== TYPE EXPORTS ====================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export type Voter = typeof voters.$inferSelect;
export type NewVoter = typeof voters.$inferInsert;

export type ElectionHistory = typeof electionHistory.$inferSelect;
export type NewElectionHistory = typeof electionHistory.$inferInsert;

export type VoterList = typeof voterLists.$inferSelect;
export type NewVoterList = typeof voterLists.$inferInsert;

export type VoterListMember = typeof voterListMembers.$inferSelect;
export type NewVoterListMember = typeof voterListMembers.$inferInsert;

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

export type Script = typeof scripts.$inferSelect;
export type NewScript = typeof scripts.$inferInsert;

export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type NewCustomFieldDefinition = typeof customFieldDefinitions.$inferInsert;

export type CustomFieldValue = typeof customFieldValues.$inferSelect;
export type NewCustomFieldValue = typeof customFieldValues.$inferInsert;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type NewTeamInvitation = typeof teamInvitations.$inferInsert;
