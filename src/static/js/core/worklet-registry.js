/**
 * @fileoverview This module provides a registry for managing Web Audio API worklets.
 * It allows for the creation of worklet URLs from source code, facilitating the dynamic
 * loading and use of audio worklets in web applications.
 */

/**
 * A map to store registered worklets.
 * @type {Map<string, string>}
 */
export const registeredWorklets = new Map();

/**
 * Creates a worklet URL from the provided source code.
 * This function takes the source code of a worklet, wraps it in an immediately invoked function expression (IIFE),
 * creates a Blob from this code, and then generates a URL for the Blob. This URL can be used to load the worklet
 * in an AudioWorkletNode.
 *
 * @param {string} workletName - The name of the worklet.
 * @param {Function} workletSrc - The source code of the worklet, typically a function.
 * @returns {string} The URL of the created worklet.
 */
export function createWorketFromSrc(workletName, workletSrc) {
    const script = new Blob([`(${workletSrc.toString()})()`], { type: 'application/javascript' });
    return URL.createObjectURL(script);
} 