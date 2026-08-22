import { Request, Response } from 'express';
import { authenticateUser, getUserById, updateProfile as updateProfileService } from '../services/authService.js';
import { AuthenticatedRequest } from '../types/index.js';
import { env } from '../config/env.js';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const { user, token } = await authenticateUser(email, password);

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: 'Login successful',
      user,
      token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ error: message });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await getUserById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user session' });
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, email, currentPassword, newPassword } = req.body;
    const user = await updateProfileService(req.user.userId, {
      name,
      email,
      currentPassword,
      newPassword,
    });

    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    res.status(400).json({ error: message });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  res.status(200).json({ message: 'Logout successful' });
}
