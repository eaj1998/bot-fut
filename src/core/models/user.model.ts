import { Schema, model, Types, Model, Document } from "mongoose";

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    phoneE164?: string;
    lid?: string;
    nick?: string;
    isGoalie: boolean;
    role?: 'admin' | 'user';
    status?: 'active' | 'inactive';
    /** @deprecated Use WorkspaceMember instead */
    workspaceId?: Types.ObjectId;
    lastAccessedWorkspaceId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema({
    name: { type: String, required: true },
    phoneE164: { type: String, unique: true, sparse: true },
    lid: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    nick: String,
    isGoalie: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' }, // Deprecated
    lastAccessedWorkspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
}, { timestamps: true });

export const UserModel: Model<IUser> = model<IUser>("User", UserSchema);
export const USER_MODEL_TOKEN = "USER_MODEL_TOKEN";
