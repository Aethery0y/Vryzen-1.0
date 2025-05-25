module.exports = {
    name: 'reload',
    description: 'Reload a specific plugin or all plugins',
    category: 'owner',
    permissions: ['owner'],
    usage: '.reload [plugin_name|all]',
    aliases: ['reloadplugin'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        const target = args[0];

        if (!target) {
            return reply('❌ Please specify what to reload.\n\nUsage: `.reload <plugin_name>` or `.reload all`\n\nExamples:\n• `.reload kick` - Reload kick plugin\n• `.reload all` - Reload all plugins');
        }

        try {
            if (target.toLowerCase() === 'all') {
                await this.reloadAllPlugins(ctx);
            } else {
                await this.reloadSinglePlugin(ctx, target);
            }

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Reload command failed:', error);
            return reply(`❌ Reload failed: ${error.message}`);
        }
    },

    async reloadSinglePlugin(ctx, pluginName) {
        const { bot, sender, reply } = ctx;

        try {
            // Check if plugin exists
            const plugin = bot.pluginManager.plugins.get(pluginName);
            if (!plugin) {
                return reply(`❌ Plugin '${pluginName}' not found.\n\n💡 Use \`.listplugins\` to see all installed plugins.`);
            }

            const startTime = Date.now();
            
            // Reload the plugin
            await bot.pluginManager.reloadPlugin(pluginName, sender);
            
            const reloadTime = Date.now() - startTime;

            await reply(`🔄 **PLUGIN RELOADED**\n\n` +
                       `📝 **Plugin:** ${pluginName}\n` +
                       `📂 **Category:** ${plugin.category}\n` +
                       `⏱️ **Reload Time:** ${reloadTime}ms\n` +
                       `👤 **Reloaded by:** @${sender.split('@')[0]}\n` +
                       `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                       `✅ Plugin has been successfully reloaded.`, {
                mentions: [sender]
            });

        } catch (error) {
            bot.logger.error('Single plugin reload failed:', error);
            return reply(`❌ Failed to reload plugin '${pluginName}': ${error.message}`);
        }
    },

    async reloadAllPlugins(ctx) {
        const { bot, sender, reply } = ctx;

        try {
            const startTime = Date.now();
            
            // Send initial message
            const loadingMsg = await reply('🔄 **RELOADING ALL PLUGINS...**\n\nPlease wait, this may take a moment...');

            // Get current plugin count
            const currentPlugins = bot.pluginManager.getAllPlugins();
            const initialCount = currentPlugins.length;

            // Stop file watcher temporarily
            bot.pluginManager.stopFileWatcher();

            // Clear current plugins
            bot.pluginManager.plugins.clear();

            // Reload all plugins
            await bot.pluginManager.loadPlugins();

            const reloadTime = Date.now() - startTime;
            const newPlugins = bot.pluginManager.getAllPlugins();
            const finalCount = newPlugins.length;

            // Count enabled/disabled
            const enabledCount = newPlugins.filter(p => p.enabled).length;
            const disabledCount = finalCount - enabledCount;

            await reply(`✅ **ALL PLUGINS RELOADED**\n\n` +
                       `📊 **Statistics:**\n` +
                       `• Total Plugins: ${finalCount}\n` +
                       `• Enabled: ${enabledCount}\n` +
                       `• Disabled: ${disabledCount}\n` +
                       `• Previous Count: ${initialCount}\n\n` +
                       `⏱️ **Reload Time:** ${reloadTime}ms\n` +
                       `👤 **Reloaded by:** @${sender.split('@')[0]}\n` +
                       `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                       `🎉 All plugins have been successfully reloaded!`, {
                mentions: [sender]
            });

            // Log the action
            bot.logger.audit('ALL_PLUGINS_RELOADED', sender, {
                previousCount: initialCount,
                newCount: finalCount,
                enabledCount,
                disabledCount,
                reloadTimeMs: reloadTime,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            bot.logger.error('All plugins reload failed:', error);
            
            // Try to restart plugin manager
            try {
                await bot.pluginManager.loadPlugins();
            } catch (restartError) {
                bot.logger.error('Failed to restart plugin manager:', restartError);
            }
            
            return reply(`❌ **RELOAD FAILED**\n\nError: ${error.message}\n\n⚠️ Some plugins may not be working correctly.\nTry restarting the bot if issues persist.`);
        }
    }
};
