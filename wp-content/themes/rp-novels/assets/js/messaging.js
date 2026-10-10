// Private Messaging Controller (Better Messages compatible)

import { SITE_DATA } from './data.js';

let activeThreadId = 't1';

export function initMessaging() {
  window.openMessagesDrawer = (threadId = null) => {
    if (threadId) activeThreadId = threadId;
    const drawer = document.getElementById('messages-drawer');
    const backdrop = document.getElementById('messages-backdrop');
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    renderMessagesDrawerContent();
  };

  window.closeMessagesDrawer = () => {
    const drawer = document.getElementById('messages-drawer');
    const backdrop = document.getElementById('messages-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  };

  window.selectThread = (id) => {
    activeThreadId = id;
    const thread = SITE_DATA.messagesThreads.find(t => t.id === id);
    if (thread) thread.unread = false;
    updateUnreadMessageBadge();
    renderMessagesDrawerContent();
  };

  window.sendMessage = () => {
    const input = document.getElementById('chat-message-input');
    if (!input || !input.value.trim()) return;

    const thread = SITE_DATA.messagesThreads.find(t => t.id === activeThreadId);
    if (!thread) return;

    const text = input.value.trim();
    thread.messages.push({
      sender: 'me',
      text: text,
      time: 'இப்போது'
    });
    thread.snippet = text;
    thread.time = 'இப்போது';
    input.value = '';

    renderMessagesDrawerContent();
    setTimeout(() => {
      const stream = document.getElementById('messages-stream');
      if (stream) stream.scrollTop = stream.scrollHeight;
    }, 50);
  };
}

export function updateUnreadMessageBadge() {
  const badge = document.getElementById('inbox-badge');
  const count = SITE_DATA.messagesThreads.filter(t => t.unread).length;
  if (badge) {
    badge.innerText = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function renderMessagesDrawerContent() {
  const thread = SITE_DATA.messagesThreads.find(t => t.id === activeThreadId) || SITE_DATA.messagesThreads[0];
  const container = document.getElementById('messages-body-container');
  if (!container) return;

  container.innerHTML = `
    <!-- Top Conversation Header -->
    <div class="conversation-chat-header">
      <img src="${thread.avatar || '/profile.png'}" class="user-avatar-sm" alt="${thread.user}" onerror="this.src='/profile.png'">
      <div>
        <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">${thread.user}</div>
        <div style="font-size:10px; color:var(--color-success);">● ஆன்லைன்</div>
      </div>
      <button onclick="window.showThreadList = !window.showThreadList; renderMessagesDrawerContent();" 
              class="btn-outline btn-sm" style="margin-left:auto;">
        உரையாடல்கள்
      </button>
    </div>

    <!-- Message Bubbles Stream -->
    <div class="messages-stream" id="messages-stream">
      ${thread.messages.map(m => `
        <div class="message-bubble ${m.sender === 'me' ? 'outgoing' : 'incoming'}">
          <div>${m.text}</div>
          <div class="bubble-meta">${m.time}</div>
        </div>
      `).join('')}
    </div>

    <!-- Message Composer -->
    <div class="message-composer">
      <input type="text" id="chat-message-input" class="message-input" 
             placeholder="செய்தியை தட்டச்சு செய்யவும்..." 
             onkeydown="if(event.key === 'Enter') sendMessage();">
      <button class="message-send-btn" onclick="sendMessage()" title="அனுப்பு">
        ➤
      </button>
    </div>
  `;

  // Auto-scroll to bottom
  const stream = document.getElementById('messages-stream');
  if (stream) stream.scrollTop = stream.scrollHeight;
}
