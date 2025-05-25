module.exports = {
    name: 'purge',
    description: 'Delete recent messages from a specific user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.purge @user [count]',
    aliases: ['delmsg'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user whose messages to purge.\n\nUsage: `.purge @user [count]`\n\nExample: `.purge @user 10`');
        }

        const targetUser = mentions[0];
        const count = parseInt(args[1]) || 5;

        // Validate count
        if (count < 1 || count > 20) {
            return reply('❌ Count must be between 1 and 20.');
        }

        // Check if user can purge the target's messages
        const canPurge = await bot.permissions.canKickUser(sender, targetUser, chatId);
        if (!canPurge) {
            return reply('❌ You cannot purge messages from this user (insufficient permissions or target has equal/higher role).');
        }

        try {
            // Get group metadata to check bot permissions
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            const botId = bot.sock.user.id;
            const botParticipant = groupMetadata.participants.find(p => p.id === botId);
            
            if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
                return reply('❌ I need admin privileges to delete messages.');
            }

            // Note: WhatsApp doesn't allow bots to delete other users' messages directly
            // This is a limitation of the WhatsApp API
            // We can only simulate this by warning about the limitation
            
            const targetPhone = targetUser.split('@')[0];
            const purgerPhone = sender.split('@')[0];
            
            await reply(`⚠️ **PURGE REQUEST**\n\n` +
                       `🎯 Target: @${targetPhone}\n` +
                       `👮‍♂️ Requested by: @${purgerPhone}\n` +
                       `📊 Count: ${count} messages\n\n` +
                       `❌ **Note:** WhatsApp API doesn't allow bots to delete other users' messages.\n` +
                       `💡 **Alternative:** Ask group admins to manually delete messages or consider muting the user.`, {
                mentions: [targetUser, sender]
            });

            // Log the attempt
            bot.logger.audit('PURGE_ATTEMPTED', sender, {
                targetUser,
                groupId: chatId,
                requestedCount: count,
                limitation: 'WhatsApp API restriction',
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Purge command failed:', error);
            return reply('❌ Failed to process purge request. Please try again.');
        }
    }
};
