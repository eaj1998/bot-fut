
import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { HelpService } from '../../services/help.service';

@injectable()
export class HelpController {
    constructor(
        @inject(HelpService) private readonly helpService: HelpService
    ) { }

    public getCommands = (req: Request, res: Response): void => {
        const commands = this.helpService.getPublicCommands();
        res.json(commands);
    };
}
