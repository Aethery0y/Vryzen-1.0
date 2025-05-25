class Permissions {
    constructor(bot) {
        this.bot = bot;
        this.realOwner = '918810502592@s.whatsapp.net';
        
        // Permission hierarchy (higher number = more permissions)
        this.roles = {
            'user': 1,
            'admin': 2,
            'owner': 3,
            'real_owner': 4
        };
    }

    async checkPermission(userId, requiredPermissions, chatId, isGroup = true) {
        try {
            // Get user role
            const userRole = await this.getUserRole(userId, chatId, isGroup);
            const userRoleLevel = this.roles[userRole] || 0;
            
            // Check each required permission
            for (const permission of requiredPermissions) {
                const requiredLevel = this.roles[permission] || 0;
                
                if (userRoleLevel >= requiredLevel) {
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            this.bot.logger.error('Permission check failed:', error);
            return false;
        }
    }

    async getUserRole(userId, chatId, isGroup) {
        try {
            // Check if Real Owner
            if (this.isRealOwner(userId)) {
                return 'real_owner';
            }
            
            // Check if added owner
            if (await this.isOwner(userId)) {
                return 'owner';
            }
            
            // Check if group admin (only in groups)
            if (isGroup && await this.isGroupAdmin(userId, chatId)) {
                return 'admin';
            }
            
            return 'user';
            
        } catch (error) {
            this.bot.logger.error('Error getting user role:', error);
            return 'user';
        }
    }

    isRealOwner(userId) {
        return userId === this.realOwner;
    }

    async isOwner(userId) {
        try {
            const user = this.bot.database.getUser(userId);
            return user && user.role === 'owner';
        } catch (error) {
            this.bot.logger.error('Error checking owner status:', error);
            return false;
        }
    }

    async isGroupAdmin(userId, chatId) {
        try {
            if (!this.bot.sock) return false;
            
            const groupMetadata = await this.bot.sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
            
        } catch (error) {
            this.bot.logger.error('Error checking group admin status:', error);
            return false;
        }
    }

    async addOwner(userId, phone, addedBy) {
        try {
            // Only Real Owner can add owners
            if (!this.isRealOwner(addedBy)) {
                throw new Error('Only Real Owner can add owners');
            }
            
            // Prevent adding Real Owner as regular owner
            if (this.isRealOwner(userId)) {
                throw new Error('Cannot modify Real Owner permissions');
            }
            
            // Add owner to database
            this.bot.database.addOwner(userId, phone, addedBy);
            
            // Log action
            this.bot.logger.logOwnerAction('ADD', userId, addedBy, { phone });
            
            return true;
            
        } catch (error) {
            this.bot.logger.error('Error adding owner:', error);
            throw error;
        }
    }

    async removeOwner(userId, removedBy) {
        try {
            // Only Real Owner can remove owners
            if (!this.isRealOwner(removedBy)) {
                throw new Error('Only Real Owner can remove owners');
            }
            
            // Prevent removing Real Owner
            if (this.isRealOwner(userId)) {
                throw new Error('Cannot remove Real Owner');
            }
            
            // Remove owner from database
            this.bot.database.removeOwner(userId);
            
            // Log action
            this.bot.logger.logOwnerAction('REMOVE', userId, removedBy);
            
            return true;
            
        } catch (error) {
            this.bot.logger.error('Error removing owner:', error);
            throw error;
        }
    }

    async canManagePlugins(userId) {
        return this.isRealOwner(userId) || await this.isOwner(userId);
    }

    async canManageOwners(userId) {
        return this.isRealOwner(userId);
    }

    async canKickUser(userId, targetUserId, chatId) {
        try {
            const userRole = await this.getUserRole(userId, chatId, true);
            const targetRole = await this.getUserRole(targetUserId, chatId, true);
            
            const userLevel = this.roles[userRole] || 0;
            const targetLevel = this.roles[targetRole] || 0;
            
            // Must be at least admin to kick
            if (userLevel < this.roles.admin) {
                return false;
            }
            
            // Cannot kick someone with equal or higher role
            if (userLevel <= targetLevel) {
                return false;
            }
            
            return true;
            
        } catch (error) {
            this.bot.logger.error('Error checking kick permission:', error);
            return false;
        }
    }

    async canPromoteUser(userId, chatId) {
        try {
            const userRole = await this.getUserRole(userId, chatId, true);
            const userLevel = this.roles[userRole] || 0;
            
            // Must be at least admin to promote
            return userLevel >= this.roles.admin;
            
        } catch (error) {
            this.bot.logger.error('Error checking promote permission:', error);
            return false;
        }
    }

    async canManageGroup(userId, chatId) {
        try {
            const userRole = await this.getUserRole(userId, chatId, true);
            const userLevel = this.roles[userRole] || 0;
            
            // Must be at least admin to manage group
            return userLevel >= this.roles.admin;
            
        } catch (error) {
            this.bot.logger.error('Error checking group management permission:', error);
            return false;
        }
    }

    getPermissionLevel(role) {
        return this.roles[role] || 0;
    }

    getAllRoles() {
        return Object.keys(this.roles);
    }

    getRoleHierarchy() {
        return Object.entries(this.roles)
            .sort(([,a], [,b]) => b - a)
            .map(([role]) => role);
    }

    validatePermissionList(permissions) {
        if (!Array.isArray(permissions)) {
            return false;
        }
        
        return permissions.every(permission => this.roles.hasOwnProperty(permission));
    }
}

module.exports = Permissions;
