import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { connectMongo } from '../src/infra/database/mongoose.connection';
import { ConfigService } from '../src/config/config.service';

// Import models
import { USER_MODEL_TOKEN, UserModel, IUser, PlayerPosition } from '../src/core/models/user.model';
import { WORKSPACE_MODEL_TOKEN, WorkspaceModel } from '../src/core/models/workspace.model';
import { GAME_MODEL_TOKEN, GameModel } from '../src/core/models/game.model';
import { PLAYER_RATING_MODEL_TOKEN, PlayerRatingModel } from '../src/core/models/player-rating.model';

// Import services
import { PlayerRatingService, PLAYER_RATING_SERVICE_TOKEN } from '../src/services/player-rating.service';

// Import repositories
import { UserRepository } from '../src/core/repositories/user.repository';

dotenv.config();

interface PositionDistribution {
    [PlayerPosition.GOL]: number;
    [PlayerPosition.ZAG]: number;
    [PlayerPosition.LAT]: number;
    [PlayerPosition.MEI]: number;
    [PlayerPosition.ATA]: number;
}

const POSITION_DISTRIBUTION: PositionDistribution = {
    [PlayerPosition.GOL]: 2,
    [PlayerPosition.ZAG]: 3,
    [PlayerPosition.LAT]: 2,
    [PlayerPosition.MEI]: 5,
    [PlayerPosition.ATA]: 4
};

/**
 * Distributes positions randomly among users
 */
function assignPositions(users: IUser[]): Map<string, PlayerPosition> {
    const positions: PlayerPosition[] = [];

    // Build position array based on distribution
    const positionKeys = [PlayerPosition.GOL, PlayerPosition.ZAG, PlayerPosition.LAT, PlayerPosition.MEI, PlayerPosition.ATA];
    positionKeys.forEach(pos => {
        for (let i = 0; i < POSITION_DISTRIBUTION[pos]; i++) {
            positions.push(pos);
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

/**
 * Generates a random rating between 2.5 and 4.5
 */
function randomRating(): number {
    return Math.round((Math.random() * 2 + 2.5) * 10) / 10;
}

/**
 * Generates a random score between 1 and 5
 */
function randomScore(): number {
    return Math.floor(Math.random() * 5) + 1;
}

const main = async () => {
    console.log('🚀 Starting FairPlay Test Script...\n');

    try {
        // Connect to database
        const config = container.resolve(ConfigService);
        await connectMongo(config.database.mongoUri, config.database.mongoDb);
        console.log('✅ Connected to MongoDB\n');

        // Register models
        container.register(USER_MODEL_TOKEN, { useValue: UserModel });
        container.register(WORKSPACE_MODEL_TOKEN, { useValue: WorkspaceModel });
        container.register(GAME_MODEL_TOKEN, { useValue: GameModel });
        container.register(PLAYER_RATING_MODEL_TOKEN, { useValue: PlayerRatingModel });

        // Register repositories
        container.register('USER_REPOSITORY_TOKEN', { useClass: UserRepository });

        // Register services
        container.register(PLAYER_RATING_SERVICE_TOKEN, { useClass: PlayerRatingService });

        // ===== STEP 1: Fetch 16 active users =====
        console.log('📋 STEP 1: Fetching active users...');
        const users = await UserModel.find({ status: 'active' }).limit(16).exec();

        if (users.length === 0) {
            console.error('❌ No active users found in database!');
            process.exit(1);
        }

        console.log(`✅ Found ${users.length} active users\n`);

        // ===== STEP 2: Assign positions and ratings =====
        console.log('🎯 STEP 2: Assigning positions and ratings...');
        const positionMap = assignPositions(users);

        for (const user of users) {
            const position = positionMap.get(user._id.toString()) || PlayerPosition.MEI;
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
                user.profile.ratingCount = 0;
            }

            await user.save();
            console.log(`  ✓ ${user.name}: ${position}, Rating: ${rating}`);
        }
        console.log('✅ Positions and ratings assigned\n');

        // ===== STEP 3: Get or create a workspace =====
        console.log('🏢 STEP 3: Finding workspace...');
        let workspace = await WorkspaceModel.findOne().exec();

        if (!workspace) {
            console.log('  Creating new workspace...');
            workspace = await WorkspaceModel.create({
                name: 'FairPlay Test Workspace',
                slug: 'fairplay-test',
                timezone: 'America/Sao_Paulo',
                settings: {
                    maxPlayers: 16,
                    pricePerGameCents: 1400
                }
            });
        }
        console.log(`✅ Using workspace: ${workspace.name} (${workspace._id})\n`);

        // ===== STEP 4: Create a game for tomorrow =====
        console.log('⚽ STEP 4: Creating test game...');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(21, 0, 0, 0);

        const game = await GameModel.create({
            workspaceId: workspace._id,
            chatId: 'test-fairplay-chat',
            date: tomorrow,
            title: 'FairPlay Test Game',
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

        // ===== STEP 5: Simulate rating votes (matrix) =====
        console.log('⭐ STEP 5: Simulating rating votes...');
        const playerRatingService = container.resolve<PlayerRatingService>(PLAYER_RATING_SERVICE_TOKEN);

        let voteCount = 0;
        for (const rater of users) {
            for (const rated of users) {
                // Skip self-rating
                if (rater._id.toString() === rated._id.toString()) {
                    continue;
                }

                const score = randomScore();
                await playerRatingService.ratePlayer(
                    rater._id.toString(),
                    rated._id.toString(),
                    score
                );
                voteCount++;
            }
        }

        console.log(`✅ Created ${voteCount} rating votes\n`);

        // ===== STEP 6: Display final summary =====
        console.log('📊 FINAL SUMMARY:');
        console.log('═'.repeat(60));

        // Reload users to get updated ratings
        const updatedUsers = await UserModel.find({
            _id: { $in: users.map(u => u._id) }
        }).exec();

        // Group by position
        const byPosition: Record<PlayerPosition, IUser[]> = {
            [PlayerPosition.GOL]: [],
            [PlayerPosition.ZAG]: [],
            [PlayerPosition.LAT]: [],
            [PlayerPosition.MEI]: [],
            [PlayerPosition.ATA]: []
        };

        updatedUsers.forEach(user => {
            const pos = user.profile?.mainPosition || PlayerPosition.MEI;
            if (byPosition[pos]) {
                byPosition[pos].push(user);
            }
        });

        // Display by position
        const positionKeys = [PlayerPosition.GOL, PlayerPosition.ZAG, PlayerPosition.LAT, PlayerPosition.MEI, PlayerPosition.ATA];
        positionKeys.forEach(pos => {
            console.log(`\n${pos} (${byPosition[pos].length} players):`);
            byPosition[pos]
                .sort((a, b) => (b.profile?.rating || 0) - (a.profile?.rating || 0))
                .forEach(user => {
                    console.log(`  • ${user.name.padEnd(20)} Rating: ${(user.profile?.rating || 0).toFixed(2)} (${user.profile?.ratingCount || 0} votes)`);
                });
        });

        console.log('\n' + '═'.repeat(60));
        console.log(`\n🎮 Game ID: ${game._id}`);
        console.log(`📅 Date: ${game.date.toLocaleString('pt-BR')}`);
        console.log(`\n✨ Script completed successfully!`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Access the admin panel`);
        console.log(`   2. Navigate to the game: ${game.title}`);
        console.log(`   3. Click "Generate Teams" to test the balancing algorithm\n`);

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }

    process.exit(0);
};

main();
