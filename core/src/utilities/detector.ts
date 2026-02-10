import DeviceDetector from "device-detector-js";

enum BROWSER_ENUM {
    EDGE,
    INTERNET_EXPLORER,
    FIRE_FOX,
    OPERA,
    UC_BROWSER,
    SAMSUNG_BROWSER,
    CHROME,
    SAFARI,
    UNKNOWN,
}
export function parseUserAgent(userAgent: string) {
    const deviceDetector = new DeviceDetector();
    const device = deviceDetector.parse(userAgent);

    return device;
}

export function parseBrowser(
    device: DeviceDetector.DeviceDetectorResult,
    rawUserAgent: string
) {
    if (device.client && device.client.name) {
        return device.client.name;
    } else return BROWSER_ENUM[detectBrowser(rawUserAgent)];
}

export function detectBrowser(userAgent: string): BROWSER_ENUM {
    const testUserAgent = (regexp: RegExp): boolean => regexp.test(userAgent);
    switch (true) {
        case testUserAgent(/edg/i):
            return BROWSER_ENUM.EDGE;
        case testUserAgent(/trident/i):
            return BROWSER_ENUM.INTERNET_EXPLORER;
        case testUserAgent(/firefox|fxios/i):
            return BROWSER_ENUM.FIRE_FOX;
        case testUserAgent(/opr\//i):
            return BROWSER_ENUM.OPERA;
        case testUserAgent(/ucbrowser/i):
            return BROWSER_ENUM.UC_BROWSER;
        case testUserAgent(/samsungbrowser/i):
            return BROWSER_ENUM.SAMSUNG_BROWSER;
        case testUserAgent(/chrome|chromium|crios/i):
            return BROWSER_ENUM.CHROME;
        case testUserAgent(/safari/i):
            return BROWSER_ENUM.SAFARI;
        default:
            return BROWSER_ENUM.UNKNOWN;
    }
}

export function parseDeviceType(
    device: DeviceDetector.DeviceDetectorResult,
    rawHeader: string | null
) {
    if (device.device && device.device.type) {
        return device.device.type;
    }
    return rawHeader ?? "Unknown";
}



export function parseOs(
    device: DeviceDetector.DeviceDetectorResult,
    rawHeader: string | null
) {
    if (device.os && device.os.name) {
        return device.os.name;
    } else return rawHeader ?? "Unknown";
}
