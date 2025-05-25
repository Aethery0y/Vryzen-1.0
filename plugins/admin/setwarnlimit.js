module.exports = {
    name: 'setwarnlimit',
    description: 'Set maximum warnings before automatic action',
    category: 'admin',
    permissions: ['admin'],
    usage: '.setwarnlimit <number>',
    aliases: ['warnlimit'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        if (args.length === 0) {
            const currentLimit = bot.database.getGroupSetting(chatId, 'warn_limit') || '3';
            return reply(`📊 **Current warning limit:** ${currentLimit}\n\nUsage: \`.setwarnlimit <number>\`\n\nExample: \`.setwarnlimit 5\`\n\n💡 Users will be kicked/banned after reaching this many warnings.`);
        }

        const limit = parseInt(args[0]);
        if (isNaN(limit) || limit < 1 || limit > 10) {
            return reply('❌ Please provide a valid number between 1 and 10.\n\nExample: `.setwarnlimit 3`');
        }

        try {
            const oldLimit = bot.database.getGroupSetting(chatId, 'warn_limit') || '3';
            bot.database.setGroupSetting(chatId, 'warn_limit', limit.toString());

            let limitMessage = `⚙️ **WARNING LIMIT UPDATED**\n\n`;
            limitMessage += `📊 **Previous limit:** ${oldLimit}\n`;
            limitMessage += `📊 **New limit:** ${limit}\n`;
            limitMessage += `👮 **Set by:** @${sender.split('@')[0]}\n`;
            limitMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            limitMessage += `⚠️ Users will now receive automatic action after ${limit} warning${limit > 1 ? 's' : ''}.`;

            await reply(limitMessage, {
                mentions: [sender]
            });

            // Log the action
            bot.logger.logOwnerAction('SET_WARN_LIMIT', null, sender, {
                groupId: chatId,
                oldLimit,
                newLimit: limit,
                timestamp: new Date().toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Set warn limit command failed:', error);
            return reply('❌ Failed to set warning limit. Please try again.');
        }
    }
};