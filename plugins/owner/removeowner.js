module.exports = {
    name: 'removeowner',
    description: 'Remove bot owner privileges (Real Owner only)',
    category: 'owner',
    permissions: ['real_owner'],
    usage: '.removeowner @user',
    aliases: ['demoteowner'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to remove owner privileges.\n\nUsage: `.removeowner @user`');
        }

        const targetUser = mentions[0];
        const targetPhone = bot.utils.whatsAppIdToPhone(targetUser);

        // Prevent removing Real Owner
        if (bot.permissions.isRealOwner(targetUser)) {
            return reply('❌ Cannot remove Real Owner privileges.');
        }

        // Check if user is actually an owner
        const existingUser = bot.database.getUser(targetUser);
        if (!existingUser || existingUser.role !== 'owner') {
            return reply('❌ This user is not a bot owner.');
        }

        try {
            // Remove owner
            await bot.permissions.removeOwner(targetUser, sender);

            // Send confirmation message
            const targetDisplayPhone = targetUser.split('@')[0];
            const removerPhone = sender.split('@')[0];
            
            await reply(`📉 **BOT OWNER REMOVED**\n\n` +
                       `👤 **Removed Owner:** @${targetDisplayPhone}\n` +
                       `📱 **Phone:** ${targetPhone}\n` +
                       `👑 **Removed by:** @${removerPhone}\n` +
                       `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                       `❌ User no longer has bot management privileges.\n` +
                       `ℹ️ They are now a regular user.`, {
                mentions: [targetUser, sender]
            });

            // Send direct message to removed owner (if possible)
            try {
                await bot.sendMessage(targetUser, {
                    text: `📢 **OWNER PRIVILEGES REMOVED**\n\n` +
                          `Your Bot Owner privileges have been revoked.\n\n` +
                          `👑 **Removed by:** Real Owner\n` +
                          `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                          `❌ **You can no longer:**\n` +
                          `• Manage plugins\n` +
                          `• Install/remove plugins\n` +
                          `• Access owner commands\n\n` +
                          `ℹ️ You are now a regular user.\n` +
                          `📖 Use \`.help\` to see available commands.`
                });
            } catch (dmError) {
                // DM failed, but ownership was still removed
                bot.logger.warn('Failed to send DM to removed owner:', dmError);
            }

            // Log the action
            bot.logger.audit('OWNER_REMOVED', sender, {
                targetUser,
                targetPhone,
                timestamp: new Date().toISOString(),
                method: 'removeowner_command'
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Remove owner command failed:', error);
            return reply(`❌ Failed to remove owner: ${error.message}`);
        }
    }
};
