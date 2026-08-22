import { Request, Response } from 'express';

export function checkHealth(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok' });
}
