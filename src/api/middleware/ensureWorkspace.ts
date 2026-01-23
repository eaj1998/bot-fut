
import { Response, NextFunction } from 'express';
import { ApiError, asyncHandler } from './error.middleware';
import { AuthRequest } from './auth.middleware';
import { WorkspaceMemberModel } from '../../core/models/workspace-member.model';
import { Types } from 'mongoose';

// Extend AuthRequest to include workspace context
declare module './auth.middleware' {
    interface AuthRequest {
        workspaceId?: string;
        memberRoles?: string[];
    }
}

export const ensureWorkspace = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        const workspaceIdHeader = req.headers['x-workspace-id'] as string;
        const user = req.user;

        if (!user) {
            throw new ApiError(401, 'User not authenticated');
        }

        // If no header, maybe we can fallback to lastAccessed or just fail?
        // Requirement says: "Ele deve ler o header x-workspace-id".
        // Let's enforce it.
        if (!workspaceIdHeader) {
            throw new ApiError(400, 'Workspace ID header (x-workspace-id) is required');
        }

        if (!Types.ObjectId.isValid(workspaceIdHeader)) {
            throw new ApiError(400, 'Invalid Workspace ID format');
        }

        // Validate membership
        const member = await WorkspaceMemberModel.findOne({
            userId: user.id,
            workspaceId: workspaceIdHeader,
            status: 'ACTIVE'
        });

        if (!member) {
            throw new ApiError(403, 'User is not a member of this workspace');
        }

        // Attach to request
        req.workspaceId = workspaceIdHeader;
        req.memberRoles = member.roles;

        next();
    }
);
