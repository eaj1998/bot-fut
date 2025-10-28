import { Schema, model, Types } from "mongoose";

const UserSchema = new Schema({
    workspaceId: { type: Types.ObjectId, ref: "Workspace", index: true, required: true },
    name: { type: String, required: true },
    phoneE164: { type: String, required: true }, // +55479...
    nick: String,
    isGoalie: { type: Boolean, default: false },
}, { timestamps: true });

UserSchema.index({ workspaceId: 1, phoneE164: 1 }, { unique: true });

export const UserModel = model("User", UserSchema);
