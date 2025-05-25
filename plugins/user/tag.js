module.exports = {
    name: 'tag',
    description: 'Mention user creatively without command action',
    category: 'user',
    permissions: ['user'],
    usage: '.tag @user [message]',
    aliases: ['mention'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            const mentions = ctx.extractMentions();
            if (mentions.length === 0) {
                return reply('❌ Please mention someone to tag.\n\nUsage: `.tag @user [message]`');
            }

            const targetUser = mentions[0];
            const targetPhone = targetUser.split('@')[0];
            const customMessage = args.slice(1).join(' ');

            const tagStyles = [
                '📢 Hey @{user}! You have been tagged!',
                '👋 @{user}, someone wants your attention!',
                '🔔 Ding ding! @{user} you are needed here!',
                '⭐ @{user} - you are being summoned!',
                '🎯 Target acquired: @{user}!',
                '📱 Incoming call for @{user}!',
                '🌟 Spotlight on @{user}!',
                '🎪 Ladies and gentlemen, @{user}!',
                '🔥 @{user} is in the spotlight!',
                '💫 Magic tag for @{user}!'
            ];

            let tagMessage;
            if (customMessage) {
                tagMessage = `📝 **MESSAGE FOR @${targetPhone}**\n\n${customMessage}\n\n👤 **From:** @${sender.split('@')[0]}`;
            } else {
                const randomTag = tagStyles[Math.floor(Math.random() * tagStyles.length)];
                tagMessage = randomTag.replace('{user}', targetPhone) + `\n\n👤 **Tagged by:** @${sender.split('@')[0]}`;
            }

            await reply(tagMessage, {
                mentions: [targetUser, sender]
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Tag command failed:', error);
            return reply('❌ Failed to send tag. Please try again.');
        }
    }
};