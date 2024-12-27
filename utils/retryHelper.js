// utils/retryHelper.js
const retry = require('async-retry');

// Retry utility function
async function retryQuery(queryFunction, retries = 5, factor = 2, minTimeout = 1000, maxTimeout = 5000) {
    try {
        const result = await retry(queryFunction, {
            retries,
            factor,
            minTimeout,
            maxTimeout
        });
        return result;
    } catch (error) {
        console.error('Error with retrying operation:', error);
        throw error;
    }
}

module.exports = { retryQuery };
