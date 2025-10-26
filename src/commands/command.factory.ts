import { container, injectable } from 'tsyringe';
import { LineUpAddCommand } from './lineup/add.command';
import { Command } from './type';
import { LineUpCreateCommand } from './lineup/create.command';
import { GoalKeeperAddCommand } from './lineup/goalkeeper.commands';

@injectable()
export class CommandFactory {
  public create(command: string): Command | undefined {
    console.log('command', command);

    switch(command) {
      case '/lista': return container.resolve(LineUpCreateCommand);
      case '/bora': return container.resolve(LineUpAddCommand);
      case '/goleiro': return container.resolve(GoalKeeperAddCommand);

      default: return undefined;
    }
  }
}
