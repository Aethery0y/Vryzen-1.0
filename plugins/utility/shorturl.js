module.exports = {
    name: 'shorturl',
    description: 'Shorten long URLs using TinyURL service',
    category: 'utility',
    permissions: ['user'],
    usage: '.shorturl <url>',
    aliases: ['shorten', 'tinyurl'],
    cooldown: 2000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            if (args.length === 0) {
                return reply('❌ Please provide a URL to shorten.\n\nUsage: `.shorturl <url>`\n\nExample: `.shorturl https://example.com/very/long/url`');
            }

            const url = args[0];
            
            // Validate URL
            if (!bot.utils.isValidUrl(url)) {
                return reply('❌ Please provide a valid URL.\n\nMake sure your URL starts with http:// or https://');
            }

            await reply('🔄 Shortening URL...');

            const fetch = require('node-fetch');
            const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
            
            const response = await fetch(apiUrl);
            const shortUrl = await response.text();

            if (shortUrl.startsWith('Error') || !shortUrl.includes('tinyurl.com')) {
                return reply('❌ Failed to shorten URL. Please check if the URL is valid and accessible.');
            }

            let shortMessage = `🔗 **URL SHORTENED SUCCESSFULLY!**\n\n`;
            shortMessage += `📝 **Original:** ${bot.utils.truncateText(url, 80)}\n`;
            shortMessage += `✂️ **Shortened:** ${shortUrl}\n\n`;
            shortMessage += `👤 **Created by:** @${sender.split('@')[0]}\n`;
            shortMessage += `📊 **Saved:** ${url.length - shortUrl.length} characters`;

            await reply(shortMessage, {
                mentions: [sender]
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Short URL command failed:', error);
            return reply('❌ Failed to shorten URL. The service might be temporarily unavailable.');
        }
    }
};