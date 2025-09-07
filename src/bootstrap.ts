import 'reflect-metadata';
import { App } from './app';
import { container } from 'tsyringe';

const main = async () => {
  const valmir = container.resolve(App);

  valmir.start();
};

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
