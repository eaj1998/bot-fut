import { Schema, model, Types, Model, Document } from "mongoose";

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    phoneE164?: string;
    lid?: string;
    nick?: string;
    isGoalie: boolean;
    role?: 'admin' | 'user';
    workspaceRoles?: 'ADMIN' | 'USER' | 'PLAYER';
    status?: 'active' | 'inactive';
    position?: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'STRIKER';
    playerType?: 'MENSALISTA' | 'AVULSO';
    stars?: number;
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
    position: { type: String, enum: ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'STRIKER'] },
    playerType: { type: String, enum: ['MENSALISTA', 'AVULSO'] },
    stars: { type: Number, min: 1, max: 5 },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
    lastAccessedWorkspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
}, { timestamps: true });

export const UserModel: Model<IUser> = model<IUser>("User", UserSchema);
export const USER_MODEL_TOKEN = "USER_MODEL_TOKEN";
