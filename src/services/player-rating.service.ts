import { inject, injectable } from "tsyringe";
import { Model, Types } from "mongoose";
import { PLAYER_RATING_MODEL_TOKEN, IPlayerRating } from "../core/models/player-rating.model";
import { USER_MODEL_TOKEN, IUser } from "../core/models/user.model";

@injectable()
export class PlayerRatingService {
    constructor(
        @inject(PLAYER_RATING_MODEL_TOKEN) private readonly ratingModel: Model<IPlayerRating>,
        @inject(USER_MODEL_TOKEN) private readonly userModel: Model<IUser>
    ) { }

    async ratePlayer(raterId: string, ratedId: string, score: number): Promise<void> {
        if (raterId === ratedId) {
            throw new Error("Players cannot rate themselves.");
        }

        await this.ratingModel.updateOne(
            { raterId: new Types.ObjectId(raterId), ratedId: new Types.ObjectId(ratedId) },
            { $set: { score } },
            { upsert: true }
        );

        await this.updateUserRating(ratedId);
    }

    async getRatingsByRater(raterId: string): Promise<IPlayerRating[]> {
        return this.ratingModel.find({ raterId: new Types.ObjectId(raterId) })
            .select('ratedId score')
            .lean() as unknown as IPlayerRating[];
    }

    private async updateUserRating(ratedId: string): Promise<void> {
        const stats = await this.ratingModel.aggregate([
            { $match: { ratedId: new Types.ObjectId(ratedId) } },
            {
                $group: {
                    _id: "$ratedId",
                    averageRating: { $avg: "$score" },
                    totalRatings: { $sum: 1 }
                }
            }
        ]);

        if (stats.length > 0) {
            const { averageRating, totalRatings } = stats[0];
            await this.userModel.findByIdAndUpdate(ratedId, {
                $set: {
                    "profile.rating": parseFloat(averageRating.toFixed(2)),
                    "profile.ratingCount": totalRatings
                }
            });
        }
    }
}

export const PLAYER_RATING_SERVICE_TOKEN = "PLAYER_RATING_SERVICE_TOKEN";
