// Best-effort GPS capture for attendance check-in/out.
//
// The contract intentionally hides every failure mode behind a `null`
// return so callers don't have to handle "permission denied", "GPS
// unavailable", "user is in airplane mode", or "device timed out"
// individually — they all just mean "no location captured this time",
// which the backend stores cleanly and the admin UI surfaces with a
// "no location" badge.
//
// Why a 7-second timeout: matches the web client's behavior (see
// frontend/src/app/attendance/page.tsx::captureLocation). Some Android
// devices on cellular take 5-6s to acquire a satellite fix; cutting
// off earlier gives spurious failures, cutting off later makes the
// clock-in button feel laggy. The web stays in sync at 7s so the UX
// matches across platforms.

import * as Location from "expo-location";

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Request foreground location permission and read a single GPS fix.
 * Returns null on any failure (permission denied, no provider,
 * timeout, hardware error). Callers should treat null as "user
 * declined / unavailable" rather than as an error.
 */
export async function captureLocation(): Promise<CapturedLocation | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;

    // `Balanced` accuracy uses wifi+cell+GPS for a fix that's typically
    // ~30–100m. That's plenty for "is the employee at the office" and
    // saves battery vs. `High`. The geo-fence policy on the backend
    // (workPreferences.attendance.officeLocations[].radius) is usually
    // set to 100m+ for the same reason.
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      7000,
    );
    if (!pos) return null;

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
    };
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}
