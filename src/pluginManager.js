const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const { VM } = require('vm2');
const crypto = require('crypto');
const fileType = require('file-type');

class PluginManager {
    constructor(bot) {
        this.bot = bot;
        this.plugins = new Map();
        this.pluginStates = new Map();
        this.pluginCategories = ['admin', 'owner', 'user', 'media', 'utility', 'moderation'];
        this.pluginsDir = './plugins';
        this.watcher = null;
    }

    async loadPlugins() {
        try {
            this.bot.logger.info('Loading plugins...');
            
            // Ensure plugins directory exists
            await fs.mkdir(this.pluginsDir, { recursive: true });
            
            // Create category directories
            for (const category of this.pluginCategories) {
                await fs.mkdir(path.join(this.pluginsDir, category), { recursive: true });
            }

            // Load enabled plugins from database
            const enabledPlugins = this.bot.database.getEnabledPlugins();
            
            // Scan plugins directory
            await this.scanPluginsDirectory();
            
            // Start file watcher for hot-reload
            this.startFileWatcher();
            
            this.bot.logger.info(`Loaded ${this.plugins.size} plugins`);
            
        } catch (error) {
            this.bot.logger.error('Failed to load plugins:', error);
            throw error;
        }
    }

    async scanPluginsDirectory() {
        try {
            for (const category of this.pluginCategories) {
                const categoryPath = path.join(this.pluginsDir, category);
                
                try {
                    const files = await fs.readdir(categoryPath);
                    
                    for (const file of files) {
                        if (file.endsWith('.js')) {
                            await this.loadPlugin(category, file);
                        }
                    }
                } catch (error) {
                    // Category directory might not exist
                    continue;
                }
            }
        } catch (error) {
            this.bot.logger.error('Error scanning plugins directory:', error);
        }
    }

    async loadPlugin(category, filename) {
        try {
            const pluginPath = path.join(this.pluginsDir, category, filename);
            const pluginName = path.basename(filename, '.js');
            
            // Check if plugin exists in database
            const dbPlugin = this.bot.database.getPlugin(pluginName);
            if (dbPlugin && !dbPlugin.enabled) {
                this.bot.logger.debug(`Plugin ${pluginName} is disabled, skipping load`);
                return;
            }

            // Delete from require cache to allow hot-reload
            delete require.cache[require.resolve(path.resolve(pluginPath))];
            
            // Load plugin module
            const pluginModule = require(path.resolve(pluginPath));
            
            // Validate plugin structure
            if (!this.validatePlugin(pluginModule)) {
                this.bot.logger.error(`Invalid plugin structure: ${pluginName}`);
                return;
            }

            // Register plugin
            this.plugins.set(pluginName, {
                ...pluginModule,
                category,
                filename,
                filePath: pluginPath,
                loadedAt: Date.now()
            });

            // Update database
            this.bot.database.addPlugin(
                pluginName,
                category,
                pluginPath,
                {
                    version: pluginModule.version || '1.0.0',
                    description: pluginModule.description || '',
                    author: pluginModule.author || 'Unknown',
                    permissions: pluginModule.permissions || []
                },
                'SYSTEM'
            );

            this.bot.logger.info(`Loaded plugin: ${pluginName} (${category})`);
            
        } catch (error) {
            this.bot.logger.error(`Failed to load plugin ${filename}:`, error);
        }
    }

    validatePlugin(plugin) {
        // Required properties
        const required = ['name', 'description', 'execute'];
        
        for (const prop of required) {
            if (!plugin[prop]) {
                return false;
            }
        }

        // Validate execute function
        if (typeof plugin.execute !== 'function') {
            return false;
        }

        // Validate permissions if present
        if (plugin.permissions && !Array.isArray(plugin.permissions)) {
            return false;
        }

        return true;
    }

    async installPlugin(pluginFile, installedBy) {
        try {
            // Validate file type
            const fileTypeResult = await fileType.fromBuffer(pluginFile);
            if (!fileTypeResult || !['application/javascript', 'text/plain'].includes(fileTypeResult.mime)) {
                throw new Error('Invalid file type. Only JavaScript files are allowed.');
            }

            // Parse plugin content
            const pluginContent = pluginFile.toString('utf8');
            
            // Create secure VM for validation
            const vm = new VM({
                timeout: 5000,
                sandbox: {
                    module: { exports: {} },
                    exports: {}
                }
            });

            // Execute plugin in sandbox to validate
            let pluginModule;
            try {
                pluginModule = vm.run(`${pluginContent}; module.exports;`);
            } catch (error) {
                throw new Error(`Plugin validation failed: ${error.message}`);
            }

            // Validate plugin structure
            if (!this.validatePlugin(pluginModule)) {
                throw new Error('Invalid plugin structure');
            }

            // Check for malicious patterns
            if (this.containsMaliciousPatterns(pluginContent)) {
                throw new Error('Plugin contains potentially malicious code');
            }

            // Generate plugin hash for integrity
            const pluginHash = crypto.createHash('sha256').update(pluginContent).digest('hex');
            
            // Save plugin file
            const category = this.determinePluginCategory(pluginModule);
            const filename = `${pluginModule.name}.js`;
            const filePath = path.join(this.pluginsDir, category, filename);
            
            await fs.writeFile(filePath, pluginContent);
            
            // Load plugin
            await this.loadPlugin(category, filename);
            
            // Log installation
            this.bot.logger.logPlugin('INSTALL', pluginModule.name, installedBy, {
                category,
                hash: pluginHash,
                version: pluginModule.version || '1.0.0'
            });

            return {
                success: true,
                name: pluginModule.name,
                category,
                hash: pluginHash
            };

        } catch (error) {
            this.bot.logger.error('Plugin installation failed:', error);
            throw error;
        }
    }

