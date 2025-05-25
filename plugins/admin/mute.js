module.exports = {
    name: 'mute',
    description: 'Temporarily mute a user from using bot commands',
    category: 'admin',
    permissions: ['admin'],
    usage: '.mute @user <duration> [reason]',
    aliases: ['muteuser'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to mute.\n\nUsage: `.mute @user <duration> [reason]`\n\nExample: `.mute @user 10m Spamming`');
        }

        if (args.length < 2) {
            return reply('❌ Please specify a duration.\n\nUsage: `.mute @user <duration> [reason]`\n\nExamples:\n• `.mute @user 5m` (5 minutes)\n• `.mute @user 1h` (1 hour)\n• `.mute @user 1d` (1 day)');
        }

        const targetUser = mentions[0];
        const durationStr = args[1];
        const reason = args.slice(2).join(' ') || 'No reason provided';

        // Parse duration
        let duration;
        try {
            duration = bot.utils.parseTimeString(durationStr);
        } catch (error) {
            return reply('❌ Invalid duration format.\n\nValid formats:\n• `5m` (5 minutes)\n• `1h` (1 hour)\n• `2d` (2 days)\n• `1w` (1 week)');
        }

        // Check if user can mute the target
        const canMute = await bot.permissions.canKickUser(sender, targetUser, chatId);
        if (!canMute) {
            return reply('❌ You cannot mute this user (insufficient permissions or target has equal/higher role).');
        }

        // Check if user is already muted
        const targetUserData = bot.database.getUser(targetUser);
        if (targetUserData && targetUserData.muted_until > Math.floor(Date.now() / 1000)) {
            const remainingTime = bot.utils.formatTimeString((targetUserData.muted_until * 1000) - Date.now());
            return reply(`❌ This user is already muted for ${remainingTime}.`);
        }

        try {
            // Create user record if doesn't exist
            if (!targetUserData) {
                const targetPhone = bot.utils.whatsAppIdToPhone(targetUser);
                bot.database.createUser(targetUser, targetPhone);
            }

            // Mute the user
            const durationSeconds = Math.floor(duration / 1000);
            bot.database.muteUser(targetUser, durationSeconds);

            // Send confirmation message
            const targetPhone = targetUser.split('@')[0];
            const muterPhone = sender.split('@')[0];
            const durationText = bot.utils.formatTimeString(duration);
            
            await reply(`🔇 @${targetPhone} has been muted from using bot commands.\n\n` +
                       `👮‍♂️ Muted by: @${muterPhone}\n` +
                       `⏰ Duration: ${durationText}\n` +
                       `📝 Reason: ${reason}\n\n` +
                       `⚠️ User will not be able to use bot commands until the mute expires.`, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.audit('USER_MUTED', sender, {
                targetUser,
                groupId: chatId,
                duration: durationText,
                reason,
                expiresAt: new Date(Date.now() + duration).toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Mute command failed:', error);
            return reply('❌ Failed to mute user. Please try again.');
        }
    }
};
