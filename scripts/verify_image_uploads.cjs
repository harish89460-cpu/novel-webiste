// Comprehensive Verification Suite for Image Uploads Across Website
// Tests local image upload, persistent storage in MySQL, file serving,
// old image replacement/cleanup on update, file validation, and error handling.

const http = require('http');
const fs = require('fs');
const path = require('path');

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function httpGetRaw(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: 'localhost',
      port: 3000,
      path: urlPath
    }, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: Buffer.concat(chunks)
        });
      });
    });
    req.on('error', reject);
  });
}

// Sample 1x1 test images
const TINY_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TINY_JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const MULTILINE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB\nCAYAAAAfFcSJAAAADUlEQVR42mNk\r\n+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function run() {
  console.log('===================================================================');
  console.log('   IMAGE UPLOAD SYSTEM: COMPREHENSIVE END-TO-END TEST SUITE        ');
  console.log('===================================================================\n');

  const { getDb } = await import('../backend/db.js');
  const { createSession } = await import('../backend/auth.js');
  const pool = getDb();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Setup Sessions
    console.log('[Step 1] Creating Authenticated Sessions...');
    const adminToken = await createSession(2, 'author');
    assert(Boolean(adminToken), 'Admin session established (User ID 2)');

    const writerRow = (await pool.query("SELECT id FROM users WHERE role = 'writer' LIMIT 1;"))[0][0];
    const writerId = writerRow ? writerRow.id : 37;
    const writerToken = await createSession(writerId);
    assert(Boolean(writerToken), `Writer session established (User ID ${writerId})`);

    const memberRow = (await pool.query("SELECT id FROM users WHERE role = 'Member' LIMIT 1;"))[0][0];
    const memberId = memberRow ? memberRow.id : 54;
    const memberToken = await createSession(memberId);
    assert(Boolean(memberToken), `Member session established (User ID ${memberId})`);

    // 2. Test Unified /api/upload/image
    console.log('\n[Step 2] Testing Unified Image Upload API (/api/upload/image)...');
    
    // 2a. Valid PNG Upload
    const uploadRes1 = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      data: TINY_PNG_BASE64,
      folder: 'covers',
      filename: 'sample_cover.png'
    });

    assert(uploadRes1.status === 201 && uploadRes1.body?.success, 'Upload valid PNG returns 201 Created');
    assert(uploadRes1.body?.url?.startsWith('/uploads/covers/'), `Image URL generated: ${uploadRes1.body?.url}`);
    
    const coverUrl1 = uploadRes1.body.url;
    const coverFile1 = path.join(__dirname, '..', 'backend', coverUrl1.replace(/^\//, ''));
    assert(fs.existsSync(coverFile1), `Physical file exists on disk: ${coverFile1}`);

    // Verify static serving via HTTP GET
    const serveRes1 = await httpGetRaw(coverUrl1);
    assert(serveRes1.status === 200, `Static file served via HTTP 200`);
    assert(serveRes1.headers['content-type'] === 'image/png', `Proper Content-Type served: ${serveRes1.headers['content-type']}`);

    // 2b. Multiline base64 upload (RFC 2045)
    const uploadRes2 = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      data: MULTILINE_BASE64,
      folder: 'covers',
      filename: 'multiline.png'
    });
    assert(uploadRes2.status === 201 && uploadRes2.body?.success, 'Upload multiline RFC 2045 base64 succeeds without error');

    // 2c. Invalid mime type rejection
    const invalidUpload = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      data: 'data:text/html;base64,PGgxPkhlbGxvPC9oMT4=',
      folder: 'covers',
      filename: 'test.html'
    });
    assert(invalidUpload.status === 400 && invalidUpload.body?.success === false, 'Invalid non-image file rejected with HTTP 400');

    // 2d. Oversized file rejection (> 10MB)
    const bigData = 'data:image/png;base64,' + Buffer.alloc(11 * 1024 * 1024).toString('base64');
    const oversizeRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      data: bigData,
      folder: 'covers',
      filename: 'huge.png'
    });
    assert(oversizeRes.status === 400 && oversizeRes.body?.error?.includes('10MB'), 'Oversized image (>10MB) rejected with HTTP 400');

    // 3. Admin Novel Cover Creation, Update, and Old Image Replacement
    console.log('\n[Step 3] Testing Novel Cover Creation, Update, and Old Image Replacement...');
    const testNovelId = `test-novel-img-${Date.now()}`;
    
    // Create novel with coverUrl1
    const createNovelRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/novels',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      id: testNovelId,
      title: 'Image Test Novel',
      author: 'Rudhra Prarthana',
      genre: 'Romance',
      cover: coverUrl1,
      status: 'Ongoing',
      visibility: 'draft'
    });

    assert(createNovelRes.status === 201, 'Novel created with uploaded cover');
    const novelDbRow = (await pool.query('SELECT cover FROM novels WHERE id = ?;', [testNovelId]))[0][0];
    assert(novelDbRow?.cover === coverUrl1, `MySQL novels.cover saved as ${coverUrl1}`);
    assert(fs.existsSync(coverFile1), 'Initial cover file exists on disk');

    // Now update novel with a NEW cover (JPEG) and verify old file is unlinked
    const uploadRes3 = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      data: TINY_JPEG_BASE64,
      folder: 'covers',
      filename: 'new_cover.jpg'
    });
    const coverUrl2 = uploadRes3.body.url;
    const coverFile2 = path.join(__dirname, '..', 'backend', coverUrl2.replace(/^\//, ''));

    const updateNovelRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/novels/${testNovelId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      cover: coverUrl2
    });

    assert(updateNovelRes.status === 200, 'Novel updated with new cover');
    const novelDbUpdated = (await pool.query('SELECT cover FROM novels WHERE id = ?;', [testNovelId]))[0][0];
    assert(novelDbUpdated?.cover === coverUrl2, `MySQL novels.cover updated to new cover ${coverUrl2}`);
    assert(fs.existsSync(coverFile2), 'New cover file exists on disk');
    assert(!fs.existsSync(coverFile1), 'Old cover file was cleaned up from disk (replacement confirmed)');

    // 4. Writer Novel Cover Upload & Creation
    console.log('\n[Step 4] Testing Writer Novel Cover Upload...');
    const writerUploadRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${writerToken}`
      }
    }, {
      data: TINY_PNG_BASE64,
      folder: 'covers',
      filename: 'writer_novel_cover.png'
    });

    assert(writerUploadRes.status === 201 && writerUploadRes.body?.url, 'Writer successfully uploaded novel cover');
    const writerCoverUrl = writerUploadRes.body.url;
    const writerCoverFile = path.join(__dirname, '..', 'backend', writerCoverUrl.replace(/^\//, ''));
    assert(fs.existsSync(writerCoverFile), 'Writer uploaded cover exists in persistent storage');

    // 5. Member Profile Avatar Upload, Replacement, and Removal
    console.log('\n[Step 5] Testing Member Profile Avatar Upload, Replacement, and Removal...');
    
    // 5a. Set Avatar
    const avatarDataUrl1 = TINY_PNG_BASE64;
    const profileUpdateRes1 = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/user/profile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      }
    }, {
      avatar: avatarDataUrl1
    });

    assert(profileUpdateRes1.status === 200, 'Member profile updated with local avatar upload');
    const memberProfile1 = (await pool.query('SELECT avatar FROM profiles WHERE user_id = ?;', [memberId]))[0][0];
    assert(memberProfile1?.avatar?.startsWith('/uploads/avatars/'), `Avatar saved persistently in MySQL: ${memberProfile1?.avatar}`);
    
    const avatarFile1 = path.join(__dirname, '..', 'backend', memberProfile1.avatar.replace(/^\//, ''));
    assert(fs.existsSync(avatarFile1), 'Avatar file exists on disk');

    // 5b. Replace Avatar with a second one
    const avatarDataUrl2 = TINY_JPEG_BASE64;
    const profileUpdateRes2 = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/user/profile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      }
    }, {
      avatar: avatarDataUrl2
    });

    assert(profileUpdateRes2.status === 200, 'Member avatar replaced with new photo');
    const memberProfile2 = (await pool.query('SELECT avatar FROM profiles WHERE user_id = ?;', [memberId]))[0][0];
    assert(memberProfile2?.avatar !== memberProfile1.avatar, 'MySQL profile avatar updated to new path');
    const avatarFile2 = path.join(__dirname, '..', 'backend', memberProfile2.avatar.replace(/^\//, ''));
    assert(fs.existsSync(avatarFile2), 'New avatar file exists on disk');
    assert(!fs.existsSync(avatarFile1), 'Old avatar file deleted from disk');

    // 5c. Remove Avatar
    const profileRemoveRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/user/profile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      }
    }, {
      avatar: 'remove'
    });

    assert(profileRemoveRes.status === 200, 'Member avatar removed');
    const memberProfile3 = (await pool.query('SELECT avatar FROM profiles WHERE user_id = ?;', [memberId]))[0][0];
    assert(memberProfile3?.avatar === null, 'MySQL profile avatar reset to NULL');
    assert(!fs.existsSync(avatarFile2), 'Removed avatar file deleted from disk');

    // 6. Admin Media Gallery Upload & Delete
    console.log('\n[Step 6] Testing Admin Media Gallery Upload & Deletion...');
    const mediaUploadRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/media/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      data: TINY_PNG_BASE64,
      filename: 'media_test.png'
    });

    assert(mediaUploadRes.status === 201 && mediaUploadRes.body?.media?.id, 'Admin media asset uploaded');
    const mediaId = mediaUploadRes.body.media.id;
    const mediaUrl = mediaUploadRes.body.media.url;
    const mediaFile = path.join(__dirname, '..', 'backend', mediaUrl.replace(/^\//, ''));
    
    assert(fs.existsSync(mediaFile), 'Media asset file exists on disk');
    const mediaRow = (await pool.query('SELECT * FROM media WHERE id = ?;', [mediaId]))[0][0];
    assert(Boolean(mediaRow), 'Media row inserted in MySQL media table');

    // Delete Media Asset
    const deleteMediaRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/media/${mediaId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert(deleteMediaRes.status === 200, 'Admin media asset deleted');
    const mediaRowAfter = (await pool.query('SELECT * FROM media WHERE id = ?;', [mediaId]))[0][0];
    assert(!mediaRowAfter, 'Media row deleted from MySQL media table');
    assert(!fs.existsSync(mediaFile), 'Media asset file unlinked from disk');

    // 7. Comments Image Upload
    console.log('\n[Step 7] Testing Comments Image Upload...');
    const commentUploadRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/comments/upload-image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      }
    }, {
      data: TINY_PNG_BASE64,
      name: 'comment_pic.png'
    });

    assert(commentUploadRes.status === 200 && commentUploadRes.body?.url, 'Comment image uploaded successfully');
    const commentFile = path.join(__dirname, '..', 'backend', commentUploadRes.body.url.replace(/^\//, ''));
    assert(fs.existsSync(commentFile), 'Comment image physically stored on disk');

    // 8. Clean up test novel
    await pool.query('DELETE FROM novels WHERE id = ?;', [testNovelId]);
    if (fs.existsSync(coverFile2)) fs.unlinkSync(coverFile2);
    if (fs.existsSync(writerCoverFile)) fs.unlinkSync(writerCoverFile);
    if (fs.existsSync(commentFile)) fs.unlinkSync(commentFile);

    console.log('\n===================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exit(1);
  }
}

run();
