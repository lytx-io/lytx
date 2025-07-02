/**
 * Generate a new encryption key (run this locally once, not in production)
 * @returns Base64 encoded encryption key
 */
export async function generateEncryptionKey(): Promise<string> {
    const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const exportedKey = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
}


/**
 * Import an encryption key from base64 format
 * @param keyBase64 Base64 encoded encryption key
 * @returns CryptoKey object for encryption/decryption
 */
export async function getEncryptionKey(keyBase64: string): Promise<CryptoKey> {
    const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}


/**
 * Encrypt a string value
 * @param value The string to encrypt
 * @param keyBase64 Base64 encoded encryption key
 * @returns Object containing encrypted value and initialization vector
 */
export async function encrypt(value: string, keyBase64: string): Promise<{
    encryptedValue: string;
    iv: string;
}> {
    // Create a random initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Get the key
    const key = await getEncryptionKey(keyBase64);

    // Encode the string as bytes
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(value);

    // Encrypt the value
    const encryptedBytes = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        valueBytes
    );

    // Convert to base64 for storage
    const encryptedValue = btoa(String.fromCharCode(...new Uint8Array(encryptedBytes)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return { encryptedValue, iv: ivBase64 };
}


/**
 * Decrypt an encrypted string value
 * @param encryptedValue Base64 encoded encrypted value
 * @param ivBase64 Base64 encoded initialization vector
 * @param keyBase64 Base64 encoded encryption key
 * @returns The decrypted string
 */
export async function decrypt(
    encryptedValue: string,
    ivBase64: string,
    keyBase64: string
): Promise<string> {
    try {
        // Convert from base64
        const encryptedBytes = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

        // Get the key
        const key = await getEncryptionKey(keyBase64);

        // Decrypt
        const decryptedBytes = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            encryptedBytes
        );

        // Convert back to string
        const decoder = new TextDecoder();
        return decoder.decode(decryptedBytes);
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Failed to decrypt value. The data may be corrupted or the key is incorrect.");
    }
}
