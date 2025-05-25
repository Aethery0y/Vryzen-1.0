module.exports = {
    name: 'removeplugin',
    description: 'Uninstall a plugin completely',
    category: 'owner',
    permissions: ['owner'],
    usage: '.removeplugin <plugin_name>',
    aliases: ['uninstallplugin', 'deleteplugin'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length === 0) {
            return reply('❌ Please specify a plugin name to remove.\n\nUsage: `.removeplugin <plugin_name>`\n\nExample: `.removeplugin myplugin`\n\n⚠️ **Warning:** This will permanently delete the plugin file.');
        }

        const pluginName = args[0];

        // Check if plugin exists
        const plugin = bot.pluginManager.plugins.get(pluginName);
        if (!plugin) {
            return reply(`❌ Plugin '${pluginName}' not found.\n\n💡 Use \`.listplugins\` to see all installed plugins.`);
        }

        // Prevent removing critical plugins
        const criticalPlugins = ['help', 'ping', 'plugin', 'addplugin', 'removeplugin', 'addowner', 'removeowner'];
        if (criticalPlugins.includes(pluginName)) {
            return reply(`❌ Cannot remove critical system plugin '${pluginName}'.\n\n🔒 This plugin is essential for bot operation.`);
        }

        // Confirmation prompt
        if (args.length === 1) {
            return reply(`⚠️ **PLUGIN REMOVAL CONFIRMATION**\n\n` +
                        `📝 **Plugin:** ${pluginName}\n` +
                        `📂 **Category:** ${plugin.category}\n` +
                        `📖 **Description:** ${plugin.description}\n\n` +
                        `❌ **This action cannot be undone!**\n` +
                        `🗑️ Plugin file will be permanently deleted.\n\n` +
                        `💡 To confirm removal, use:\n\`.removeplugin ${pluginName} confirm\``);
        }

        // Check for confirmation
        if (args[1] !== 'confirm') {
            return reply(`❌ Invalid confirmation.\n\n💡 To confirm removal, use:\n\`.removeplugin ${pluginName} confirm\``);
        }

        try {
            // Uninstall the plugin
            await bot.pluginManager.uninstallPlugin(pluginName, sender);

            await reply(`🗑️ **PLUGIN REMOVED SUCCESSFULLY**\n\n` +
                       `📝 **Name:** ${pluginName}\n` +
                       `📂 **Category:** ${plugin.category}\n` +
                       `👤 **Removed by:** @${sender.split('@')[0]}\n` +
                       `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                       `✅ Plugin has been completely uninstalled.\n` +
                       `📁 Plugin file has been deleted from disk.`, {
                mentions: [sender]
            });

        } catch (error) {
            bot.logger.error('Remove plugin command failed:', error);
            return reply(`❌ Failed to remove plugin: ${error.message}`);
        }
    }
};
