import { inject, injectable, singleton } from "tsyringe";
import { Model, FilterQuery } from "mongoose";
import { USER_MODEL_TOKEN, IUser } from "../models/user.model";
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from "../models/workspace-member.model";

interface ListPlayersOptions {
    workspaceId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
    data: T[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
}

@singleton()
@injectable()
export class PlayerRepository {
    constructor(
        @inject(USER_MODEL_TOKEN) private readonly userModel: Model<IUser>,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>
    ) { }

    async listPlayers(options: ListPlayersOptions): Promise<PaginatedResult<IUser>> {
        const { workspaceId, page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = options;

        // 1. Find relevant user IDs from workspace members
        const memberQuery: FilterQuery<IWorkspaceMember> = { workspaceId };

        if (status && status !== 'all') {
            // Assuming status on member reflects "active/inactive" for the workspace
            // If filter is strictly for User status, we might need to adjust.
            // But usually workspace context matters most.
            // For now, let's filter members if status is compatible with member status,
            // or fetch all and let user query filter.
            // The prompt implies we want to search PLAYERS.
            if (['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status.toUpperCase())) {
                memberQuery.status = status.toUpperCase();
            }
        }

        const members = await this.workspaceMemberModel.find(memberQuery).select('userId status');
        const userIds = members.map(m => m.userId);

        // 2. Build User Query
        const query: FilterQuery<IUser> = {
            _id: { $in: userIds }
        };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { nick: { $regex: search, $options: 'i' } },
                { phoneE164: { $regex: search, $options: 'i' } } // Optional: search by phone
            ];
        }

        // 3. Pagination & Count in Parallel
        const skip = (page - 1) * limit;
        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const [users, totalCount] = await Promise.all([
            this.userModel.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            this.userModel.countDocuments(query)
        ]);

        return {
            data: users as unknown as IUser[],
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit)
        };
    }
}

export const PLAYER_REPOSITORY_TOKEN = 'PLAYER_REPOSITORY_TOKEN';
