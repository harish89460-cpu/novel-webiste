/**
 * Rudhra Prarthana Novels — Novel Writing and Novel Management Engine
 * Provides:
 *  1. Novel Content Writing Page:
 *     - Custom Unicode / Tamil / English Title input (no restrictions)
 *     - MS Word-like Rich-Text Editor (Bold, Italic, Underline, Strikethrough,
 *       Font Family, Font Size, Paragraph styles, Alignment, Lists, Text Color,
 *       Highlight Color, Link Dialog with separate text/URL, Image insertion,
 *       Emojis picker, Undo/Redo, Clear formatting)
 *     - Automatic continuous draft saving (debounce + periodic + blur + local recovery)
 *     - Reader Preview Modal
 *     - Generate Publish Link integration
 *  2. Novel Management Page:
 *     - Database-driven table with Title, Creator, Status, Created, Updated, Actions
 *     - Strict 10-per-page pagination with Previous, Next, and Page Numbers
 *     - Real-time title search and status filtering
 *     - Edit workflow (loads existing novel by ID without duplication)
 *     - Enable/Disable toggle
 *     - Trash deletion via existing moveToTrash system
 *     - View Preview Modal
 */

import { apiFetch } from './errors.js';
import { showToast } from './reader.js';

// Safe HTML escaping helper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, "\\'");
}

// Global state for novel system
const novelState = {
  currentNovelId: null,
  currentNovelSlug: null,
  editingPublishedUrl: null,
  isWriter: false,
  isDirty: false,
  autosaveTimer: null,
  periodicTimer: null,
  activeFilter: 'all',
  searchQuery: '',
  currentPage: 1,
  limit: 10,
  totalPages: 1,
  totalItems: 0,
  items: [],
  cachedRecovery: null
};

window.novelState = novelState;

/* =========================================================================
   1. NOVEL CONTENT WRITING PAGE
   ========================================================================= */

/**
 * Render Novel Content Writing Page
 * @param {HTMLElement} canvas - mount target container
 * @param {Object} options - { isWriter: boolean, novelId: number|null }
 */
