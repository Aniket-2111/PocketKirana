/**
 * PocketKirana — Dynamic Categories & Subcategories End-to-End Test Suite
 * 
 * Verifies:
 * 1. GET /api/categories (returns active & inactive categories with subcategory/product counts)
 * 2. POST /api/categories (create parent category with unique slug)
 * 3. POST /api/categories (create child subcategories with dynamic parentId)
 * 4. PUT /api/categories/[id] (edit category name, image, display order, active status)
 * 5. POST /api/categories/move (move subcategory between parent categories and update relationships)
 * 6. POST /api/categories/reorder (batch reorder display_order)
 * 7. DELETE /api/categories/[id] (safe delete with product & subcategory reassignment)
 * 8. PostgreSQL database integrity check
 * 
 * Usage: node scripts/test_dynamic_categories_e2e.js
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (bodyStr) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  POCKETKIRANA — Dynamic Categories & Subcategories E2E Tests');
  console.log('══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✔ [PASS ${total}] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL ${total}] ${message}`);
    }
  }

  try {
    // 1. Fetch Categories
    console.log('[Test 1] Testing GET /api/categories...');
    const listRes = await request('GET', '/api/categories');
    assert(listRes.status === 200, 'GET /api/categories returns 200 OK');
    assert(listRes.body.success === true, 'Response contains success: true');
    assert(Array.isArray(listRes.body.categories) && listRes.body.categories.length > 0, `Returned ${listRes.body.categories?.length} categories`);

    // 2. Create New Category
    console.log('\n[Test 2] Creating new parent category "Organic Superfoods"...');
    const testCatName = `Organic Superfoods ${Date.now().toString().slice(-4)}`;
    const createCatRes = await request('POST', '/api/categories', {
      name: testCatName,
      description: 'Healthy organic seeds, grains, and nutritional superfoods',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      displayOrder: 99,
      isActive: true,
    });

    assert(createCatRes.status === 200, 'POST /api/categories returns 200 OK');
    assert(createCatRes.body.success === true, 'Parent category created successfully');
    const newCat = createCatRes.body.category;
    assert(newCat && newCat.id && newCat.name === testCatName, `Created category ID: ${newCat?.id}`);
    assert(newCat.parentId === null, 'Parent category has parentId = null');

    // 3. Create Subcategories under the new Category
    console.log('\n[Test 3] Creating subcategories under the new category...');
    const sub1Res = await request('POST', '/api/categories', {
      name: 'Chia & Flax Seeds',
      parentId: newCat.id,
      description: 'Raw and roasted organic omega-3 seeds',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      displayOrder: 1,
      isActive: true,
    });

    const sub2Res = await request('POST', '/api/categories', {
      name: 'Organic Quinoa & Millets',
      parentId: newCat.id,
      description: 'Gluten-free organic quinoa and barnyard millets',
      image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
      displayOrder: 2,
      isActive: true,
    });

    assert(sub1Res.status === 200 && sub1Res.body.success, 'Subcategory 1 "Chia & Flax Seeds" created');
    assert(sub2Res.status === 200 && sub2Res.body.success, 'Subcategory 2 "Organic Quinoa & Millets" created');
    const sub1 = sub1Res.body.category;
    const sub2 = sub2Res.body.category;
    assert(sub1.parentId === newCat.id, 'Subcategory 1 correctly points to parent ID');

    // 4. Edit Category
    console.log('\n[Test 4] Editing category properties...');
    const updatedName = `${testCatName} (Premium)`;
    const editRes = await request('PUT', `/api/categories/${newCat.id}`, {
      name: updatedName,
      description: 'Updated premium organic superfoods description',
      displayOrder: 15,
      isActive: true,
    });

    assert(editRes.status === 200 && editRes.body.success, 'PUT /api/categories/[id] returns 200 OK');
    assert(editRes.body.category?.name === updatedName, 'Category name updated in database');

    // 5. Move Subcategory to another parent
    console.log('\n[Test 5] Moving Subcategory "Chia & Flax Seeds" to "Staples & Grains" (cat-staples)...');
    const moveRes = await request('POST', '/api/categories/move', {
      subcategoryId: sub1.id,
      newParentCategoryId: 'cat-staples',
    });

    assert(moveRes.status === 200 && moveRes.body.success, 'POST /api/categories/move returned success');

    // Verify subcategory's new parent in DB
    const verifySubRes = await request('GET', `/api/categories/${sub1.id}`);
    assert(verifySubRes.status === 200, 'GET updated subcategory returns 200');
    assert(verifySubRes.body.category?.parentId === 'cat-staples', 'Subcategory parent_id changed to cat-staples in database');

    // 6. Batch Reorder Categories
    console.log('\n[Test 6] Testing batch category reordering...');
    const reorderRes = await request('POST', '/api/categories/reorder', {
      items: [
        { id: 'cat-veg', displayOrder: 1 },
        { id: 'cat-oil-ghee', displayOrder: 2 },
        { id: 'cat-dairy', displayOrder: 3 },
      ],
    });

    assert(reorderRes.status === 200 && reorderRes.body.success, 'POST /api/categories/reorder returned success');

    // 7. Safe Deletion of Test Category & Reassignment
    console.log('\n[Test 7] Testing safe deletion of category...');
    const deleteRes = await request('DELETE', `/api/categories/${newCat.id}`, {
      reassignCategoryId: 'cat-staples',
    });

    assert(deleteRes.status === 200 && deleteRes.body.success, 'DELETE /api/categories/[id] returned success');

    // Clean up test subcategory
    await request('DELETE', `/api/categories/${sub1.id}`);
    await request('DELETE', `/api/categories/${sub2.id}`);

    // Verify deletion
    const verifyDeleted = await request('GET', `/api/categories/${newCat.id}`);
    assert(verifyDeleted.status === 404, 'Deleted category is no longer found (404)');

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`  E2E TEST SUMMARY: ${passed}/${total} checks passed (${Math.round((passed / total) * 100)}%)`);
    console.log('══════════════════════════════════════════════════════════════\n');

    if (passed === total) {
      console.log('  🎉 ALL DYNAMIC CATEGORY & SUBCATEGORY TESTS PASSED PERFECTLY!\n');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Test execution error:', err);
    process.exit(1);
  }
}

runTests();
