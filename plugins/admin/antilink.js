module.exports = {
    name: 'antilink',
    description: 'Enable/disable automatic link deletion in group',
    category: 'admin',
    permissions: ['admin'],
    usage: '.antilink <on/off>',
    aliases: ['al', 'linkblock'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const action = args[0]?.toLowerCase();
        
        if (!action || !['on', 'off', 'enable', 'disable'].includes(action)) {
            const currentStatus = await bot.database.getGroupSetting(chatId, 'antilink');
            const status = currentStatus === 'enabled' ? '🟢 Enabled' : '🔴 Disabled';
            
            return reply(`🔗 **ANTI-LINK STATUS**\n\n` +
                        `📊 **Current Status:** ${status}\n\n` +
                        `💡 **Usage:** \`.antilink <on/off>\`\n` +
                        `📝 **Description:** Automatically delete messages containing links`);
        }

        try {
            const enable = ['on', 'enable'].includes(action);
            
            // Update group setting
            await bot.database.setGroupSetting(chatId, 'antilink', enable ? 'enabled' : 'disabled');
            
            const statusText = enable ? 'enabled' : 'disabled';
            const statusIcon = enable ? '✅' : '❌';
            
            await reply(`${statusIcon} **Anti-link has been ${statusText}**\n\n` +
                       `${enable ? '🛡️ Links will now be automatically deleted' : '🔓 Links are now allowed'}\n\n` +
                       `👮‍♂️ **Action by:** @${sender.split('@')[0]}`,
                       { mentions: [sender] });

            // Log the action
            bot.logger.audit('ANTILINK_TOGGLE', sender, {
                groupId: chatId,
                action: statusText,
                timestamp: Date.now()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Antilink command failed:', error);
            return reply('❌ Failed to update anti-link setting. Please try again.');
        }
    }
};