import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { inject, injectable } from 'tsyringe';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';
import { createErrorHandler } from '../api/middleware/error.middleware';

@injectable()
export class ApiServer {
    private app: Application;

    constructor(
        @inject(ConfigService) private readonly config: ConfigService,
        @inject(LoggerService) private readonly logger: LoggerService
    ) {
        this.app = express();
        this.logger.setName('ApiServer');
        this.setupMiddleware();
    }

    private setupMiddleware() {
        this.app.use(helmet());
        this.app.use(
            cors({
                origin: this.config.api.cors.origin,
                credentials: true,
            }),
        );

        this.app.use(
            rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // limit each IP to 100 requests per windowMs
            }),
        );

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }  

    public initialize(): void {
        const apiRoutes = require('../api/routes').default;

        this.app.get('/', (req, res) => {
            res.json({
                message: 'Bot-Fut API',
                version: '1.0.0',
                endpoints: {
                    health: '/api/health',
                    auth: '/api/auth',
                    games: '/api/games',
                },
            });
        });

        this.app.use('/api', apiRoutes);

        const errorLogger = new LoggerService();
        errorLogger.setName('ErrorHandler');
        this.app.use(createErrorHandler(errorLogger));
        
        this.logger.log('Routes initialized');
    }

    public start(): void {
        const port = this.config.api.port;
        this.app.listen(port, () => {
            this.logger.info(`API Server running on port ${port}`);
            this.logger.info(`CORS enabled for: ${this.config.api.cors.origin.join(', ')}`);
        });
    }

    public getApp(): Application {
        return this.app;
    }
}
