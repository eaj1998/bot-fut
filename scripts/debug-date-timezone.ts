import 'reflect-metadata';
import dotenv from 'dotenv';
import { MembershipRepository } from '../src/core/repositories/membership.repository';

console.log('--- Timezone Debug ---');
console.log('Current Time:', new Date().toString());
console.log('Current ISO:', new Date().toISOString());
console.log('Timezone Offset:', new Date().getTimezoneOffset());

const nextDue = MembershipRepository.calculateNextDueDate(new Date());
console.log('Calculated Next Due (Local):', nextDue.toString());
console.log('Calculated Next Due (ISO):', nextDue.toISOString());
console.log('Day of Month:', nextDue.getDate());
