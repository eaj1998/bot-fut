
import { TeamBalancerService } from '../src/services/team-balancer.service';
import { IUser, PlayerPosition } from '../src/core/models/user.model';
import { Types } from 'mongoose';

const balancer = new TeamBalancerService();

const mockUser = (name: string, position?: PlayerPosition, rating?: number): IUser => {
    return {
        _id: new Types.ObjectId(),
        name,
        isGoalie: position === PlayerPosition.GOL,
        profile: position ? {
            mainPosition: position,
            rating: rating || 3,
            ratingCount: 1
        } : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any;
};

// Create a mix of regular players and guests (no profile)
const players: IUser[] = [
    mockUser('Regular 1', PlayerPosition.ATA, 4.5),
    mockUser('Regular 2', PlayerPosition.ZAG, 4.0),
    mockUser('Guest 1'), // No profile -> Should be MEI, 3.0
    mockUser('Guest 2'), // No profile -> Should be MEI, 3.0
    mockUser('Regular 3', PlayerPosition.GOL, 5.0),
    mockUser('Guest 3'), // No profile -> Should be MEI, 3.0
];

console.log('--- Testing Team Balancer with Guests ---');
try {
    const result = balancer.balanceTeams(players);
    console.log('\nTeam A:', result.teamA.map(p => `${p.name} (${p.profile?.mainPosition || 'None'})`).join(', '));
    console.log('Team B:', result.teamB.map(p => `${p.name} (${p.profile?.mainPosition || 'None'})`).join(', '));
    console.log('\nStats:', result.stats);

    const allPlayers = [...result.teamA, ...result.teamB];
    if (allPlayers.length !== players.length) {
        console.error('ERROR: Not all players were assigned!');
    } else {
        console.log('\nSUCCESS: All players assigned.');
    }

} catch (error) {
    console.error('ERROR:', error);
}
