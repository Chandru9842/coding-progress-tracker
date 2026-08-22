import axios from 'axios';

const API_BASE_URL = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Client-side Memory Cache with TTL for 0ms Instant Page Loads
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cacheStore: Record<string, CacheEntry<any>> = {};
const CACHE_TTL = 30000; // 30 seconds

export function getCachedData<T>(key: string): T | null {
  const entry = cacheStore[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

export function setCachedData<T>(key: string, data: T): void {
  cacheStore[key] = { data, timestamp: Date.now() };
}

export function clearClientCache(prefix?: string): void {
  if (!prefix) {
    Object.keys(cacheStore).forEach((k) => delete cacheStore[k]);
  } else {
    Object.keys(cacheStore).forEach((k) => {
      if (k.startsWith(prefix)) delete cacheStore[k];
    });
  }
}


export interface User {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  isActive: boolean;
  is_active?: boolean;
  createdAt: string;
  created_at?: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'STAFF' | 'ADMIN';
  is_active: boolean;
  isActive: boolean;
  created_at: string;
  createdAt: string;
  assignedBatchesCount?: number;
  assignedStudentsCount?: number;
  assignedBatches: Array<{ id: string; batch_name: string }>;
  assignedSections: Array<{ id: string; name: string; batch_id: string; section_id?: string; assignment_mode?: 'ALL' | 'SELECTED' }>;
  directStudentAssignments: Array<{ id: string; name: string; register_number: string; section_id?: string }>;
  staff_batch_assignments?: Array<{ batch: { id: string; batch_name: string } }>;
  staff_section_assignments?: Array<{ section: { id: string; name: string; batch_id: string }; assignment_mode: 'ALL' | 'SELECTED' }>;
  staff_student_assignments?: Array<{ student: { id: string; name: string; register_number: string } }>;
}

export type StaffListItem = StaffUser;
export type StaffDetail = StaffUser;

export interface Batch {
  id: string;
  batch_name: string;
  start_year: number;
  end_year: number;
  department: string;
  created_at: string;
  sections?: Section[];
  _count?: {
    students: number;
  };
}

export interface AllocationBatch {
  id: string;
  section_id: string;
  name: string;
  created_at: string;
  _count?: {
    students: number;
  };
}

export interface Section {
  id: string;
  batch_id: string;
  name: string;
  created_at: string;
  allocation_batches?: AllocationBatch[];
  _count?: {
    students: number;
  };
}

export interface Student {
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
  mentor_id?: string | null;
  mentor?: { id: string; name: string; email: string } | null;
  allocation_batch?: { id: string; name: string } | null;
  created_at: string;
  batch?: { batch_name: string };
  section?: { name: string };
  snapshots?: DailySnapshot[];
}

export interface DailySnapshot {
  id: string;
  student_id: string;
  snapshot_date: string;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  total_solved: number;
  created_at: string;
}

function normalizeStaffUser(s: any): StaffUser {
  if (!s) return s;
  const assignedBatches = s.assignedBatches || s.staff_batch_assignments?.map((a: any) => a.batch || a) || [];
  const assignedSections = s.assignedSections || s.staff_section_assignments?.map((a: any) => ({
    id: a.section?.id || a.section_id || a.id,
    section_id: a.section_id || a.section?.id || a.id,
    name: a.section?.name || a.name,
    batch_id: a.section?.batch_id || a.batch_id,
    assignment_mode: a.assignment_mode || 'ALL',
  })) || [];
  const directStudentAssignments = s.directStudentAssignments || s.staff_student_assignments?.map((a: any) => a.student || a) || [];

  return {
    ...s,
    isActive: s.isActive !== undefined ? s.isActive : s.is_active,
    is_active: s.is_active !== undefined ? s.is_active : s.isActive,
    createdAt: s.createdAt || s.created_at,
    created_at: s.created_at || s.createdAt,
    assignedBatches,
    assignedSections,
    directStudentAssignments,
    assignedBatchesCount: s.assignedBatchesCount !== undefined ? s.assignedBatchesCount : assignedBatches.length,
    assignedStudentsCount: s.assignedStudentsCount !== undefined ? s.assignedStudentsCount : directStudentAssignments.length,
  };
}

export const authApi = {
  getMe: async (): Promise<User> => {
    const res = await api.get<{ user: any }>('/auth/me');
    const u = res.data.user;
    return {
      id: u.id || u.userId,
      userId: u.userId || u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive !== undefined ? u.isActive : u.is_active ?? true,
      is_active: u.is_active !== undefined ? u.is_active : u.isActive ?? true,
      createdAt: u.createdAt || u.created_at || new Date().toISOString(),
      created_at: u.created_at || u.createdAt || new Date().toISOString(),
    };
  },

  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    const res = await api.post<{ user: any; token: string }>('/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('auth_token', res.data.token);
    }
    const u = res.data.user;
    const normalizedUser: User = {
      id: u.id || u.userId,
      userId: u.userId || u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive !== undefined ? u.isActive : u.is_active ?? true,
      is_active: u.is_active !== undefined ? u.is_active : u.isActive ?? true,
      createdAt: u.createdAt || u.created_at || new Date().toISOString(),
      created_at: u.created_at || u.createdAt || new Date().toISOString(),
    };
    return { user: normalizedUser, token: res.data.token };
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
    }
  },

  updateProfile: async (data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<User> => {
    const res = await api.put<{ user: any }>('/auth/profile', data);
    const u = res.data.user;
    return {
      id: u.id || u.userId,
      userId: u.userId || u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive !== undefined ? u.isActive : u.is_active ?? true,
      is_active: u.is_active !== undefined ? u.is_active : u.isActive ?? true,
      createdAt: u.createdAt || u.created_at || new Date().toISOString(),
      created_at: u.created_at || u.createdAt || new Date().toISOString(),
    };
  },
};

export const statsApi = {
  getStats: async (): Promise<any> => {
    const res = await api.get('/stats/dashboard');
    return res.data;
  },
};

export const staffApi = {
  getStaffList: async (activeOnly?: boolean): Promise<StaffUser[]> => {
    const key = `staff_list_${activeOnly ? 'active' : 'all'}`;
    const cached = getCachedData<StaffUser[]>(key);
    if (cached) return cached;
    const res = await api.get<{ staff: any[] }>('/staff', {
      params: activeOnly ? { active: 'true' } : undefined,
    });
    const normalized = res.data.staff.map(normalizeStaffUser);
    setCachedData(key, normalized);
    return normalized;
  },

  getAllStaff: async (activeOnly?: boolean): Promise<StaffUser[]> => {
    const key = `staff_${activeOnly ? 'active' : 'all'}`;
    const cached = getCachedData<StaffUser[]>(key);
    if (cached) return cached;
    const res = await api.get<{ staff: any[] }>('/staff', {
      params: activeOnly ? { active: 'true' } : undefined,
    });
    const normalized = res.data.staff.map(normalizeStaffUser);
    setCachedData(key, normalized);
    return normalized;
  },

  getStaffDetail: async (staffId: string): Promise<StaffUser> => {
    const res = await api.get<{ staff: any }>(`/staff/${staffId}`);
    return normalizeStaffUser(res.data.staff);
  },

  getStaffById: async (staffId: string): Promise<StaffUser> => {
    const res = await api.get<{ staff: any }>(`/staff/${staffId}`);
    return normalizeStaffUser(res.data.staff);
  },

  createStaff: async (data: { name: string; email: string; password: string; isActive?: boolean }): Promise<StaffUser> => {
    clearClientCache('staff_');
    const res = await api.post<{ staff: any }>('/staff', {
      name: data.name,
      email: data.email,
      password: data.password,
    });
    const created = normalizeStaffUser(res.data.staff);
    if (data.isActive !== undefined && data.isActive !== created.is_active) {
      await api.patch(`/staff/${created.id}/status`, { isActive: data.isActive });
    }
    return created;
  },

  updateStaff: async (staffId: string, data: { name?: string; email?: string; password?: string; assignedBatchIds?: string[] }): Promise<void> => {
    clearClientCache('staff_');
    await api.patch(`/staff/${staffId}`, data);
  },

  deleteStaff: async (staffId: string): Promise<void> => {
    clearClientCache('staff_');
    await api.delete(`/staff/${staffId}`);
  },

  bulkDeleteStaff: async (staffIds: string[]): Promise<void> => {
    clearClientCache('staff_');
    await api.post('/staff/bulk-delete', { staffIds });
  },


  updateStatus: async (staffId: string, isActive: boolean): Promise<void> => {
    clearClientCache('staff_');
    await api.patch(`/staff/${staffId}/status`, { isActive });
  },


  resetPassword: async (staffId: string, password: string): Promise<void> => {
    await api.patch(`/staff/${staffId}/password`, { password });
  },

  assignBatches: async (staffId: string, batchIds: string[]): Promise<void> => {
    await api.post(`/staff/${staffId}/batches`, { batchIds });
  },

  assignSection: async (staffId: string, sectionId: string, assignmentMode: 'ALL' | 'SELECTED', studentIds?: string[]): Promise<void> => {
    await api.post(`/staff/${staffId}/sections`, { sectionId, assignmentMode });
    if (assignmentMode === 'SELECTED' && studentIds && studentIds.length > 0) {
      await api.post(`/staff/${staffId}/students`, { studentIds });
    }
  },

  removeSection: async (staffId: string, sectionId: string): Promise<void> => {
    await api.delete(`/staff/${staffId}/sections/${sectionId}`);
  },

  assignStudents: async (staffId: string, studentIds: string[]): Promise<void> => {
    await api.post(`/staff/${staffId}/students`, { studentIds });
  },

  removeStudent: async (staffId: string, studentId: string): Promise<void> => {
    await api.delete(`/staff/${staffId}/students/${studentId}`);
  },

  getAssignedScopes: async (): Promise<{ sections: Array<{ id: string; name: string; batch_id: string; academic_year: string; department: string; assignment_mode: 'ALL' | 'SELECTED'; allocation_batches: Array<{ id: string; name: string }> }> }> => {
    const res = await api.get('/staff/me/assigned-scopes');
    return res.data;
  },
};

export const batchApi = {
  getBatches: async (): Promise<Batch[]> => {
    const res = await api.get<{ batches: Batch[] }>('/batches');
    return res.data.batches;
  },

  getAllBatches: async (): Promise<Batch[]> => {
    const res = await api.get<{ batches: Batch[] }>('/batches');
    return res.data.batches;
  },

  getBatchDetail: async (batchId: string): Promise<Batch> => {
    const res = await api.get<{ batch: Batch }>(`/batches/${batchId}`);
    return res.data.batch;
  },

  getBatchById: async (batchId: string): Promise<Batch> => {
    const res = await api.get<{ batch: Batch }>(`/batches/${batchId}`);
    return res.data.batch;
  },

  createBatch: async (data: { batch_name: string; start_year: number; end_year: number; department: string }): Promise<Batch> => {
    const res = await api.post<{ batch: Batch }>('/batches', data);
    return res.data.batch;
  },

  updateBatch: async (batchId: string, data: Partial<Batch>): Promise<Batch> => {
    const res = await api.patch<{ batch: Batch }>(`/batches/${batchId}`, data);
    return res.data.batch;
  },

  deleteBatch: async (batchId: string): Promise<void> => {
    await api.delete(`/batches/${batchId}`);
  },

  createSection: async (batchId: string, name: string): Promise<Section> => {
    const res = await api.post<{ section: Section }>(`/batches/${batchId}/sections`, { name });
    return res.data.section;
  },

  updateSection: async (sectionId: string, name: string): Promise<Section> => {
    const res = await api.patch<{ section: Section }>(`/sections/${sectionId}`, { name });
    return res.data.section;
  },

  deleteSection: async (sectionId: string): Promise<void> => {
    await api.delete(`/sections/${sectionId}`);
  },

  getBatchSections: async (batchId: string): Promise<Section[]> => {
    const res = await api.get<{ sections: Section[] }>(`/batches/${batchId}/sections`);
    return res.data.sections;
  },

  getAllocationBatches: async (sectionId: string): Promise<AllocationBatch[]> => {
    const res = await api.get<{ allocation_batches: AllocationBatch[] }>(`/sections/${sectionId}/allocation-batches`);
    return res.data.allocation_batches;
  },

  createAllocationBatch: async (sectionId: string, name: string): Promise<AllocationBatch> => {
    const res = await api.post<{ allocation_batch: AllocationBatch }>(`/sections/${sectionId}/allocation-batches`, { name });
    return res.data.allocation_batch;
  },

  updateAllocationBatch: async (sectionId: string, allocationBatchId: string, name: string): Promise<AllocationBatch> => {
    const res = await api.patch<{ allocation_batch: AllocationBatch }>(`/sections/${sectionId}/allocation-batches/${allocationBatchId}`, { name });
    return res.data.allocation_batch;
  },

  deleteAllocationBatch: async (sectionId: string, allocationBatchId: string): Promise<void> => {
    await api.delete(`/sections/${sectionId}/allocation-batches/${allocationBatchId}`);
  },

  assignStudentsToAllocationBatch: async (sectionId: string, allocationBatchId: string, studentIds: string[]): Promise<void> => {
    await api.post(`/sections/${sectionId}/allocation-batches/${allocationBatchId}/students`, { student_ids: studentIds });
  },
};

export const studentApi = {
  getStudents: async (params?: {
    batchId?: string;
    sectionId?: string;
    department?: string;
    allocationBatchId?: string;
    subBatch?: string;
    mentorId?: string;
    search?: string;
  }): Promise<Student[]> => {
    const key = `students_${JSON.stringify(params || {})}`;
    const cached = getCachedData<Student[]>(key);
    if (cached) return cached;
    const res = await api.get<{ students: Student[] }>('/students', { params });
    setCachedData(key, res.data.students);
    return res.data.students;
  },

  getStudentById: async (studentId: string): Promise<Student> => {
    const res = await api.get<{ student: Student }>(`/students/${studentId}`);
    return res.data.student;
  },

  createStudent: async (data: {
    register_number: string;
    name: string;
    department: string;
    batch_id: string;
    section_id: string;
    leetcode_username?: string;
  }): Promise<Student> => {
    clearClientCache('students_');
    const res = await api.post<{ student: Student }>('/students', data);
    return res.data.student;
  },

  updateStudent: async (studentId: string, data: Partial<Student>): Promise<Student> => {
    clearClientCache('students_');
    const res = await api.patch<{ student: Student }>(`/students/${studentId}`, data);
    return res.data.student;
  },

  deleteStudent: async (studentId: string): Promise<void> => {
    clearClientCache('students_');
    await api.delete(`/students/${studentId}`);
  },

  bulkDeleteStudents: async (studentIds: string[]): Promise<void> => {
    clearClientCache('students_');
    await api.post('/students/bulk-delete', { studentIds });
  },
};



export const syncApi = {
  syncStudent: async (studentId: string): Promise<any> => {
    const res = await api.post(`/sync/student/${studentId}`);
    return res.data;
  },

  syncBatch: async (batchId: string): Promise<any> => {
    const res = await api.post(`/sync/batch/${batchId}`);
    return res.data;
  },

  syncAll: async (): Promise<any> => {
    const res = await api.post('/sync/all');
    return res.data;
  },

  getSnapshots: async (studentId: string): Promise<DailySnapshot[]> => {
    const res = await api.get<{ snapshots: DailySnapshot[] }>(`/students/${studentId}/snapshots`);
    return res.data.snapshots;
  },

  getStatus: async (): Promise<any> => {
    const res = await api.get('/sync/status');
    return res.data;
  },

  triggerPeriodicAutoSync: async (): Promise<any> => {
    const res = await api.post('/cron/periodic-sync');
    return res.data;
  },

  triggerDailyMidnightReconciliation: async (): Promise<any> => {
    const res = await api.post('/cron/daily-sync');
    return res.data;
  },
};

export interface GoogleSheetLink {
  id: string;
  owner_user_id: string;
  name: string;
  spreadsheet_id: string;
  spreadsheet_name?: string | null;
  spreadsheet_url?: string | null;
  academic_year?: string | null;
  department?: string | null;
  section_id?: string | null;
  allocation_batch_id?: string | null;
  batch_ids: string[];
  is_active: boolean;
  is_auto_sync_enabled: boolean;
  sync_students: boolean;
  sync_daily_progress: boolean;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  owner?: { id: string; name: string; email: string; role: string } | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleSheetLinkLog {
  id: string;
  sheet_link_id: string;
  status: string;
  rows_synced: number;
  details?: string | null;
  error_message?: string | null;
  synced_at: string;
}

export const googleSheetsApi = {
  getLinks: async (): Promise<GoogleSheetLink[]> => {
    const res = await api.get<{ links: GoogleSheetLink[] }>('/google-sheets/links');
    return res.data.links;
  },

  createLink: async (data: {
    name: string;
    spreadsheet_id: string;
    spreadsheet_name?: string;
    academic_year?: string;
    department?: string;
    section_id?: string;
    allocation_batch_id?: string;
    batch_ids?: string[];
    is_auto_sync_enabled?: boolean;
    sync_students?: boolean;
    sync_daily_progress?: boolean;
  }): Promise<GoogleSheetLink> => {
    const res = await api.post<{ link: GoogleSheetLink }>('/google-sheets/links', data);
    return res.data.link;
  },

  updateLink: async (
    linkId: string,
    data: {
      name?: string;
      spreadsheet_id?: string;
      spreadsheet_name?: string;
      academic_year?: string;
      department?: string;
      section_id?: string;
      allocation_batch_id?: string;
      batch_ids?: string[];
    }
  ): Promise<GoogleSheetLink> => {
    const res = await api.put<{ link: GoogleSheetLink }>(`/google-sheets/links/${linkId}`, data);
    return res.data.link;
  },

  getLinkDetail: async (linkId: string): Promise<GoogleSheetLink> => {
    const res = await api.get<{ link: GoogleSheetLink }>(`/google-sheets/links/${linkId}`);
    return res.data.link;
  },

  triggerSync: async (linkId: string): Promise<any> => {
    const res = await api.post(`/google-sheets/links/${linkId}/sync`);
    return res.data;
  },

  syncAllLinks: async (): Promise<any> => {
    const res = await api.post('/google-sheets/links/sync-all');
    return res.data;
  },

  deleteLink: async (linkId: string): Promise<void> => {
    await api.delete(`/google-sheets/links/${linkId}`);
  },

  getLogs: async (linkId: string): Promise<GoogleSheetLinkLog[]> => {
    const res = await api.get<{ logs: GoogleSheetLinkLog[] }>(`/google-sheets/links/${linkId}/logs`);
    return res.data.logs;
  },
};
