import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { connectMongo } from '../src/infra/database/mongoose.connection';
import { ConfigService } from '../src/config/config.service';

// Import models
import { USER_MODEL_TOKEN, UserModel, IUser, PlayerPosition } from '../src/core/models/user.model';
import { WORKSPACE_MODEL_TOKEN, WorkspaceModel } from '../src/core/models/workspace.model';
import { GAME_MODEL_TOKEN, GameModel } from '../src/core/models/game.model';

// Import services
import { TeamBalancerService, TEAM_BALANCER_SERVICE_TOKEN } from '../src/services/team-balancer.service';
import { UserService, USER_SERVICE_TOKEN } from '../src/services/user.service';

// Import repositories
import { UserRepository } from '../src/core/repositories/user.repository';

dotenv.config();

/**
 * Attack Heavy Distribution:
 * - 10 Attackers (ATA)
 * - 2 Midfielders (MEI)
 * - 2 Defenders (ZAG)
 * - 2 Goalkeepers (GOL)
 * Total: 16 players
 */
const ATTACK_HEAVY_DISTRIBUTION = {
    [PlayerPosition.ATA]: 10,
    [PlayerPosition.MEI]: 2,
    [PlayerPosition.ZAG]: 2,
    [PlayerPosition.GOL]: 2
};

/**
 * Generates a random rating between 1 and 5
 */
function randomRating(): number {
    return Math.round((Math.random() * 4 + 1) * 10) / 10;
}

/**
 * Assigns positions according to attack-heavy distribution
 */
function assignAttackHeavyPositions(users: IUser[]): Map<string, PlayerPosition> {
    const positions: PlayerPosition[] = [];

    // Build position array based on distribution
    Object.entries(ATTACK_HEAVY_DISTRIBUTION).forEach(([pos, count]) => {
        for (let i = 0; i < count; i++) {
            positions.push(pos as PlayerPosition);
        }
    });

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Assign to users
    const assignmentMap = new Map<string, PlayerPosition>();
    users.forEach((user, index) => {
        if (index < positions.length) {
            assignmentMap.set(user._id.toString(), positions[index]);
        }
    });

    return assignmentMap;
}

