module.exports = {
    name: 'ping',
    description: 'Check bot response time and status',
    category: 'user',
    permissions: ['user'],
    usage: '.ping',
    aliases: ['pong'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        const startTime = Date.now();
        
        try {
            // Send initial ping message
            const pingMessage = await reply('🏓 Pinging...');
            
            const responseTime = Date.now() - startTime;
            const uptime = bot.getUptime();
            const memoryUsage = bot.utils.getMemoryUsage();
            
            // Calculate memory in MB
            const memoryMB = {
                rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100
            };

            // Get plugin count
            const pluginCount = bot.pluginManager.getAllPlugins().length;
            const enabledPlugins = bot.pluginManager.getAllPlugins().filter(p => p.enabled).length;

            let pongMessage = `🏓 **PONG!**\n\n`;
            pongMessage += `⚡ **Response Time:** ${responseTime}ms\n`;
            pongMessage += `⏰ **Uptime:** ${uptime}\n`;
            pongMessage += `🧠 **Memory Usage:** ${memoryMB.heapUsed}MB / ${memoryMB.heapTotal}MB\n`;
            pongMessage += `🔌 **Plugins:** ${enabledPlugins}/${pluginCount} active\n`;
            pongMessage += `📱 **Connection:** ${bot.isConnected ? '✅ Connected' : '❌ Disconnected'}\n\n`;
            
            // Performance indicators
            if (responseTime < 100) {
                pongMessage += `🟢 **Status:** Excellent`;
            } else if (responseTime < 300) {
                pongMessage += `🟡 **Status:** Good`;
            } else if (responseTime < 1000) {
                pongMessage += `🟠 **Status:** Fair`;
            } else {
                pongMessage += `🔴 **Status:** Poor`;
            }

            await reply(pongMessage);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Ping command failed:', error);
            return reply(`❌ Ping failed: ${error.message}`);
        }
    }
};
