import { Schema, model, Types, Model, Document } from "mongoose";

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    phoneE164: string;
    nick?: string;
    isGoalie: boolean;
    role?: 'admin' | 'user'; 
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema({
    name: { type: String, required: true },
    phoneE164: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    nick: String,
    isGoalie: { type: Boolean, default: false },
}, { timestamps: true });

export const UserModel: Model<IUser> = model<IUser>("User", UserSchema);
export const USER_MODEL_TOKEN = "USER_MODEL_TOKEN";
