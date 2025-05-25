module.exports = {
    name: 'contact',
    description: 'Share contact card of the user',
    category: 'user',
    permissions: ['user'],
    usage: '.contact @user',
    aliases: ['sharecontact'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        const mentions = ctx.extractMentions();
        const targetUser = mentions.length > 0 ? mentions[0] : sender;
        const targetPhone = targetUser.split('@')[0];

        try {
            // Get user data for display name
            const userData = bot.database.getUser(targetUser);
            const displayName = userData?.name || `+${targetPhone}`;

            // Create contact card
            const contactCard = {
                displayName: displayName,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${displayName};;;;\nFN:${displayName}\nTEL;type=CELL;waid=${targetPhone}:+${targetPhone}\nEND:VCARD`
            };

            await bot.sendMessage(chatId, {
                contacts: {
                    displayName: displayName,
                    contacts: [contactCard]
                }
            });

            // Send additional info message
            let contactMessage = `📇 **CONTACT SHARED**\n\n`;
            contactMessage += `👤 **Name:** ${displayName}\n`;
            contactMessage += `📱 **Number:** +${targetPhone}\n`;
            contactMessage += `📤 **Shared by:** @${sender.split('@')[0]}`;

            await reply(contactMessage, {
                mentions: [sender]
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Contact command failed:', error);
            return reply('❌ Failed to share contact. Please try again.');
        }
    }
};