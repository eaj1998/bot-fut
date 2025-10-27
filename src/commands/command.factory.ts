import { container, injectable } from 'tsyringe';
import { LineUpAddCommand } from './lineup/add.command';
import { Command } from './type';
import { LineUpCreateCommand } from './lineup/create.command';
import { GoalKeeperAddCommand } from './lineup/goalkeeper.command';
import { GiveUpCommand } from './lineup/giveup.command';
import { GuestCommand } from './lineup/guest.command';
import { OutCommand } from './lineup/out.command';
import { PaymentCommand } from './payment/payment.command';
import { UncheckPaymentCommand } from './payment/uncheckPayment.command';

@injectable()
export class CommandFactory {
  public create(command: string): Command | undefined {
    console.log('command', command);

    switch(command) {
      case '/lista': return container.resolve(LineUpCreateCommand);
      case '/bora': return container.resolve(LineUpAddCommand);
      case '/goleiro': return container.resolve(GoalKeeperAddCommand);
      case '/desistir': return container.resolve(GiveUpCommand);
      case '/convidado': return container.resolve(GuestCommand);
      case '/fora': return container.resolve(OutCommand);
      case '/pago': return container.resolve(PaymentCommand);
      case '/desmarcar': return container.resolve(UncheckPaymentCommand);

      default: return undefined;
    }
  }
}
