module.exports = {
    name: 'addowner',
    description: 'Add a new bot owner (Real Owner only)',
    category: 'owner',
    permissions: ['real_owner'],
    usage: '.addowner @user',
    aliases: ['makeowner'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to make owner.\n\nUsage: `.addowner @user`\n\n⚠️ **Warning:** Owners have full access to bot management.');
        }

        const targetUser = mentions[0];
        const targetPhone = bot.utils.whatsAppIdToPhone(targetUser);

        // Prevent adding Real Owner as regular owner
        if (bot.permissions.isRealOwner(targetUser)) {
            return reply('❌ Cannot modify Real Owner permissions.');
        }

        // Check if user is already an owner
        const existingUser = bot.database.getUser(targetUser);
        if (existingUser && existingUser.role === 'owner') {
            return reply('❌ This user is already a bot owner.');
        }

        try {
            // Add owner
            await bot.permissions.addOwner(targetUser, targetPhone, sender);

            // Send confirmation message
            const targetDisplayPhone = targetUser.split('@')[0];
            const adderPhone = sender.split('@')[0];
            
            await reply(`👑 **NEW BOT OWNER ADDED**\n\n` +
                       `👤 **New Owner:** @${targetDisplayPhone}\n` +
                       `📱 **Phone:** ${targetPhone}\n` +
                       `👑 **Added by:** @${adderPhone}\n` +
                       `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                       `✅ User now has full bot management privileges.\n` +
                       `⚠️ They can manage plugins, users, and settings.`, {
                mentions: [targetUser, sender]
            });

            // Send direct message to new owner (if possible)
            try {
                await bot.sendMessage(targetUser, {
                    text: `🎉 **CONGRATULATIONS!**\n\n` +
                          `You have been granted Bot Owner privileges!\n\n` +
                          `👑 **Granted by:** Real Owner\n` +
                          `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                          `🔑 **Your new permissions:**\n` +
                          `• Plugin management (.plugin on/off)\n` +
                          `• Plugin installation (.addplugin)\n` +
                          `• Plugin removal (.removeplugin)\n` +
                          `• System management\n\n` +
                          `📖 Use \`.help owner\` to see all owner commands.\n` +
                          `⚠️ Use these powers responsibly!`
                });
            } catch (dmError) {
                // DM failed, but ownership was still granted
                bot.logger.warn('Failed to send DM to new owner:', dmError);
            }

            // Log the action
            bot.logger.audit('OWNER_ADDED', sender, {
                targetUser,
                targetPhone,
                timestamp: new Date().toISOString(),
                method: 'addowner_command'
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Add owner command failed:', error);
            return reply(`❌ Failed to add owner: ${error.message}`);
        }
    }
};
