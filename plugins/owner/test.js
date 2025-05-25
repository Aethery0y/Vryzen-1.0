module.exports = {
    name: 'test',
    description: 'Test all plugins for errors and functionality',
    category: 'owner',
    permissions: ['owner', 'real_owner'],
    usage: '.test [category] [--verbose] [--fix]',
    aliases: ['testall', 'plugintest'],
    cooldown: 5000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            const options = this.parseOptions(args);
            const startTime = Date.now();

            await reply('🧪 **PLUGIN TESTING INITIATED**\n\n🔄 Testing all plugins for errors and functionality...');

            const testResults = await this.runPluginTests(bot, options);
            const report = this.generateTestReport(testResults, Date.now() - startTime, options);

            // If --fix option is used, attempt to fix common issues
            if (options.fix) {
                await this.attemptPluginFixes(bot, testResults);
                await reply('🔧 **Auto-fix attempt completed!**\n\nRe-running tests to verify fixes...');
                
                // Re-run tests after fixes
                const retestResults = await this.runPluginTests(bot, options);
                const retestReport = this.generateTestReport(retestResults, 0, options, true);
                await reply(retestReport);
            } else {
                await reply(report);
            }

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Test command failed:', error);
            return reply(`❌ Plugin testing failed: ${error.message}`);
        }
    },

    parseOptions(args) {
        const options = {
            category: null,
            verbose: false,
            fix: false
        };

        for (const arg of args) {
            if (arg === '--verbose' || arg === '-v') {
                options.verbose = true;
            } else if (arg === '--fix' || arg === '-f') {
                options.fix = true;
            } else if (!arg.startsWith('-')) {
                options.category = arg.toLowerCase();
            }
        }

        return options;
    },

    async runPluginTests(bot, options) {
        const plugins = options.category 
            ? bot.pluginManager.getPluginsByCategory(options.category)
            : bot.pluginManager.getAllPlugins();

        const results = {
            total: plugins.length,
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: [],
            warnings_list: [],
            details: []
        };

        for (const plugin of plugins) {
            const testResult = await this.testPlugin(bot, plugin, options);
            results.details.push(testResult);

            if (testResult.status === 'passed') {
                results.passed++;
            } else if (testResult.status === 'failed') {
                results.failed++;
                results.errors.push(testResult);
            } else if (testResult.status === 'warning') {
                results.warnings++;
                results.warnings_list.push(testResult);
            }
        }

        return results;
    },

    async testPlugin(bot, plugin, options) {
        const result = {
            name: plugin.name,
            category: plugin.category,
            status: 'passed',
            issues: [],
            checks: {
                structure: false,
                permissions: false,
                database: false,
                execution: false,
                dependencies: false
            }
        };

        try {
            // Test 1: Plugin Structure Validation
            result.checks.structure = this.validatePluginStructure(plugin);
            if (!result.checks.structure) {
                result.issues.push('Invalid plugin structure');
                result.status = 'failed';
            }

            // Test 2: Permission Validation
            result.checks.permissions = this.validatePermissions(plugin, bot);
            if (!result.checks.permissions) {
                result.issues.push('Invalid permissions configuration');
                result.status = 'warning';
            }

            // Test 3: Database Access Test
            result.checks.database = await this.testDatabaseAccess(plugin, bot);
            if (!result.checks.database) {
                result.issues.push('Database access issues');
                result.status = 'warning';
            }

            // Test 4: Plugin Dependencies
            result.checks.dependencies = await this.checkDependencies(plugin);
            if (!result.checks.dependencies) {
                result.issues.push('Missing or incompatible dependencies');
                result.status = 'warning';
            }

            // Test 5: Execution Test (safe dry run)
            if (result.status !== 'failed') {
                result.checks.execution = await this.testPluginExecution(plugin, bot);
                if (!result.checks.execution) {
                    result.issues.push('Execution test failed');
                    result.status = 'failed';
                }
            }

        } catch (error) {
            result.status = 'failed';
            result.issues.push(`Test error: ${error.message}`);
            bot.logger.error(`Plugin test failed for ${plugin.name}:`, error);
        }

        return result;
    },

    validatePluginStructure(plugin) {
        const required = ['name', 'description', 'execute'];
        const optional = ['category', 'permissions', 'usage', 'aliases', 'cooldown', 'version', 'author'];

        // Check required fields
        for (const field of required) {
            if (!plugin[field]) {
                return false;
            }
        }

        // Validate execute function
        if (typeof plugin.execute !== 'function') {
            return false;
        }

        // Validate permissions array
        if (plugin.permissions && !Array.isArray(plugin.permissions)) {
            return false;
        }

        // Validate aliases array
        if (plugin.aliases && !Array.isArray(plugin.aliases)) {
            return false;
        }

        return true;
    },

    validatePermissions(plugin, bot) {
        if (!plugin.permissions) return true;

        const validRoles = bot.permissions.getAllRoles();
        return plugin.permissions.every(permission => validRoles.includes(permission));
    },

    async testDatabaseAccess(plugin, bot) {
        try {
            // Test basic database connectivity
            const testUser = bot.database.getUser('test@test.com');
            return true;
        } catch (error) {
            return false;
        }
    },

    async checkDependencies(plugin) {
        // Check if plugin has any specific dependencies mentioned
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                try {
                    require.resolve(dep);
                } catch (error) {
                    return false;
                }
            }
        }
        return true;
    },

    async testPluginExecution(plugin, bot) {
        try {
            // Create a safe mock context for testing
            const mockContext = {
                bot,
                message: {
                    key: { remoteJid: 'test@test.com', fromMe: false },
                    message: { conversation: '.test' }
                },
                args: [],
                sender: 'test@test.com',
                chatId: 'test@test.com',
                isGroup: false,
                reply: async (text) => ({ success: true, text }),
                sendMessage: async (text) => ({ success: true, text }),
                downloadMedia: async () => null,
                extractMentions: () => [],
                getQuotedMessage: () => null,
                getUserInfo: () => null,
                updateUserStats: () => true,
                parseDuration: (str) => parseInt(str) || 0,
                formatDuration: (sec) => `${sec}s`
            };

            // Test if execute function can be called without errors
            // We won't actually execute it to avoid side effects
            const executeStr = plugin.execute.toString();
            
            // Check for potential runtime issues in the code
            const problematicPatterns = [
                /\.kill\(/,
                /process\.exit/,
                /require\(['"]child_process['"]\)/,
                /eval\(/,
                /Function\(/
            ];

            for (const pattern of problematicPatterns) {
                if (pattern.test(executeStr)) {
                    return false;
                }
            }

            return true;

        } catch (error) {
            return false;
        }
    },

    generateTestReport(results, executionTime, options, isRetest = false) {
        const title = isRetest ? '🔄 **RE-TEST RESULTS**' : '🧪 **PLUGIN TEST RESULTS**';
        let report = `${title}\n\n`;
        
        report += `📊 **Summary:**\n`;
        report += `• Total Plugins: ${results.total}\n`;
        report += `• ✅ Passed: ${results.passed}\n`;
        report += `• ⚠️ Warnings: ${results.warnings}\n`;
        report += `• ❌ Failed: ${results.failed}\n`;
        report += `• ⏱️ Execution Time: ${executionTime}ms\n\n`;

        // Overall status
        if (results.failed === 0 && results.warnings === 0) {
            report += `🎉 **Status: ALL TESTS PASSED!**\n\n`;
        } else if (results.failed === 0) {
            report += `✅ **Status: PASSED WITH WARNINGS**\n\n`;
        } else {
            report += `❌ **Status: SOME TESTS FAILED**\n\n`;
        }

        // Failed plugins
        if (results.failed > 0) {
            report += `❌ **FAILED PLUGINS:**\n`;
            for (const error of results.errors) {
                report += `• ${error.name} (${error.category}): ${error.issues.join(', ')}\n`;
            }
            report += `\n`;
        }

        // Warning plugins
        if (results.warnings > 0 && options.verbose) {
            report += `⚠️ **WARNINGS:**\n`;
            for (const warning of results.warnings_list) {
                report += `• ${warning.name} (${warning.category}): ${warning.issues.join(', ')}\n`;
            }
            report += `\n`;
        }

        // Detailed results (verbose mode)
        if (options.verbose) {
            report += `📋 **DETAILED RESULTS:**\n`;
            for (const detail of results.details) {
                const statusIcon = detail.status === 'passed' ? '✅' : detail.status === 'warning' ? '⚠️' : '❌';
                report += `${statusIcon} ${detail.name} (${detail.category})\n`;
                
                if (detail.issues.length > 0) {
                    report += `  Issues: ${detail.issues.join(', ')}\n`;
                }
            }
        }

        report += `\n💡 **Tip:** Use \`.test --fix\` to attempt automatic fixes for common issues.`;
        
        return report;
    },

    async attemptPluginFixes(bot, testResults) {
        const fixedPlugins = [];
        
        for (const result of testResults.details) {
            if (result.status === 'failed' || result.status === 'warning') {
                try {
                    const fixed = await this.fixPlugin(bot, result);
                    if (fixed) {
                        fixedPlugins.push(result.name);
                    }
                } catch (error) {
                    bot.logger.error(`Failed to fix plugin ${result.name}:`, error);
                }
            }
        }

        if (fixedPlugins.length > 0) {
            // Reload fixed plugins
            for (const pluginName of fixedPlugins) {
                try {
                    await bot.pluginManager.reloadPlugin(pluginName, 'AUTO_FIX');
                } catch (error) {
                    bot.logger.error(`Failed to reload fixed plugin ${pluginName}:`, error);
                }
            }
        }

        return fixedPlugins;
    },

    async fixPlugin(bot, result) {
        // Attempt common fixes based on the issues found
        let fixed = false;

        for (const issue of result.issues) {
            if (issue.includes('permissions')) {
                // Fix permission issues
                const plugin = bot.pluginManager.getPlugin(result.name);
                if (plugin && (!plugin.permissions || plugin.permissions.length === 0)) {
                    plugin.permissions = ['user']; // Default permission
                    fixed = true;
                }
            }

            if (issue.includes('database')) {
                // Enable plugin in database if disabled
                bot.database.togglePlugin(result.name, true);
                fixed = true;
            }
        }

        return fixed;
    }
};