# Adding Custom Tools to the Gemini API Client

This guide explains how to extend the functionality of the Gemini API client by adding your own custom tools. Tools allow you to define functions that the Gemini model can call to perform specific actions or retrieve information from external sources.

## Tool Structure

Each tool is defined as a JavaScript class with two main methods:

* `getDeclaration()`: Returns the tool's declaration, which describes the function's name, parameters, and purpose to the Gemini API.
* `execute(args)`: Contains the actual implementation of the tool's functionality. It takes an object `args` containing the parameters provided by the Gemini API and returns the result of the function call. Read more in [Google's official documentation](https://ai.google.dev/gemini-api/docs/function-calling).

## Steps to Add a Custom Tool

1. **Create a new JavaScript file** for your tool inside the `js/tools` directory. Name the file appropriately, e.g., `my-custom-tool.js`.

2. **Define your tool class** in the new file. For example:

    ```javascript
    import { Logger } from '../utils/logger.js';

    export class MyCustomTool {
        getDeclaration() {
            return [{
                name: "my_custom_function",
                description: "This is a description of what my custom function does.",
                parameters: {
                    type: "object",
                    properties: {
                        param1: {
                            type: "string",
                            description: "Description of param1"
                        },
                        param2: {
                            type: "number",
                            description: "Description of param2"
                        }
                    },
                    required: ["param1"]
                }
            }];
        }

        async execute(args) {
            try {
                Logger.info('Executing MyCustomTool', args);
                // Your custom tool logic here
                const result = `param1: ${args.param1}, param2: ${args.param2}`;
                return result;
            } catch (error) {
                Logger.error('MyCustomTool failed', error);
                throw error;
            }
        }
    }    ```

3. **Register your tool** in `js/tools/tool-manager.js`:

    ```javascript
    import { MyCustomTool } from './my-custom-tool.js';

    // ... other imports ...

    export class ToolManager {
        constructor() {
            this.tools = new Map();
            this.registerDefaultTools();
        }

        registerDefaultTools() {
            this.registerTool('googleSearch', new GoogleSearchTool());
            this.registerTool('weather', new WeatherTool());
            // Add your custom tool here
            this.registerTool('myCustomTool', new MyCustomTool());
        }

        // ... rest of the class ...
    }    ```

4. **Use your tool** in the conversation with the Gemini API. When the model determines that your tool should be used, it will send a function call request, and the `ToolManager` will execute the corresponding `execute` method of your tool.

## Example: `google-search.js`

The `google-search.js` file provides a placeholder for integrating with the Google Search API. In the current implementation, it simply logs the search query and returns `null` because the actual search functionality is handled server-side by the Gemini API.

## Example: `weather-tool.js`

The `weather-tool.js` file demonstrates a mock implementation of a weather tool. It defines a function `get_weather_on_date` that takes a location and date as input and returns a simulated weather forecast.

## Important Considerations

* **Error Handling:** Implement proper error handling in your `execute` method to catch and handle potential issues.
* **Logging:** Use the `Logger` utility to log important events and debug information.
* **Asynchronous Operations:** If your tool performs asynchronous operations (e.g., network requests), make sure your `execute` method is `async` and use `await` to handle promises.
* **Security:** Be mindful of security implications when integrating with external APIs or services. Avoid exposing sensitive information in your tool's implementation or logs.
