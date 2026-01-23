import { Schema, model, Types, Model, Document } from "mongoose";

export interface IWorkspaceMember extends Document {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId;
    userId: Types.ObjectId;
    roles: string[];
    nickname?: string;
    status: 'ACTIVE' | 'INVITED';
    joinedAt: Date;
}

const WorkspaceMemberSchema = new Schema({
    workspaceId: { type: Types.ObjectId, ref: "Workspace", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    roles: [{ type: String }],
    nickname: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INVITED'], default: 'ACTIVE' },
}, { timestamps: true });

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMemberModel: Model<IWorkspaceMember> = model<IWorkspaceMember>("WorkspaceMember", WorkspaceMemberSchema);
export const WORKSPACE_MEMBER_MODEL_TOKEN = "WORKSPACE_MEMBER_MODEL_TOKEN";
