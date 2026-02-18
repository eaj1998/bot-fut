import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { container } from 'tsyringe';
import { ConfigService } from '../../config/config.service';
import { ApiError, asyncHandler } from './error.middleware';
import { WorkspaceMemberRepository, WORKSPACE_MEMBER_REPOSITORY_TOKEN } from '../../core/repositories/workspace-member.repository';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    phone: string;
    role: 'admin' | 'user';
  };
  workspaceId?: string;
  memberRoles?: string[];
}

export const authenticate = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

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

      // Extract workspaceId from header
      const workspaceId = req.headers['x-workspace-id'] as string;
      if (workspaceId) {
        // Validate membership
        const workspaceMemberRepo = container.resolve<WorkspaceMemberRepository>(WORKSPACE_MEMBER_REPOSITORY_TOKEN);
        const member = await workspaceMemberRepo.findByWorkspaceAndUser(workspaceId, decoded.id);

        if (!member) {
          // If user is global admin, maybe allow? For now, strict check.
          // Or check if it's the specific "Workspace ID não encontrado" usage.
          // But here we just don't set it or throw.
          // If the header is explicitly sent, we should probably error if invalid.
          throw new ApiError(403, 'Você não é membro deste workspace');
        }

        req.workspaceId = workspaceId;
        req.memberRoles = member.roles;
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, 'Invalid or expired token');
    }
  },
);
