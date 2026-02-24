import { injectable } from "tsyringe";
import { IUser, PlayerPosition } from "../core/models/user.model";

interface IPlayerWithRating extends IUser {
    workspaceRating?: number;
}

interface TeamResult {
    teamA: IPlayerWithRating[];
    teamB: IPlayerWithRating[];
    stats: {
        avgA: number;
        avgB: number;
        totalA: number;
        totalB: number;
    };
}

@injectable()
export class TeamBalancerService {

    balanceTeams(players: IPlayerWithRating[]): TeamResult {
        // Inicializa buckets
        const goalkeepers: IPlayerWithRating[] = [];
        const defenders: IPlayerWithRating[] = [];
        const midfielders: IPlayerWithRating[] = [];
        const forwards: IPlayerWithRating[] = [];

        players.forEach(player => {
            const pos = player.profile ? player.profile.mainPosition : PlayerPosition.MEI;

            if (pos === PlayerPosition.GOL) {
                goalkeepers.push(player);
            } else if (pos === PlayerPosition.ZAG || pos === PlayerPosition.LAT) {
                defenders.push(player);
            } else if (pos === PlayerPosition.MEI) {
                midfielders.push(player);
            } else if (pos === PlayerPosition.ATA) {
                forwards.push(player);
            } else {
                midfielders.push(player);
            }
        });

        const sortFn = (a: IPlayerWithRating, b: IPlayerWithRating) => {
            const ratingA = a.workspaceRating ?? 3.0;
            const ratingB = b.workspaceRating ?? 3.0;
            return ratingB - ratingA;
        };
        goalkeepers.sort(sortFn);
        defenders.sort(sortFn);
        midfielders.sort(sortFn);
        forwards.sort(sortFn);

        const teamA: IPlayerWithRating[] = [];
        const teamB: IPlayerWithRating[] = [];

        // Distribui jogadores usando alocação dinâmica
        this.dynamicAllocate(goalkeepers, teamA, teamB);
        this.dynamicAllocate(defenders, teamA, teamB);
        this.dynamicAllocate(midfielders, teamA, teamB);
        this.dynamicAllocate(forwards, teamA, teamB);

        // Verificação final: garante que a diferença de tamanho seja no máximo 1
        this.balanceTeamSizes(teamA, teamB);

        return {
            teamA,
            teamB,
            stats: {
                avgA: this.calculateAverage(teamA),
                avgB: this.calculateAverage(teamB),
                totalA: teamA.length,
                totalB: teamB.length
            }
        };
    }

    /**
     * Distribui jogadores dinamicamente priorizando equilíbrio numérico e de rating
     */
    private dynamicAllocate(players: IPlayerWithRating[], teamA: IPlayerWithRating[], teamB: IPlayerWithRating[]) {
        players.forEach(player => {
            const teamASize = teamA.length;
            const teamBSize = teamB.length;
            const teamARating = this.calculateTotalRating(teamA);
            const teamBRating = this.calculateTotalRating(teamB);

            if (teamASize < teamBSize - 1) {
                teamA.push(player);
            } else if (teamBSize < teamASize - 1) {
                teamB.push(player);
            }
            else if (teamASize === teamBSize) {
                if (teamARating <= teamBRating) {
                    teamA.push(player);
                } else {
                    teamB.push(player);
                }
            } else if (teamASize < teamBSize) {
                teamA.push(player);
            } else {
                teamB.push(player);
            }
        });
    }

    /**
     * Balanceamento final: garante que a diferença de tamanho seja no máximo 1
     */
    private balanceTeamSizes(teamA: IPlayerWithRating[], teamB: IPlayerWithRating[]) {
        while (Math.abs(teamA.length - teamB.length) > 1) {
            if (teamA.length > teamB.length) {
                const playerToMove = this.findLowestRatedPlayer(teamA);
                if (playerToMove) {
                    const index = teamA.indexOf(playerToMove);
                    teamA.splice(index, 1);
                    teamB.push(playerToMove);
                }
            } else {
                const playerToMove = this.findLowestRatedPlayer(teamB);
                if (playerToMove) {
                    const index = teamB.indexOf(playerToMove);
                    teamB.splice(index, 1);
                    teamA.push(playerToMove);
                }
            }
        }
    }

    /**
     * Encontra o jogador com menor rating em um time
     */
    private findLowestRatedPlayer(team: IPlayerWithRating[]): IPlayerWithRating | null {
        if (team.length === 0) return null;

        return team.reduce((lowest, player) => {
            const lowestRating = lowest.workspaceRating ?? 3.0;
            const playerRating = player.workspaceRating ?? 3.0;
            return playerRating < lowestRating ? player : lowest;
        });
    }

    /**
     * Calcula o rating total de um time
     */
    private calculateTotalRating(team: IPlayerWithRating[]): number {
        return team.reduce((acc, p) => acc + (p.workspaceRating ?? 3.0), 0);
    }

    private calculateAverage(team: IPlayerWithRating[]): number {
        if (team.length === 0) return 0;
        const sum = team.reduce((acc, p) => acc + (p.workspaceRating ?? 3.0), 0);
        return parseFloat((sum / team.length).toFixed(2));
    }
}

export const TEAM_BALANCER_SERVICE_TOKEN = "TEAM_BALANCER_SERVICE_TOKEN";