export async function renderNovelContentWritingPage(canvas, options = {}) {
  if (!canvas) return;
  const isWriter = Boolean(options.isWriter);
  novelState.isWriter = isWriter;
  novelState.isDirty = false;

  // Clear timers from prior instances
  if (novelState.autosaveTimer) clearTimeout(novelState.autosaveTimer);
  if (novelState.periodicTimer) clearInterval(novelState.periodicTimer);

  const novelId = options.novelId || null;
  novelState.currentNovelId = novelId;

  // Initial skeleton
  canvas.innerHTML = `
    <div class="novel-writer-container" style="max-width:1120px; margin:0 auto; padding:16px 12px 60px;">
      <!-- Top Action Bar -->
      <div class="novel-top-action-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid #E2E8F0;">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.navigateBackToNovelsManagement(${isWriter})" style="display:inline-flex; align-items:center; gap:6px; font-weight:600; padding:6px 12px;">
            ← Back to Novels
          </button>
          <div>
            <h1 id="novel-writing-page-title" style="margin:0; font-size:1.45rem; font-weight:700; color:#0B1F33; font-family:'Playfair Display', serif;">
              ${novelId ? 'Edit Novel Content' : 'Novel Content Writing'}
            </h1>
            <div style="font-size:12px; color:#64748B; margin-top:2px;">
              Write and format your novel chapters. Changes are continuously saved as drafts.
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <!-- Autosave Badge -->
          <div id="novel-save-status-badge" class="novel-save-badge" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:#F8FAFC; border:1px solid #CBD5E1; border-radius:20px; font-size:12.5px; font-weight:600; color:#334155;">
            <span id="novel-save-dot" style="width:8px; height:8px; border-radius:50%; background:#10B981; display:inline-block;"></span>
            <span id="novel-save-text">${novelId ? 'Loaded' : 'Ready'}</span>
          </div>

          <!-- Save Draft Button -->
          <button type="button" class="btn btn-outline btn-sm" id="btn-novel-save-draft" onclick="window.manualSaveNovelDraft(${isWriter})" style="font-weight:600; padding:7px 14px;">
            💾 Save Draft
          </button>

          <!-- Preview Button -->
          <button type="button" class="btn btn-outline btn-sm" onclick="window.openNovelReaderPreview()" style="font-weight:600; padding:7px 14px;">
            👁️ Preview
          </button>

          <!-- Generate Publish Link Button -->
          <button type="button" class="btn btn-gold btn-sm" id="btn-novel-publish-link" onclick="window.executePublishNovelLink(${isWriter})" style="font-weight:700; padding:8px 18px; box-shadow:0 2px 8px rgba(200,155,60,0.3);">
            🔗 Generate Publish Link
          </button>
        </div>
      </div>

      <!-- Recovery Banner Mount -->
      <div id="novel-draft-recovery-mount"></div>

      <!-- Single Clear Title Input Card -->
      <div class="novel-title-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:16px 20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
        <label for="novel-title-input" style="display:flex; align-items:center; gap:8px; font-weight:700; color:#0B1F33; font-size:14px; margin-bottom:8px;">
          <span style="font-size:16px;">📝</span> Novel Title <span style="color:#EF4444;">*</span>
        </label>
        <input type="text" id="novel-title-input" class="form-input" 
               placeholder="Enter novel title (Tamil, English, punctuation, or any custom title)..." 
               value=""
               oninput="window.onNovelContentChanged(${isWriter})"
               style="font-size:16px; font-weight:600; padding:10px 14px; width:100%; border:1px solid #CBD5E1; border-radius:8px; background:#FAFAFA;">
        <div style="font-size:11.5px; color:#64748B; margin-top:5px;">
          Accepts any custom title in Tamil (தமிழ்), English, numbers, and symbols. No restrictive dropdowns.
        </div>
      </div>

      <!-- MS Word-like Rich-Text Editor Toolbar -->
      <div class="novel-editor-toolbar" id="novel-toolbar" role="toolbar" aria-label="Rich-Text Formatting" style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:10px 10px 0 0; padding:8px 12px; display:flex; flex-wrap:wrap; gap:6px; align-items:center; border-bottom:none; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
        
        <!-- Undo / Redo Group -->
        <div class="toolbar-btn-group" style="display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px; gap:2px;">
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('undo')" title="Undo (Ctrl+Z)" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:14px; cursor:pointer;">↶</button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('redo')" title="Redo (Ctrl+Y)" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:14px; cursor:pointer;">↷</button>
        </div>

        <!-- Font Family Selector -->
        <div class="toolbar-btn-group" style="display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px;">
          <select id="novel-font-family-select" onchange="window.execNovelFontFamily(this.value)" title="Font Style" style="height:32px; padding:2px 8px; border:1px solid #CBD5E1; border-radius:4px; font-size:13px; background:#FFF; color:#334155; font-weight:500;">
            <option value="">Font Family</option>
            <option value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans (Default)</option>
            <option value="'Noto Sans Tamil', 'Mukta Malar', sans-serif">Mukta Malar / Tamil</option>
            <option value="'Cormorant Garamond', serif">Cormorant Garamond (Serif)</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="'Courier New', monospace">Courier New</option>
          </select>
        </div>

        <!-- Font Size Selector -->
        <div class="toolbar-btn-group" style="display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px;">
          <select id="novel-font-size-select" onchange="window.execNovelFontSize(this.value)" title="Font Size" style="height:32px; padding:2px 8px; border:1px solid #CBD5E1; border-radius:4px; font-size:13px; background:#FFF; color:#334155; font-weight:500;">
            <option value="">Font Size</option>
            <option value="12px">12px (Small)</option>
            <option value="14px">14px</option>
            <option value="16px">16px (Normal)</option>
            <option value="18px">18px (Medium)</option>
            <option value="20px">20px (Large)</option>
            <option value="24px">24px (H3)</option>
            <option value="28px">28px (H2)</option>
            <option value="32px">32px (H1)</option>
          </select>
        </div>

        <!-- Paragraph Block Format -->
        <div class="toolbar-btn-group" style="display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px;">
          <select id="novel-block-format-select" onchange="window.execNovelBlock(this.value); this.value='p';" title="Paragraph Formatting" style="height:32px; padding:2px 8px; border:1px solid #CBD5E1; border-radius:4px; font-size:13px; background:#FFF; color:#334155; font-weight:500;">
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote Block</option>
          </select>
        </div>

        <!-- Inline Formats: Bold, Italic, Underline, Strikethrough -->
        <div class="toolbar-btn-group" style="display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px; gap:2px;">
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('bold')" title="Bold (Ctrl+B)" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-weight:800; cursor:pointer;"><strong>B</strong></button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('italic')" title="Italic (Ctrl+I)" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-style:italic; font-family:serif; cursor:pointer;"><em>I</em></button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('underline')" title="Underline (Ctrl+U)" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; text-decoration:underline; cursor:pointer;"><u>U</u></button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('strikeThrough')" title="Strikethrough" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; text-decoration:line-through; cursor:pointer;"><s>S</s></button>
        </div>

        <!-- Text Color Dropdown -->
        <div class="toolbar-btn-group" style="position:relative; display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px;">
          <button type="button" class="toolbar-btn" onclick="window.toggleNovelColorMenu('text')" title="Text Color" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
            <span style="border-bottom:3px solid #2E1065; padding-bottom:1px;">A</span>
            <span style="font-size:9px;">▼</span>
          </button>
          <div id="novel-text-color-menu" style="display:none; position:absolute; top:36px; left:0; z-index:100; background:#FFF; border:1px solid #CBD5E1; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); padding:8px; width:150px;">
            <div style="font-size:11px; font-weight:700; color:#64748B; margin-bottom:6px;">TEXT COLOR</div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
              <button type="button" onclick="window.execNovelTextColor('#0F172A')" style="background:#0F172A; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Default Dark"></button>
              <button type="button" onclick="window.execNovelTextColor('#2E1065')" style="background:#2E1065; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Royal Purple"></button>
              <button type="button" onclick="window.execNovelTextColor('#C89B3C')" style="background:#C89B3C; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Gold"></button>
              <button type="button" onclick="window.execNovelTextColor('#DC2626')" style="background:#DC2626; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Crimson"></button>
              <button type="button" onclick="window.execNovelTextColor('#16A34A')" style="background:#16A34A; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Green"></button>
              <button type="button" onclick="window.execNovelTextColor('#2563EB')" style="background:#2563EB; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Blue"></button>
              <button type="button" onclick="window.execNovelTextColor('#7C3AED')" style="background:#7C3AED; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Violet"></button>
              <button type="button" onclick="window.execNovelTextColor('#64748B')" style="background:#64748B; width:26px; height:26px; border-radius:4px; border:1px solid #000; cursor:pointer;" title="Slate Gray"></button>
            </div>
          </div>
        </div>

        <!-- Highlight Color Dropdown -->
        <div class="toolbar-btn-group" style="position:relative; display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px;">
          <button type="button" class="toolbar-btn" onclick="window.toggleNovelColorMenu('highlight')" title="Highlight Color" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
            <span>🖍️</span>
            <span style="font-size:9px;">▼</span>
          </button>
          <div id="novel-highlight-color-menu" style="display:none; position:absolute; top:36px; left:0; z-index:100; background:#FFF; border:1px solid #CBD5E1; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); padding:8px; width:150px;">
            <div style="font-size:11px; font-weight:700; color:#64748B; margin-bottom:6px;">HIGHLIGHT</div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
              <button type="button" onclick="window.execNovelHighlight('transparent')" style="background:#FFF; width:26px; height:26px; border-radius:4px; border:1px dashed #CBD5E1; font-size:12px; cursor:pointer;" title="None">✕</button>
              <button type="button" onclick="window.execNovelHighlight('#FEF08A')" style="background:#FEF08A; width:26px; height:26px; border-radius:4px; border:1px solid #EAB308; cursor:pointer;" title="Yellow"></button>
              <button type="button" onclick="window.execNovelHighlight('#BBF7D0')" style="background:#BBF7D0; width:26px; height:26px; border-radius:4px; border:1px solid #22C55E; cursor:pointer;" title="Mint Green"></button>
              <button type="button" onclick="window.execNovelHighlight('#BAE6FD')" style="background:#BAE6FD; width:26px; height:26px; border-radius:4px; border:1px solid #0EA5E9; cursor:pointer;" title="Sky Blue"></button>
              <button type="button" onclick="window.execNovelHighlight('#FBCFE8')" style="background:#FBCFE8; width:26px; height:26px; border-radius:4px; border:1px solid #EC4899; cursor:pointer;" title="Pink"></button>
              <button type="button" onclick="window.execNovelHighlight('#FED7AA')" style="background:#FED7AA; width:26px; height:26px; border-radius:4px; border:1px solid #F97316; cursor:pointer;" title="Peach/Orange"></button>
              <button type="button" onclick="window.execNovelHighlight('#E9D5FF')" style="background:#E9D5FF; width:26px; height:26px; border-radius:4px; border:1px solid #A855F7; cursor:pointer;" title="Lavender"></button>
            </div>
          </div>
        </div>

        <!-- Alignments -->
        <div class="toolbar-btn-group" style="display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px; gap:2px;">
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('justifyLeft')" title="Align Left" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; cursor:pointer;">⇤</button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('justifyCenter')" title="Align Center" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; cursor:pointer;">≡</button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('justifyRight')" title="Align Right" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; cursor:pointer;">⇥</button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('justifyFull')" title="Justify" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; cursor:pointer;">≣</button>
        </div>

        <!-- Lists & Indent -->
        <div class="toolbar-btn-group" style="display:inline-flex; border-right:1px solid #E2E8F0; padding-right:6px; margin-right:2px; gap:2px;">
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('insertUnorderedList')" title="Bullet List" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:12px; cursor:pointer;">• List</button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('insertOrderedList')" title="Numbered List" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:12px; cursor:pointer;">1. List</button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('insertHorizontalRule')" title="Divider Line" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; cursor:pointer;">—</button>
        </div>

        <!-- Insert Tools: Link, Image, Emojis, Clear -->
        <div class="toolbar-btn-group" style="display:inline-flex; gap:4px;">
          <button type="button" class="toolbar-btn" onclick="window.openNovelLinkModal()" title="Insert Link" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
            <span>🔗</span> Link
          </button>
          <button type="button" class="toolbar-btn" onclick="window.triggerNovelImageUpload()" title="Insert Image" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
            <span>🖼️</span> Image
          </button>
          <button type="button" class="toolbar-btn" onclick="window.openNovelEmojiPicker()" title="Insert Emoji" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
            <span>😊</span> Emoji
          </button>
          <button type="button" class="toolbar-btn" onclick="window.execNovelCmd('removeFormat')" title="Clear Formatting" style="padding:6px 10px; background:#FFF; border:1px solid #CBD5E1; border-radius:4px; font-size:13px; cursor:pointer;">
            🧹 Clear
          </button>
        </div>

      </div>

      <!-- Blank Document Surface -->
      <div class="novel-editor-surface-wrap" style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:0 0 10px 10px; min-height:560px; box-shadow:0 2px 8px rgba(0,0,0,0.04); padding:32px 36px;">
        <div id="novel-editor-surface" contenteditable="true" role="textbox" aria-multiline="true"
             oninput="window.onNovelContentChanged(${isWriter})"
             style="outline:none; min-height:500px; font-size:16px; line-height:1.85; color:#1E293B; word-break:break-word;">
        </div>
      </div>

      <!-- Bottom Status Bar -->
      <div class="novel-editor-status-bar" style="margin-top:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:12px 18px; background:#FAFAFA; border:1px solid #E2E8F0; border-radius:8px;">
        <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; font-size:13px;">
          <span id="novel-word-count" style="font-weight:700; color:#0B1F33;">0 words</span>
          <span style="color:#CBD5E1;">|</span>
          <span id="novel-char-count" style="color:#64748B;">0 characters</span>
          <span style="color:#CBD5E1;">|</span>
          <span id="novel-read-time" style="color:#64748B;">1 min read</span>
        </div>

        <div style="font-size:12px; color:#64748B; display:flex; align-items:center; gap:6px;">
          <span style="color:#10B981;">⚡</span> Continuous Autosave Active
        </div>
      </div>
    </div>
  `;

  // Setup listeners and load data
  setupNovelEditorEventListeners(isWriter);

  if (novelId) {
    await loadNovelForEditing(novelId);
  } else {
    await checkUnsavedNovelCrashRecovery(isWriter);
  }
}

