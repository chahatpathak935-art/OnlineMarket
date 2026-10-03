// Captures the device's current GPS coordinates using the browser's built-in Geolocation API.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device/browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error('Could not get your location. Please allow location access and try again.')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Converts GPS coordinates into a readable address using OpenStreetMap's free Nominatim service.
export async function reverseGeocode(latitude, longitude) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
  if (!res.ok) throw new Error('Could not fetch address for this location.');
  const data = await res.json();
  return data.display_name || '';
}