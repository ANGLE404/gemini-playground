import { Logger } from '../utils/logger.js';

/**
 * Represents a tool for retrieving weather forecasts.
 * This tool provides a mock implementation for demonstration purposes.
 */
export class WeatherTool {
    /**
     * Returns the tool declaration for the Gemini API.
     * The declaration defines the function name, description, and parameters.
     *
     * @returns {Object[]} An array containing the function declaration for getting weather on a specific date.
     */
    getDeclaration() {
        // Return an array of function declarations
        return [{
            name: "get_weather_on_date",
            description: "Get the weather forecast for a specific location and date",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "The location to get weather for (city name)"
                    },
                    date: {
                        type: "string",
                        description: "The date to get weather for (YYYY-MM-DD format)"
                    }
                },
                required: ["location", "date"]
            }
        }];
    }

    /**
     * Executes the weather tool.
     * Generates a mock weather forecast based on the provided location and date.
     *
     * @param {Object} args - The arguments for the tool.
     * @param {string} args.location - The location for the weather forecast.
     * @param {string} args.date - The date for the weather forecast (YYYY-MM-DD).
     * @returns {Promise<Object>} A promise that resolves with the weather forecast.
     * @throws {Error} Throws an error if the tool execution fails.
     */
    async execute(args) {
        try {
            Logger.info('Executing Weather Tool', args);
            const { location, date } = args;

            // Mock weather data
            const weatherConditions = [
                'sunny', 'partly cloudy', 'cloudy', 
                'light rain', 'heavy rain', 'thunderstorm',
                'windy', 'snow', 'foggy'
            ];
            
            const temperatures = {
                sunny: { min: 20, max: 35 },
                'partly cloudy': { min: 18, max: 30 },
                cloudy: { min: 15, max: 25 },
                'light rain': { min: 12, max: 20 },
                'heavy rain': { min: 10, max: 18 },
                thunderstorm: { min: 15, max: 25 },
                windy: { min: 8, max: 15 },
                snow: { min: -5, max: 5 },
                foggy: { min: 5, max: 15 }
            };

            // Generate consistent but pseudo-random weather based on location and date
            const seed = this.hashString(`${location}${date}`);
            const condition = weatherConditions[seed % weatherConditions.length];
            const temp = temperatures[condition];
            
            // Add some randomness to temperature within the range
            const currentTemp = temp.min + (seed % (temp.max - temp.min));

            return {
                location,
                date,
                condition,
                temperature: Math.round(currentTemp),
                humidity: 40 + (seed % 40), // Random humidity between 40-80%
                windSpeed: 5 + (seed % 25),  // Random wind speed between 5-30 km/h
                forecast: `The weather in ${location} on ${date} will be ${condition} with a temperature of ${Math.round(currentTemp)}°C`
            };

        } catch (error) {
            Logger.error('Weather Tool failed', error);
            throw error;
        }
    }

    /**
     * Generates a numeric hash from a string.
     * Used to create a pseudo-random seed for consistent weather generation.
     *
     * @param {string} str - The input string.
     * @returns {number} The numeric hash.
     */
    // Helper function to generate a numeric hash from a string
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
} 