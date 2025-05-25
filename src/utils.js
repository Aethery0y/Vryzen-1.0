const crypto = require('crypto');
const path = require('path');

class Utils {
    constructor() {
        this.phoneRegex = /^\+?[1-9]\d{1,14}$/;
        this.urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    }

    // Phone number utilities
    formatPhoneNumber(phone) {
        // Remove all non-digits
        const digits = phone.replace(/\D/g, '');
        
        // Add + if not present
        if (!phone.startsWith('+')) {
            return '+' + digits;
        }
        
        return '+' + digits;
    }

    isValidPhoneNumber(phone) {
        const formatted = this.formatPhoneNumber(phone);
        return this.phoneRegex.test(formatted);
    }

    phoneToWhatsAppId(phone) {
        const formatted = this.formatPhoneNumber(phone);
        return formatted.substring(1) + '@s.whatsapp.net';
    }

    whatsAppIdToPhone(whatsappId) {
        const phone = whatsappId.split('@')[0];
        return '+' + phone;
    }

    // URL utilities
    isValidUrl(url) {
        return this.urlRegex.test(url);
    }

    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return null;
        }
    }

    // Time utilities
    parseTimeString(timeStr) {
        const units = {
            's': 1000,
            'm': 60000,
            'h': 3600000,
            'd': 86400000,
            'w': 604800000
        };
        
        const match = timeStr.toLowerCase().match(/^(\d+)([smhdw])$/);
        if (!match) {
            throw new Error('Invalid time format. Use format like: 5m, 1h, 2d');
        }
        
        const [, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }

    formatTimeString(milliseconds) {
        const units = [
            { name: 'week', ms: 604800000 },
            { name: 'day', ms: 86400000 },
            { name: 'hour', ms: 3600000 },
            { name: 'minute', ms: 60000 },
            { name: 'second', ms: 1000 }
        ];
        
        for (const unit of units) {
            if (milliseconds >= unit.ms) {
                const amount = Math.floor(milliseconds / unit.ms);
                return `${amount} ${unit.name}${amount > 1 ? 's' : ''}`;
            }
        }
        
        return '0 seconds';
    }

    getRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) {
            return 'just now';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diff / 86400000);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    }

    // Text utilities
    escapeMarkdown(text) {
        return text.replace(/[*_`~]/g, '\\$&');
    }

    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    capitalizeFirst(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    cleanWhitespace(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    // Array utilities
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Hash utilities
    generateHash(data, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }

    generateRandomString(length = 16) {
        return crypto.randomBytes(length).toString('hex').substring(0, length);
    }

    // File utilities
    getFileExtension(filename) {
        return path.extname(filename).toLowerCase();
    }

    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9.-]/gi, '_');
    }

    // Message utilities
    extractMentionsFromText(text) {
        const mentionRegex = /@(\d+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1] + '@s.whatsapp.net');
        }
        
        return mentions;
    }

    formatMention(userId) {
        const phone = userId.split('@')[0];
        return `@${phone}`;
    }

    // Number utilities
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    parseNumber(str) {
        const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? null : num;
    }

    // Validation utilities
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidUsername(username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        return usernameRegex.test(username);
    }

    // Rate limiting utilities
    createRateLimiter(maxRequests = 10, windowMs = 60000) {
        const requests = new Map();
        
        return (key) => {
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Clean old entries
            for (const [k, timestamps] of requests.entries()) {
                const filtered = timestamps.filter(t => t > windowStart);
                if (filtered.length === 0) {
                    requests.delete(k);
                } else {
                    requests.set(k, filtered);
                }
            }
            
            // Check current requests
            const userRequests = requests.get(key) || [];
            const recentRequests = userRequests.filter(t => t > windowStart);
            
            if (recentRequests.length >= maxRequests) {
                return false; // Rate limited
            }
            
            // Add current request
            recentRequests.push(now);
            requests.set(key, recentRequests);
            
            return true; // Allowed
        };
    }

    // Media utilities
    getMimeType(buffer) {
        if (buffer.length < 4) return null;
        
        const signatures = {
            'ffd8ff': 'image/jpeg',
            '89504e': 'image/png',
            '474946': 'image/gif',
            '52494646': 'image/webp',
            '49443303': 'audio/mp3',
            '000001ba': 'video/mpeg',
            '1a45dfa3': 'video/webm'
        };
        
        const hex = buffer.toString('hex', 0, 4);
        
        for (const [signature, mimeType] of Object.entries(signatures)) {
            if (hex.startsWith(signature)) {
                return mimeType;
            }
        }
        
        return null;
    }

    // Error handling utilities
    createSafeAsyncHandler(handler) {
        return async (...args) => {
            try {
                return await handler(...args);
            } catch (error) {
                console.error('Async handler error:', error);
                throw error;
            }
        };
    }

    // Configuration utilities
    parseConfigValue(value, type = 'string') {
        switch (type) {
            case 'boolean':
                return value === 'true' || value === '1' || value === true;
            case 'number':
                return parseInt(value) || 0;
            case 'float':
                return parseFloat(value) || 0.0;
            case 'json':
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }
            default:
                return value;
        }
    }

    // Retry utilities
    async retry(fn, maxAttempts = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts) {
                    await this.sleep(delay * attempt);
                }
            }
        }
        
        throw lastError;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Security utilities
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '') // Remove potential HTML
            .replace(/javascript:/gi, '') // Remove javascript: URLs
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
    }

    // Memory utilities
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(usage.external / 1024 / 1024 * 100) / 100
        };
    }
}

// Export singleton instance
module.exports = new Utils();
