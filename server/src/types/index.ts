import { Request } from 'express';

export type UserRole = 'ADMIN' | 'STAFF';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface AdminStatsResponse {
  role: 'ADMIN';
  totalStaff: number;
  activeStaff: number;
  totalBatches: number;
  totalStudents: number;
}

export interface StaffStatsResponse {
  role: 'STAFF';
  assignedBatchesCount: number;
  totalStudentsInAssignedBatches: number;
}

export type StatsResponse = AdminStatsResponse | StaffStatsResponse;
