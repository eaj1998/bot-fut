import 'reflect-metadata';
import { MembershipRepository } from '../src/core/repositories/membership.repository';

const testCases = [
    new Date('2026-02-02T12:00:00Z'), // Today (Before 10th)
    new Date('2026-02-10T12:00:00Z'), // On 10th
    new Date('2026-02-20T12:00:00Z'), // After 10th
    new Date('2026-01-31T12:00:00Z'), // End of month edge case
];

console.log('--- Verifying Due Date Logic ---');

testCases.forEach(date => {
    const nextDue = MembershipRepository.calculateNextDueDate(date);
    console.log(`Input: ${date.toISOString().split('T')[0]} -> Next Due: ${nextDue.toISOString()}`);
});