    containsMaliciousPatterns(content) {
        const dangerousPatterns = [
            /require\s*\(\s*['"]child_process['"]\s*\)/,
            /require\s*\(\s*['"]fs['"]\s*\)/,
            /require\s*\(\s*['"]process['"]\s*\)/,
            /eval\s*\(/,
            /Function\s*\(/,
            /process\.exit/,
            /process\.kill/,
            /\.exec\s*\(/,
            /\.spawn\s*\(/,
            /\.fork\s*\(/,
            /import\s+.*from\s+['"]child_process['"]/,
            /import\s+.*from\s+['"]fs['"]/
        ];

        return dangerousPatterns.some(pattern => pattern.test(content));
    }

    determinePluginCategory(plugin) {
        // Auto-determine category based on plugin permissions
        const permissions = plugin.permissions || [];
        
        if (permissions.includes('owner') || permissions.includes('real_owner')) {
            return 'owner';
        } else if (permissions.includes('admin')) {
            return 'admin';
        } else if (plugin.name.includes('media') || plugin.category === 'media') {
            return 'media';
        } else {
            return 'user';
        }
    }

    async uninstallPlugin(pluginName, uninstalledBy) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error('Plugin not found');
            }

            // Remove from plugins map
            this.plugins.delete(pluginName);
            
            // Remove file
            await fs.unlink(plugin.filePath);
            
            // Remove from database
            this.bot.database.removePlugin(pluginName);
            
            // Log uninstallation
            this.bot.logger.logPlugin('UNINSTALL', pluginName, uninstalledBy);
            
            return true;
            
        } catch (error) {
            this.bot.logger.error('Plugin uninstallation failed:', error);
            throw error;
        }
    }

    async togglePlugin(pluginName, enabled, toggledBy) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error('Plugin not found');
            }

            // Update database
            this.bot.database.togglePlugin(pluginName, enabled);
            
            // Update plugin state
            this.pluginStates.set(pluginName, enabled);
            
            // Log toggle action
            this.bot.logger.logPlugin(enabled ? 'ENABLE' : 'DISABLE', pluginName, toggledBy);
            
            return true;
            
        } catch (error) {
            this.bot.logger.error('Plugin toggle failed:', error);
            throw error;
        }
    }

    isPluginEnabled(pluginName) {
        // Check runtime state first, then database
        if (this.pluginStates.has(pluginName)) {
            return this.pluginStates.get(pluginName);
        }
        
        const dbPlugin = this.bot.database.getPlugin(pluginName);
        return dbPlugin ? Boolean(dbPlugin.enabled) : false;
    }

    getPlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (plugin && this.isPluginEnabled(pluginName)) {
            return plugin;
        }
        return null;
    }

    getAllPlugins() {
        return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
            name,
            ...plugin,
            enabled: this.isPluginEnabled(name)
        }));
    }

    getPluginsByCategory(category) {
        return this.getAllPlugins().filter(plugin => plugin.category === category);
    }

    async reloadPlugin(pluginName, reloadedBy) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error('Plugin not found');
            }

            // Reload plugin
            await this.loadPlugin(plugin.category, plugin.filename);
            
            // Log reload
            this.bot.logger.logPlugin('RELOAD', pluginName, reloadedBy);
            
            return true;
            
        } catch (error) {
            this.bot.logger.error('Plugin reload failed:', error);
            throw error;
        }
    }

    startFileWatcher() {
        // Watch plugins directory for changes
        this.watcher = chokidar.watch(this.pluginsDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        this.watcher
            .on('change', (filePath) => {
                if (filePath.endsWith('.js')) {
                    this.handleFileChange(filePath);
                }
            })
            .on('add', (filePath) => {
                if (filePath.endsWith('.js')) {
                    this.handleFileAdd(filePath);
                }
            })
            .on('unlink', (filePath) => {
                if (filePath.endsWith('.js')) {
                    this.handleFileRemove(filePath);
                }
            });

        this.bot.logger.info('Plugin file watcher started');
    }

    async handleFileChange(filePath) {
        try {
            const relativePath = path.relative(this.pluginsDir, filePath);
            const pathParts = relativePath.split(path.sep);
            
            if (pathParts.length === 2) {
                const [category, filename] = pathParts;
                this.bot.logger.info(`Plugin file changed: ${filename}`);
                await this.loadPlugin(category, filename);
            }
        } catch (error) {
            this.bot.logger.error('Error handling file change:', error);
        }
    }

    async handleFileAdd(filePath) {
        try {
            const relativePath = path.relative(this.pluginsDir, filePath);
            const pathParts = relativePath.split(path.sep);
            
            if (pathParts.length === 2) {
                const [category, filename] = pathParts;
                this.bot.logger.info(`New plugin file detected: ${filename}`);
                await this.loadPlugin(category, filename);
            }
        } catch (error) {
            this.bot.logger.error('Error handling file add:', error);
        }
    }

    handleFileRemove(filePath) {
        try {
            const relativePath = path.relative(this.pluginsDir, filePath);
            const pathParts = relativePath.split(path.sep);
            
            if (pathParts.length === 2) {
                const [category, filename] = pathParts;
                const pluginName = path.basename(filename, '.js');
                
                this.bot.logger.info(`Plugin file removed: ${filename}`);
                this.plugins.delete(pluginName);
            }
        } catch (error) {
            this.bot.logger.error('Error handling file remove:', error);
        }
    }

    stopFileWatcher() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            this.bot.logger.info('Plugin file watcher stopped');
        }
    }
}

module.exports = PluginManager;
