module.exports = {
    name: 'warn',
    description: 'Issue a warning to a user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.warn @user [reason]',
    aliases: ['warning'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to warn.\n\nUsage: `.warn @user [reason]`');
        }

        const targetUser = mentions[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';

        // Check if user can warn the target
        const canWarn = await bot.permissions.canKickUser(sender, targetUser, chatId);
        if (!canWarn) {
            return reply('❌ You cannot warn this user (insufficient permissions or target has equal/higher role).');
        }

        try {
            // Create user record if doesn't exist
            let targetUserData = bot.database.getUser(targetUser);
            if (!targetUserData) {
                const targetPhone = bot.utils.whatsAppIdToPhone(targetUser);
                bot.database.createUser(targetUser, targetPhone);
                targetUserData = bot.database.getUser(targetUser);
            }

            // Add warning
            bot.database.addWarning(targetUser);
            
            // Get updated user data
            const updatedUserData = bot.database.getUser(targetUser);
            const warningCount = updatedUserData.warnings;

            // Get warning limit from group settings (default 3)
            const warnLimit = parseInt(bot.database.getGroupSetting(chatId, 'warn_limit') || '3');

            // Send warning message
            const targetPhone = targetUser.split('@')[0];
            const warnerPhone = sender.split('@')[0];
            
            let warningMessage = `⚠️ @${targetPhone} has received a warning!\n\n` +
                               `👮‍♂️ Warned by: @${warnerPhone}\n` +
                               `📝 Reason: ${reason}\n` +
                               `📊 Warnings: ${warningCount}/${warnLimit}`;

            // Check if user has reached warning limit
            if (warningCount >= warnLimit) {
                // Auto-action based on group settings
                const autoAction = bot.database.getGroupSetting(chatId, 'warn_action') || 'kick';
                
                try {
                    if (autoAction === 'kick' && isGroup) {
                        // Auto-kick user
                        const groupMetadata = await bot.sock.groupMetadata(chatId);
                        const botParticipant = groupMetadata.participants.find(p => p.id === bot.sock.user.id);
                        
                        if (botParticipant && botParticipant.admin === 'admin') {
                            await bot.sock.groupParticipantsUpdate(chatId, [targetUser], 'remove');
                            warningMessage += `\n\n🚫 User has been automatically kicked for reaching the warning limit!`;
                        } else {
                            warningMessage += `\n\n⚠️ User has reached the warning limit but I don't have admin privileges to kick!`;
                        }
                    } else if (autoAction === 'ban') {
                        // Auto-ban user
                        bot.database.banUser(targetUser);
                        warningMessage += `\n\n🔨 User has been automatically banned for reaching the warning limit!`;
                    }
                } catch (autoActionError) {
                    bot.logger.error('Auto-action failed:', autoActionError);
                    warningMessage += `\n\n⚠️ User has reached the warning limit but auto-action failed!`;
                }
            } else {
                const remainingWarnings = warnLimit - warningCount;
                warningMessage += `\n\n⚡ ${remainingWarnings} warning${remainingWarnings > 1 ? 's' : ''} remaining before action is taken.`;
            }

            await reply(warningMessage, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.audit('USER_WARNED', sender, {
                targetUser,
                groupId: chatId,
                reason,
                warningCount,
                warnLimit,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Warn command failed:', error);
            return reply('❌ Failed to issue warning. Please try again.');
        }
    }
};
