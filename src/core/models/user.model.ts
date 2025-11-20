import { Schema, model, Types, Model } from "mongoose";

export interface UserDoc extends Document {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId; 
    name: string;
    phoneE164: string;           
    nick?: string;
    isGoalie: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema({
    workspaceId: { type: Types.ObjectId, ref: "Workspace", index: true, required: true },
    name: { type: String, required: true },
    phoneE164: { type: String, required: true }, 
    nick: String,
    isGoalie: { type: Boolean, default: false },
}, { timestamps: true });

UserSchema.index({ workspaceId: 1, phoneE164: 1 }, { unique: true });

export const UserModel: Model<UserDoc> = model<UserDoc>("User", UserSchema);

export const USER_MODEL_TOKEN = "USER_MODEL_TOKEN";