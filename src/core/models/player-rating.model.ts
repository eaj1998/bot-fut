import { Schema, model, Types, Model, Document } from "mongoose";

export interface IPlayerRating extends Document {
    workspaceId: Types.ObjectId;
    raterId: Types.ObjectId;
    ratedId: Types.ObjectId;
    score: number;
    createdAt: Date;
    updatedAt: Date;
}

const PlayerRatingSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    raterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ratedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true });

PlayerRatingSchema.index({ workspaceId: 1, raterId: 1, ratedId: 1 }, { unique: true });

export const PlayerRatingModel: Model<IPlayerRating> = model<IPlayerRating>("PlayerRating", PlayerRatingSchema);
export const PLAYER_RATING_MODEL_TOKEN = "PLAYER_RATING_MODEL_TOKEN";
