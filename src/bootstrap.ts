import 'reflect-metadata';
import dotenv from 'dotenv';
import { App } from './app';
import { container } from 'tsyringe';

dotenv.config();

const main = async () => {
  const valmir = container.resolve(App);

  valmir.start();
};

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
