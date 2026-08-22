export type UserRole = 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminStats {
  role: 'ADMIN';
  totalStaff: number;
  activeStaff: number;
  totalBatches: number;
  totalStudents: number;
}

export interface StaffStats {
  role: 'STAFF';
  assignedBatchesCount: number;
  totalStudentsInAssignedBatches: number;
}

export type DashboardStats = AdminStats | StaffStats;

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
