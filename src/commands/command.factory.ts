import { container, injectable } from 'tsyringe';
import { LineUpAddCommand } from './lineup/add.command';
import { Command } from './type';

@injectable()
export class CommandFactory {
  public create(command: string): Command {
    console.log('command', command);
    return container.resolve(LineUpAddCommand);
  }
}
