import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { PlayerRatingService, PLAYER_RATING_SERVICE_TOKEN } from '../../services/player-rating.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';

@injectable()
export class PlayerRatingsController {
    constructor(
        @inject(PLAYER_RATING_SERVICE_TOKEN) private readonly ratingService: PlayerRatingService
    ) { }

    createRating = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const raterId = req.user!.id;
            const { targetUserId, score } = req.body;

            if (!targetUserId || !score) {
                throw new ApiError(400, 'targetUserId and score are required');
            }

            if (score < 1 || score > 5) {
                throw new ApiError(400, 'Score must be between 1 and 5');
            }

            await this.ratingService.ratePlayer(raterId, targetUserId, score);

            res.status(201).json({
                success: true,
                message: 'Avaliação enviada com sucesso'
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'Players cannot rate themselves.') {
                next(new ApiError(400, error.message));
            } else {
                next(error);
            }
        }
    };

    getUserRatings = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const raterId = req.user!.id;
            const ratings = await this.ratingService.getRatingsByRater(raterId);

            res.json({
                success: true,
                data: ratings
            });
        } catch (error) {
            next(error);
        }
    };
}