const main = async () => {
    console.log('🚀 Starting Attack-Heavy Imbalance Test...\n');
    console.log('📊 Position Distribution:');
    console.log('   - Attackers (ATA): 10');
    console.log('   - Midfielders (MEI): 2');
    console.log('   - Defenders (ZAG): 2');
    console.log('   - Goalkeepers (GOL): 2');
    console.log('   - Total: 16 players\n');

    try {
        // Connect to database
        const config = container.resolve(ConfigService);
        await connectMongo(config.database.mongoUri, config.database.mongoDb);
        console.log('✅ Connected to MongoDB\n');

        // Register models
        container.register(USER_MODEL_TOKEN, { useValue: UserModel });
        container.register(WORKSPACE_MODEL_TOKEN, { useValue: WorkspaceModel });
        container.register(GAME_MODEL_TOKEN, { useValue: GameModel });

        // Register repositories
        container.register('USER_REPOSITORY_TOKEN', { useClass: UserRepository });

        // Register services
        container.register(TEAM_BALANCER_SERVICE_TOKEN, { useClass: TeamBalancerService });
        container.register(USER_SERVICE_TOKEN, { useClass: UserService });

        // ===== STEP 1: Fetch 16 active users =====
        console.log('📋 STEP 1: Fetching 16 active users...');
        const users = await UserModel.find({ status: 'active' }).limit(16).exec();

        if (users.length < 16) {
            console.warn(`⚠️  Only found ${users.length} active users (need 16). Proceeding with available users...\n`);
        } else {
            console.log(`✅ Found ${users.length} active users\n`);
        }

        // ===== STEP 2: Assign attack-heavy positions =====
        console.log('🎯 STEP 2: Assigning attack-heavy positions...');
        const positionMap = assignAttackHeavyPositions(users);

        // Count positions for verification
        const positionCounts: Record<string, number> = {};

        for (const user of users) {
            const position = positionMap.get(user._id.toString()) || PlayerPosition.ATA;
            const rating = randomRating();

            if (!user.profile) {
                user.profile = {
                    mainPosition: position,
                    secondaryPositions: [],
                    dominantFoot: ['LEFT', 'RIGHT', 'BOTH'][Math.floor(Math.random() * 3)] as any,
                    rating: rating,
                    ratingCount: 0
                };
            } else {
                user.profile.mainPosition = position;
                user.profile.rating = rating;
            }

            await user.save();

            // Count positions
            positionCounts[position] = (positionCounts[position] || 0) + 1;

            console.log(`  ✓ ${user.name.padEnd(20)} ${position.padEnd(5)} Rating: ${rating.toFixed(1)}`);
        }

        console.log('\n📊 Position Summary:');
        Object.entries(positionCounts).forEach(([pos, count]) => {
            console.log(`   ${pos}: ${count} players`);
        });
        console.log('✅ Positions assigned\n');

        // ===== STEP 3: Get or create workspace =====
        console.log('🏢 STEP 3: Finding workspace...');
        let workspace = await WorkspaceModel.findOne().exec();

        if (!workspace) {
            console.log('  Creating new workspace...');
            workspace = await WorkspaceModel.create({
                name: 'Imbalance Test Workspace',
                slug: 'imbalance-test',
                timezone: 'America/Sao_Paulo',
                settings: {
                    maxPlayers: 16,
                    pricePerGameCents: 1400
                }
            });
        }
        console.log(`✅ Using workspace: ${workspace.name}\n`);

        // ===== STEP 4: Create game =====
        console.log('⚽ STEP 4: Creating test game...');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(21, 0, 0, 0);

        const game = await GameModel.create({
            workspaceId: workspace._id,
            chatId: 'test-imbalance-chat',
            date: tomorrow,
            title: 'Attack-Heavy Imbalance Test',
            location: 'Test Field',
            priceCents: 1400,
            maxPlayers: 16,
            status: 'open',
            roster: {
                goalieSlots: 2,
                players: users.map((user, index) => ({
                    slot: index + 1,
                    userId: user._id,
                    name: user.name,
                    paid: false,
                    guest: false,
                    phoneE164: user.phoneE164
                })),
                waitlist: [],
                outlist: []
            }
        });

        console.log(`✅ Game created: ${game.title}`);
        console.log(`   Date: ${game.date.toLocaleString('pt-BR')}`);
        console.log(`   Players: ${game.roster.players.length}\n`);

        // ===== STEP 5: Generate teams using TeamBalancerService =====
        console.log('⚡ STEP 5: Generating balanced teams...\n');
        const teamBalancer = container.resolve<TeamBalancerService>(TEAM_BALANCER_SERVICE_TOKEN);

        // Get confirmed players with full user data
        const confirmedUserIds = game.roster.players
            .filter(p => p.userId)
            .map(p => p.userId!.toString());

        const confirmedUsers = await UserModel.find({
            _id: { $in: confirmedUserIds }
        }).exec();

        const result = teamBalancer.balanceTeams(confirmedUsers);

        // ===== STEP 6: Display results =====
        console.log('═'.repeat(80));
        console.log('🏆 TEAM BALANCING RESULTS');
        console.log('═'.repeat(80));

        console.log(`\n🔵 TEAM A (${result.teamA.length} players) - Avg Rating: ${result.stats.avgA}`);
        console.log('─'.repeat(80));
        result.teamA.forEach((player, index) => {
            const pos = player.profile?.mainPosition || 'N/A';
            const rating = player.profile?.rating || 0;
            console.log(`${(index + 1).toString().padStart(2)}. ${player.name.padEnd(25)} ${pos.padEnd(5)} Rating: ${rating.toFixed(1)}`);
        });

        console.log(`\n🔴 TEAM B (${result.teamB.length} players) - Avg Rating: ${result.stats.avgB}`);
        console.log('─'.repeat(80));
        result.teamB.forEach((player, index) => {
            const pos = player.profile?.mainPosition || 'N/A';
            const rating = player.profile?.rating || 0;
            console.log(`${(index + 1).toString().padStart(2)}. ${player.name.padEnd(25)} ${pos.padEnd(5)} Rating: ${rating.toFixed(1)}`);
        });

        console.log('\n' + '═'.repeat(80));
        console.log('📊 BALANCE ANALYSIS');
        console.log('═'.repeat(80));

        const sizeDiff = Math.abs(result.teamA.length - result.teamB.length);
        const ratingDiff = Math.abs(result.stats.avgA - result.stats.avgB);

        console.log(`\n✓ Team Size Balance:`);
        console.log(`  Team A: ${result.teamA.length} players`);
        console.log(`  Team B: ${result.teamB.length} players`);
        console.log(`  Difference: ${sizeDiff} player(s) ${sizeDiff <= 1 ? '✅ PASS' : '❌ FAIL'}`);

        console.log(`\n✓ Rating Balance:`);
        console.log(`  Team A Avg: ${result.stats.avgA}`);
        console.log(`  Team B Avg: ${result.stats.avgB}`);
        console.log(`  Difference: ${ratingDiff.toFixed(2)} ${ratingDiff <= 0.5 ? '✅ EXCELLENT' : ratingDiff <= 1.0 ? '✅ GOOD' : '⚠️  ACCEPTABLE'}`);

        // Position distribution per team
        const teamAPositions: Record<string, number> = {};
        const teamBPositions: Record<string, number> = {};

        result.teamA.forEach(p => {
            const pos = p.profile?.mainPosition || 'N/A';
            teamAPositions[pos] = (teamAPositions[pos] || 0) + 1;
        });

        result.teamB.forEach(p => {
            const pos = p.profile?.mainPosition || 'N/A';
            teamBPositions[pos] = (teamBPositions[pos] || 0) + 1;
        });

        console.log(`\n✓ Position Distribution:`);
        console.log(`  Team A: ${JSON.stringify(teamAPositions)}`);
        console.log(`  Team B: ${JSON.stringify(teamBPositions)}`);

        console.log('\n' + '═'.repeat(80));
        console.log('✨ Test completed successfully!');
        console.log(`\n💡 Conclusion: The algorithm ${sizeDiff <= 1 ? 'successfully' : 'failed to'} maintain numerical balance`);
        console.log(`   even with an extreme attack-heavy distribution (10 ATA, 2 MEI, 2 ZAG, 2 GOL).\n`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }

    process.exit(0);
};

main();
