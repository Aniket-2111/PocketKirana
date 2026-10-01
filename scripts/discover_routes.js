const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'app');

function getRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getRouteFiles(fullPath));
    } else if (file === 'route.ts' || file === 'route.js') {
      results.push(fullPath);
    }
  }
  return results;
}

const routeFiles = getRouteFiles(path.join(appDir, 'api'));

const inventory = routeFiles.map((file) => {
  const relPath = path.relative(appDir, file).replace(/\\/g, '/');
  const routePath = '/' + relPath.replace(/\/route\.(ts|js)$/, '');
  const content = fs.readFileSync(file, 'utf8');

  // Detect exported HTTP methods
  const methods = [];
  if (content.match(/export\s+(async\s+)?function\s+GET/)) methods.push('GET');
  if (content.match(/export\s+(async\s+)?function\s+POST/)) methods.push('POST');
  if (content.match(/export\s+(async\s+)?function\s+PUT/)) methods.push('PUT');
  if (content.match(/export\s+(async\s+)?function\s+PATCH/)) methods.push('PATCH');
  if (content.match(/export\s+(async\s+)?function\s+DELETE/)) methods.push('DELETE');
  if (content.match(/export\s+(async\s+)?function\s+OPTIONS/)) methods.push('OPTIONS');

  // Categorize role & auth
  let category = 'PUBLIC';
  let requiredRole = 'none';
  let authRequired = false;

  if (routePath.startsWith('/api/admin')) {
    category = 'ADMIN';
    requiredRole = 'admin';
    authRequired = true;
  } else if (routePath.startsWith('/api/picker') || routePath.startsWith('/api/picking') || routePath.startsWith('/api/packing')) {
    category = 'PICKER';
    requiredRole = 'picker';
    authRequired = true;
  } else if (routePath.startsWith('/api/delivery')) {
    category = 'DELIVERY';
    requiredRole = 'delivery_partner';
    authRequired = true;
  } else if (routePath.startsWith('/api/checkout') || routePath.startsWith('/api/cart') || routePath.startsWith('/api/orders')) {
    category = 'CUSTOMER';
    requiredRole = 'customer';
    authRequired = true;
  } else if (routePath.includes('webhook')) {
    category = 'WEBHOOK';
    requiredRole = 'gateway_hmac';
    authRequired = false; // HMAC verified
  } else if (routePath === '/api/health') {
    category = 'HEALTH';
    requiredRole = 'none';
    authRequired = false;
  } else if (routePath.startsWith('/api/auth')) {
    const isPublicOtp = routePath.includes('send-otp') || routePath.includes('verify-otp') || routePath.includes('otp/verify');
    if (isPublicOtp) {
      category = 'PUBLIC';
      requiredRole = 'none';
      authRequired = false;
    } else {
      category = 'AUTHENTICATED';
      requiredRole = 'user';
      authRequired = true;
    }
  }

  // Database dependencies
  const hasPostgres = content.includes('postgres') || content.includes('getPostgresPool');
  const hasFirebase = content.includes('firebase') || content.includes('firestore');

  return {
    route: routePath,
    category,
    methods,
    authRequired,
    requiredRole,
    database: hasPostgres ? 'PostgreSQL' : hasFirebase ? 'Firestore' : 'None',
    isSecuritySensitive: category === 'ADMIN' || category === 'WEBHOOK' || category === 'DELIVERY' || category === 'CUSTOMER',
    idempotencyRequired: methods.includes('POST') || methods.includes('PUT') || methods.includes('PATCH'),
  };
});

// Output JSON inventory
const outJsonPath = path.join(__dirname, '..', 'docs', 'phase-17-routes.json');
fs.writeFileSync(outJsonPath, JSON.stringify(inventory, null, 2));

console.log(`Discovered ${inventory.length} API routes. Saved to docs/phase-17-routes.json`);
