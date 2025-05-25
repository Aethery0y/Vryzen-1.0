const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

class DatabaseManager {
    constructor(dbPath = './data/vryzen.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async init() {
        try {
            // Ensure database directory exists
            const dbDir = path.dirname(this.dbPath);
            await fs.mkdir(dbDir, { recursive: true });

            // Initialize database with WAL mode for better concurrency
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');

            // Create tables
            await this.createTables();
            
            logger.info('Database initialized successfully');
        } catch (error) {
            logger.error('Database initialization failed:', error);
            throw error;
        }
    }

    async createTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                phone TEXT UNIQUE,
                name TEXT,
                role TEXT DEFAULT 'user',
                warnings INTEGER DEFAULT 0,
                banned BOOLEAN DEFAULT 0,
                muted_until INTEGER DEFAULT 0,
                restricted_until INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Groups table
            `CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                locked BOOLEAN DEFAULT 0,
                settings TEXT DEFAULT '{}',
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Plugins table
            `CREATE TABLE IF NOT EXISTS plugins (
                name TEXT PRIMARY KEY,
                category TEXT,
                enabled BOOLEAN DEFAULT 1,
                file_path TEXT,
                metadata TEXT DEFAULT '{}',
                installed_by TEXT,
                installed_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Owners table
            `CREATE TABLE IF NOT EXISTS owners (
                id TEXT PRIMARY KEY,
                phone TEXT UNIQUE,
                added_by TEXT,
                added_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Command logs table
            `CREATE TABLE IF NOT EXISTS command_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                group_id TEXT,
                command TEXT,
                success BOOLEAN,
                error_message TEXT,
                executed_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Group settings table
            `CREATE TABLE IF NOT EXISTS group_settings (
                group_id TEXT,
                setting_key TEXT,
                setting_value TEXT,
                PRIMARY KEY (group_id, setting_key)
            )`,

            // User stats table
            `CREATE TABLE IF NOT EXISTS user_stats (
                user_id TEXT,
                group_id TEXT,
                commands_used INTEGER DEFAULT 0,
                messages_sent INTEGER DEFAULT 0,
                warnings_received INTEGER DEFAULT 0,
                last_active INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, group_id)
            )`,

            // Plugin dependencies table
            `CREATE TABLE IF NOT EXISTS plugin_dependencies (
                plugin_name TEXT,
                dependency_name TEXT,
                version_requirement TEXT,
                PRIMARY KEY (plugin_name, dependency_name)
            )`
        ];

        for (const tableSQL of tables) {
            this.db.exec(tableSQL);
        }

