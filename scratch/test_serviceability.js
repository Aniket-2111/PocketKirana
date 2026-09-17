
const STORE = {
  name: 'Maule Kirana Store (PocketKirana Hub)',
  city: 'Neral',
  latitude: 19.0224536,
  longitude: 73.3210018,
  deliveryRadiusKm: 4.5,
};

console.log('=== POCKETKIRANA SERVICEABILITY TEST MATRIX ===');
console.log('Store:', STORE.name, `(${STORE.city})`);
console.log('Store Location:', `${STORE.latitude}, ${STORE.longitude}`);
console.log('Max Delivery Radius:', `${STORE.deliveryRadiusKm} KM\n`);

const testPoints = [
  { name: 'Maule Kirana Store (0 KM)', lat: 19.0224536, lon: 73.3210018, expected: true },
  { name: 'Neral Market / Station (0.3 KM)', lat: 19.0245, lon: 73.3200, expected: true },
  { name: 'Neral House 203 GPS Location (0.8 KM)', lat: 19.0280, lon: 73.3240, expected: true },
  { name: 'Neral Rural / Karjat Taluka (2.2 KM)', lat: 19.0050, lon: 73.3280, expected: true },
  { name: 'Neral Outskirts (3.6 KM)', lat: 18.9900, lon: 73.3210, expected: true },
  { name: 'Boundary 4.4 KM', lat: 18.9830, lon: 73.3210, expected: true },
  { name: 'Karjat Central (~12.5 KM)', lat: 18.9102, lon: 73.3284, expected: false },
  { name: 'Mumbai (~60 KM)', lat: 19.0760, lon: 72.8777, expected: false },
];

let allPassed = true;

for (const pt of testPoints) {
  // Direct distance
  const R = 6371;
  const dLat = ((pt.lat - STORE.latitude) * Math.PI) / 180;
  const dLon = ((pt.lon - STORE.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((STORE.latitude * Math.PI) / 180) *
      Math.cos((pt.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = Math.round(R * c * 10) / 10;
  
  const serviceable = dist <= STORE.deliveryRadiusKm;
  const passed = serviceable === pt.expected;
  if (!passed) allPassed = false;
  console.log(
    `${passed ? '✓ PASS' : '✗ FAIL'} | ${pt.name.padEnd(40)} | Distance: ${String(dist).padStart(4)} KM | Result: ${serviceable ? 'SERVICEABLE ' : 'OUT_OF_RANGE'} (Expected: ${pt.expected})`
  );
}

console.log('\nResult:', allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌');
process.exit(allPassed ? 0 : 1);
