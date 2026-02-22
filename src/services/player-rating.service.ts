import { inject, injectable } from "tsyringe";
import { Model, Types } from "mongoose";
import { PLAYER_RATING_MODEL_TOKEN, IPlayerRating } from "../core/models/player-rating.model";
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from "../core/models/workspace-member.model";

@injectable()
export class PlayerRatingService {
    constructor(
        @inject(PLAYER_RATING_MODEL_TOKEN) private readonly ratingModel: Model<IPlayerRating>,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>
    ) { }

    async ratePlayer(workspaceId: string, raterId: string, ratedId: string, score: number): Promise<void> {
        if (raterId === ratedId) {
            throw new Error("Players cannot rate themselves.");
        }

        await this.ratingModel.updateOne(
            {
                workspaceId: new Types.ObjectId(workspaceId),
                raterId: new Types.ObjectId(raterId),
                ratedId: new Types.ObjectId(ratedId)
            },
            { $set: { score } },
            { upsert: true }
        );

        await this.updateUserRating(workspaceId, ratedId);
    }

    async getRatingsByRater(workspaceId: string, raterId: string): Promise<IPlayerRating[]> {
        return this.ratingModel.find({
            workspaceId: new Types.ObjectId(workspaceId),
            raterId: new Types.ObjectId(raterId)
        })
            .select('ratedId score')
            .lean() as unknown as IPlayerRating[];
    }

    private async updateUserRating(workspaceId: string, ratedId: string): Promise<void> {
        const stats = await this.ratingModel.aggregate([
            {
                $match: {
                    workspaceId: new Types.ObjectId(workspaceId),
                    ratedId: new Types.ObjectId(ratedId)
                }
            },
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
            await this.workspaceMemberModel.updateOne(
                {
                    workspaceId: new Types.ObjectId(workspaceId),
                    userId: new Types.ObjectId(ratedId)
                },
                {
                    $set: {
                        rating: parseFloat(averageRating.toFixed(2)),
                        ratingCount: totalRatings
                    }
                }
            );
        }
    }
}

export const PLAYER_RATING_SERVICE_TOKEN = "PLAYER_RATING_SERVICE_TOKEN";