        // Create indexes
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)',
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_command_logs_user ON command_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_command_logs_command ON command_logs(command)',
            'CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category)',
            'CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(enabled)'
        ];

        for (const indexSQL of indexes) {
            this.db.exec(indexSQL);
        }

        // Insert Real Owner if not exists
        this.insertRealOwner();
    }

    insertRealOwner() {
        const realOwnerPhone = '+918810502592';
        const realOwnerId = realOwnerPhone + '@s.whatsapp.net';
        
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO users (id, phone, name, role)
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.run(realOwnerId, realOwnerPhone, 'Real Owner', 'real_owner');
        
        const ownerStmt = this.db.prepare(`
            INSERT OR IGNORE INTO owners (id, phone, added_by)
            VALUES (?, ?, ?)
        `);
        
        ownerStmt.run(realOwnerId, realOwnerPhone, 'SYSTEM');
    }

    // User management
    getUser(userId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(userId);
    }

    createUser(userId, phone, name = null) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO users (id, phone, name, updated_at)
            VALUES (?, ?, ?, strftime('%s', 'now'))
        `);
        return stmt.run(userId, phone, name);
    }

    updateUserRole(userId, role) {
        const stmt = this.db.prepare(`
            UPDATE users SET role = ?, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(role, userId);
    }

    // Warning system
    addWarning(userId) {
        const stmt = this.db.prepare(`
            UPDATE users SET warnings = warnings + 1, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(userId);
    }

    removeWarning(userId) {
        const stmt = this.db.prepare(`
            UPDATE users SET warnings = MAX(0, warnings - 1), updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(userId);
    }

    clearWarnings(userId) {
        const stmt = this.db.prepare(`
            UPDATE users SET warnings = 0, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(userId);
    }

    // Ban/Mute system
    banUser(userId) {
        const stmt = this.db.prepare(`
            UPDATE users SET banned = 1, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(userId);
    }

    unbanUser(userId) {
        const stmt = this.db.prepare(`
            UPDATE users SET banned = 0, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(userId);
    }

    muteUser(userId, duration) {
        const muteUntil = Math.floor(Date.now() / 1000) + duration;
        const stmt = this.db.prepare(`
            UPDATE users SET muted_until = ?, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(muteUntil, userId);
    }

    unmuteUser(userId) {
        const stmt = this.db.prepare(`
            UPDATE users SET muted_until = 0, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(userId);
    }

    // Owner management
    addOwner(ownerId, phone, addedBy) {
        const userStmt = this.db.prepare(`
            INSERT OR REPLACE INTO users (id, phone, role, updated_at)
            VALUES (?, ?, 'owner', strftime('%s', 'now'))
        `);
        
        const ownerStmt = this.db.prepare(`
            INSERT OR REPLACE INTO owners (id, phone, added_by)
            VALUES (?, ?, ?)
        `);
        
        userStmt.run(ownerId, phone);
        return ownerStmt.run(ownerId, phone, addedBy);
    }

    removeOwner(ownerId) {
        const userStmt = this.db.prepare(`
            UPDATE users SET role = 'user', updated_at = strftime('%s', 'now')
            WHERE id = ? AND role = 'owner'
        `);
        
        const ownerStmt = this.db.prepare('DELETE FROM owners WHERE id = ?');
        
        userStmt.run(ownerId);
        return ownerStmt.run(ownerId);
    }

    getAllOwners() {
        const stmt = this.db.prepare('SELECT * FROM owners');
        return stmt.all();
    }

    // Plugin management
    addPlugin(name, category, filePath, metadata = {}, installedBy) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO plugins 
            (name, category, file_path, metadata, installed_by, updated_at)
            VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
        `);
        return stmt.run(name, category, filePath, JSON.stringify(metadata), installedBy);
    }

    removePlugin(name) {
        const stmt = this.db.prepare('DELETE FROM plugins WHERE name = ?');
        return stmt.run(name);
    }

    togglePlugin(name, enabled) {
        const stmt = this.db.prepare(`
            UPDATE plugins SET enabled = ?, updated_at = strftime('%s', 'now')
            WHERE name = ?
        `);
        return stmt.run(enabled ? 1 : 0, name);
    }

    getPlugin(name) {
        const stmt = this.db.prepare('SELECT * FROM plugins WHERE name = ?');
        return stmt.get(name);
    }

    getAllPlugins(category = null) {
        let stmt;
        if (category) {
            stmt = this.db.prepare('SELECT * FROM plugins WHERE category = ? ORDER BY name');
            return stmt.all(category);
        } else {
            stmt = this.db.prepare('SELECT * FROM plugins ORDER BY category, name');
            return stmt.all();
        }
    }

    getEnabledPlugins() {
        const stmt = this.db.prepare('SELECT * FROM plugins WHERE enabled = 1 ORDER BY category, name');
        return stmt.all();
    }

    // Group management
    getGroup(groupId) {
        const stmt = this.db.prepare('SELECT * FROM groups WHERE id = ?');
        return stmt.get(groupId);
    }

    createGroup(groupId, name, description = null) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO groups (id, name, description, updated_at)
            VALUES (?, ?, ?, strftime('%s', 'now'))
        `);
        return stmt.run(groupId, name, description);
    }

    lockGroup(groupId) {
        const stmt = this.db.prepare(`
            UPDATE groups SET locked = 1, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(groupId);
    }

    unlockGroup(groupId) {
        const stmt = this.db.prepare(`
            UPDATE groups SET locked = 0, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(groupId);
    }

    // Group settings
    setGroupSetting(groupId, key, value) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO group_settings (group_id, setting_key, setting_value)
            VALUES (?, ?, ?)
        `);
        return stmt.run(groupId, key, value);
    }

    getGroupSetting(groupId, key) {
        const stmt = this.db.prepare(`
            SELECT setting_value FROM group_settings 
            WHERE group_id = ? AND setting_key = ?
        `);
        const result = stmt.get(groupId, key);
        return result ? result.setting_value : null;
    }

    // Command logging
    logCommand(userId, groupId, command, success, errorMessage = null) {
        const stmt = this.db.prepare(`
            INSERT INTO command_logs (user_id, group_id, command, success, error_message)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, groupId, command, success ? 1 : 0, errorMessage);
    }

    getCommandStats(limit = 100) {
        const stmt = this.db.prepare(`
            SELECT command, COUNT(*) as count, 
                   SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                   SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
            FROM command_logs 
            GROUP BY command 
            ORDER BY count DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    // User statistics
    updateUserStats(userId, groupId, messagesIncrement = 0, commandsIncrement = 0) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO user_stats 
            (user_id, group_id, messages_sent, commands_used, last_active)
            VALUES (
                ?, ?, 
                COALESCE((SELECT messages_sent FROM user_stats WHERE user_id = ? AND group_id = ?), 0) + ?,
                COALESCE((SELECT commands_used FROM user_stats WHERE user_id = ? AND group_id = ?), 0) + ?,
                strftime('%s', 'now')
            )
        `);
        return stmt.run(userId, groupId, userId, groupId, messagesIncrement, userId, groupId, commandsIncrement);
    }

    getUserStats(userId, groupId = null) {
        let stmt;
        if (groupId) {
            stmt = this.db.prepare(`
                SELECT * FROM user_stats WHERE user_id = ? AND group_id = ?
            `);
            return stmt.get(userId, groupId);
        } else {
            stmt = this.db.prepare(`
                SELECT 
                    SUM(messages_sent) as total_messages,
                    SUM(commands_used) as total_commands,
                    COUNT(*) as groups_active,
                    MAX(last_active) as last_active
                FROM user_stats WHERE user_id = ?
            `);
            return stmt.get(userId);
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

module.exports = DatabaseManager;
