module.exports = {
    name: 'plugin',
    description: 'Enable/disable plugins or get plugin status',
    category: 'owner',
    permissions: ['owner'],
    usage: '.plugin <on/off/status> [plugin_name]',
    aliases: ['plugins'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length === 0) {
            return reply('❌ Please specify an action.\n\nUsage: `.plugin <on/off/status> [plugin_name]`\n\nExamples:\n• `.plugin status` - Show all plugins\n• `.plugin on kick` - Enable kick plugin\n• `.plugin off ban` - Disable ban plugin');
        }

        const action = args[0].toLowerCase();
        const pluginName = args[1];

        try {
            switch (action) {
                case 'status':
                case 'list':
                    await this.showPluginStatus(ctx, pluginName);
                    break;

                case 'on':
                case 'enable':
                    if (!pluginName) {
                        return reply('❌ Please specify a plugin name.\n\nUsage: `.plugin on <plugin_name>`');
                    }
                    await this.enablePlugin(ctx, pluginName);
                    break;

                case 'off':
                case 'disable':
                    if (!pluginName) {
                        return reply('❌ Please specify a plugin name.\n\nUsage: `.plugin off <plugin_name>`');
                    }
                    await this.disablePlugin(ctx, pluginName);
                    break;

                default:
                    return reply('❌ Invalid action.\n\nValid actions: `on`, `off`, `status`\n\nExamples:\n• `.plugin status`\n• `.plugin on kick`\n• `.plugin off ban`');
            }

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Plugin command failed:', error);
            return reply('❌ Plugin command failed. Please try again.');
        }
    },

    async showPluginStatus(ctx, specificPlugin = null) {
        const { bot, reply } = ctx;

        try {
            if (specificPlugin) {
                // Show specific plugin info
                const plugin = bot.pluginManager.getPlugin(specificPlugin);
                const dbPlugin = bot.database.getPlugin(specificPlugin);
                
                if (!plugin && !dbPlugin) {
                    return reply(`❌ Plugin '${specificPlugin}' not found.`);
                }

                const isEnabled = bot.pluginManager.isPluginEnabled(specificPlugin);
                const pluginData = plugin || dbPlugin;
                
                let statusMessage = `🔌 **PLUGIN STATUS**\n\n`;
                statusMessage += `📝 **Name:** ${specificPlugin}\n`;
                statusMessage += `📂 **Category:** ${pluginData.category || 'Unknown'}\n`;
                statusMessage += `🔘 **Status:** ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
                statusMessage += `📖 **Description:** ${pluginData.description || 'No description'}\n`;
                
                if (pluginData.permissions) {
                    statusMessage += `🔐 **Permissions:** ${pluginData.permissions.join(', ')}\n`;
                }
                
                if (pluginData.aliases) {
                    statusMessage += `🏷️ **Aliases:** ${pluginData.aliases.join(', ')}\n`;
                }
                
                if (pluginData.usage) {
                    statusMessage += `💡 **Usage:** ${pluginData.usage}\n`;
                }

                return reply(statusMessage);
            }

            // Show all plugins
            const allPlugins = bot.pluginManager.getAllPlugins();
            
            if (allPlugins.length === 0) {
                return reply('❌ No plugins found.');
            }

            // Group by category
            const categories = {};
            allPlugins.forEach(plugin => {
                const category = plugin.category || 'uncategorized';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(plugin);
            });

            let statusMessage = `🔌 **PLUGIN STATUS**\n\n`;
            statusMessage += `📊 **Total Plugins:** ${allPlugins.length}\n\n`;

            for (const [category, plugins] of Object.entries(categories)) {
                statusMessage += `📂 **${category.toUpperCase()} (${plugins.length})**\n`;
                
                plugins.forEach(plugin => {
                    const status = plugin.enabled ? '✅' : '❌';
                    statusMessage += `${status} ${plugin.name}\n`;
                });
                
                statusMessage += `\n`;
            }

            statusMessage += `💡 **Usage:**\n`;
            statusMessage += `• \`.plugin status <name>\` - Plugin details\n`;
            statusMessage += `• \`.plugin on <name>\` - Enable plugin\n`;
            statusMessage += `• \`.plugin off <name>\` - Disable plugin`;

            return reply(statusMessage);

        } catch (error) {
            bot.logger.error('Show plugin status failed:', error);
            return reply('❌ Failed to get plugin status.');
        }
    },

    async enablePlugin(ctx, pluginName) {
        const { bot, sender, reply } = ctx;

        try {
            const plugin = bot.pluginManager.plugins.get(pluginName);
            if (!plugin) {
                return reply(`❌ Plugin '${pluginName}' not found.`);
            }

            if (bot.pluginManager.isPluginEnabled(pluginName)) {
                return reply(`❌ Plugin '${pluginName}' is already enabled.`);
            }

            await bot.pluginManager.togglePlugin(pluginName, true, sender);

            await reply(`✅ **PLUGIN ENABLED**\n\n` +
                       `📝 **Plugin:** ${pluginName}\n` +
                       `📂 **Category:** ${plugin.category}\n` +
                       `👤 **Enabled by:** @${sender.split('@')[0]}\n` +
                       `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                       `🔄 Plugin is now active and ready to use.`, {
                mentions: [sender]
            });

        } catch (error) {
            bot.logger.error('Enable plugin failed:', error);
            return reply(`❌ Failed to enable plugin: ${error.message}`);
        }
    },

    async disablePlugin(ctx, pluginName) {
        const { bot, sender, reply } = ctx;

        try {
            const plugin = bot.pluginManager.plugins.get(pluginName);
            if (!plugin) {
                return reply(`❌ Plugin '${pluginName}' not found.`);
            }

            if (!bot.pluginManager.isPluginEnabled(pluginName)) {
                return reply(`❌ Plugin '${pluginName}' is already disabled.`);
            }

            // Prevent disabling critical plugins
            const criticalPlugins = ['help', 'ping', 'plugin'];
            if (criticalPlugins.includes(pluginName)) {
                return reply(`❌ Cannot disable critical plugin '${pluginName}'.`);
            }

            await bot.pluginManager.togglePlugin(pluginName, false, sender);

            await reply(`❌ **PLUGIN DISABLED**\n\n` +
                       `📝 **Plugin:** ${pluginName}\n` +
                       `📂 **Category:** ${plugin.category}\n` +
                       `👤 **Disabled by:** @${sender.split('@')[0]}\n` +
                       `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                       `⏸️ Plugin is now inactive and cannot be used.`, {
                mentions: [sender]
            });

        } catch (error) {
            bot.logger.error('Disable plugin failed:', error);
            return reply(`❌ Failed to disable plugin: ${error.message}`);
        }
    }
};
