import { inject, singleton } from "tsyringe";
import { Model, Types } from "mongoose";
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from "../models/workspace-member.model";

@singleton()
export class WorkspaceMemberRepository {
    constructor(
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly model: Model<IWorkspaceMember>
    ) { }

    async findByWorkspaceAndUser(workspaceId: string | Types.ObjectId, userId: string | Types.ObjectId): Promise<IWorkspaceMember | null> {
        return this.model.findOne({ workspaceId, userId }).exec();
    }

    async findByUserId(userId: string | Types.ObjectId): Promise<IWorkspaceMember[]> {
        return this.model.find({ userId }).exec();
    }

    async findByWorkspaceId(workspaceId: string | Types.ObjectId): Promise<IWorkspaceMember[]> {
        return this.model.find({ workspaceId }).exec();
    }
}

export const WORKSPACE_MEMBER_REPOSITORY_TOKEN = Symbol("WORKSPACE_MEMBER_REPOSITORY_TOKEN");
