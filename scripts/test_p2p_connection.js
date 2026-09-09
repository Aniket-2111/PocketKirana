/**
 * Simple Peer-to-Peer Laptop Connectivity Tester
 * Usage: node scripts/test_p2p_connection.js <CLIENT_IP>
 */

const { exec } = require('child_process');
const net = require('net');

const targetIp = process.argv[2] || process.env.DB_HOST || '100.120.240.61';

console.log('\n======================================================');
console.log('📡 POCKETKIRANA — LAPTOP PEER-TO-PEER CONNECTIVITY TEST');
console.log('======================================================\n');
console.log(`📍 Testing Target IP: ${targetIp}`);
console.log('------------------------------------------------------');

// 1. Run Ping Test
console.log('\n[1/2] Running Network Ping Test...');
exec(`ping -n 3 ${targetIp}`, (err, stdout, stderr) => {
  if (err || stdout.includes('Request timed out') || stdout.includes('100% loss')) {
    console.error('❌ PING FAILED: Target laptop is not reachable on this IP.');
    console.log(stdout);
    console.log('\n💡 Tip: Check https://console.tailscale.com/admin/machines to get the CLIENT laptop IP (not developer laptop IP).');
  } else {
    console.log('✅ PING SUCCESSFUL! Laptop network connection is ALIVE!');
    console.log(stdout);

    // 2. Run Port Check (5432)
    console.log('\n[2/2] Testing PostgreSQL Port 5432 Socket...');
    const socket = new net.Socket();
    socket.setTimeout(4000);

    socket.on('connect', () => {
      console.log(`🎉 SUCCESS: Port 5432 is OPEN and ACCEPTING CONNECTIONS from ${targetIp}!`);
      socket.destroy();
    });

    socket.on('timeout', () => {
      console.error(`❌ PORT TIMEOUT: Laptop responded to Ping, but Port 5432 is blocked by Firewall.`);
      socket.destroy();
    });

    socket.on('error', (err) => {
      console.error(`❌ PORT REFUSED (${err.message}): Laptop is reachable, but PostgreSQL service is stopped or listening on localhost only.`);
      socket.destroy();
    });

    socket.connect(5432, targetIp);
  }
});
