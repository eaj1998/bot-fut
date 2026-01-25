import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { Model } from 'mongoose';
import { AuthRequest } from './auth.middleware';
import { ApiError } from './error.middleware';
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from '../../core/models/workspace-member.model';

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    // 1. Check Global Admin
    if (req.user.role === 'admin') {
      return next();
    }

    // 2. Check Workspace Admin (if workspaceId is provided in context)
    // 2. Check Workspace Admin (if workspaceId is provided in context)
    const workspaceId = (req.headers['x-workspace-id'] as string) || req.query?.workspaceId || req.body?.workspaceId;

    if (workspaceId) {
      const workspaceMemberModel = container.resolve<Model<IWorkspaceMember>>(WORKSPACE_MEMBER_MODEL_TOKEN);

      const member = await workspaceMemberModel.findOne({
        workspaceId: workspaceId,
        userId: req.user.id,
        status: 'ACTIVE'
      });

      if (member && member.roles && (member.roles.includes('admin') || member.roles.includes('owner') || member.roles.includes('ADMIN') || member.roles.includes('OWNER'))) {
        return next();
      }
    }

    // If we are here, user is not global admin and either no workspaceId provided or not workspace admin
    throw new ApiError(403, 'Admin access required');
  } catch (error) {
    next(error);
  }
};

export const requireUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  next();
};
