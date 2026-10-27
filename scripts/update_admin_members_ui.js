import fs from 'node:fs';

const newCode = `function getMemberStatusBadge(status, member = null) {
  const s = (status || member?.computedStatus || 'active').toLowerCase();
  if (member?.isTemporarilyBlocked || s === 'temporarily_blocked' || s === 'temp_blocked') {
    const remaining = member?.remainingText ? \` • \${escapeHtml(member.remainingText)}\` : '';
    const expiryStr = member?.blockedUntil ? new Date(member.blockedUntil).toLocaleString() : '';
    return \`<span class="status-pill scheduled" style="background:#FFF7ED; color:#C2410C; border:1px solid #FFEDD5; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;" title="Blocked until \${expiryStr}"><span style="width:6px; height:6px; background:#EA580C; border-radius:50%;"></span> Temp Blocked\${remaining}</span>\`;
  }
  if (s === 'active') {
    return \`<span class="status-pill published" style="background:#DCFCE7; color:#15803D; border:1px solid #BBF7D0; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#16A34A; border-radius:50%;"></span> Active</span>\`;
  }
  if (s === 'suspended') {
    return \`<span class="status-pill scheduled" style="background:#FEF3C7; color:#B45309; border:1px solid #FDE68A; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#D97706; border-radius:50%;"></span> Suspended</span>\`;
  }
  if (s === 'blocked') {
    return \`<span class="status-pill draft" style="background:#FEE2E2; color:#B91C1C; border:1px solid #FECACA; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#DC2626; border-radius:50%;"></span> Blocked</span>\`;
  }
  if (s === 'expired') {
    return \`<span class="status-pill" style="background:#EFF6FF; color:#1D4ED8; border:1px solid #DBEAFE; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#3B82F6; border-radius:50%;"></span> Expired</span>\`;
  }
  return \`<span class="status-pill" style="background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB; font-size:11px; font-weight:600; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">Disabled</span>\`;
}

function getMemberPermissionsBadges(permissions) {
  if (!permissions) return '';
  const p = permissions;
  return \`
    <div style="display:inline-flex; gap:4px; flex-wrap:wrap; font-size:11px;" title="Feature Permissions: Chat, Comments, Forum, Audio">
      <span title="Chat: \${p.can_chat ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:\${p.can_chat ? '#F0FDF4' : '#FEF2F2'}; color:\${p.can_chat ? '#15803D' : '#DC2626'}; border:1px solid \${p.can_chat ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        💬 \${p.can_chat ? '✓' : '✕'}
      </span>
      <span title="Novel Comments: \${p.can_comment ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:\${p.can_comment ? '#F0FDF4' : '#FEF2F2'}; color:\${p.can_comment ? '#15803D' : '#DC2626'}; border:1px solid \${p.can_comment ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        📝 \${p.can_comment ? '✓' : '✕'}
      </span>
      <span title="Forum Discussions: \${p.can_post_forum ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:\${p.can_post_forum ? '#F0FDF4' : '#FEF2F2'}; color:\${p.can_post_forum ? '#15803D' : '#DC2626'}; border:1px solid \${p.can_post_forum ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        🏛️ \${p.can_post_forum ? '✓' : '✕'}
      </span>
      <span title="Audio Novels: \${p.can_access_audio ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:\${p.can_access_audio ? '#F0FDF4' : '#FEF2F2'}; color:\${p.can_access_audio ? '#15803D' : '#DC2626'}; border:1px solid \${p.can_access_audio ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        🎧 \${p.can_access_audio ? '✓' : '✕'}
      </span>
    </div>
  \`;
}

export async function renderMembersManagementTab(canvas) {
  canvas.innerHTML = \`
    <div style="text-align:center; padding:60px 20px; color:var(--color-text-muted);">
      <div style="width:38px; height:38px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 14px;"></div>
      <div style="font-size:15px; font-weight:600; color:var(--color-navy-deep);">Loading Members Directory & Statistics...</div>
    </div>
  \`;

  try {
    const filter = adminState.membersFilter;
    const queryParams = new URLSearchParams({
      search: filter.search || '',
      status: filter.status || 'all',
      role: filter.role || 'all',
      sortBy: filter.sortBy || 'created_at',
      sortOrder: filter.sortOrder || 'DESC',
      page: String(filter.page || 1),
      limit: String(filter.limit || 25)
    });

    const res = await apiFetch(\`/api/admin/members?\${queryParams.toString()}\`);
    if (!res.ok) {
      throw new Error(\`Failed to load members (HTTP \${res.status})\`);
    }

    const data = await res.json();
    adminState.membersData = data;

    const navBadge = document.getElementById('nav-members-count');
    if (navBadge && data.metrics?.totalMembers !== undefined) {
      navBadge.textContent = data.metrics.totalMembers;
    }

    renderMembersListUI(canvas);
  } catch (err) {
    console.error('Error fetching members list:', err);
    canvas.innerHTML = \`
      <div class="admin-card" style="text-align:center; padding:50px 24px; max-width:600px; margin:40px auto;">
        <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
        <h3 style="color:#DC2626; margin-bottom:8px; font-size:18px;">Unable to Load Member Accounts</h3>
        <p style="color:var(--color-text-muted); font-size:14px; margin-bottom:20px;">\${escapeHtml(err.message)}</p>
        <button class="btn btn-gold btn-sm" onclick="renderMembersManagementTab(document.getElementById('admin-main-canvas'))">
          ↻ Retry Loading
        </button>
      </div>
    \`;
  }
}

function renderMembersListUI(canvas) {
  const data = adminState.membersData || {};
  const metrics = data.metrics || {
    totalMembers: 0,
    activeMembers: 0,
    tempBlockedMembers: 0,
    inactiveMembers: 0,
    recentlyRegistered: 0,
    onlineNow: 0
  };
  const members = data.members || [];
  const filter = adminState.membersFilter || {};
  const page = data.page || 1;
  const total = data.total || 0;
  const limit = data.limit || 25;
  const totalPages = data.totalPages || 1;
  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  canvas.innerHTML = \`
    <!-- Page Header with Primary Actions -->
    <div class="admin-page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:22px;">
      <div>
        <h2 class="admin-page-title" style="margin:0 0 4px; font-size:24px; color:var(--color-navy-deep); font-weight:800;">
          Member Account Management
        </h2>
        <p class="admin-page-subtitle" style="margin:0; font-size:13px; color:var(--color-text-muted);">
          Complete administrative control: Temporary block with auto-expiry, permanent deletion, granular feature permissions, and security audit logs.
        </p>
      </div>
      <div class="admin-header-actions" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="openAdminAuditLogsModal()" title="View Security Audit History" style="display:inline-flex; align-items:center; gap:6px;">
          \${ADMIN_ICONS.history}
          <span>Security Audit Logs</span>
        </button>
        <button type="button" class="btn btn-gold btn-sm" onclick="openAddMemberModal()" title="Create New Member Account" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          \${ADMIN_ICONS.userPlus}
          <span>+ Add Member</span>
        </button>
      </div>
    </div>

    <!-- Real-Time Database KPI Stat Cards -->
    <div class="admin-metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:22px;">
      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Total Members</span>
          <span class="admin-metric-icon" style="color:#0369A1; background:#E0F2FE; padding:6px; border-radius:8px; display:flex;">\${ADMIN_ICONS.users}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:var(--color-navy-deep);">\${metrics.totalMembers}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Registered Accounts</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Active Accounts</span>
          <span class="admin-metric-icon" style="color:#15803D; background:#DCFCE7; padding:6px; border-radius:8px; display:flex;">\${ADMIN_ICONS.checkCircle}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:#15803D;">\${metrics.activeMembers}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">In Good Standing</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Temp Blocked</span>
          <span class="admin-metric-icon" style="color:#EA580C; background:#FFF7ED; padding:6px; border-radius:8px; display:flex;">\${ADMIN_ICONS.lock}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:\${metrics.tempBlockedMembers > 0 ? '#EA580C' : '#475569'};">\${metrics.tempBlockedMembers || 0}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Timed Expiry Blocks</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Suspended / Inactive</span>
          <span class="admin-metric-icon" style="color:#B91C1C; background:#FEE2E2; padding:6px; border-radius:8px; display:flex;">\${ADMIN_ICONS.userX}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:\${metrics.inactiveMembers > 0 ? '#B91C1C' : '#475569'};">\${metrics.inactiveMembers}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Suspended / Disabled</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">New in 30 Days</span>
          <span class="admin-metric-icon" style="color:#B88635; background:#FAF5EC; padding:6px; border-radius:8px; display:flex;">\${ADMIN_ICONS.clock}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:#B88635;">\${metrics.recentlyRegistered}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Recently Registered</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Online Readers</span>
          <span class="admin-metric-icon" style="color:#059669; background:#D1FAE5; padding:6px; border-radius:8px; display:flex;">\${ADMIN_ICONS.eye}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:#059669; display:flex; align-items:center; gap:8px;">
          <span>\${metrics.onlineNow}</span>
          <span style="width:8px; height:8px; background:#10B981; border-radius:50%; box-shadow:0 0 0 3px rgba(16,185,129,0.25);"></span>
        </div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Active Online Activity</div>
      </div>
    </div>

    <!-- Advanced Search, Filtering, and Sorting Toolbar -->
    <div class="admin-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; margin-bottom:20px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
      <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
        <!-- Search Input -->
        <div style="position:relative; flex:1 1 260px; min-width:220px;">
          <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94A3B8; pointer-events:none; display:flex;">
            \${ADMIN_ICONS.search}
          </span>
          <input type="text" id="admin-members-search-input" 
                 class="admin-search-input" 
                 placeholder="Search by name, email, or ID..." 
                 value="\${escapeHtml(filter.search || '')}"
                 oninput="handleMembersSearch(event)"
                 style="width:100%; padding:9px 12px 9px 36px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#B88635'" onblur="this.style.borderColor='#CBD5E1'" />
        </div>

        <!-- Filter Dropdowns -->
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          <!-- Status Filter -->
          <div style="display:flex; align-items:center; gap:6px;">
            <label for="admin-members-status-filter" style="font-size:12px; font-weight:600; color:#64748B;">Status:</label>
            <select id="admin-members-status-filter" onchange="handleMembersStatusFilter(this.value)"
                    style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF; color:#334155; outline:none;">
              <option value="all" \${filter.status === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="active" \${filter.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="temporarily_blocked" \${filter.status === 'temporarily_blocked' ? 'selected' : ''}>Temporarily Blocked</option>
              <option value="blocked" \${filter.status === 'blocked' ? 'selected' : ''}>Blocked (All)</option>
              <option value="suspended" \${filter.status === 'suspended' ? 'selected' : ''}>Suspended</option>
              <option value="disabled" \${filter.status === 'disabled' ? 'selected' : ''}>Disabled</option>
            </select>
          </div>

          <!-- Role Filter -->
          <div style="display:flex; align-items:center; gap:6px;">
            <label for="admin-members-role-filter" style="font-size:12px; font-weight:600; color:#64748B;">Role:</label>
            <select id="admin-members-role-filter" onchange="handleMembersRoleFilter(this.value)"
                    style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF; color:#334155; outline:none;">
              <option value="all" \${filter.role === 'all' ? 'selected' : ''}>All Roles</option>
              <option value="Member" \${filter.role === 'Member' ? 'selected' : ''}>Member</option>
              <option value="writer" \${filter.role === 'writer' ? 'selected' : ''}>Writer</option>
              <option value="admin" \${filter.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>

          <!-- Sort Filter -->
          <div style="display:flex; align-items:center; gap:6px;">
            <label for="admin-members-sort-filter" style="font-size:12px; font-weight:600; color:#64748B;">Sort:</label>
            <select id="admin-members-sort-filter" onchange="handleMembersSort(this.value)"
                    style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF; color:#334155; outline:none;">
              <option value="created_at_DESC" \${filter.sortBy === 'created_at' && filter.sortOrder === 'DESC' ? 'selected' : ''}>Registered: Newest</option>
              <option value="created_at_ASC" \${filter.sortBy === 'created_at' && filter.sortOrder === 'ASC' ? 'selected' : ''}>Registered: Oldest</option>
              <option value="name_ASC" \${filter.sortBy === 'name' && filter.sortOrder === 'ASC' ? 'selected' : ''}>Name: A to Z</option>
              <option value="name_DESC" \${filter.sortBy === 'name' && filter.sortOrder === 'DESC' ? 'selected' : ''}>Name: Z to A</option>
              <option value="last_login_DESC" \${filter.sortBy === 'last_login' ? 'selected' : ''}>Last Login</option>
              <option value="email_ASC" \${filter.sortBy === 'email' ? 'selected' : ''}>Email: A to Z</option>
            </select>
          </div>

          <!-- Reset Filter Button -->
          \${(filter.search || filter.status !== 'all' || filter.role !== 'all' || filter.sortBy !== 'created_at') ? \`
            <button type="button" class="btn btn-outline btn-sm" onclick="handleResetMembersFilters()" title="Clear all filters" style="font-size:12px; padding:7px 12px;">
              ✕ Reset
            </button>
          \` : ''}
        </div>
      </div>
    </div>

    <!-- Members Table Canvas -->
    <div class="admin-table-wrapper" style="box-shadow:0 1px 3px rgba(0,0,0,0.05); border-radius:12px; overflow-x:auto;">
      <table class="admin-table" style="width:100%; border-collapse:collapse; min-width:980px;">
        <thead>
          <tr style="background:#FAF5EC; border-bottom:1px solid #E2E8F0;">
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep); width:50px;">ID</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Member</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Email Address</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Role</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Account Status</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Permissions</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Registered</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Last Login</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep); text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          \${members.length === 0 ? \`
            <tr>
              <td colspan="9" style="text-align:center; padding:48px 16px; color:#64748B;">
                <div style="font-size:32px; margin-bottom:8px;">🔍</div>
                <div style="font-weight:700; font-size:16px; color:var(--color-navy-deep); margin-bottom:4px;">No Members Found</div>
                <div style="font-size:13px;">No registered accounts match your current filter criteria.</div>
                \${(filter.search || filter.status !== 'all' || filter.role !== 'all') ? \`
                  <button type="button" class="btn btn-outline btn-sm" onclick="handleResetMembersFilters()" style="margin-top:14px;">
                    Clear Filter Search
                  </button>
                \` : ''}
              </td>
            </tr>
          \` : members.map(m => {
            const isProtected = m.id === 2 || m.email === 'digitalmarkservices.in@gmail.com';
            const isBlockedOrTemp = m.computedStatus === 'temporarily_blocked' || m.computedStatus === 'blocked';

            return \`
              <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                <td style="padding:12px 16px; font-size:12px; font-weight:700; color:#64748B;">
                  #\${m.id}
                </td>
                <td style="padding:12px 16px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="position:relative; width:34px; height:34px; flex-shrink:0;">
                      <img src="\${escapeHtml(m.avatar || '/profile.png')}" alt="\${escapeHtml(m.displayName)}" 
                           style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid #E2E8F0;"
                           onerror="this.src='/profile.png'" />
                      \${m.isOnline && m.activityStatusEnabled ? \`
                        <span style="position:absolute; bottom:-1px; right:-1px; width:9px; height:9px; background:#10B981; border:2px solid #FFF; border-radius:50%;" title="Online Now"></span>
                      \` : ''}
                    </div>
                    <div>
                      <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep); line-height:1.2;">
                        \${escapeHtml(m.displayName)}
                      </div>
                      <div style="font-size:11px; color:#64748B; margin-top:2px;">
                        @\${escapeHtml(m.username)}
                      </div>
                    </div>
                  </div>
                </td>
                <td style="padding:12px 16px; font-size:13px; color:#334155;">
                  <span style="font-family:monospace; font-size:12px;">\${escapeHtml(m.email)}</span>
                </td>
                <td style="padding:12px 16px;">
                  \${getMemberRoleBadge(m.role)}
                </td>
                <td style="padding:12px 16px;">
                  \${getMemberStatusBadge(m.status, m)}
                </td>
                <td style="padding:12px 16px;">
                  \${getMemberPermissionsBadges(m.permissions)}
                </td>
                <td style="padding:12px 16px; font-size:12px; color:#64748B; white-space:nowrap;">
                  \${formatAdminDateTime(m.createdAt)}
                </td>
                <td style="padding:12px 16px; font-size:12px; color:#64748B; white-space:nowrap;">
                  \${formatAdminDateTime(m.lastLogin)}
                </td>
                <td style="padding:12px 16px; text-align:right;">
                  <div class="admin-action-btn-group" style="display:inline-flex; gap:5px; align-items:center;">
                    <!-- 1. View Details -->
                    <button type="button" class="member-action-btn btn-view" onclick="openMemberDetailsModal(\${m.id})" 
                            title="View Complete Member Profile & Audit Log">
                      \${ADMIN_ICONS.eye}
                    </button>
                    <!-- 2. Edit Profile -->
                    <button type="button" class="member-action-btn btn-edit" onclick="openEditMemberModal(\${m.id})" 
                            title="Edit Member Information">
                      \${ADMIN_ICONS.edit}
                    </button>
                    <!-- 3. Feature Permissions -->
                    <button type="button" class="member-action-btn btn-perm" onclick="openManagePermissionsModal(\${m.id})" 
                            title="Manage Feature Access Permissions">
                      \${ADMIN_ICONS.sliders || '⚙️'}
                    </button>
                    <!-- 4. Reset Password (No OTP) -->
                    <button type="button" class="member-action-btn btn-key" onclick="openResetMemberPasswordModal(\${m.id})" 
                            title="Reset Password Without Member OTP">
                      \${ADMIN_ICONS.key}
                    </button>

                    <!-- 5. Temporarily Block / Early Unblock -->
                    \${!isProtected ? \`
                      \${isBlockedOrTemp ? \`
                        <button type="button" class="member-action-btn btn-unblock" onclick="openUnblockMemberModal(\${m.id})" 
                                title="Unblock Account (Restore Active Access)">
                          \${ADMIN_ICONS.unlock}
                        </button>
                      \` : \`
                        <button type="button" class="member-action-btn btn-block" onclick="openTemporaryBlockModal(\${m.id})" 
                                title="Temporarily Block Account (Duration / Reason)">
                          \${ADMIN_ICONS.lock}
                        </button>
                      \`}
                    \` : ''}

                    <!-- 6. Revoke Active Sessions -->
                    <button type="button" class="member-action-btn btn-revoke" onclick="confirmRevokeMemberSessions(\${m.id})" 
                            title="Revoke All Active Sessions (\${m.activeSessionsCount} active)">
                      \${ADMIN_ICONS.refresh}
                    </button>

                    <!-- 7. Permanently Delete Account -->
                    \${!isProtected ? \`
                      <button type="button" class="member-action-btn btn-delete" onclick="openDeleteMemberModal(\${m.id})" 
                              title="Permanently Delete Account (Irreversible)">
                        \${ADMIN_ICONS.trash}
                      </button>
                    \` : ''}
                  </div>
                </td>
              </tr>
            \`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination Controls -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:16px;">
      <div style="font-size:13px; color:#64748B;">
        Showing <strong>\${startIdx}</strong> to <strong>\${endIdx}</strong> of <strong>\${total}</strong> members
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <label for="admin-members-page-limit" style="font-size:12px; color:#64748B;">Per Page:</label>
        <select id="admin-members-page-limit" onchange="handleMembersPageLimit(this.value)"
                style="padding:5px 8px; border:1px solid #CBD5E1; border-radius:6px; font-size:12px; background:#FFF;">
          <option value="10" \${limit === 10 ? 'selected' : ''}>10</option>
          <option value="25" \${limit === 25 ? 'selected' : ''}>25</option>
          <option value="50" \${limit === 50 ? 'selected' : ''}>50</option>
        </select>

        <div style="display:inline-flex; gap:4px; margin-left:8px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="handleMembersPageChange(\${page - 1})"
                  \${page <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            ‹ Prev
          </button>
          
          <span style="font-size:13px; font-weight:700; color:var(--color-navy-deep); padding:5px 10px; display:inline-flex; align-items:center;">
            Page \${page} of \${totalPages}
          </span>

          <button type="button" class="btn btn-outline btn-sm" onclick="handleMembersPageChange(\${page + 1})"
                  \${page >= totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            Next ›
          </button>
        </div>
      </div>
    </div>
  \`;
}

/* ========================================================
   FILTER, SEARCH, & PAGINATION HANDLERS
   ======================================================== */
window.handleMembersSearch = (event) => {
  const value = event.target.value;
  if (membersSearchTimeout) clearTimeout(membersSearchTimeout);
  membersSearchTimeout = setTimeout(() => {
    adminState.membersFilter.search = value;
    adminState.membersFilter.page = 1;
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  }, 300);
};

window.handleMembersStatusFilter = (status) => {
  adminState.membersFilter.status = status;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersRoleFilter = (role) => {
  adminState.membersFilter.role = role;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersSort = (sortVal) => {
  const parts = sortVal.split('_');
  const sortOrder = parts.pop();
  const sortBy = parts.join('_');
  adminState.membersFilter.sortBy = sortBy;
  adminState.membersFilter.sortOrder = sortOrder;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersPageLimit = (limit) => {
  adminState.membersFilter.limit = parseInt(limit, 10) || 25;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersPageChange = (newPage) => {
  const totalPages = adminState.membersData?.totalPages || 1;
  if (newPage < 1 || newPage > totalPages) return;
  adminState.membersFilter.page = newPage;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleResetMembersFilters = () => {
  adminState.membersFilter = {
    search: '',
    status: 'all',
    role: 'all',
    sortBy: 'created_at',
    sortOrder: 'DESC',
    page: 1,
    limit: 25
  };
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

/* ========================================================
   MODAL CONTROLS: CLOSE HELPER
   ======================================================== */
window.closeMemberModal = () => {
  const modals = document.querySelectorAll('.member-mgmt-modal-wrapper');
  modals.forEach(m => m.remove());
};

window.togglePasswordVisibility = (inputId, btnId) => {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerHTML = ADMIN_ICONS.eyeOff || 'Hide';
  } else {
    input.type = 'password';
    if (btn) btn.innerHTML = ADMIN_ICONS.eye || 'Show';
  }
};

/* ========================================================
   MODAL 1: ADD MEMBER ACCOUNT
   ======================================================== */
window.openAddMemberModal = () => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-add-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#B88635; display:flex;">\${ADMIN_ICONS.userPlus}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Create Member Account</h3>
            <div style="font-size:12px; color:#64748B;">Add a new community member with administrative authorization.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-add-member-form" onsubmit="submitAddMemberForm(event)" style="padding:22px 24px;">
        <div id="add-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Full Member Name <span style="color:#DC2626;">*</span>
          </label>
          <input type="text" id="new-member-name" required placeholder="e.g. Priya Sundaram"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Email Address <span style="color:#DC2626;">*</span>
          </label>
          <input type="email" id="new-member-email" required placeholder="e.g. priya@example.com"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Username <span style="font-size:11px; color:#64748B; font-weight:400;">(Optional — auto-generated from name if empty)</span>
          </label>
          <input type="text" id="new-member-username" placeholder="e.g. priya_s"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Initial Password <span style="color:#DC2626;">*</span>
            </label>
            <div style="position:relative;">
              <input type="password" id="new-member-password" required placeholder="Min 6 characters" minlength="6"
                     style="width:100%; padding:10px 38px 10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
              <button type="button" id="toggle-new-pw-btn" onclick="togglePasswordVisibility('new-member-password', 'toggle-new-pw-btn')"
                      style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748B; display:flex;">
                \${ADMIN_ICONS.eye}
              </button>
            </div>
          </div>

          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Confirm Password <span style="color:#DC2626;">*</span>
            </label>
            <input type="password" id="new-member-password-confirm" required placeholder="Confirm password" minlength="6"
                   style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Role
            </label>
            <select id="new-member-role" style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
              <option value="Member" selected>Member (Standard Reader)</option>
              <option value="writer">Writer (Author Assistant)</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Initial Account Status
            </label>
            <select id="new-member-status" style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
              <option value="active" selected>Active</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-add-member-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
            Create Member Account
          </button>
        </div>
      </form>
    </div>
  \`;

  document.body.appendChild(modal);
  document.getElementById('new-member-name')?.focus();
};

window.submitAddMemberForm = async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('add-member-error-box');
  const submitBtn = document.getElementById('submit-add-member-btn');
  if (errorBox) errorBox.style.display = 'none';

  const displayName = document.getElementById('new-member-name')?.value.trim();
  const email = document.getElementById('new-member-email')?.value.trim();
  const username = document.getElementById('new-member-username')?.value.trim();
  const password = document.getElementById('new-member-password')?.value.trim();
  const confirmPassword = document.getElementById('new-member-password-confirm')?.value.trim();
  const role = document.getElementById('new-member-role')?.value;
  const status = document.getElementById('new-member-status')?.value;

  if (password !== confirmPassword) {
    if (errorBox) {
      errorBox.textContent = 'Passwords do not match. Please re-enter.';
      errorBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
  }

  try {
    const res = await apiFetch('/api/admin/members', {
      method: 'POST',
      body: JSON.stringify({ displayName, email, username, password, confirmPassword, role, status })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create member account.');
    }

    showToast(\`Member account "\${displayName}" created successfully.\`);
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Member Account';
    }
  }
};

/* ========================================================
   MODAL 2: EDIT MEMBER DETAILS
   ======================================================== */
window.openEditMemberModal = async (memberId) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-edit-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div style="padding:40px; text-align:center;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div style="font-size:14px; color:#64748B;">Loading member account...</div>
      </div>
    </div>
  \`;
  document.body.appendChild(modal);

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}\`);
    if (!res.ok) throw new Error('Could not retrieve member details.');
    const { member } = await res.json();

    const isProtectedAdmin = member.id === 2 || member.email === 'digitalmarkservices.in@gmail.com';

    modal.innerHTML = \`
      <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
        <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="color:#1D4ED8; display:flex;">\${ADMIN_ICONS.edit}</div>
            <div>
              <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Edit Member Details</h3>
              <div style="font-size:12px; color:#64748B;">Member #\${member.id} • \${escapeHtml(member.displayName)}</div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
        </div>

        <form id="admin-edit-member-form" onsubmit="submitEditMemberForm(event, \${member.id})" style="padding:22px 24px;">
          <div id="edit-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

          \${isProtectedAdmin ? \`
            <div style="padding:10px 14px; background:#FEF3C7; border:1px solid #FDE68A; border-radius:8px; color:#92400E; font-size:12px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
              \${ADMIN_ICONS.shield}
              <span>Primary Author & Administrator Account (Protected System Account)</span>
            </div>
          \` : ''}

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Display Name <span style="color:#DC2626;">*</span>
              </label>
              <input type="text" id="edit-member-name" required value="\${escapeHtml(member.displayName)}"
                     style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
            </div>

            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Username <span style="color:#DC2626;">*</span>
              </label>
              <input type="text" id="edit-member-username" required value="\${escapeHtml(member.username)}"
                     style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Email Address <span style="color:#DC2626;">*</span>
            </label>
            <input type="email" id="edit-member-email" required value="\${escapeHtml(member.email)}"
                   style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Role
              </label>
              <select id="edit-member-role" \${isProtectedAdmin ? 'disabled' : ''}
                      style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
                <option value="Member" \${member.role === 'Member' ? 'selected' : ''}>Member</option>
                <option value="writer" \${member.role === 'writer' ? 'selected' : ''}>Writer</option>
                <option value="Admin" \${member.role === 'Admin' ? 'selected' : ''}>Admin</option>
              </select>
            </div>

            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Account Status
              </label>
              <select id="edit-member-status" \${isProtectedAdmin ? 'disabled' : ''}
                      style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
                <option value="active" \${member.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="suspended" \${member.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                <option value="blocked" \${member.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                <option value="disabled" \${member.status === 'disabled' ? 'selected' : ''}>Disabled</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Bio / Literary Description
            </label>
            <textarea id="edit-member-bio" rows="2" placeholder="Optional biography..."
                      style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box; resize:vertical;">\${escapeHtml(member.bio || '')}</textarea>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E2E8F0; padding-top:16px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openResetMemberPasswordModal(\${member.id})" style="color:#B88635; display:inline-flex; align-items:center; gap:6px;">
              \${ADMIN_ICONS.key} Reset Password
            </button>
            <div style="display:flex; gap:10px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
              <button type="submit" id="submit-edit-member-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    \`;
  } catch (err) {
    modal.innerHTML = \`
      <div class="modal-card admin-modal-card" style="max-width:440px; background:#FFF; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:32px; color:#DC2626; margin-bottom:8px;">⚠️</div>
        <div style="font-weight:700; color:#DC2626; margin-bottom:8px;">Error Loading Member</div>
        <p style="font-size:13px; color:#64748B; margin-bottom:16px;">\${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close</button>
      </div>
    \`;
  }
};

window.submitEditMemberForm = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('edit-member-error-box');
  const submitBtn = document.getElementById('submit-edit-member-btn');
  if (errorBox) errorBox.style.display = 'none';

  const displayName = document.getElementById('edit-member-name')?.value.trim();
  const username = document.getElementById('edit-member-username')?.value.trim();
  const email = document.getElementById('edit-member-email')?.value.trim();
  const role = document.getElementById('edit-member-role')?.value;
  const status = document.getElementById('edit-member-status')?.value;
  const bio = document.getElementById('edit-member-bio')?.value.trim();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}\`, {
      method: 'PUT',
      body: JSON.stringify({ displayName, username, email, role, status, bio })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update member details.');
    }

    showToast('Member details updated successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
};

/* ========================================================
   MODAL 3: ADMIN PASSWORD RESET WITHOUT MEMBER OTP
   ======================================================== */
window.openResetMemberPasswordModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const memberName = m ? (m.displayName || m.username) : \`Member #\${memberId}\`;
  const memberEmail = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-reset-password-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:480px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#B88635; display:flex;">\${ADMIN_ICONS.key}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Admin Password Reset</h3>
            <div style="font-size:12px; color:#64748B;">Direct administrative reset without target member OTP.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-reset-pw-form" onsubmit="submitResetMemberPassword(event, \${memberId})" style="padding:22px 24px;">
        <div id="reset-pw-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Target Account</div>
          <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">\${escapeHtml(memberName)}</div>
          <div style="font-size:12px; font-family:monospace; color:#334155; margin-top:2px;">\${escapeHtml(memberEmail)} (ID: #\${memberId})</div>
        </div>

        <div style="background:#FEF3C7; border:1px solid #FDE68A; border-radius:8px; padding:12px 14px; margin-bottom:18px; display:flex; align-items:flex-start; gap:10px;">
          <div style="color:#D97706; margin-top:2px; flex-shrink:0;">\${ADMIN_ICONS.shield}</div>
          <div style="font-size:12px; color:#92400E; line-height:1.4;">
            <strong>Administrative Direct Override:</strong> The target member is <u>not required</u> to enter an OTP. The new password takes effect immediately, and any existing active login sessions are revoked.
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            New Password <span style="color:#DC2626;">*</span>
          </label>
          <div style="position:relative;">
            <input type="password" id="admin-reset-new-pw" required placeholder="Min 6 characters" minlength="6"
                   style="width:100%; padding:10px 40px 10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
            <button type="button" id="toggle-reset-pw-btn" onclick="togglePasswordVisibility('admin-reset-new-pw', 'toggle-reset-pw-btn')"
                    style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748B; display:flex;">
              \${ADMIN_ICONS.eye}
            </button>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Confirm New Password <span style="color:#DC2626;">*</span>
          </label>
          <input type="password" id="admin-reset-confirm-pw" required placeholder="Confirm new password" minlength="6"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-reset-pw-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
            Confirm Password Reset
          </button>
        </div>
      </form>
    </div>
  \`;

  document.body.appendChild(modal);
  document.getElementById('admin-reset-new-pw')?.focus();
};

window.submitResetMemberPassword = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('reset-pw-error-box');
  const submitBtn = document.getElementById('submit-reset-pw-btn');
  if (errorBox) errorBox.style.display = 'none';

  const newPassword = document.getElementById('admin-reset-new-pw')?.value.trim();
  const confirmPassword = document.getElementById('admin-reset-confirm-pw')?.value.trim();

  if (newPassword !== confirmPassword) {
    if (errorBox) {
      errorBox.textContent = 'Passwords do not match. Please re-enter.';
      errorBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating Password...';
  }

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}/reset-password\`, {
      method: 'POST',
      body: JSON.stringify({ newPassword, confirmPassword })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset password.');
    }

    showToast(data.message || 'Password reset successfully without OTP.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Password Reset';
    }
  }
};

/* ========================================================
   MODAL 4: TEMPORARILY BLOCK MEMBER ACCOUNT
   ======================================================== */
window.openTemporaryBlockModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : \`member_\${memberId}\`;
  const email = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-block-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:520px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#FFF7ED; padding:18px 24px; border-bottom:1px solid #FFEDD5; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#EA580C; display:flex;">\${ADMIN_ICONS.lock}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#9A3412;">Temporarily Block Account</h3>
            <div style="font-size:12px; color:#C2410C;">Restrict member login and API access for a specified duration.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-block-member-form" onsubmit="submitTemporaryBlock(event, \${memberId})" style="padding:22px 24px;">
        <div id="block-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Target Member</div>
          <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">@\${escapeHtml(username)}</div>
          <div style="font-size:12px; font-family:monospace; color:#334155; margin-top:2px;">\${escapeHtml(email)} (ID: #\${memberId})</div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:8px;">
            Block Duration <span style="color:#DC2626;">*</span>
          </label>
          <div class="block-duration-grid">
            <div class="block-duration-card" onclick="selectBlockDuration('1h', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">1 Hour</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Cooling off</div>
            </div>
            <div class="block-duration-card selected" onclick="selectBlockDuration('24h', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">24 Hours</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Standard 1 day</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('3d', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">3 Days</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Short penalty</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('7d', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">7 Days</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">1 Week</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('30d', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">30 Days</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">1 Month</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('indefinite', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">Manual</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Until unblocked</div>
            </div>
          </div>
          <input type="hidden" id="selected-block-duration" value="24h" />
        </div>

        <div id="custom-block-date-wrap" style="display:none; margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Custom Expiration Date & Time:
          </label>
          <input type="datetime-local" id="custom-block-datetime" 
                 style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Reason for Blocking <span style="font-size:11px; color:#64748B; font-weight:400;">(Shown to member upon login attempt)</span>
          </label>
          <textarea id="block-member-reason" rows="2" placeholder="e.g. Inappropriate forum comments violating community guidelines."
                    style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box; resize:vertical;"></textarea>
        </div>

        <div style="background:#FFF7ED; border:1px solid #FFEDD5; border-radius:8px; padding:12px 14px; margin-bottom:20px; font-size:12px; color:#9A3412; line-height:1.4;">
          <strong>Security Action Notice:</strong> Blocking this account will automatically revoke all active sessions across all devices. When the timed duration expires, the account will automatically restore to active status.
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-block-btn" class="btn btn-gold btn-sm" style="background:#EA580C; border-color:#C2410C; color:#FFF; font-weight:700;">
            Apply Temporary Block
          </button>
        </div>
      </form>
    </div>
  \`;

  document.body.appendChild(modal);
};

window.selectBlockDuration = (duration, cardElem) => {
  document.querySelectorAll('.block-duration-card').forEach(c => c.classList.remove('selected'));
  if (cardElem) cardElem.classList.add('selected');
  const input = document.getElementById('selected-block-duration');
  if (input) input.value = duration;

  const customWrap = document.getElementById('custom-block-date-wrap');
  if (customWrap) {
    customWrap.style.display = duration === 'custom' ? 'block' : 'none';
  }
};

window.submitTemporaryBlock = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('block-member-error-box');
  const submitBtn = document.getElementById('submit-block-btn');
  if (errorBox) errorBox.style.display = 'none';

  const duration = document.getElementById('selected-block-duration')?.value || '24h';
  const customExpiry = document.getElementById('custom-block-datetime')?.value || null;
  const reason = document.getElementById('block-member-reason')?.value.trim();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Blocking Account...';
  }

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}/block\`, {
      method: 'POST',
      body: JSON.stringify({ duration, customExpiry, reason })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to temporarily block member.');
    }

    showToast(data.message || 'Account blocked successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Apply Temporary Block';
    }
  }
};

/* ========================================================
   MODAL 5: EARLY UNBLOCK MEMBER ACCOUNT
   ======================================================== */
window.openUnblockMemberModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : \`member_\${memberId}\`;
  const email = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-unblock-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:480px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#F0FDF4; padding:18px 24px; border-bottom:1px solid #DCFCE7; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#16A34A; display:flex;">\${ADMIN_ICONS.unlock}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#15803D;">Unblock Member Account</h3>
            <div style="font-size:12px; color:#166534;">Restore full login access and clear restrictions.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-unblock-member-form" onsubmit="submitUnblockMember(event, \${memberId})" style="padding:22px 24px;">
        <div id="unblock-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Target Member</div>
          <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">@\${escapeHtml(username)}</div>
          <div style="font-size:12px; font-family:monospace; color:#334155; margin-top:2px;">\${escapeHtml(email)} (ID: #\${memberId})</div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Optional Reason for Unblocking:
          </label>
          <input type="text" id="unblock-member-reason" placeholder="e.g. Administrative review completed, member resolved issue."
                 style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-unblock-btn" class="btn btn-gold btn-sm" style="background:#16A34A; border-color:#15803D; color:#FFF; font-weight:700;">
            Unblock & Restore Access
          </button>
        </div>
      </form>
    </div>
  \`;

  document.body.appendChild(modal);
};

window.submitUnblockMember = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('unblock-member-error-box');
  const submitBtn = document.getElementById('submit-unblock-btn');
  if (errorBox) errorBox.style.display = 'none';

  const reason = document.getElementById('unblock-member-reason')?.value.trim();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Unblocking Account...';
  }

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}/unblock\`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to unblock member account.');
    }

    showToast(data.message || 'Account unblocked successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Unblock & Restore Access';
    }
  }
};

/* ========================================================
   MODAL 6: MANAGE GRANULAR FEATURE PERMISSIONS
   ======================================================== */
window.openManagePermissionsModal = async (memberId) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-permissions-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div style="padding:40px; text-align:center;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div style="font-size:14px; color:#64748B;">Loading member permissions...</div>
      </div>
    </div>
  \`;
  document.body.appendChild(modal);

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}/permissions\`);
    if (!res.ok) throw new Error('Could not retrieve member permissions.');
    const data = await res.json();
    const p = data.permissions || {};

    modal.innerHTML = \`
      <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
        <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="color:#7C3AED; display:flex;">\${ADMIN_ICONS.sliders || '⚙️'}</div>
            <div>
              <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Feature Access Permissions</h3>
              <div style="font-size:12px; color:#64748B;">Member #\${data.memberId} • @\${escapeHtml(data.username)} (\${escapeHtml(data.role)})</div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
        </div>

        <form id="admin-permissions-form" onsubmit="submitManagePermissions(event, \${memberId})" style="padding:22px 24px;">
          <div id="permissions-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

          <div style="margin-bottom:16px;">
            <!-- 1. Novel Comments -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">📝 Novel Comments & Replies</div>
                <div style="font-size:11px; color:#64748B;">Allow writing chapter comments, replying to reader threads, and liking posts.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-comment" \${p.can_comment !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 2. Forum Posting -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">🏛️ Forum Discussions</div>
                <div style="font-size:11px; color:#64748B;">Allow creating community discussion topics and submitting forum replies.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-forum" \${p.can_post_forum !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 3. Private Messaging -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">💬 Direct Private Chat</div>
                <div style="font-size:11px; color:#64748B;">Allow sending real-time direct messages, photos, and voice notes.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-chat" \${p.can_chat !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 4. Audio Novels -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">🎧 Audio Novels Access</div>
                <div style="font-size:11px; color:#64748B;">Allow streaming and listening to exclusive narrated audio episodes.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-audio" \${p.can_access_audio !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 5. Novel Publishing (Writers & Admin) -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">📖 Novel & Episode Publishing</div>
                <div style="font-size:11px; color:#64748B;">Allow publishing chapters and editing stories in the Writer workspace.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-novels" \${p.can_publish_novels === true ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>
          </div>

          <div style="margin-bottom:18px; padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="perm-revoke-sessions" checked style="cursor:pointer;" />
            <label for="perm-revoke-sessions" style="font-size:12px; color:#475569; cursor:pointer;">
              Revoke active sessions immediately to apply updated permissions right now
            </label>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
            <button type="submit" id="submit-perms-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
              Save Permissions
            </button>
          </div>
        </form>
      </div>
    \`;
  } catch (err) {
    modal.innerHTML = \`
      <div class="modal-card admin-modal-card" style="max-width:440px; background:#FFF; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:32px; color:#DC2626; margin-bottom:8px;">⚠️</div>
        <div style="font-weight:700; color:#DC2626; margin-bottom:8px;">Error Loading Permissions</div>
        <p style="font-size:13px; color:#64748B; margin-bottom:16px;">\${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close</button>
      </div>
    \`;
  }
};

window.submitManagePermissions = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('permissions-error-box');
  const submitBtn = document.getElementById('submit-perms-btn');
  if (errorBox) errorBox.style.display = 'none';

  const permissions = {
    can_comment: document.getElementById('perm-comment')?.checked ?? true,
    can_post_forum: document.getElementById('perm-forum')?.checked ?? true,
    can_chat: document.getElementById('perm-chat')?.checked ?? true,
    can_access_audio: document.getElementById('perm-audio')?.checked ?? true,
    can_publish_novels: document.getElementById('perm-novels')?.checked ?? false
  };

  const revokeSessions = Boolean(document.getElementById('perm-revoke-sessions')?.checked);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}/permissions\`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, revokeSessions })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update member permissions.');
    }

    showToast('Member permissions updated successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Permissions';
    }
  }
};

/* ========================================================
   MODAL 7: PERMANENTLY DELETE MEMBER ACCOUNT (DANGER)
   ======================================================== */
window.openDeleteMemberModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : \`member_\${memberId}\`;
  const email = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-delete-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:520px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden; border:2px solid #F87171;">
      <div class="modal-header" style="background:#FEF2F2; padding:18px 24px; border-bottom:1px solid #FEE2E2; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#DC2626; display:flex;">\${ADMIN_ICONS.trash}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#991B1B;">Permanently Delete Account</h3>
            <div style="font-size:12px; color:#DC2626; font-weight:600;">Irreversible administrative operation</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-delete-member-form" onsubmit="submitDeleteMember(event, \${memberId})" style="padding:22px 24px;">
        <div id="delete-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:14px 16px; margin-bottom:18px; color:#991B1B; font-size:13px; line-height:1.5;">
          <strong>⚠️ DANGER: This action cannot be undone.</strong>
          <ul style="margin:6px 0 0 16px; padding:0; font-size:12px; color:#7F1D1D;">
            <li>The user account, authentication credentials, and active sessions will be deleted.</li>
            <li>Reader profile, bookmarks, and reading history will be purged.</li>
            <li>Chapter comments and forum threads will be safely preserved or anonymized according to retention policy.</li>
            <li>Administrative security audit logs will be permanently retained.</li>
          </ul>
        </div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:18px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Selected Account to Delete</div>
          <div style="font-weight:800; font-size:15px; color:var(--color-navy-deep);">@\${escapeHtml(username)}</div>
          <div style="font-size:12px; font-family:monospace; color:#475569; margin-top:2px;">\${escapeHtml(email)} (Member ID: #\${memberId})</div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Optional Reason for Deletion:
          </label>
          <input type="text" id="delete-member-reason" placeholder="e.g. Account owner request / terms of service violation"
                 style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#991B1B; margin-bottom:6px;">
            Safety Confirmation: Type <span style="font-family:monospace; background:#FEE2E2; padding:1px 6px; border-radius:4px;">\${escapeHtml(username)}</span> to confirm:
          </label>
          <input type="text" id="delete-member-confirm-input" required placeholder="Type username exactly to enable deletion"
                 oninput="checkDeleteConfirmation(this.value, '\${escapeHtml(username)}')"
                 style="width:100%; padding:10px 12px; border:1.5px solid #F87171; border-radius:8px; font-size:13px; box-sizing:border-box; font-family:monospace;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-delete-member-btn" disabled 
                  class="btn btn-sm" 
                  style="background:#DC2626; border-color:#B91C1C; color:#FFF; font-weight:700; opacity:0.4; cursor:not-allowed;">
            Permanently Delete Account
          </button>
        </div>
      </form>
    </div>
  \`;

  document.body.appendChild(modal);
  document.getElementById('delete-member-confirm-input')?.focus();
};

window.checkDeleteConfirmation = (typedVal, targetUsername) => {
  const btn = document.getElementById('submit-delete-member-btn');
  if (!btn) return;
  const isMatch = (typedVal || '').trim().toLowerCase() === targetUsername.trim().toLowerCase();
  if (isMatch) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
  }
};

window.submitDeleteMember = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('delete-member-error-box');
  const submitBtn = document.getElementById('submit-delete-member-btn');
  if (errorBox) errorBox.style.display = 'none';

  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const targetUsername = m ? m.username : '';

  const confirmationText = document.getElementById('delete-member-confirm-input')?.value.trim();
  const reason = document.getElementById('delete-member-reason')?.value.trim();

  if (confirmationText.toLowerCase() !== targetUsername.toLowerCase()) {
    if (errorBox) {
      errorBox.textContent = \`Confirmation text must match "\${targetUsername}" exactly.\`;
      errorBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Deleting Account Permanently...';
  }

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}/delete\`, {
      method: 'POST',
      body: JSON.stringify({ confirmationText, reason })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete member account.');
    }

    showToast(data.message || \`Account for "\${targetUsername}" has been permanently deleted.\`);
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Permanently Delete Account';
    }
  }
};

/* ========================================================
   MODAL 8: REVOKE ALL ACTIVE SESSIONS
   ======================================================== */
window.confirmRevokeMemberSessions = async (memberId) => {
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : \`Member #\${memberId}\`;

  if (!confirm(\`Revoke all active login sessions for "\${username}"?\\n\\nThis will immediately log them out of all browser tabs, devices, and active API tokens.\`)) {
    return;
  }

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}/revoke-sessions\`, {
      method: 'POST'
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to revoke sessions.');
    }

    showToast(data.message || 'All active sessions terminated.');
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    alert(\`Error: \${err.message}\`);
  }
};

/* ========================================================
   MODAL 9: COMPLETE MEMBER DETAILS & AUDIT LOGS
   ======================================================== */
window.openMemberDetailsModal = async (memberId) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-member-details-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:680px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div style="padding:40px; text-align:center;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div style="font-size:14px; color:#64748B;">Loading member details...</div>
      </div>
    </div>
  \`;
  document.body.appendChild(modal);

  try {
    const res = await apiFetch(\`/api/admin/members/\${memberId}\`);
    if (!res.ok) throw new Error('Could not retrieve member details.');
    const { member } = await res.json();

    const isProtectedAdmin = member.id === 2 || member.email === 'digitalmarkservices.in@gmail.com';
    const isBlockedOrTemp = member.computedStatus === 'temporarily_blocked' || member.computedStatus === 'blocked';
    const p = member.permissions || {};

    modal.innerHTML = \`
      <div class="modal-card admin-modal-card" style="max-width:720px; max-height:90vh; overflow-y:auto; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2);">
        <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:10;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="\${escapeHtml(member.avatar || '/profile.png')}" alt="\${escapeHtml(member.displayName)}"
                 style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid #B88635;"
                 onerror="this.src='/profile.png'" />
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">\${escapeHtml(member.displayName)}</h3>
                \${getMemberStatusBadge(member.status, member)}
              </div>
              <div style="font-size:12px; color:#64748B; margin-top:2px;">
                @\${escapeHtml(member.username)} • Member ID #\${member.id} • \${getMemberRoleBadge(member.role)}
              </div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
        </div>

        <div style="padding:22px 24px;">
          <!-- Temporary Block Alert Banner if Active -->
          \${member.isTemporarilyBlocked ? \`
            <div style="background:#FFF7ED; border:1px solid #FFEDD5; border-radius:10px; padding:14px 16px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:#C2410C; font-size:13px;">🔒 Temporarily Blocked</div>
                <div style="font-size:12px; color:#9A3412; margin-top:2px;">
                  Expires: <strong>\${new Date(member.blockedUntil).toLocaleString()}</strong> (\${member.remainingText || ''})
                  \${member.blockReason ? \`<br><span style="color:#7C2D12;">Reason: \${escapeHtml(member.blockReason)}</span>\` : ''}
                </div>
              </div>
              <button type="button" class="btn btn-sm" onclick="openUnblockMemberModal(\${member.id})" style="background:#16A34A; color:#FFF; font-weight:700;">
                Unblock Now
              </button>
            </div>
          \` : ''}

          <!-- 1. Account Details Grid -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:18px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569; margin-bottom:12px;">
              Account Information
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">
              <div>
                <span style="color:#64748B;">Email Address:</span>
                <div style="font-weight:600; font-family:monospace; color:var(--color-navy-deep); word-break:break-all;">\${escapeHtml(member.email)}</div>
              </div>
              <div>
                <span style="color:#64748B;">Email Verification:</span>
                <div style="font-weight:600; color:\${member.emailVerified ? '#15803D' : '#64748B'};">
                  \${member.emailVerified ? '✓ Verified' : 'Unverified'}
                </div>
              </div>
              <div>
                <span style="color:#64748B;">Account Created:</span>
                <div style="font-weight:600; color:var(--color-navy-deep);">\${formatAdminDateTime(member.createdAt)}</div>
              </div>
              <div>
                <span style="color:#64748B;">Last Login:</span>
                <div style="font-weight:600; color:var(--color-navy-deep);">\${formatAdminDateTime(member.lastLogin)}</div>
              </div>
              <div>
                <span style="color:#64748B;">Active Sessions:</span>
                <div style="font-weight:600; color:var(--color-navy-deep);">\${member.activeSessionsCount} device(s) logged in</div>
              </div>
              <div>
                <span style="color:#64748B;">Online Visibility:</span>
                <div style="font-weight:600; color:\${member.isOnline ? '#15803D' : '#64748B'};">
                  \${member.isOnline ? '🟢 Online Now' : '⚪ Offline'} \${member.activityStatusEnabled ? '(Enabled)' : '(Hidden)'}
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Feature Access Permissions Summary -->
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569;">
                Feature Permissions
              </div>
              <button type="button" class="btn btn-outline btn-sm" onclick="openManagePermissionsModal(\${member.id})" style="font-size:11px; padding:3px 8px;">
                Edit Permissions
              </button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Comments</div>
                <div style="font-weight:700; color:\${p.can_comment !== false ? '#15803D' : '#DC2626'}; font-size:13px;">\${p.can_comment !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Forum</div>
                <div style="font-weight:700; color:\${p.can_post_forum !== false ? '#15803D' : '#DC2626'}; font-size:13px;">\${p.can_post_forum !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Private Chat</div>
                <div style="font-weight:700; color:\${p.can_chat !== false ? '#15803D' : '#DC2626'}; font-size:13px;">\${p.can_chat !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Audio Novels</div>
                <div style="font-weight:700; color:\${p.can_access_audio !== false ? '#15803D' : '#DC2626'}; font-size:13px;">\${p.can_access_audio !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Publish Novels</div>
                <div style="font-weight:700; color:\${p.can_publish_novels ? '#15803D' : '#64748B'}; font-size:13px;">\${p.can_publish_novels ? 'Allowed' : 'Disabled'}</div>
              </div>
            </div>
          </div>

          <!-- 3. Literary & Reading Activity Section -->
          <div style="background:#FAF5EC; border:1px solid #FDE68A; border-radius:10px; padding:16px; margin-bottom:18px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#92400E; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              \${ADMIN_ICONS.book || '📖'}
              <span>Reading Activity</span>
            </div>
            \${member.currentReading ? \`
              <div style="display:flex; align-items:center; gap:12px; background:#FFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px;">
                <div style="font-size:24px;">📖</div>
                <div style="flex:1;">
                  <div style="font-size:11px; font-weight:700; color:#059669; text-transform:uppercase;">Currently Reading Now</div>
                  <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">\${escapeHtml(member.currentReading.title)} (Chapter \${escapeHtml(member.currentReading.chapterNum)})</div>
                  <div style="font-size:11px; color:#64748B;">Session Duration: \${Math.round((member.currentReading.durationSeconds || 0) / 60)} min</div>
                </div>
              </div>
            \` : member.lastRead ? \`
              <div style="display:flex; align-items:center; gap:12px; background:#FFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px;">
                <div style="font-size:24px;">📚</div>
                <div style="flex:1;">
                  <div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Recent Story</div>
                  <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">\${escapeHtml(member.lastRead.title)} (Chapter \${escapeHtml(member.lastRead.chapterNum)})</div>
                  <div style="font-size:11px; color:#64748B;">Last read at: \${formatAdminDateTime(member.lastRead.lastReadAt)}</div>
                </div>
              </div>
            \` : \`
              <div style="font-size:13px; color:#78350F;">No reading activity recorded yet.</div>
            \`}
          </div>

          <!-- 4. Security Actions Bar -->
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; align-items:center; padding:14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openResetMemberPasswordModal(\${member.id})" style="color:#B88635; display:inline-flex; align-items:center; gap:6px;">
              \${ADMIN_ICONS.key} Reset Password
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="confirmRevokeMemberSessions(\${member.id})" style="color:#DC2626; display:inline-flex; align-items:center; gap:6px;">
              \${ADMIN_ICONS.refresh} Revoke Sessions (\${member.activeSessionsCount})
            </button>
            \${!isProtectedAdmin ? \`
              \${isBlockedOrTemp ? \`
                <button type="button" class="btn btn-outline btn-sm" onclick="openUnblockMemberModal(\${member.id})" style="color:#16A34A; display:inline-flex; align-items:center; gap:6px;">
                  \${ADMIN_ICONS.unlock} Unblock Account
                </button>
              \` : \`
                <button type="button" class="btn btn-outline btn-sm" onclick="openTemporaryBlockModal(\${member.id})" style="color:#EA580C; display:inline-flex; align-items:center; gap:6px;">
                  \${ADMIN_ICONS.lock} Block Account
                </button>
              \`}
              <button type="button" class="btn btn-outline btn-sm" onclick="openDeleteMemberModal(\${member.id})" style="color:#991B1B; border-color:#FECACA; display:inline-flex; align-items:center; gap:6px;">
                \${ADMIN_ICONS.trash} Delete Account
              </button>
            \` : ''}
          </div>

          <!-- 5. Security Audit History -->
          <div>
            <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              \${ADMIN_ICONS.history}
              <span>Security Audit Trail for This Account</span>
            </div>
            \${(!member.auditHistory || member.auditHistory.length === 0) ? \`
              <div style="font-size:12px; color:#94A3B8; padding:14px; background:#F8FAFC; border-radius:8px; text-align:center;">
                No administrative actions logged yet for this account.
              </div>
            \` : \`
              <div style="max-height:220px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="background:#F1F5F9; border-bottom:1px solid #E2E8F0; text-align:left;">
                      <th style="padding:8px 12px; color:#475569;">Action</th>
                      <th style="padding:8px 12px; color:#475569;">Administrator</th>
                      <th style="padding:8px 12px; color:#475569;">Details</th>
                      <th style="padding:8px 12px; color:#475569;">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${member.auditHistory.map(l => \`
                      <tr style="border-bottom:1px solid #F1F5F9;">
                        <td style="padding:8px 12px; font-weight:700; color:var(--color-navy-deep);">\${escapeHtml(l.action)}</td>
                        <td style="padding:8px 12px; color:#334155;">\${escapeHtml(l.adminName)}</td>
                        <td style="padding:8px 12px; color:#64748B; font-size:11px;">\${escapeHtml(l.details)}</td>
                        <td style="padding:8px 12px; color:#94A3B8; font-size:11px; white-space:nowrap;">\${formatAdminDateTime(l.createdAt)}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
            \`}
          </div>
        </div>

        <div style="padding:16px 24px; border-top:1px solid #E2E8F0; background:#FAF5EC; display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close Details</button>
        </div>
      </div>
    \`;
  } catch (err) {
    modal.innerHTML = \`
      <div class="modal-card admin-modal-card" style="max-width:440px; background:#FFF; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:32px; color:#DC2626; margin-bottom:8px;">⚠️</div>
        <div style="font-weight:700; color:#DC2626; margin-bottom:8px;">Error Loading Member</div>
        <p style="font-size:13px; color:#64748B; margin-bottom:16px;">\${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close</button>
      </div>
    \`;
  }
};

/* ========================================================
   MODAL 10: SECURITY AUDIT LOGS VIEWER
   ======================================================== */
window.openAdminAuditLogsModal = async (targetUserId = null) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-audit-logs-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = \`
    <div class="modal-card admin-modal-card" style="max-width:880px; max-height:90vh; overflow-y:auto; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2);">
      <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:10;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#B88635; display:flex;">\${ADMIN_ICONS.history}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Security Audit Logs</h3>
            <div style="font-size:12px; color:#64748B;">Immutable administrative activity logs for sensitive account operations.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <div style="padding:22px 24px;">
        <div id="audit-logs-table-container">
          <div style="text-align:center; padding:30px; color:#64748B;">Loading security audit logs...</div>
        </div>
      </div>

      <div style="padding:14px 24px; border-top:1px solid #E2E8F0; background:#FAF5EC; display:flex; justify-content:flex-end;">
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Done</button>
      </div>
    </div>
  \`;

  document.body.appendChild(modal);

  try {
    const url = targetUserId 
      ? \`/api/admin/members/audit-logs?targetUserId=\${targetUserId}&limit=50\`
      : '/api/admin/members/audit-logs?limit=50';

    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Failed to retrieve audit logs.');
    const { logs } = await res.json();

    const container = document.getElementById('audit-logs-table-container');
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = \`
        <div style="text-align:center; padding:40px; color:#64748B;">
          <div style="font-size:32px; margin-bottom:8px;">📜</div>
          <div style="font-weight:700; color:var(--color-navy-deep);">No Audit Logs Recorded Yet</div>
          <div style="font-size:13px; margin-top:4px;">Administrative operations will be automatically logged here.</div>
        </div>
      \`;
      return;
    }

    container.innerHTML = \`
      <div style="overflow-x:auto; border:1px solid #E2E8F0; border-radius:8px;">
        <table style="width:100%; border-collapse:collapse; font-size:12px; min-width:680px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; text-align:left;">
              <th style="padding:10px 14px; color:#475569;">Time</th>
              <th style="padding:10px 14px; color:#475569;">Action</th>
              <th style="padding:10px 14px; color:#475569;">Administrator</th>
              <th style="padding:10px 14px; color:#475569;">Target Member</th>
              <th style="padding:10px 14px; color:#475569;">Status</th>
              <th style="padding:10px 14px; color:#475569;">Details</th>
            </tr>
          </thead>
          <tbody>
            \${logs.map(l => \`
              <tr style="border-bottom:1px solid #F1F5F9;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                <td style="padding:10px 14px; color:#64748B; white-space:nowrap; font-size:11px;">\${formatAdminDateTime(l.createdAt)}</td>
                <td style="padding:10px 14px; font-weight:700; color:var(--color-navy-deep);">
                  <span style="background:#F1F5F9; padding:2px 8px; border-radius:4px; font-family:monospace; font-size:11px;">\${escapeHtml(l.action)}</span>
                </td>
                <td style="padding:10px 14px; font-weight:600; color:#334155;">\${escapeHtml(l.adminName)}</td>
                <td style="padding:10px 14px; color:#334155;">
                  \${l.targetName ? \`<div>\${escapeHtml(l.targetName)}</div>\` : ''}
                  \${l.targetEmail ? \`<div style="font-size:11px; color:#64748B; font-family:monospace;">\${escapeHtml(l.targetEmail)}</div>\` : ''}
                </td>
                <td style="padding:10px 14px;">
                  <span style="font-size:11px; font-weight:700; color:\${l.status === 'success' ? '#15803D' : '#DC2626'}; background:\${l.status === 'success' ? '#DCFCE7' : '#FEE2E2'}; padding:2px 6px; border-radius:6px;">
                    \${escapeHtml(l.status)}
                  </span>
                </td>
                <td style="padding:10px 14px; color:#475569; font-size:11px; max-width:280px; word-break:break-word;">
                  \${escapeHtml(l.details)}
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      </div>
    \`;
  } catch (err) {
    const container = document.getElementById('audit-logs-table-container');
    if (container) {
      container.innerHTML = \`<div style="color:#DC2626; padding:20px; text-align:center;">Failed to load audit logs: \${escapeHtml(err.message)}</div>\`;
    }
  }
};
`;

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const startMarker = 'function getMemberStatusBadge(status, member = null) {';
  const endMarker = 'FORUM MANAGEMENT TAB (CATEGORIES & OFFICIAL TOPICS)';

  const startIdx = content.indexOf(startMarker);
  const foundEnd = content.indexOf(endMarker);
  const endIdx = content.lastIndexOf('/* ========================================================', foundEnd);

  if (startIdx === -1 || foundEnd === -1 || endIdx === -1) {
    console.error('Markers not found in', filePath, 'startIdx:', startIdx, 'foundEnd:', foundEnd, 'endIdx:', endIdx);
    return false;
  }

  const updated = content.slice(0, startIdx) + newCode + '\n' + content.slice(endIdx);
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log('Successfully updated', filePath);
  return true;
}

updateFile('src/js/admin.js');
updateFile('frontend/src/js/admin.js');
