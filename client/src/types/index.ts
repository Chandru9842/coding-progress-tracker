export type UserRole = 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface LeetCodeDashboardStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  todaySolved: number;
  activeCoders: number;
  totalCoders: number;
  topCoders: Array<{
    id: string;
    name: string;
    register_number: string;
    leetcode_username: string;
    department?: string;
    batch_name?: string;
    total_solved: number;
    easy_solved: number;
    medium_solved: number;
    hard_solved: number;
  }>;
}

export interface AdminStats {
  role: 'ADMIN';
  totalStaff: number;
  activeStaff: number;
  totalBatches: number;
  totalStudents: number;
  leetcodeStats?: LeetCodeDashboardStats;
}

export interface StaffStats {
  role: 'STAFF';
  assignedBatchesCount: number;
  totalStudentsInAssignedBatches: number;
  leetcodeStats?: LeetCodeDashboardStats;
}

export type DashboardStats = AdminStats | StaffStats;

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
