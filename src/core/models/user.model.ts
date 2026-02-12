import { Schema, model, Types, Model, Document } from "mongoose";

export enum PlayerPosition {
    GOL = 'GOL',
    ZAG = 'ZAG',
    LAT = 'LAT',
    MEI = 'MEI',
    ATA = 'ATA'
}

export interface IUserProfile {
    mainPosition: PlayerPosition;
    secondaryPositions?: PlayerPosition[];
    dominantFoot?: 'LEFT' | 'RIGHT' | 'BOTH';
    rating: number;
    ratingCount: number;
}

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    phoneE164?: string;
    lid?: string;
    nick?: string;
    isGoalie: boolean;
    role?: 'admin' | 'user';
    workspaceRoles?: string[];
    status?: 'active' | 'inactive';
    position?: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'STRIKER';
    playerType?: 'MENSALISTA' | 'AVULSO';
    stars?: number;
    workspaceId?: Types.ObjectId;
    lastAccessedWorkspaceId?: Types.ObjectId;
    profile?: IUserProfile;
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
    profile: {
        mainPosition: { type: String, enum: Object.values(PlayerPosition) },
        secondaryPositions: [{ type: String, enum: Object.values(PlayerPosition) }],
        dominantFoot: { type: String, enum: ['LEFT', 'RIGHT', 'BOTH'] },
        rating: { type: Number, default: 3.0 },
        ratingCount: { type: Number, default: 0 }
    }
}, { timestamps: true });

export const UserModel: Model<IUser> = model<IUser>("User", UserSchema);
export const USER_MODEL_TOKEN = "USER_MODEL_TOKEN";
