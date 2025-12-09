// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter types for voters
export interface VoterFilters {
  search?: string;
  congressionalDistrict?: string;
  legislativeDistrict?: string;
  stateSenateDistrict?: string;
  county?: string;
  city?: string;
  zipCode?: string;
  precinctCode?: string;
  supportLevel?: number;
  hasPhone?: boolean;
  hasEmail?: boolean;
  listId?: number;
}

// Election types mapping (from Minnesota voter file)
export const ELECTION_TYPES: Record<string, string> = {
  'MG': 'Municipal General Election',
  'MP': 'Municipal Primary',
  'PNP': 'Presidential Nomination Primary',
  'SDG': 'School District Election',
  'SDP': 'School District Primary',
  'SDSE': 'School District Special Election',
  'SDSP': 'School District Special Primary',
  'SE': 'Special Election',
  'STG': 'State General Election',
  'STP': 'State Primary',
};

// Voting methods mapping
export const VOTING_METHODS: Record<string, string> = {
  'A': 'Absentee',
  'M': 'Mail',
  'P': 'In Person',
  'N': 'Unknown',
};

// Interaction result types
export const INTERACTION_RESULTS = {
  CONTACTED: 'contacted',
  NOT_HOME: 'not_home',
  MOVED: 'moved',
  REFUSED: 'refused',
  BUSY: 'busy',
  WRONG_NUMBER: 'wrong_number',
  LEFT_MESSAGE: 'left_message',
  DECEASED: 'deceased',
  INACCESSIBLE: 'inaccessible',
  OTHER: 'other',
} as const;

export type InteractionResult = typeof INTERACTION_RESULTS[keyof typeof INTERACTION_RESULTS];

export const INTERACTION_RESULT_LABELS: Record<InteractionResult, string> = {
  contacted: 'Contacted',
  not_home: 'Not Home',
  moved: 'Moved',
  refused: 'Refused',
  busy: 'Busy',
  wrong_number: 'Wrong Number',
  left_message: 'Left Message',
  deceased: 'Deceased',
  inaccessible: 'Inaccessible',
  other: 'Other',
};

// Support levels
export const SUPPORT_LEVELS = {
  STRONG_SUPPORT: 1,
  LEAN_SUPPORT: 2,
  UNDECIDED: 3,
  LEAN_OPPOSE: 4,
  STRONG_OPPOSE: 5,
} as const;

export const SUPPORT_LEVEL_LABELS: Record<number, string> = {
  1: 'Strong Support',
  2: 'Lean Support',
  3: 'Undecided',
  4: 'Lean Oppose',
  5: 'Strong Oppose',
};

export const SUPPORT_LEVEL_COLORS: Record<number, string> = {
  1: 'bg-green-600',
  2: 'bg-green-400',
  3: 'bg-yellow-500',
  4: 'bg-red-400',
  5: 'bg-red-600',
};

// List types
export const LIST_TYPES = {
  CANVASS: 'canvass',
  PHONEBANK: 'phonebank',
  MAILING: 'mailing',
  CUSTOM: 'custom',
} as const;

export type ListType = typeof LIST_TYPES[keyof typeof LIST_TYPES];

export const LIST_TYPE_LABELS: Record<ListType, string> = {
  canvass: 'Canvassing',
  phonebank: 'Phone Banking',
  mailing: 'Mailing',
  custom: 'Custom',
};

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  VOLUNTEER: 'volunteer',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  volunteer: 'Volunteer',
};

// Minnesota voter file column mappings
export const MN_VOTER_FILE_COLUMNS = {
  VoterId: 'stateVoterId',
  CountyCode: 'countyCode',
  FirstName: 'firstName',
  MiddleName: 'middleName',
  LastName: 'lastName',
  NameSuffix: 'nameSuffix',
  HouseNumber: 'houseNumber',
  StreetName: 'streetName',
  UnitType: 'unitType',
  UnitNumber: 'unitNumber',
  Address2: 'address2',
  City: 'city',
  State: 'state',
  ZipCode: 'zipCode',
  MailAddress: 'mailAddress',
  MailCity: 'mailCity',
  MailState: 'mailState',
  MailZipCode: 'mailZipCode',
  PhoneNumber: 'phone',
  RegistrationDate: 'registrationDate',
  DOBYear: 'dobYear',
  StateMcdCode: 'stateMcdCode',
  McdName: 'mcdName',
  PrecinctCode: 'precinctCode',
  PrecinctName: 'precinctName',
  WardCode: 'wardCode',
  School: 'schoolDistrict',
  SchSub: 'schoolSubDistrict',
  Judicial: 'judicialDistrict',
  Legislative: 'legislativeDistrict',
  StateSen: 'stateSenateDistrict',
  Congressional: 'congressionalDistrict',
  Commissioner: 'commissionerDistrict',
  Park: 'parkDistrict',
  SoilWater: 'soilWaterDistrict',
  Hospital: 'hospitalDistrict',
  LegacyId: 'legacyId',
  PermanentAbsentee: 'permanentAbsentee',
} as const;

export const MN_ELECTION_FILE_COLUMNS = {
  VoterId: 'stateVoterId',
  ElectionDate: 'electionDate',
  ElectionDescription: 'electionDescription',
  VotingMethod: 'votingMethod',
} as const;

// Dashboard metrics
export interface DashboardMetrics {
  totalVoters: number;
  contactedThisWeek: number;
  supportDistribution: { level: number; count: number }[];
  recentActivity: ActivityItem[];
  topLists: { id: number; name: string; memberCount: number }[];
}

export interface ActivityItem {
  id: number;
  type: string;
  description: string;
  userId: number;
  userName: string;
  createdAt: string;
}

// Import job status
export const IMPORT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ImportStatus = typeof IMPORT_STATUS[keyof typeof IMPORT_STATUS];

// Email campaign status
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
} as const;

export type CampaignStatus = typeof CAMPAIGN_STATUS[keyof typeof CAMPAIGN_STATUS];
