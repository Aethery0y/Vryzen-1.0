module.exports = {
    name: 'ban',
    description: 'Permanently ban a user from using bot commands',
    category: 'admin',
    permissions: ['admin'],
    usage: '.ban @user [reason]',
    aliases: ['banuser'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to ban.\n\nUsage: `.ban @user [reason]`');
        }

        const targetUser = mentions[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';

        // Check if user can ban the target
        const canBan = await bot.permissions.canKickUser(sender, targetUser, chatId);
        if (!canBan) {
            return reply('❌ You cannot ban this user (insufficient permissions or target has equal/higher role).');
        }

        // Check if user is already banned
        const targetUserData = bot.database.getUser(targetUser);
        if (targetUserData && targetUserData.banned) {
            return reply('❌ This user is already banned.');
        }

        try {
            // Ban the user
            bot.database.banUser(targetUser);

            // Create user record if doesn't exist
            if (!targetUserData) {
                const targetPhone = bot.utils.whatsAppIdToPhone(targetUser);
                bot.database.createUser(targetUser, targetPhone);
                bot.database.banUser(targetUser);
            }

            // Send confirmation message
            const targetPhone = targetUser.split('@')[0];
            const bannerPhone = sender.split('@')[0];
            
            await reply(`🔨 @${targetPhone} has been permanently banned from using bot commands.\n\n` +
                       `👮‍♂️ Banned by: @${bannerPhone}\n` +
                       `📝 Reason: ${reason}\n\n` +
                       `⚠️ User will not be able to use any bot commands until unbanned.`, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.audit('USER_BANNED', sender, {
                targetUser,
                groupId: chatId,
                reason,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Ban command failed:', error);
            return reply('❌ Failed to ban user. Please try again.');
        }
    }
};
