#!/usr/bin/env node

const { parseArgs } = require('util');
const chalk = require('chalk');
const Bot = require('./src/bot');
const logger = require('./src/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const usePairCode = args.includes('--paircode') || args.includes('-p');

console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║            VRYZEN v1.0               ║
║        WhatsApp Bot System           ║
║       Plugin-Based Architecture      ║
╚══════════════════════════════════════╝
`));

console.log(chalk.yellow(`🚀 Starting Vryzen Bot...`));
console.log(chalk.blue(`📱 Connection Method: ${usePairCode ? 'Pairing Code' : 'QR Code'}`));

// Initialize bot
const bot = new Bot({
    usePairCode,
    sessionPath: './sessions',
    logLevel: process.env.LOG_LEVEL || 'info'
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n⏹️  Shutting down bot gracefully...'));
    await bot.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n⏹️  Shutting down bot gracefully...'));
    await bot.stop();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    console.error(chalk.red('💥 Uncaught Exception:'), error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.error(chalk.red('💥 Unhandled Rejection:'), reason);
});

// Start the bot
bot.start().catch((error) => {
    logger.error('Failed to start bot:', error);
    console.error(chalk.red('💥 Failed to start bot:'), error);
    process.exit(1);
});