/**
 * Load an existing novel by ID into the editor for editing
 */
async function loadNovelForEditing(novelId) {
  try {
    const res = await apiFetch(`/api/novels/${novelId}`);
    const data = await res.json();
    if (!res.ok || !data.success || !data.novel) {
      showToast('Could not load novel: ' + (data.error || 'Not found'));
      return;
    }

    const n = data.novel;
    novelState.currentNovelId = n.id;
    novelState.currentNovelSlug = n.slug || null;

    const titleInput = document.getElementById('novel-title-input');
    const surface = document.getElementById('novel-editor-surface');
    const pageTitle = document.getElementById('novel-writing-page-title');
    const saveText = document.getElementById('novel-save-text');

    if (titleInput) titleInput.value = n.title || '';
    if (surface) surface.innerHTML = n.content || '';
    if (pageTitle) pageTitle.textContent = `Edit Novel: ${n.title || 'Untitled'}`;
    if (saveText) saveText.textContent = `Loaded (ID: ${n.id})`;

    updateNovelWordCounters();
    showToast(`Loaded novel "${n.title || 'Untitled'}" for editing.`);
  } catch (err) {
    showToast('Error loading novel: ' + err.message);
  }
}

/**
 * Setup event listeners for the editor
 */
function setupNovelEditorEventListeners(isWriter) {
  const surface = document.getElementById('novel-editor-surface');
  const titleInput = document.getElementById('novel-title-input');

  // Autosave on blur
  if (surface) {
    surface.addEventListener('blur', () => {
      if (novelState.isDirty) window.executeNovelAutosave(isWriter);
    });
  }
  if (titleInput) {
    titleInput.addEventListener('blur', () => {
      if (novelState.isDirty) window.executeNovelAutosave(isWriter);
    });
  }

  // Periodic autosave every 25 seconds
  novelState.periodicTimer = setInterval(() => {
    if (novelState.isDirty) {
      window.executeNovelAutosave(isWriter);
    }
  }, 25000);

  // Close menus on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#novel-text-color-menu') && !e.target.closest('button[onclick*="text"]')) {
      const m = document.getElementById('novel-text-color-menu');
      if (m) m.style.display = 'none';
    }
    if (!e.target.closest('#novel-highlight-color-menu') && !e.target.closest('button[onclick*="highlight"]')) {
      const m = document.getElementById('novel-highlight-color-menu');
      if (m) m.style.display = 'none';
    }
  });

  // Hotkey support (Ctrl+S for instant save)
  if (!window._rp_novel_hotkey_bound) {
    window._rp_novel_hotkey_bound = true;
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        const surf = document.getElementById('novel-editor-surface');
        if (surf) {
          e.preventDefault();
          window.manualSaveNovelDraft(novelState.isWriter);
        }
      }
    });
  }
}

/**
 * Update word, character, and read time counters
 */
