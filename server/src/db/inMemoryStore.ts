export interface InMemoryUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'ADMIN' | 'STAFF';
  is_active: boolean;
  created_at: Date;
}

export interface InMemoryBatch {
  id: string;
  batch_name: string;
  start_year: number;
  end_year: number;
  department: string;
  created_at: Date;
}

export interface InMemorySection {
  id: string;
  batch_id: string;
  name: string;
  created_at: Date;
}

export interface InMemoryAllocationBatch {
  id: string;
  section_id: string;
  name: string;
  created_at: Date;
}

export interface InMemoryStudent {
  id: string;
  register_number: string;
  name: string;
  department: string;
  batch_id: string;
  section_id: string;
  allocation_batch_id?: string | null;
  sub_batch?: string | null;
  current_year?: string | null;
  leetcode_username?: string | null;
  created_at: Date;
}

export interface InMemoryStaffBatch {
  id: string;
  staff_id: string;
  batch_id: string;
  created_at: Date;
}

export interface InMemoryStaffSection {
  id: string;
  staff_id: string;
  section_id: string;
  allocation_batch_id?: string | null;
  assignment_mode: 'ALL' | 'SELECTED';
  created_at: Date;
}

export interface InMemoryStaffStudent {
  id: string;
  staff_id: string;
  student_id: string;
  created_at: Date;
}

export interface InMemorySnapshot {
  id: string;
  student_id: string;
  snapshot_date: Date;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  total_solved: number;
  created_at: Date;
}

export interface InMemoryReport {
  id: string;
  generated_by_staff_id: string;
  batch_id?: string | null;
  section_id?: string | null;
  report_type: string;
  from_date?: Date | null;
  to_date?: Date | null;
  file_name: string;
  generated_at: Date;
}

export interface InMemoryGoogleSheetsConfig {
  id: string;
  spreadsheet_id?: string | null;
  spreadsheet_name?: string | null;
  spreadsheet_url?: string | null;
  is_auto_sync_enabled: boolean;
  sync_students: boolean;
  sync_daily_progress: boolean;
  sync_staff_assignments: boolean;
  google_account_email?: string | null;
  refresh_token?: string | null;
  access_token?: string | null;
  token_expiry?: Date | null;
  last_sync_at?: Date | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InMemoryGoogleSheetsSyncLog {
  id: string;
  status: string;
  rows_synced: number;
  details?: string | null;
  error_message?: string | null;
  synced_at: Date;
}

export interface InMemoryGoogleSheetLink {
  id: string;
  owner_user_id: string;
  name: string;
  spreadsheet_id: string;
  spreadsheet_name?: string | null;
  spreadsheet_url?: string | null;
  webhook_url?: string | null;
  start_date?: string | null;
  academic_year?: string | null;
  department?: string | null;
  section_id?: string | null;
  allocation_batch_id?: string | null;
  batch_ids: string[];
  is_active: boolean;
  is_auto_sync_enabled: boolean;
  sync_students: boolean;
  sync_daily_progress: boolean;
  last_sync_at?: Date | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InMemoryGoogleSheetSyncLogItem {
  id: string;
  sheet_link_id: string;
  status: string;
  rows_synced: number;
  details?: string | null;
  error_message?: string | null;
  synced_at: Date;
}

class InMemoryStore {
  public users: InMemoryUser[] = [];

  public batches: InMemoryBatch[] = [];
  public sections: InMemorySection[] = [];
  public allocationBatches: InMemoryAllocationBatch[] = [];
  public students: InMemoryStudent[] = [];

  public staffBatchAssignments: InMemoryStaffBatch[] = [];
  public staffSectionAssignments: InMemoryStaffSection[] = [];
  public staffStudentAssignments: InMemoryStaffStudent[] = [];

  public snapshots: InMemorySnapshot[] = [];
  public generatedReports: InMemoryReport[] = [];

  public googleSheetsConfigs: InMemoryGoogleSheetsConfig[] = [];
  public googleSheetsSyncLogs: InMemoryGoogleSheetsSyncLog[] = [];

  public googleSheetLinks: InMemoryGoogleSheetLink[] = [];
  public googleSheetLinkLogs: InMemoryGoogleSheetSyncLogItem[] = [];
}

export const inMemoryStore = new InMemoryStore();
