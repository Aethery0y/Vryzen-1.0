#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class PluginTester {
    constructor() {
        this.pluginsDir = './plugins';
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: [],
            warnings_list: [],
            details: []
        };
    }

    async runTests() {
        console.log(chalk.cyan.bold('🧪 VRYZEN PLUGIN TESTER'));
        console.log(chalk.gray('================================\n'));

        const startTime = Date.now();
        
        try {
            await this.scanAndTestPlugins();
            const duration = Date.now() - startTime;
            this.displayResults(duration);
        } catch (error) {
            console.log(chalk.red('❌ Test execution failed:'), error.message);
        }
    }

    async scanAndTestPlugins() {
        const categories = ['admin', 'owner', 'user', 'media', 'utility', 'moderation'];
        
        for (const category of categories) {
            const categoryPath = path.join(this.pluginsDir, category);
            
            try {
                const files = await fs.readdir(categoryPath);
                
                for (const file of files) {
                    if (file.endsWith('.js')) {
                        await this.testPlugin(category, file);
                    }
                }
            } catch (error) {
                // Category directory might not exist
                continue;
            }
        }
    }

    async testPlugin(category, filename) {
        const pluginPath = path.join(this.pluginsDir, category, filename);
        const pluginName = path.basename(filename, '.js');
        
        const result = {
            name: pluginName,
            category: category,
            status: 'passed',
            issues: [],
            checks: {
                structure: false,
                syntax: false,
                dependencies: false,
                permissions: false,
                execution: false
            }
        };

        this.results.total++;

        try {
            console.log(chalk.blue(`🔍 Testing ${category}/${pluginName}...`));

            // Test 1: File exists and readable
            const pluginContent = await fs.readFile(pluginPath, 'utf8');
            
            // Test 2: Syntax validation
            result.checks.syntax = this.validateSyntax(pluginContent, result);
            
            // Test 3: Load plugin module
            delete require.cache[require.resolve(path.resolve(pluginPath))];
            const plugin = require(path.resolve(pluginPath));
            
            // Test 4: Structure validation
            result.checks.structure = this.validateStructure(plugin, result);
            
            // Test 5: Permission validation
            result.checks.permissions = this.validatePermissions(plugin, result);
            
            // Test 6: Dependencies check
            result.checks.dependencies = this.checkDependencies(pluginContent, result);
            
            // Test 7: Execution validation
            result.checks.execution = this.validateExecution(plugin, result);

            // Determine final status
            if (result.issues.length === 0) {
                result.status = 'passed';
                this.results.passed++;
                console.log(chalk.green(`  ✅ ${pluginName} - All tests passed`));
            } else if (result.issues.some(issue => issue.includes('CRITICAL'))) {
                result.status = 'failed';
                this.results.failed++;
                this.results.errors.push(result);
                console.log(chalk.red(`  ❌ ${pluginName} - Critical issues found`));
            } else {
                result.status = 'warning';
                this.results.warnings++;
                this.results.warnings_list.push(result);
                console.log(chalk.yellow(`  ⚠️  ${pluginName} - Minor issues found`));
            }

        } catch (error) {
            result.status = 'failed';
            result.issues.push(`CRITICAL: Load error - ${error.message}`);
            this.results.failed++;
            this.results.errors.push(result);
            console.log(chalk.red(`  ❌ ${pluginName} - Failed to load: ${error.message}`));
        }

        this.results.details.push(result);
    }

    validateSyntax(content, result) {
        try {
            // Check for basic syntax issues
            const syntaxIssues = [];
            
            // Check for common syntax problems
            if (content.includes('module.exports =') && !content.includes('module.exports = {')) {
                if (!content.match(/module\.exports\s*=\s*\{[\s\S]*\}/)) {
                    syntaxIssues.push('Invalid module.exports structure');
                }
            }
            
            // Check for unmatched brackets
            const openBraces = (content.match(/\{/g) || []).length;
            const closeBraces = (content.match(/\}/g) || []).length;
            if (openBraces !== closeBraces) {
                syntaxIssues.push('Unmatched braces detected');
            }
            
            if (syntaxIssues.length > 0) {
                result.issues.push(`Syntax: ${syntaxIssues.join(', ')}`);
                return false;
            }
            
            return true;
        } catch (error) {
            result.issues.push(`CRITICAL: Syntax validation failed - ${error.message}`);
            return false;
        }
    }

    validateStructure(plugin, result) {
        const required = ['name', 'description', 'execute'];
        const recommended = ['category', 'permissions', 'usage'];
        
        // Check required fields
        for (const field of required) {
            if (!plugin[field]) {
                result.issues.push(`CRITICAL: Missing required field '${field}'`);
                return false;
            }
        }

        // Check execute function
        if (typeof plugin.execute !== 'function') {
            result.issues.push(`CRITICAL: 'execute' must be a function`);
            return false;
        }

        // Check recommended fields
        const missing = recommended.filter(field => !plugin[field]);
        if (missing.length > 0) {
            result.issues.push(`Missing recommended fields: ${missing.join(', ')}`);
        }

        // Validate field types
        if (plugin.permissions && !Array.isArray(plugin.permissions)) {
            result.issues.push(`Invalid 'permissions' type - should be array`);
        }

        if (plugin.aliases && !Array.isArray(plugin.aliases)) {
            result.issues.push(`Invalid 'aliases' type - should be array`);
        }

        if (plugin.cooldown && typeof plugin.cooldown !== 'number') {
            result.issues.push(`Invalid 'cooldown' type - should be number`);
        }

        return true;
    }

    validatePermissions(plugin, result) {
        if (!plugin.permissions) {
            result.issues.push(`No permissions defined - defaulting to 'user'`);
            return true;
        }

        const validRoles = ['user', 'admin', 'owner', 'real_owner'];
        const invalidPerms = plugin.permissions.filter(perm => !validRoles.includes(perm));
        
        if (invalidPerms.length > 0) {
            result.issues.push(`Invalid permissions: ${invalidPerms.join(', ')}`);
            return false;
        }

        return true;
    }

    checkDependencies(content, result) {
        const requiredModules = [];
        const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
        let match;

        while ((match = requireRegex.exec(content)) !== null) {
            const moduleName = match[1];
            if (!moduleName.startsWith('./') && !moduleName.startsWith('../')) {
                requiredModules.push(moduleName);
            }
        }

        // Check if required modules are available
        for (const moduleName of requiredModules) {
            try {
                require.resolve(moduleName);
            } catch (error) {
                result.issues.push(`CRITICAL: Missing dependency '${moduleName}'`);
                return false;
            }
        }

        return true;
    }

    validateExecution(plugin, result) {
        try {
            const executeStr = plugin.execute.toString();
            
            // Check for potentially dangerous patterns
            const dangerousPatterns = [
                { pattern: /process\.exit\s*\(/g, message: 'Uses process.exit()' },
                { pattern: /eval\s*\(/g, message: 'Uses eval()' },
                { pattern: /Function\s*\(/g, message: 'Uses Function constructor' },
                { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/g, message: 'Uses child_process' },
                { pattern: /fs\.unlink|fs\.rmdir|fs\.rm\s*\(/g, message: 'Uses destructive file operations' }
            ];

            for (const { pattern, message } of dangerousPatterns) {
                if (pattern.test(executeStr)) {
                    result.issues.push(`Security concern: ${message}`);
                }
            }

            // Check for common issues
            if (!executeStr.includes('try') && !executeStr.includes('catch')) {
                result.issues.push(`No error handling detected`);
            }

            if (!executeStr.includes('reply') && !executeStr.includes('sendMessage')) {
                result.issues.push(`No response mechanism found`);
            }

            return true;

        } catch (error) {
            result.issues.push(`CRITICAL: Execution validation failed - ${error.message}`);
            return false;
        }
    }

    displayResults(duration) {
        console.log('\n' + chalk.cyan.bold('📊 TEST RESULTS'));
        console.log(chalk.gray('================\n'));

        // Summary
        console.log(chalk.white.bold('📋 SUMMARY:'));
        console.log(`   Total Plugins: ${this.results.total}`);
        console.log(chalk.green(`   ✅ Passed: ${this.results.passed}`));
        console.log(chalk.yellow(`   ⚠️  Warnings: ${this.results.warnings}`));
        console.log(chalk.red(`   ❌ Failed: ${this.results.failed}`));
        console.log(`   ⏱️  Duration: ${duration}ms\n`);

        // Overall status
        if (this.results.failed === 0 && this.results.warnings === 0) {
            console.log(chalk.green.bold('🎉 ALL TESTS PASSED! 🎉\n'));
        } else if (this.results.failed === 0) {
            console.log(chalk.yellow.bold('✅ PASSED WITH WARNINGS\n'));
        } else {
            console.log(chalk.red.bold('❌ SOME TESTS FAILED\n'));
        }

        // Failed plugins
        if (this.results.failed > 0) {
            console.log(chalk.red.bold('❌ FAILED PLUGINS:'));
            for (const error of this.results.errors) {
                console.log(chalk.red(`   • ${error.name} (${error.category})`));
                error.issues.forEach(issue => {
                    console.log(chalk.red(`     - ${issue}`));
                });
            }
            console.log('');
        }

        // Warnings
        if (this.results.warnings > 0) {
            console.log(chalk.yellow.bold('⚠️  WARNINGS:'));
            for (const warning of this.results.warnings_list) {
                console.log(chalk.yellow(`   • ${warning.name} (${warning.category})`));
                warning.issues.forEach(issue => {
                    console.log(chalk.yellow(`     - ${issue}`));
                });
            }
            console.log('');
        }

        // Detailed breakdown by category
        const categories = [...new Set(this.results.details.map(r => r.category))];
        console.log(chalk.white.bold('📂 BREAKDOWN BY CATEGORY:'));
        
        for (const category of categories) {
            const categoryResults = this.results.details.filter(r => r.category === category);
            const passed = categoryResults.filter(r => r.status === 'passed').length;
            const warnings = categoryResults.filter(r => r.status === 'warning').length;
            const failed = categoryResults.filter(r => r.status === 'failed').length;
            
            console.log(`   ${category.toUpperCase()}: ${passed}✅ ${warnings}⚠️ ${failed}❌`);
        }

        console.log('\n' + chalk.gray('Test completed successfully! 🧪'));
    }
}

// Run the tester
async function main() {
    const tester = new PluginTester();
    await tester.runTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PluginTester;