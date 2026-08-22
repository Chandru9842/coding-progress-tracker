import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticatedRequest, JwtPayload } from '../types/index.js';

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    let token: string | undefined = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return;
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }

  next();
};

export const requireStaff = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }

  if (req.user.role !== 'STAFF' && req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Faculty access required' });
    return;
  }

  next();
};
