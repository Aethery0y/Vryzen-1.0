module.exports = {
    name: 'remindme',
    description: 'Set personal reminder (via bot DM or reply)',
    category: 'user',
    permissions: ['user'],
    usage: '.remindme <time> <message>',
    aliases: ['remind'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length < 2) {
            return reply('❌ Please specify time and message.\n\nUsage: `.remindme <time> <message>`\n\nExamples:\n• `.remindme 10m Take a break`\n• `.remindme 1h Check emails`\n• `.remindme 2d Birthday party`');
        }

        const timeStr = args[0];
        const reminderMessage = args.slice(1).join(' ');

        try {
            const timeMs = ctx.parseDuration(timeStr);
            if (!timeMs) {
                return reply('❌ Invalid time format. Use: 10m, 1h, 2d, etc.\n\nExamples:\n• `5m` = 5 minutes\n• `2h` = 2 hours\n• `1d` = 1 day');
            }

            if (timeMs < 60000) { // Less than 1 minute
                return reply('❌ Minimum reminder time is 1 minute.');
            }

            if (timeMs > 30 * 24 * 60 * 60 * 1000) { // More than 30 days
                return reply('❌ Maximum reminder time is 30 days.');
            }

            const reminderTime = new Date(Date.now() + timeMs);
            
            let confirmMessage = `⏰ **REMINDER SET**\n\n`;
            confirmMessage += `📝 **Message:** ${reminderMessage}\n`;
            confirmMessage += `⏰ **Time:** ${timeStr}\n`;
            confirmMessage += `🕐 **When:** ${reminderTime.toLocaleString()}\n`;
            confirmMessage += `👤 **For:** @${sender.split('@')[0]}\n\n`;
            confirmMessage += `✅ I'll remind you at the specified time!`;

            await reply(confirmMessage, {
                mentions: [sender]
            });

            // Set the reminder
            setTimeout(async () => {
                try {
                    let reminderAlert = `🔔 **REMINDER ALERT!**\n\n`;
                    reminderAlert += `📝 **Your reminder:** ${reminderMessage}\n`;
                    reminderAlert += `📅 **Set on:** ${new Date(Date.now() - timeMs).toLocaleString()}\n`;
                    reminderAlert += `⏰ **Reminder time:** ${reminderTime.toLocaleString()}\n\n`;
                    reminderAlert += `💡 Hope this helps! 🎯`;

                    // Try to send as DM first, fallback to group mention
                    try {
                        await bot.sendMessage(sender, {
                            text: reminderAlert
                        });
                    } catch (dmError) {
                        // If DM fails, send in the group where command was used
                        await bot.sendMessage(chatId, {
                            text: `@${sender.split('@')[0]} ${reminderAlert}`,
                            mentions: [sender]
                        });
                    }

                    bot.logger.info('Reminder delivered', {
                        userId: sender,
                        message: reminderMessage,
                        originalTime: timeStr
                    });

                } catch (reminderError) {
                    bot.logger.error('Failed to deliver reminder:', reminderError);
                }
            }, timeMs);

            // Log the reminder creation
            bot.logger.info('Reminder created', {
                userId: sender,
                message: reminderMessage,
                timeMs,
                reminderTime: reminderTime.toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Remind me command failed:', error);
            return reply('❌ Failed to set reminder. Please try again.');
        }
    }
};