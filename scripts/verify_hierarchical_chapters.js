// scripts/verify_hierarchical_chapters.js
import { createSession } from '../backend/auth.js';

let authToken = '';

async function request(method, path, data = null) {
  const url = `http://localhost:3000${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    }
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json };
}

async function runTests() {
  console.log('=== STARTING CHAPTER & EPISODE HIERARCHICAL TESTS ===\n');
  const createdIds = [];

  try {
    // 0. Authenticate as Admin / Author
    console.log('Step 0: Creating Author session token...');
    authToken = await createSession(2, 'author');
    console.log(`✓ Created Author token: ${authToken.slice(0, 10)}...`);

    // 1. Get novel info
    console.log('\nStep 1: Fetching novel en-uyiril-nee...');
    const novelRes = await request('GET', '/api/novels/en-uyiril-nee');
    if (!novelRes.data || !novelRes.data.novel) {
      throw new Error('Failed to fetch novel: ' + JSON.stringify(novelRes));
    }
    const novel = novelRes.data.novel;
    const novelId = novel.id;
    console.log(`✓ Found novel Title: "${novel.title}", ID: "${novelId}"`);

    // 2. Fetch existing episodes for this novel
    console.log('\nStep 2: Fetching existing episodes tree...');
    const epRes = await request('GET', `/api/admin/episodes?novelId=${novelId}`);
    const existing = epRes.data?.episodes || epRes.data?.data || [];
    console.log(`✓ Fetched ${existing.length} top-level chapters/items.`);
    for (const ch of existing) {
      console.log(`  - Chapter ${ch.chapterNum || ch.episodeNumber}: "${ch.title}" (Sub-items: ${(ch.subEpisodes || []).length})`);
      for (const ep of ch.subEpisodes || []) {
        console.log(`    * Episode ${ep.chapterNum || ep.episodeNumber}: "${ep.title}" (Sub-episodes: ${(ep.subEpisodes || []).length})`);
        for (const sub of ep.subEpisodes || []) {
          console.log(`      + Sub-episode ${sub.chapterNum || sub.episodeNumber}: "${sub.title}"`);
        }
      }
    }

    // Identify Chapter 1 and Chapter 2
    const ch1 = existing.find(c => String(c.chapterNum || c.episodeNumber).trim() === '1');
    const ch2 = existing.find(c => String(c.chapterNum || c.episodeNumber).trim() === '2');

    // 3. Test Scenario 1: Create a new Chapter (parent_id = null)
    console.log('\nStep 3: Creating a new Chapter (parent_id = null)...');
    const chCreateRes = await request('POST', '/api/admin/episodes', {
      novelId: novelId,
      parentId: null,
      content: '<p>Chapter 3 test content</p>',
      status: 'draft'
    });
    console.log('Create Chapter Response:', chCreateRes.data);
    if (!chCreateRes.data.success) throw new Error('Failed to create Chapter: ' + JSON.stringify(chCreateRes.data));
    const newChapter = chCreateRes.data.episode || chCreateRes.data.data;
    createdIds.push(newChapter.id);
    const chNum = newChapter.chapterNum || newChapter.chapter_num;
    console.log(`✓ Created Chapter ID ${newChapter.id}: number="${chNum}", title="${newChapter.title}"`);

    if (!newChapter.title.includes(`(${chNum})`)) {
      console.warn(`⚠️ Warning: Expected title to contain (${chNum}), got: ${newChapter.title}`);
    } else {
      console.log(`✓ Title correctly formatted as "${newChapter.title}"`);
    }

    // 4. Test Scenario 2: Edit Chapter Title
    console.log('\nStep 4: Editing Chapter title...');
    const customTitle = `${novel.title} (${chNum}) - சிறப்பு அத்தியாயம் (Special Chapter)`;
    const editRes = await request('PUT', `/api/admin/episodes/${newChapter.id}`, {
      title: customTitle,
      titleTa: customTitle,
      chapterNum: chNum,
      novelId: novelId,
      status: 'draft'
    });
    console.log('Edit Response:', editRes.data);
    if (!editRes.data.success) throw new Error('Failed to edit chapter title: ' + JSON.stringify(editRes.data));

    // Verify persistence
    const verifyGet = await request('GET', `/api/admin/episodes/${newChapter.id}`);
    const updatedCh = verifyGet.data.episode || verifyGet.data.data;
    console.log(`✓ Verified persistence after update: ID ${updatedCh.id}, title="${updatedCh.title}"`);
    if (updatedCh.title !== customTitle) {
      throw new Error(`Title mismatch! Expected "${customTitle}", got "${updatedCh.title}"`);
    }

    // 5. Test Scenario 3: Create Episode under Chapter 1
    let newEp1 = null;
    if (ch1) {
      console.log(`\nStep 5: Creating an Episode under Chapter 1 (ID ${ch1.id})...`);
      const epCreateRes = await request('POST', '/api/admin/episodes', {
        novelId: novelId,
        parentId: ch1.id,
        content: '<p>Episode under Chapter 1 content</p>',
        status: 'draft'
      });
      console.log('Create Episode 1.x Response:', epCreateRes.data);
      if (!epCreateRes.data.success) throw new Error('Failed to create Episode under Ch 1: ' + JSON.stringify(epCreateRes.data));
      newEp1 = epCreateRes.data.episode || epCreateRes.data.data;
      createdIds.push(newEp1.id);
      const epNum = newEp1.chapterNum || newEp1.chapter_num;
      console.log(`✓ Created Episode ID ${newEp1.id}: number="${epNum}", title="${newEp1.title}"`);
      if (!String(epNum).startsWith('1.')) {
        throw new Error(`Expected episode number to start with "1.", got "${epNum}"`);
      }

      // 6. Test Scenario 4: Create Sub-Episode under this Episode
      console.log(`\nStep 6: Creating Sub-Episode under Episode ${epNum} (ID ${newEp1.id})...`);
      const subCreateRes = await request('POST', '/api/admin/episodes', {
        novelId: novelId,
        parentId: newEp1.id,
        content: '<p>Sub-episode content</p>',
        status: 'draft'
      });
      console.log('Create Sub-episode Response:', subCreateRes.data);
      if (!subCreateRes.data.success) throw new Error('Failed to create Sub-episode: ' + JSON.stringify(subCreateRes.data));
      const newSub = subCreateRes.data.episode || subCreateRes.data.data;
      createdIds.push(newSub.id);
      const subNum = newSub.chapterNum || newSub.chapter_num;
      console.log(`✓ Created Sub-Episode ID ${newSub.id}: number="${subNum}", title="${newSub.title}"`);
      const expectedSubPrefix = `${epNum}.`;
      if (!String(subNum).startsWith(expectedSubPrefix)) {
        throw new Error(`Expected sub-episode number to start with "${expectedSubPrefix}", got "${subNum}"`);
      }
    }

    // 7. Test Scenario 5: Create Episode under Chapter 2
    let newEp2 = null;
    if (ch2) {
      console.log(`\nStep 7: Creating an Episode under Chapter 2 (ID ${ch2.id})...`);
      const ep2CreateRes = await request('POST', '/api/admin/episodes', {
        novelId: novelId,
        parentId: ch2.id,
        content: '<p>Episode under Chapter 2 content</p>',
        status: 'draft'
      });
      console.log('Create Episode 2.x Response:', ep2CreateRes.data);
      if (!ep2CreateRes.data.success) throw new Error('Failed to create Episode under Ch 2: ' + JSON.stringify(ep2CreateRes.data));
      newEp2 = ep2CreateRes.data.episode || ep2CreateRes.data.data;
      createdIds.push(newEp2.id);
      const ep2Num = newEp2.chapterNum || newEp2.chapter_num;
      console.log(`✓ Created Episode ID ${newEp2.id}: number="${ep2Num}", title="${newEp2.title}"`);
      if (!String(ep2Num).startsWith('2.')) {
        throw new Error(`Expected episode number to start with "2.", got "${ep2Num}"`);
      }

      // 8. Test Scenario 6: Create Sub-Episode under Chapter 2 episode
      console.log(`\nStep 8: Creating Sub-Episode under Episode ${ep2Num} (ID ${newEp2.id})...`);
      const sub2CreateRes = await request('POST', '/api/admin/episodes', {
        novelId: novelId,
        parentId: newEp2.id,
        content: '<p>Sub-episode under 2.x content</p>',
        status: 'draft'
      });
      console.log('Create Sub-episode 2.x.x Response:', sub2CreateRes.data);
      if (!sub2CreateRes.data.success) throw new Error('Failed to create Sub-episode under Ch 2: ' + JSON.stringify(sub2CreateRes.data));
      const newSub2 = sub2CreateRes.data.episode || sub2CreateRes.data.data;
      createdIds.push(newSub2.id);
      const sub2Num = newSub2.chapterNum || newSub2.chapter_num;
      console.log(`✓ Created Sub-Episode ID ${newSub2.id}: number="${sub2Num}", title="${newSub2.title}"`);
      const expectedSub2Prefix = `${ep2Num}.`;
      if (!String(sub2Num).startsWith(expectedSub2Prefix)) {
        throw new Error(`Expected sub-episode number to start with "${expectedSub2Prefix}", got "${sub2Num}"`);
      }
    }

    // 9. Fetch tree again to verify complete 3-tier hierarchy in API
    console.log('\nStep 9: Fetching updated episodes tree to verify hierarchy rendering...');
    const verifyTreeRes = await request('GET', `/api/admin/episodes?novelId=${novelId}`);
    const verifyTree = verifyTreeRes.data?.episodes || verifyTreeRes.data?.data || [];
    console.log(`✓ Fetched updated tree (${verifyTree.length} roots):`);
    for (const ch of verifyTree) {
      console.log(`  [Root] ${ch.chapterNum || ch.episodeNumber}: "${ch.title}" (ID ${ch.id})`);
      for (const ep of ch.subEpisodes || []) {
        console.log(`    ↳ [Ep] ${ep.chapterNum || ep.episodeNumber}: "${ep.title}" (ID ${ep.id})`);
        for (const sub of ep.subEpisodes || []) {
          console.log(`      ↳ [Sub-Ep] ${sub.chapterNum || sub.episodeNumber}: "${sub.title}" (ID ${sub.id})`);
        }
      }
    }

    // 10. Check Public Novel endpoint
    console.log('\nStep 10: Checking Public Novel detail endpoint...');
    const pubNovelRes = await request('GET', `/api/novels/en-uyiril-nee`);
    const pubChapters = pubNovelRes.data?.novel?.chapters || [];
    console.log(`✓ Public chapters count: ${pubChapters.length}`);
    const pubNums = pubChapters.map(c => c.chapterNum || c.chapter_num);
    console.log(`  Chapter numbers in order: ${pubNums.join(', ')}`);

    console.log('\n==========================================');
    console.log('ALL VERIFICATION SCENARIOS PASSED SUCCESSFULLY!');
    console.log('==========================================');

  } catch (err) {
    console.error('❌ Verification failed with error:', err);
    process.exitCode = 1;
  } finally {
    // Clean up created items safely in reverse order
    console.log('\nCleaning up created test records:', createdIds);
    for (const id of createdIds.reverse()) {
      try {
        const delRes = await request('DELETE', `/api/admin/episodes/${id}`);
        console.log(`  - Deleted test item ${id}:`, delRes.data);
      } catch (e) {
        console.error(`  - Failed to delete item ${id}:`, e.message);
      }
    }
    console.log('Cleanup complete.');
  }
}

runTests();
