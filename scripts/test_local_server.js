async function main() {
  try {
    const res = await fetch('http://localhost:3000/api/admin/store/operations');
    console.log('Port 3000 HTTP Status:', res.status);
    const json = await res.json();
    console.log('Port 3000 Response:', json);
  } catch (err) {
    console.error('Port 3000 Error:', err.message);
  }
}
main();
