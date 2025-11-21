import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { container } from 'tsyringe';
import { ConfigService } from '../../config/config.service';
import { ApiError, asyncHandler } from './error.middleware';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    phone: string;
    role: 'admin' | 'user';
  };
}

export const authenticate = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('TOKENNNN', token);
    
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    try {
      const config = container.resolve(ConfigService);
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        phone: string;
        role: 'admin' | 'user';
      };

      req.user = decoded;
      next();
    } catch (error) {
      throw new ApiError(401, 'Invalid or expired token');
    }
  },
);