function updateNovelWordCounters() {
  const surface = document.getElementById('novel-editor-surface');
  if (!surface) return;
  const text = (surface.innerText || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  const readMins = Math.max(1, Math.ceil(words / 200));

  const wordEl = document.getElementById('novel-word-count');
  const charEl = document.getElementById('novel-char-count');
  const readEl = document.getElementById('novel-read-time');

  if (wordEl) wordEl.textContent = `${words.toLocaleString()} words`;
  if (charEl) charEl.textContent = `${chars.toLocaleString()} characters`;
  if (readEl) readEl.textContent = `${readMins} min read`;
}

/**
 * Called on any input in title or editor surface
 */
window.onNovelContentChanged = (isWriter) => {
  novelState.isDirty = true;
  updateNovelWordCounters();

  const dot = document.getElementById('novel-save-dot');
  const text = document.getElementById('novel-save-text');
  const badge = document.getElementById('novel-save-status-badge');

  if (dot) dot.style.background = '#F59E0B';
  if (text) text.textContent = 'Typing…';
  if (badge) badge.style.borderColor = '#FCD34D';

  // Fast local backup
  const titleInput = document.getElementById('novel-title-input');
  const surface = document.getElementById('novel-editor-surface');
  const title = (titleInput?.value || '').trim();
  const content = surface?.innerHTML || '';

  try {
    const storageKey = isWriter ? 'rp_novel_draft_writer' : 'rp_novel_draft_admin';
    localStorage.setItem(storageKey, JSON.stringify({
      id: novelState.currentNovelId,
      title,
      content,
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {}

  // Debounced autosave (1800ms)
  if (novelState.autosaveTimer) clearTimeout(novelState.autosaveTimer);
  novelState.autosaveTimer = setTimeout(() => {
    window.executeNovelAutosave(isWriter);
  }, 1800);
};

/**
 * Perform database autosave
 */
window.executeNovelAutosave = async (isWriter) => {
  const titleInput = document.getElementById('novel-title-input');
  const surface = document.getElementById('novel-editor-surface');
  if (!titleInput && !surface) return;

  const title = (titleInput?.value || '').trim();
  const content = (surface?.innerHTML || '').trim();
  const plainText = (surface?.innerText || '').trim();

  // If completely blank, do nothing
  if (!title && !plainText) return;

  const dot = document.getElementById('novel-save-dot');
  const text = document.getElementById('novel-save-text');
  const badge = document.getElementById('novel-save-status-badge');

  if (dot) dot.style.background = '#3B82F6';
  if (text) text.textContent = 'Saving…';
  if (badge) badge.style.borderColor = '#93C5FD';

  try {
    const res = await apiFetch('/api/novels/autosave', {
      method: 'POST',
      body: JSON.stringify({
        id: novelState.currentNovelId || null,
        title: title || 'Untitled Draft',
        content: content
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Autosave failed');
    }

    // Persist current novel ID so future saves update this same record
    if (data.id) {
      novelState.currentNovelId = data.id;
      if (data.novel?.slug) novelState.currentNovelSlug = data.novel.slug;
    }

    novelState.isDirty = false;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (dot) dot.style.background = '#10B981';
    if (text) text.textContent = `Saved at ${timeStr}`;
    if (badge) badge.style.borderColor = '#A7F3D0';
  } catch (err) {
    console.warn('[Novel Autosave Error]:', err.message);
    if (dot) dot.style.background = '#EF4444';
    if (text) text.textContent = 'Save failed — retrying';
    if (badge) badge.style.borderColor = '#FCA5A5';
  }
};

/**
 * Manual Save Draft button
 */
window.manualSaveNovelDraft = async (isWriter) => {
  await window.executeNovelAutosave(isWriter);
  showToast('Draft successfully saved to database! ✓');
};

/**
 * Check crash/session recovery when starting fresh
 */
async function checkUnsavedNovelCrashRecovery(isWriter) {
  const mount = document.getElementById('novel-draft-recovery-mount');
  if (!mount) return;

  try {
    const storageKey = isWriter ? 'rp_novel_draft_writer' : 'rp_novel_draft_admin';
    let candidate = null;

    const rawLocal = localStorage.getItem(storageKey);
    if (rawLocal) {
      try {
        const p = JSON.parse(rawLocal);
        if (p && (p.title || p.content)) candidate = { ...p, source: 'local' };
      } catch (e) {}
    }

    // Also check backend latest draft
    try {
      const res = await apiFetch('/api/novels/latest-draft');
      const data = await res.json();
      if (res.ok && data.success && data.draft) {
        if (!candidate || new Date(data.draft.updatedAt) > new Date(candidate.updatedAt)) {
          candidate = {
            id: data.draft.id,
            title: data.draft.title,
            content: data.draft.content,
            updatedAt: data.draft.updatedAt,
            source: 'server'
          };
        }
      }
    } catch (apiErr) {}

    const surface = document.getElementById('novel-editor-surface');
    const titleInput = document.getElementById('novel-title-input');

    if (candidate && surface && !surface.innerText.trim() && !titleInput.value.trim()) {
      const timeStr = candidate.updatedAt ? new Date(candidate.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier';
      novelState.cachedRecovery = candidate;

      mount.innerHTML = `
        <div class="novel-draft-recovery-card" style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:12px 18px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:20px;">💡</span>
            <div>
              <strong style="color:#92400E; font-size:13.5px;">Recovered draft found from ${timeStr}</strong>
              <div style="font-size:12px; color:#B45309;">Title: "${escapeHtml(candidate.title || 'Untitled')}" • ${candidate.source === 'server' ? 'Stored in database' : 'Saved in browser storage'}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-gold btn-xs" onclick="window.restoreNovelDraftRecovery(${isWriter})" style="font-weight:700; padding:6px 14px;">
              Restore Draft
            </button>
            <button type="button" class="btn btn-outline btn-xs" onclick="window.dismissNovelDraftRecovery(${isWriter})" style="font-size:12px; padding:6px 12px;">
              Start Fresh
            </button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.warn('Crash recovery check error:', err);
  }
}

window.restoreNovelDraftRecovery = (isWriter) => {
  const c = novelState.cachedRecovery;
  if (!c) return;

  const titleInput = document.getElementById('novel-title-input');
  const surface = document.getElementById('novel-editor-surface');

  if (titleInput) titleInput.value = c.title || '';
  if (surface) surface.innerHTML = c.content || '';
  if (c.id) novelState.currentNovelId = c.id;

  document.getElementById('novel-draft-recovery-mount').innerHTML = '';
  updateNovelWordCounters();
  showToast('Draft successfully restored! ✓');
  window.executeNovelAutosave(isWriter);
};

window.dismissNovelDraftRecovery = (isWriter) => {
  const storageKey = isWriter ? 'rp_novel_draft_writer' : 'rp_novel_draft_admin';
  localStorage.removeItem(storageKey);
  novelState.cachedRecovery = null;
  const mount = document.getElementById('novel-draft-recovery-mount');
  if (mount) mount.innerHTML = '';
  showToast('Previous draft dismissed.');
};

/* =========================================================================
   2. RICH-TEXT FORMATTING ACTIONS
   ========================================================================= */

window.execNovelCmd = (command, value = null) => {
  document.execCommand(command, false, value);
  const surface = document.getElementById('novel-editor-surface');
  if (surface) surface.focus();
  window.onNovelContentChanged(novelState.isWriter);
};

window.execNovelBlock = (tag) => {
  document.execCommand('formatBlock', false, tag);
  const surface = document.getElementById('novel-editor-surface');
  if (surface) surface.focus();
  window.onNovelContentChanged(novelState.isWriter);
};

window.execNovelFontFamily = (fontFamily) => {
  if (!fontFamily) return;
  document.execCommand('fontName', false, fontFamily);
  const surface = document.getElementById('novel-editor-surface');
  if (surface) surface.focus();
  window.onNovelContentChanged(novelState.isWriter);
};

window.execNovelFontSize = (fontSize) => {
  if (!fontSize) return;
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  // Use a span wrapper with exact font-size style for pixel accuracy
  const range = selection.getRangeAt(0);
  const span = document.createElement('span');
  span.style.fontSize = fontSize;
  span.appendChild(range.extractContents());
  range.insertNode(span);

  const surface = document.getElementById('novel-editor-surface');
  if (surface) surface.focus();
  window.onNovelContentChanged(novelState.isWriter);
};

window.toggleNovelColorMenu = (type) => {
  const menuId = type === 'text' ? 'novel-text-color-menu' : 'novel-highlight-color-menu';
  const otherMenuId = type === 'text' ? 'novel-highlight-color-menu' : 'novel-text-color-menu';
  const other = document.getElementById(otherMenuId);
  if (other) other.style.display = 'none';

  const menu = document.getElementById(menuId);
  if (menu) {
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  }
};

window.execNovelTextColor = (color) => {
  document.execCommand('foreColor', false, color);
  const menu = document.getElementById('novel-text-color-menu');
  if (menu) menu.style.display = 'none';
  const surface = document.getElementById('novel-editor-surface');
  if (surface) surface.focus();
  window.onNovelContentChanged(novelState.isWriter);
};

window.execNovelHighlight = (color) => {
  document.execCommand('hiliteColor', false, color);
  const menu = document.getElementById('novel-highlight-color-menu');
  if (menu) menu.style.display = 'none';
  const surface = document.getElementById('novel-editor-surface');
  if (surface) surface.focus();
  window.onNovelContentChanged(novelState.isWriter);
};

/* --- Link Dialog with Separate Text and URL Fields --- */
window.openNovelLinkModal = () => {
  const surface = document.getElementById('novel-editor-surface');
  if (!surface) return;

  const selection = window.getSelection();
  let savedRange = null;
  if (selection && selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange();
  }

  // Detect if cursor is inside an existing link
  let existingLink = null;
  if (selection && selection.anchorNode) {
    let node = selection.anchorNode;
    while (node && node !== surface) {
      if (node.nodeType === 1 && node.tagName.toLowerCase() === 'a') {
        existingLink = node;
        break;
      }
      node = node.parentNode;
    }
  }

  const existingText = existingLink ? existingLink.textContent : (savedRange ? savedRange.toString() : '');
  const existingHref = existingLink ? (existingLink.getAttribute('href') || '') : '';
  const isEditing = Boolean(existingLink);

  document.getElementById('modal-novel-link')?.remove();

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-novel-link" style="position:fixed; inset:0; background:rgba(15,23,42,0.65); display:flex; align-items:center; justify-content:center; z-index:999999; padding:16px; backdrop-filter:blur(3px);">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:480px; border-radius:14px; box-shadow:0 20px 45px rgba(0,0,0,0.25); border:1px solid #CBD5E1; overflow:hidden;">
        <div style="background:#0B1F33; color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:15.5px; font-weight:700; display:flex; align-items:center; gap:8px;">
            <span>🔗</span> ${isEditing ? 'Edit Link' : 'Insert Link'}
          </h3>
          <button type="button" onclick="document.getElementById('modal-novel-link').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>

        <div style="padding:20px;">
          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:12.5px; font-weight:700; color:#0B1F33; margin-bottom:6px;">
              Link Text
            </label>
            <input type="text" id="novel-link-input-text" class="form-input" 
                   value="${escapeHtml(existingText)}" 
                   placeholder="e.g. Read Episode 1 or Click here" 
                   style="width:100%; padding:9px 12px; font-size:14px; border:1px solid #CBD5E1; border-radius:6px;">
            <div style="font-size:11.5px; color:#64748B; margin-top:4px;">The readable text displayed to readers.</div>
          </div>

          <div style="margin-bottom:18px;">
            <label style="display:block; font-size:12.5px; font-weight:700; color:#0B1F33; margin-bottom:6px;">
              Web URL Destination <span style="color:#EF4444;">*</span>
            </label>
            <input type="text" id="novel-link-input-url" class="form-input" 
                   value="${escapeHtml(existingHref)}" 
                   placeholder="e.g. https://... or #thread?id=..." 
                   style="width:100%; padding:9px 12px; font-size:14px; border:1px solid #CBD5E1; border-radius:6px;">
            <div style="font-size:11.5px; color:#64748B; margin-top:4px;">Valid web URL (https://) or internal hash link (#thread?).</div>
          </div>

          <div id="novel-link-error-msg" style="display:none; color:#DC2626; font-size:12.5px; margin-bottom:12px; font-weight:600;"></div>

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:20px;">
            <div>
              ${isEditing ? `
                <button type="button" class="btn btn-outline btn-sm" id="btn-novel-remove-link" style="color:#DC2626; border-color:#FCA5A5; font-size:12px; padding:6px 12px;">
                  🗑️ Remove Link
                </button>
              ` : '<span></span>'}
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-novel-link').remove()">
                Cancel
              </button>
              <button type="button" class="btn btn-gold btn-sm" id="btn-novel-submit-link" style="font-weight:700; padding:7px 18px;">
                ${isEditing ? 'Update Link' : 'Insert Link'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const urlInput = document.getElementById('novel-link-input-url');
  const textInput = document.getElementById('novel-link-input-text');
  const errEl = document.getElementById('novel-link-error-msg');

  setTimeout(() => {
    if (!existingText) textInput?.focus();
    else urlInput?.focus();
  }, 100);

  const removeBtn = document.getElementById('btn-novel-remove-link');
  if (removeBtn && existingLink) {
    removeBtn.onclick = () => {
      const textNode = document.createTextNode(existingLink.textContent);
      existingLink.parentNode.replaceChild(textNode, existingLink);
      document.getElementById('modal-novel-link')?.remove();
      window.onNovelContentChanged(novelState.isWriter);
      showToast('Link removed.');
    };
  }

  const submitBtn = document.getElementById('btn-novel-submit-link');
  if (submitBtn) {
    submitBtn.onclick = () => {
      let url = (urlInput?.value || '').trim();
      let text = (textInput?.value || '').trim();

      if (!url) {
        if (errEl) {
          errEl.textContent = 'Please enter a destination URL.';
          errEl.style.display = 'block';
        }
        urlInput?.focus();
        return;
      }

      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('#') && !url.startsWith('/') && !url.startsWith('mailto:')) {
        url = 'https://' + url;
      }

      if (!text) text = url;

      document.getElementById('modal-novel-link')?.remove();
      surface.focus();

      if (isEditing && existingLink) {
        existingLink.setAttribute('href', url);
        existingLink.setAttribute('target', url.startsWith('#') ? '_self' : '_blank');
        existingLink.setAttribute('rel', 'noopener noreferrer');
        existingLink.textContent = text;
      } else {
        if (savedRange) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }

        const a = document.createElement('a');
        a.href = url;
        a.target = url.startsWith('#') ? '_self' : '_blank';
        a.rel = 'noopener noreferrer';
        a.style.color = '#2563EB';
        a.style.textDecoration = 'underline';
        a.style.fontWeight = '600';
        a.textContent = text;

        if (savedRange && !savedRange.collapsed) {
          savedRange.deleteContents();
          savedRange.insertNode(a);
        } else if (savedRange) {
          savedRange.insertNode(a);
        } else {
          surface.appendChild(a);
        }

        const sel = window.getSelection();
        const newRange = document.createRange();
        newRange.setStartAfter(a);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }

      window.onNovelContentChanged(novelState.isWriter);
      showToast(isEditing ? 'Link updated! ✓' : 'Link inserted! ✓');
    };
  }
};

/* --- Image Upload & Insertion --- */
window.triggerNovelImageUpload = () => {
  let fileInput = document.getElementById('novel-image-file-input');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'novel-image-file-input';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
    fileInput.style.display = 'none';
    fileInput.onchange = async (event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file.');
        event.target.value = '';
        return;
      }
      showToast('Uploading image...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await apiFetch('/api/upload/image', {
            method: 'POST',
            body: JSON.stringify({ data: e.target.result, folder: 'media', filename: file.name })
          });
          const data = await res.json();
          if (res.ok && data.url) {
            document.execCommand('insertImage', false, data.url);
            window.onNovelContentChanged(novelState.isWriter);
            showToast('Image successfully uploaded and inserted! ✓');
          } else {
            throw new Error(data.error || 'Upload failed.');
          }
        } catch (err) {
          showToast('Error uploading image: ' + err.message);
        } finally {
          event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    };
    document.body.appendChild(fileInput);
  }
  fileInput.click();
};

/* --- Emoji Picker Modal --- */
window.openNovelEmojiPicker = () => {
  document.getElementById('modal-novel-emoji')?.remove();

  const emojis = [
    '❤️', '✨', '📚', '✍️', '📖', '🌸', '👑', '🔥', '💫', '💖',
    '😊', '😇', '🥺', '😢', '😍', '🤔', '👏', '🙏', '🌹', '🖋️',
    '🎉', '🌟', '🌙', '☀️', '🕊️', '💐', '💎', '☕', '🕯️', '🌿',
    '🥰', '😭', '🤗', '🤩', '💯', '🌈', '🦋', '🎭', '🎼', '💌'
  ];

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-novel-emoji" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); display:flex; align-items:center; justify-content:center; z-index:999999; padding:16px; backdrop-filter:blur(2px);">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:360px; border-radius:12px; box-shadow:0 16px 40px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:#0B1F33; color:#FFF; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:14.5px; font-weight:700;">😊 Choose Emoji</h3>
          <button type="button" onclick="document.getElementById('modal-novel-emoji').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <div style="padding:16px; display:grid; grid-template-columns:repeat(8, 1fr); gap:8px;">
          ${emojis.map(em => `
            <button type="button" onclick="window.insertNovelEmoji('${em}')" style="font-size:20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:6px; cursor:pointer; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
              ${em}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.insertNovelEmoji = (emoji) => {
  document.getElementById('modal-novel-emoji')?.remove();
  const surface = document.getElementById('novel-editor-surface');
  if (surface) {
    surface.focus();
    document.execCommand('insertText', false, emoji);
    window.onNovelContentChanged(novelState.isWriter);
  }
};

/* --- Reader Preview Modal --- */
window.openNovelReaderPreview = () => {
  const title = (document.getElementById('novel-title-input')?.value || '').trim() || 'Untitled Novel';
  const surface = document.getElementById('novel-editor-surface');
  const content = surface?.innerHTML || '<p style="color:#94A3B8; font-style:italic;">No content written yet.</p>';
  const words = (surface?.innerText || '').trim().split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.ceil(words / 200));

  document.getElementById('modal-novel-preview')?.remove();

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-novel-preview" style="position:fixed; inset:0; background:rgba(15,23,42,0.7); display:flex; align-items:center; justify-content:center; z-index:999999; padding:clamp(10px, 3vw, 20px); box-sizing:border-box; backdrop-filter:blur(3px);">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:820px; max-height:90vh; border-radius:14px; box-shadow:0 24px 50px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden;">
        
        <div style="background:#0B1F33; color:#FFF; padding:16px 22px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:18px;">📖</span>
            <h3 style="margin:0; font-size:16px; font-weight:700;">Live Reader Preview</h3>
          </div>
          <button type="button" onclick="document.getElementById('modal-novel-preview').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>

        <div style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; padding:10px 22px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:12.5px; color:#64748B;">
            ⏱️ ${readMins} min read • 📊 ${words.toLocaleString()} words
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-outline btn-xs" onclick="document.getElementById('preview-body-container').style.background='#FFFFFF'; document.getElementById('preview-body-container').style.color='#1E293B';" style="font-size:11px; padding:3px 8px;">Light</button>
            <button type="button" class="btn btn-outline btn-xs" onclick="document.getElementById('preview-body-container').style.background='#FBF0D9'; document.getElementById('preview-body-container').style.color='#5F4B32';" style="font-size:11px; padding:3px 8px;">Sepia</button>
            <button type="button" class="btn btn-outline btn-xs" onclick="document.getElementById('preview-body-container').style.background='#1A1A1A'; document.getElementById('preview-body-container').style.color='#E5E5E5';" style="font-size:11px; padding:3px 8px;">Dark</button>
          </div>
        </div>

        <div id="preview-body-container" style="padding:clamp(18px, 4vw, 36px) clamp(14px, 4vw, 36px); overflow-y:auto; flex:1; background:#FFFFFF; transition:background 0.2s; box-sizing:border-box;">
          <div style="text-align:center; border-bottom:1px solid rgba(200,155,60,0.3); padding-bottom:18px; margin-bottom:24px;">
            <div style="font-size:11.5px; letter-spacing:1.5px; text-transform:uppercase; color:#C89B3C; font-weight:700;">Rudhra Prarthana Novels</div>
            <h1 style="font-family:'Playfair Display', serif; font-size:2rem; margin:10px 0 6px; color:inherit; font-weight:700;">
              ${escapeHtml(title)}
            </h1>
            <div style="font-size:12px; opacity:0.75;">Protected Reading • High Quality Literary Experience</div>
          </div>
          <div class="novel-preview-rendered-body" style="font-family:'Cormorant Garamond', Georgia, serif; font-size:1.15rem; line-height:1.95; overflow-wrap:break-word; word-break:normal;">
            ${content}
          </div>
        </div>

        <div style="background:#F8FAFC; border-top:1px solid #E2E8F0; padding:12px 22px; display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-gold btn-sm" onclick="document.getElementById('modal-novel-preview').remove()">
            Close Preview
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/* --- Generate Publish Link Action --- */
window.executePublishNovelLink = async (isWriter) => {
  const title = (document.getElementById('novel-title-input')?.value || '').trim();
  const surface = document.getElementById('novel-editor-surface');
  const content = surface?.innerHTML || '';
  const plainText = (surface?.innerText || '').trim();

  if (!title) {
    showToast('Please enter a novel title before publishing.');
    document.getElementById('novel-title-input')?.focus();
    return;
  }

  if (!plainText) {
    showToast('Cannot publish empty content. Please write your novel.');
    return;
  }

  // First save draft to ensure we have an ID
  await window.executeNovelAutosave(isWriter);
  const novelId = novelState.currentNovelId;

  if (!novelId) {
    showToast('Error saving novel. Please try again.');
    return;
  }

  try {
    const res = await apiFetch(`/api/novels/${novelId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ title, content })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to publish novel.');
      return;
    }

    const contentLink = data.contentLink || `#thread?id=${data.novel?.slug || novelId}`;
    novelState.currentNovelSlug = data.novel?.slug || null;

    if (typeof window.showSavedContentLinkModal === 'function') {
      window.showSavedContentLinkModal({ title, type: 'novel', contentLink });
    } else {
      showToast('Novel published successfully! Link: ' + contentLink);
    }

    const text = document.getElementById('novel-save-text');
    const dot = document.getElementById('novel-save-dot');
    if (text) text.textContent = 'Published Live';
    if (dot) dot.style.background = '#10B981';
  } catch (err) {
    showToast('Publish error: ' + err.message);
  }
};

window.navigateBackToNovelsManagement = (isWriter) => {
  if (novelState.isDirty && !confirm('You have unsaved changes. Navigate back to Novel Management?')) {
    return;
  }
  if (isWriter && typeof window.switchWriterTab === 'function') {
    window.switchWriterTab('novels');
  } else if (!isWriter && typeof window.switchAdminTab === 'function') {
    window.switchAdminTab('novels');
  }
};

/* =========================================================================
   3. NOVEL MANAGEMENT PAGE (Admin & Writer)
   ========================================================================= */

/**
 * Render Dedicated Novel Management Page
 * @param {HTMLElement} canvas - mount target container
 * @param {Object} options - { isWriter: boolean }
 */
export async function renderNovelManagementPage(canvas, options = {}) {
  if (!canvas) return;
  const isWriter = Boolean(options.isWriter);
  novelState.isWriter = isWriter;
  novelState.activeFilter = 'all';
  novelState.searchQuery = '';
  novelState.currentPage = 1;

  canvas.innerHTML = `
    <div class="novel-management-container" style="max-width:1160px; margin:0 auto; padding:16px 12px 60px;">
      
      <!-- Page Header -->
      <div class="novel-page-header" style="margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 style="margin:0; font-size:1.6rem; font-weight:700; color:#0B1F33; display:flex; align-items:center; gap:10px; font-family:'Playfair Display', serif;">
            <span>📚</span> Novel Management
          </h1>
          <p style="margin:4px 0 0; font-size:13px; color:#64748B;">
            ${isWriter ? 'Manage, edit, review, and organize your novels and drafts.' : 'Manage, edit, review, and organize all novels across categories.'}
          </p>
        </div>

        <button type="button" class="btn btn-gold btn-sm" onclick="window.startNewNovelWriting(${isWriter})" style="font-weight:700; padding:8px 18px; box-shadow:0 2px 8px rgba(200,155,60,0.3);">
          ✍️ + Write New Novel
        </button>
      </div>

      <!-- Summary Statistics Strip -->
      <div id="novel-summary-stats-mount" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:20px;">
        <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:10px; padding:14px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size:11.5px; font-weight:700; color:#64748B; text-transform:uppercase;">Total Novels</div>
          <div id="stat-total-novels" style="font-size:24px; font-weight:800; color:#0B1F33; margin-top:4px;">-</div>
        </div>
        <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:10px; padding:14px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size:11.5px; font-weight:700; color:#64748B; text-transform:uppercase;">🟢 Published</div>
          <div id="stat-published-novels" style="font-size:24px; font-weight:800; color:#10B981; margin-top:4px;">-</div>
        </div>
        <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:10px; padding:14px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size:11.5px; font-weight:700; color:#64748B; text-transform:uppercase;">📝 Drafts</div>
          <div id="stat-drafts-novels" style="font-size:24px; font-weight:800; color:#F59E0B; margin-top:4px;">-</div>
        </div>
        <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:10px; padding:14px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size:11.5px; font-weight:700; color:#64748B; text-transform:uppercase;">⏸️ Disabled</div>
          <div id="stat-disabled-novels" style="font-size:24px; font-weight:800; color:#64748B; margin-top:4px;">-</div>
        </div>
      </div>

      <!-- Controls Strip: Filters & Search -->
      <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:12px; padding:14px 18px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        
        <!-- Status Filter Buttons -->
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;" id="novel-status-filter-group">
          <button type="button" class="btn btn-sm btn-gold" id="btn-filter-all" onclick="window.onNovelFilterClick('all', ${isWriter})">All</button>
          <button type="button" class="btn btn-sm btn-outline" id="btn-filter-published" onclick="window.onNovelFilterClick('published', ${isWriter})">🟢 Published</button>
          <button type="button" class="btn btn-sm btn-outline" id="btn-filter-draft" onclick="window.onNovelFilterClick('draft', ${isWriter})">📝 Drafts</button>
          <button type="button" class="btn btn-sm btn-outline" id="btn-filter-disabled" onclick="window.onNovelFilterClick('disabled', ${isWriter})">⏸️ Disabled</button>
        </div>

        <!-- Search Input -->
        <div style="min-width:280px; flex:1; max-width:380px;">
          <input type="text" id="novel-mgmt-search-input" class="form-input" 
                 placeholder="🔍 Search novel title..." 
                 oninput="window.onNovelSearchInput(this.value, ${isWriter})"
                 style="width:100%; padding:8px 14px; font-size:13.5px; border:1px solid #CBD5E1; border-radius:8px;">
        </div>
      </div>

      <!-- Table Mount Target -->
      <div id="novel-management-table-mount">
        <div style="text-align:center; padding:50px; color:#64748B;">
          Loading novels…
        </div>
      </div>

      <!-- Pagination Mount Target (Strictly 10 per page) -->
      <div id="novel-management-pagination-mount" style="margin-top:20px;"></div>
    </div>
  `;

  await loadNovelManagementData(isWriter);
}

/**
 * Start writing a new novel with a clean slate
 */
window.startNewNovelWriting = (isWriter) => {
  novelState.currentNovelId = null;
  novelState.currentNovelSlug = null;
  novelState.isDirty = false;

  if (isWriter && typeof window.switchWriterTab === 'function') {
    window.switchWriterTab('editor');
  } else if (!isWriter && typeof window.switchAdminTab === 'function') {
    window.switchAdminTab('editor');
  }
};

window.onNovelFilterClick = (filter, isWriter) => {
  novelState.activeFilter = filter;
  novelState.currentPage = 1;

  // Update button active styling
  ['all', 'published', 'draft', 'disabled'].forEach(f => {
    const btn = document.getElementById(`btn-filter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'btn btn-sm btn-gold';
      } else {
        btn.className = 'btn btn-sm btn-outline';
      }
    }
  });

  loadNovelManagementData(isWriter);
};

window.onNovelSearchInput = (val, isWriter) => {
  novelState.searchQuery = (val || '').trim();
  novelState.currentPage = 1;

  if (window._novelSearchTimer) clearTimeout(window._novelSearchTimer);
  window._novelSearchTimer = setTimeout(() => {
    loadNovelManagementData(isWriter);
  }, 300);
};

window.onNovelPageChange = (page, isWriter) => {
  novelState.currentPage = Math.max(1, page);
  loadNovelManagementData(isWriter);
  window.scrollTo({ top: 120, behavior: 'smooth' });
};

/**
 * Load paginated novels from the backend
 */
async function loadNovelManagementData(isWriter) {
  const mount = document.getElementById('novel-management-table-mount');
  const pagMount = document.getElementById('novel-management-pagination-mount');
  if (!mount) return;

  try {
    let url = `/api/novels?page=${novelState.currentPage}&limit=10&status=${encodeURIComponent(novelState.activeFilter)}`;
    if (novelState.searchQuery) {
      url += `&search=${encodeURIComponent(novelState.searchQuery)}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();
    if (!res.ok || !data.success) {
      mount.innerHTML = `<div style="color:#DC2626; padding:24px; text-align:center;">Failed to load novels: ${data.error || 'Server error'}</div>`;
      return;
    }

    const items = data.items || [];
    const pag = data.pagination || { page: 1, limit: 10, total: items.length, totalPages: 1 };
    novelState.items = items;
    novelState.totalItems = pag.total || 0;
    novelState.totalPages = pag.totalPages || 1;

    // Update summary stat counts
    const statTotal = document.getElementById('stat-total-novels');
    const statPub = document.getElementById('stat-published-novels');
    const statDrf = document.getElementById('stat-drafts-novels');
    const statDis = document.getElementById('stat-disabled-novels');

    if (statTotal) statTotal.textContent = pag.total !== undefined ? pag.total : items.length;
    if (statPub) statPub.textContent = items.filter(i => i.status === 'published').length;
    if (statDrf) statDrf.textContent = items.filter(i => i.status === 'draft').length;
    if (statDis) statDis.textContent = items.filter(i => i.status === 'disabled').length;

    // Empty state
    if (items.length === 0) {
      mount.innerHTML = `
        <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:12px; padding:48px 24px; text-align:center;">
          <div style="font-size:42px; margin-bottom:12px;">📚</div>
          <h3 style="font-size:18px; font-weight:700; color:#0B1F33; margin:0 0 6px;">No Novels Found</h3>
          <p style="color:#64748B; font-size:14px; margin:0 0 20px;">
            ${novelState.searchQuery ? `No novels matching "${escapeHtml(novelState.searchQuery)}".` : 'No novels in this filter.'}
          </p>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.startNewNovelWriting(${isWriter})">
            ✍️ + Write New Novel
          </button>
        </div>
      `;
      if (pagMount) pagMount.innerHTML = '';
      return;
    }

    // Render Clean Table
    mount.innerHTML = `
      <div class="novel-table-card" style="background:#FFF; border:1px solid #E2E8F0; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.04); overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:920px; font-size:13.5px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0;">
              <th style="padding:14px 18px; text-align:left; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase;">Novel Title</th>
              <th style="padding:14px 18px; text-align:left; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase;">Creator</th>
              <th style="padding:14px 18px; text-align:center; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase;">Status</th>
              <th style="padding:14px 18px; text-align:left; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase;">Created</th>
              <th style="padding:14px 18px; text-align:left; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase;">Last Updated</th>
              <th style="padding:14px 18px; text-align:right; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => {
              const isPub = item.status === 'published';
              const isDis = item.status === 'disabled';
              const isDrf = item.status === 'draft';

              const statusBadge = isPub 
                ? '<span style="background:#DCFCE7; color:#166534; padding:3px 10px; border-radius:12px; font-weight:700; font-size:11.5px;">🟢 Published</span>'
                : (isDis 
                    ? '<span style="background:#F1F5F9; color:#475569; padding:3px 10px; border-radius:12px; font-weight:700; font-size:11.5px;">⏸️ Disabled</span>'
                    : '<span style="background:#FEF3C7; color:#92400E; padding:3px 10px; border-radius:12px; font-weight:700; font-size:11.5px;">📝 Draft</span>');

              const createdStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
              const updatedStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
              const linkUrl = isPub ? `#thread?id=${item.slug || item.id}` : '';

              return `
                <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                  
                  <!-- Title -->
                  <td style="padding:14px 18px; max-width:320px;">
                    <div style="font-weight:700; font-size:14.5px; color:#0B1F33; margin-bottom:4px; word-break:break-word;">
                      ${isPub ? `
                        <a href="${linkUrl}" target="_blank" style="color:#0B1F33; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                          <span>${escapeHtml(item.title)}</span>
                          <span style="font-size:11px; color:#3B82F6;">↗</span>
                        </a>
                      ` : `<span>${escapeHtml(item.title)}</span>`}
                    </div>
                    ${isPub ? `
                      <div style="font-size:11.5px; color:#64748B; display:flex; align-items:center; gap:8px;">
                        <span style="background:#F1F5F9; padding:2px 6px; border-radius:4px; font-family:monospace;">${linkUrl}</span>
                        <button type="button" class="btn btn-outline btn-xs" onclick="navigator.clipboard.writeText(window.location.origin + '/${linkUrl}'); showToast('Reader link copied! 📋');" style="font-size:10.5px; padding:1px 6px;">
                          📋 Copy
                        </button>
                      </div>
                    ` : ''}
                  </td>

                  <!-- Creator -->
                  <td style="padding:14px 18px; font-size:13px; color:#334155; font-weight:600;">
                    ${escapeHtml(item.authorName || 'Rudhra Prarthana')}
                  </td>

                  <!-- Status -->
                  <td style="padding:14px 18px; text-align:center;">
                    ${statusBadge}
                  </td>

                  <!-- Created -->
                  <td style="padding:14px 18px; font-size:12.5px; color:#64748B;">
                    ${createdStr}
                  </td>

                  <!-- Updated -->
                  <td style="padding:14px 18px; font-size:12.5px; color:#64748B;">
                    ${updatedStr}
                  </td>

                  <!-- Actions -->
                  <td style="padding:14px 18px; text-align:right;">
                    <div style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.openNovelEdit(${item.id}, ${isWriter})" style="padding:5px 10px; font-size:12px; font-weight:600;" title="Edit in Novel Writing Page">
                        ✏️ Edit
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.viewNovelDetailModal(${item.id})" style="padding:5px 10px; font-size:12px; font-weight:600;" title="View Content">
                        👁️ View
                      </button>
                      ${isPub ? `
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.showNovelPublishLinkModal(${item.id})" style="padding:5px 10px; font-size:12px; font-weight:600;" title="Show Publish Link">
                          🔗 Link
                        </button>
                      ` : ''}
                      ${!isDrf ? `
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.toggleNovelStatusAction(${item.id}, '${isPub ? 'disabled' : 'published'}', ${isWriter})" style="padding:5px 10px; font-size:12px; font-weight:600;" title="${isPub ? 'Disable Novel' : 'Enable Novel'}">
                          ${isPub ? '⏸️ Disable' : '▶️ Enable'}
                        </button>
                      ` : ''}
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.deleteNovelToTrashAction(${item.id}, '${escapeQuote(item.title)}', ${isWriter})" style="color:#DC2626; border-color:#FCA5A5; padding:5px 10px; font-size:12px; font-weight:600;" title="Move to Trash">
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Render Pagination (Strictly 10 novels per page)
    renderNovelPagination(pag, isWriter);
  } catch (err) {
    mount.innerHTML = `<div style="color:#DC2626; padding:24px; text-align:center;">Error loading novels: ${err.message}</div>`;
  }
}

/**
 * Render Strict 10-per-page Pagination Controls
 */
function renderNovelPagination(pag, isWriter) {
  const mount = document.getElementById('novel-management-pagination-mount');
  if (!mount) return;

  const total = pag.total || 0;
  const page = pag.page || 1;
  const totalPages = pag.totalPages || 1;
  const limit = pag.limit || 10;

  if (total === 0) {
    mount.innerHTML = '';
    return;
  }

  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  // Generate page number buttons
  let pageButtonsHtml = '';
  for (let p = 1; p <= totalPages; p++) {
    const isCurrent = p === page;
    pageButtonsHtml += `
      <button type="button" class="btn btn-sm ${isCurrent ? 'btn-gold' : 'btn-outline'}" 
              onclick="window.onNovelPageChange(${p}, ${isWriter})" 
              style="min-width:36px; font-weight:${isCurrent ? '800' : '500'};">
        ${p}
      </button>
    `;
  }

  mount.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:12px 18px; background:#FFF; border:1px solid #E2E8F0; border-radius:10px;">
      <div style="font-size:13px; color:#64748B;">
        Showing <strong>${startIdx}–${endIdx}</strong> of <strong>${total}</strong> novels (10 per page)
      </div>

      <div style="display:flex; align-items:center; gap:6px;">
        <button type="button" class="btn btn-outline btn-sm" 
                onclick="window.onNovelPageChange(${page - 1}, ${isWriter})" 
                ${page <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
          « Previous
        </button>

        ${pageButtonsHtml}

        <button type="button" class="btn btn-outline btn-sm" 
                onclick="window.onNovelPageChange(${page + 1}, ${isWriter})" 
                ${page >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
          Next »
        </button>
      </div>
    </div>
  `;
}

/**
 * Edit novel action: Switches to the Novel Writing page and loads the record by ID
 */
window.openNovelEdit = async (novelId, isWriter) => {
  novelState.currentNovelId = novelId;
  novelState.isWriter = isWriter;

  if (isWriter && typeof window.switchWriterTab === 'function') {
    window.switchWriterTab('editor', { novelId });
  } else if (!isWriter && typeof window.switchAdminTab === 'function') {
    window.switchAdminTab('editor', { novelId });
  }
};

/**
 * View novel modal preview
 */
window.viewNovelDetailModal = (novelId) => {
  const item = (novelState.items || []).find(x => Number(x.id) === Number(novelId));
  if (!item) return;

  document.getElementById('modal-view-novel-mgmt')?.remove();

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-view-novel-mgmt" style="position:fixed; inset:0; background:rgba(15,23,42,0.7); display:flex; align-items:center; justify-content:center; z-index:999999; padding:20px; backdrop-filter:blur(3px);">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:720px; max-height:85vh; border-radius:14px; box-shadow:0 24px 50px rgba(0,0,0,0.25); display:flex; flex-direction:column; overflow:hidden;">
        <div style="background:#0B1F33; color:#FFF; padding:16px 22px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">📖 Novel Details</h3>
          <button type="button" onclick="document.getElementById('modal-view-novel-mgmt').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <div style="padding:22px; overflow-y:auto; flex:1;">
          <div style="font-size:12px; font-weight:700; color:#856404; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
            ${escapeHtml(item.status || 'Draft').toUpperCase()} • by ${escapeHtml(item.authorName || 'Rudhra Prarthana')}
          </div>
          <h2 style="margin:0 0 16px; font-size:1.45rem; color:#0B1F33; font-family:'Playfair Display', serif;">${escapeHtml(item.title)}</h2>
          <div style="font-size:14.5px; line-height:1.85; color:#334155; border-top:1px solid #E2E8F0; padding-top:16px;">
            ${item.content || '<p style="color:#94A3B8; font-style:italic;">No content written yet.</p>'}
          </div>
        </div>
        <div style="background:#F8FAFC; border-top:1px solid #E2E8F0; padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:12px; color:#64748B;">
            Updated: ${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-view-novel-mgmt').remove()">Close</button>
            <button type="button" class="btn btn-gold btn-sm" onclick="document.getElementById('modal-view-novel-mgmt').remove(); window.openNovelEdit(${item.id}, ${novelState.isWriter});">
              ✏️ Edit in Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/**
 * Show Publish Link modal for a specific published novel
 */
window.showNovelPublishLinkModal = (novelId) => {
  const item = (novelState.items || []).find(x => Number(x.id) === Number(novelId));
  if (!item) return;

  const contentLink = `#thread?id=${item.slug || item.id}`;
  if (typeof window.showSavedContentLinkModal === 'function') {
    window.showSavedContentLinkModal({ title: item.title, type: 'novel', contentLink });
  } else {
    navigator.clipboard.writeText(window.location.origin + '/' + contentLink);
    showToast('Publish link copied to clipboard! 📋');
  }
};

/**
 * Enable / Disable novel status toggle
 */
window.toggleNovelStatusAction = async (novelId, targetStatus, isWriter) => {
  try {
    const res = await apiFetch(`/api/novels/${novelId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: targetStatus })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update novel status.');
      return;
    }
    showToast(`Novel status updated to "${targetStatus}"! ✓`);
    loadNovelManagementData(isWriter);
  } catch (err) {
    showToast('Error updating status: ' + err.message);
  }
};

/**
 * Delete novel safely to trash
 */
window.deleteNovelToTrashAction = async (novelId, title, isWriter) => {
  const confirmed = confirm(`Are you sure you want to delete "${title}"?\n\nThis will safely move it to the Recycle Bin / Trash, where it can be restored if needed.`);
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/api/novels/${novelId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete novel.');
      return;
    }
    showToast(`Novel "${title}" moved to Trash. ✓`);
    loadNovelManagementData(isWriter);
  } catch (err) {
    showToast('Error deleting novel: ' + err.message);
  }
};

