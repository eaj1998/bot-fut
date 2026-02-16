import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { XMLParser } from 'fast-xml-parser';
import { GameService } from '../../services/game.service';
import { WhatsAppService } from '../../services/whatsapp.service';
import { LoggerService } from '../../logger/logger.service';
import { asyncHandler } from '../middleware/error.middleware';

@injectable()
export class YoutubeWebhookController {
    private xmlParser: XMLParser;
    private processedVideoIds: Set<string> = new Set();

    constructor(
        @inject(GameService) private gameService: GameService,
        @inject(WhatsAppService) private whatsappService: WhatsAppService,
        @inject(LoggerService) private logger: LoggerService
    ) {
        this.logger.setName('YoutubeWebhookController');
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: ""
        });
    }

    /**
     * GET /api/webhooks/youtube
     * Verificação do PubSubHubbub (Google Challenge)
     */
    verifyWebhook = (req: Request, res: Response) => {
        const challenge = req.query['hub.challenge'];
        const topic = req.query['hub.topic'];
        const mode = req.query['hub.mode'];

        if (challenge) {
            this.logger.log(`Verifying subscription for topic: ${topic}`);
            res.status(200).send(challenge);
        } else {
            res.status(400).send('No challenge provided');
        }
    };

    /**
     * POST /api/webhooks/youtube
     * Recebimento de Notificação (Atom Feed XML)
     */
    handleNotification = asyncHandler(async (req: Request, res: Response) => {

        try {

            let xmlData = req.body;

            if (Buffer.isBuffer(xmlData)) {
                xmlData = xmlData.toString('utf-8');
            } else if (typeof xmlData === 'object' && Object.keys(xmlData).length === 0) {
            }

            if (!xmlData || typeof xmlData !== 'string') {
                this.logger.warn('Received empty or invalid body in YouTube webhook');
                res.status(200).send('OK (Empty)');
                return;
            }

            const jsonObj = this.xmlParser.parse(xmlData);

            if (!jsonObj.feed || !jsonObj.feed.entry) {
                res.status(200).send('OK (No Entry)');
                return;
            }

            const entry = jsonObj.feed.entry;
            const videoId = entry['yt:videoId'];
            const title = entry.title;
            const link = entry.link?.href || `https://www.youtube.com/watch?v=${videoId}`;

            if (!videoId || !title) {
                this.logger.warn('Missing videoId or title in feed entry');
                res.status(200).send('OK');
                return;
            }

            if (this.processedVideoIds.has(videoId)) {
                this.logger.log(`Ignoring duplicate notification for video: ${videoId}`);
                res.status(200).send('OK (Duplicate)');
                return;
            }
            this.processedVideoIds.add(videoId);

            if (this.processedVideoIds.size > 1000) {
                this.processedVideoIds.clear();
            }

            this.logger.log(`New Video Posted: ${title} (${videoId})`);

            const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/;
            const match = title.match(dateRegex);

            if (match) {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                const year = parseInt(match[3]);
                const gameDate = new Date(year, month, day);

                this.logger.log(`Extracted Date: ${gameDate.toISOString()}`);

                const game = await this.gameService.findGameByDate(gameDate);

                if (game) {
                    this.logger.log(`Found Game: ${game.title} (ID: ${game._id})`);

                    const message = `🎥 *Novo Vídeo do Jogo!*
                    
⚽ *${title}*

Assista agora: ${link}`;

                    await this.whatsappService.sendMessage(game.chatId, message);
                } else {
                    this.logger.warn(`No game found for date: ${match[0]}`);
                }
            } else {
                this.logger.warn(`Could not extract date from title: ${title}`);
            }

            res.status(200).send('OK');

        } catch (error) {
            this.logger.error('Error processing YouTube webhook', error);
            res.status(500).send('Internal Server Error');
        }
    });
}
