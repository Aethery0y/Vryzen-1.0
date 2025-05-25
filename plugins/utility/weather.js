module.exports = {
    name: 'weather',
    description: 'Get current weather information for a location',
    category: 'utility',
    permissions: ['user'],
    usage: '.weather <city>',
    aliases: ['clima', 'temp'],
    cooldown: 3000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length === 0) {
            return reply('❌ Please provide a city name.\n\nUsage: `.weather <city>`\n\nExample: `.weather New York`');
        }

        const location = args.join(' ');

        try {
            await reply(`🔄 Getting weather information for ${location}...`);

            // Use WeatherStack API
            const apiKey = '4ff7149251afeefc7276af368285cc3b';
            const apiUrl = `http://api.weatherstack.com/current?access_key=${apiKey}&query=${encodeURIComponent(location)}`;

            const fetch = require('node-fetch');
            const response = await fetch(apiUrl);
            const weatherData = await response.json();

            if (weatherData.error) {
                return reply(`❌ Weather information not found for "${location}".\n\nPlease check the location name and try again.\n\n💡 Try using city names like "New York", "London", or "Tokyo"`);
            }

            if (!weatherData.current) {
                return reply(`❌ Unable to retrieve weather data for "${location}".\n\nPlease try a different location.`);
            }

            const current = weatherData.current;
            const location_info = weatherData.location;

            let weatherMessage = `🌤️ **WEATHER REPORT**\n\n`;
            weatherMessage += `📍 **Location:** ${location_info.name}, ${location_info.country}\n`;
            weatherMessage += `🌡️ **Temperature:** ${current.temperature}°C (feels like ${current.feelslike}°C)\n`;
            weatherMessage += `☁️ **Condition:** ${current.weather_descriptions[0]}\n`;
            weatherMessage += `💨 **Wind:** ${current.wind_speed} km/h ${current.wind_dir}\n`;
            weatherMessage += `💧 **Humidity:** ${current.humidity}%\n`;
            weatherMessage += `👁️ **Visibility:** ${current.visibility} km\n`;
            weatherMessage += `🧭 **Pressure:** ${current.pressure} mbar\n`;
            weatherMessage += `☀️ **UV Index:** ${current.uv_index}\n\n`;
            weatherMessage += `🕐 **Local Time:** ${location_info.localtime}\n`;
            weatherMessage += `⏰ **Last Updated:** ${current.observation_time}`;

            await reply(weatherMessage);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Weather command failed:', error);
            return reply('❌ Failed to get weather information. Please try again later.');
        }
    }
};