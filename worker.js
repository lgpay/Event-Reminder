/**
 * 事件提醒 (Event Reminder) v5.5
 * Cloudflare Workers 版
 * 优化：替换为微信企业应用通知，增加代理配置
 */

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
  
  // --- 1. 前端应用 (UI) ---
  const HTML_CONTENT = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>事件提醒</title>
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
          /* 核心变量 */
          :root {
              --bg-body: #f3f4f6;
              --bg-card: #ffffff;
              --text-main: #1f2937;
              --text-sub: #6b7280;
              --text-label: #4b5563; 
              --border-color: rgba(0,0,0,0.08);
              --primary: #3b82f6;
              --primary-rgb: 59, 130, 246;
              --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
              --modal-bg: #ffffff;
              --input-bg: #fff;
              --input-border: #d1d5db;
              --picker-hover: #f3f4f6;
          }
  
          [data-theme="dark"] {
              --bg-body: #111827;
              --bg-card: #1f2937;
              --text-main: #f9fafb;
              --text-sub: #9ca3af;
              --text-label: #e5e7eb;
              --border-color: rgba(255,255,255,0.1);
              --primary: #60a5fa;
              --primary-rgb: 96, 165, 250;
              --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
              --modal-bg: #1f2937;
              --input-bg: #374151;
              --input-border: #4b5563;
              --picker-hover: #374151;
          }
  
          body {
              background-color: var(--bg-body);
              color: var(--text-main);
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif;
              transition: background-color 0.3s, color 0.3s;
              padding-bottom: 100px;
              -webkit-font-smoothing: antialiased;
          }
  
          .form-label { color: var(--text-label) !important; font-weight: 600; opacity: 0.9; font-size: 0.85rem; margin-bottom: 0.2rem; }
          
          /* 优化 Placeholder 颜色：极淡灰色 */
          ::placeholder { color: var(--text-sub) !important; opacity: 0.4 !important; }
          :-ms-input-placeholder { color: var(--text-sub) !important; opacity: 0.4 !important; }
          ::-ms-input-placeholder { color: var(--text-sub) !important; opacity: 0.4 !important; }
  
          /* 顶部导航 */
          .navbar-custom {
              background: var(--bg-card); padding: 0.8rem 1rem;
              position: sticky; top: 0; z-index: 100;
              box-shadow: var(--shadow);
              display: flex; justify-content: space-between; align-items: center;
              backdrop-filter: blur(10px);
          }
          .brand { font-weight: 700; font-size: 1.2rem; color: var(--primary); display: flex; align-items: center; gap: 8px; }
          .theme-toggle {
              cursor: pointer; width: 36px; height: 36px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              background: rgba(var(--primary-rgb), 0.1); color: var(--primary); border: none;
          }
          .search-input {
              background: var(--bg-body); border: 1px solid transparent; color: var(--text-main);
              padding: 0.4rem 1rem; border-radius: 50px; outline: none; width: 100%; max-width: 200px;
          }
  
          /* 卡片 */
          .task-card {
              background: var(--bg-card); border-radius: 16px; 
              padding: 1rem 1.2rem; 
              box-shadow: var(--shadow); border: 1px solid var(--border-color);
              transition: transform 0.2s; height: 100%; display: flex; flex-direction: column; cursor: pointer;
          }
          .task-card:active { transform: scale(0.98); }
          .status-pill {
              display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px;
              font-size: 0.7rem; font-weight: 700; margin: 0;
          }
          .pill-safe { background: rgba(16, 185, 129, 0.15); color: #059669; }
          .pill-warn { background: rgba(245, 158, 11, 0.15); color: #d97706; }
          .pill-danger { background: rgba(239, 68, 68, 0.15); color: #dc2626; }
          
          .days-big { font-size: 2.2rem; font-weight: 800; line-height: 1; margin-bottom: 0.2rem; }
          .card-title { font-weight: 700; font-size: 1.1rem; margin-bottom: 0.3rem; color: var(--text-main); }
          .card-date { 
              font-size: 0.75rem; color: var(--text-sub); 
              margin-bottom: 0.5rem; display: flex; align-items: center;
              gap: 4px;
          }
          .card-note { 
              font-size: 0.8rem; color: var(--text-sub); background: var(--bg-body);
              padding: 4px 8px; border-radius: 6px; margin-top: auto; margin-bottom: 0.8rem;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .icon-container { display: inline-flex; align-items: center; gap: 4px; }
          .svg-icon { width: 14px; height: 14px; display: block; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
  
          .btn-action {
              width: 100%; border-radius: 8px; padding: 6px; border: none; font-weight: 600; font-size: 0.85rem;
              background: var(--primary); color: white; transition: opacity 0.2s;
          }
          .btn-archive-action { background: var(--bg-body); color: var(--text-sub); }
  
          .fab {
              position: fixed; bottom: 30px; right: 30px; z-index: 1050;
              width: 56px; height: 56px; border-radius: 50%; 
              display: flex; align-items: center; justify-content: center;
              font-size: 1.4rem; background-color: var(--primary); color: white; 
              box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.4); cursor: pointer;
              border: none !important; outline: none !important;
          }
  
          /* Modal & Form */
          .modal-content { background-color: var(--modal-bg); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 20px; }
          .form-control, .form-select {
              background-color: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-main);
              border-radius: 8px; padding: 0.35rem 0.7rem; font-size: 0.9rem;
          }
          .btn-check:checked + .btn-outline-primary { background-color: rgba(59, 130, 246, 0.15); color: var(--primary); border-color: var(--primary); }
          .btn-outline-primary { color: var(--text-sub); border-color: var(--input-border); padding: 4px 10px; font-size: 0.85rem; }
  
          @media (max-width: 576px) {
              .modal-dialog { margin: 0.5rem; max-width: 100%; }
              .modal-content { border-radius: 16px; }
              .modal-header { padding: 0.8rem 1rem; border-bottom: 1px solid var(--border-color); }
              .modal-body { padding: 1rem; } 
              .mb-3 { margin-bottom: 0.6rem !important; }
              .modal-footer { padding: 0.8rem; flex-direction: column; align-items: stretch; gap: 10px; border-top: 1px solid var(--border-color); }
              .modal-footer .d-flex { justify-content: space-between; width: 100%; }
              .modal-footer .btn-primary, .modal-footer .btn-secondary { flex: 1; padding: 10px; }
          }
  
          /* --- 自定义微型时间选择器 (UI 协调核心) --- */
          .time-picker-wrapper { position: relative; }
          .time-picker-popup {
              position: absolute; bottom: 100%; right: 0; width: 180px; 
              background: var(--modal-bg); border: 1px solid var(--border-color);
              border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);
              z-index: 1060; padding: 0; overflow: hidden;
              display: none; /* 默认隐藏 */
              margin-bottom: 5px;
          }
          .time-picker-header {
              padding: 8px; text-align: center; font-size: 0.8rem; font-weight: bold;
              background: var(--bg-body); border-bottom: 1px solid var(--border-color);
              color: var(--text-sub);
          }
          .time-picker-body { display: flex; height: 160px; }
          .time-col { flex: 1; overflow-y: auto; scrollbar-width: none; padding: 5px 0; border-right: 1px solid var(--border-color); }
          .time-col:last-child { border-right: none; }
          .time-col::-webkit-scrollbar { display: none; }
          .time-item {
              padding: 6px; text-align: center; cursor: pointer; font-size: 0.9rem;
              transition: background 0.1s;
          }
          .time-item:hover { background: var(--picker-hover); }
          .time-item.active { background: var(--primary); color: white; border-radius: 4px; margin: 0 4px; }
  
          .btn-test-premium {
              background-color: rgba(59, 130, 246, 0.1); color: #2563eb; font-weight: 600; font-size: 0.85rem;
              border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 50px; padding: 6px 14px;
              display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
          }
          .btn-del-minimal { color: #ef4444; font-size: 0.85rem; text-decoration: none; padding: 0 5px; }
  
          #auth-overlay { position: fixed; inset: 0; background: var(--bg-body); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      </style>
  </head>
  <body>
  
      <!-- 登录 -->
      <div id="auth-overlay">
          <div class="text-center p-4">
              <h2 class="fw-bold mb-4" style="color: var(--primary)"><i class="far fa-calendar-check"></i> 事件提醒</h2>
              <input type="password" id="auth-pass" class="form-control form-control-lg text-center mb-3" placeholder="密码" style="max-width: 250px;">
              <button class="btn btn-primary w-100 rounded-pill" onclick="app.login()">进入</button>
          </div>
      </div>
  
      <!-- 主界面 -->
      <div id="app-box" style="display:none">
          <nav class="navbar-custom">
              <div class="brand"><i class="far fa-calendar-check"></i> 事件提醒</div>
              <div class="d-flex gap-3 align-items-center">
                  <input type="text" class="search-input d-none d-md-block" placeholder="搜索..." onkeyup="app.render(this.value)">
                  <button class="theme-toggle" onclick="app.toggleTheme()"><i class="fas fa-adjust"></i></button>
                  <button class="theme-toggle" onclick="app.logout()" style="background:rgba(239,68,68,0.1); color:#ef4444"><i class="fas fa-power-off"></i></button>
              </div>
          </nav>
  
          <div class="container mt-3">
              <ul class="nav nav-pills justify-content-center mb-3" style="gap:10px">
                  <li class="nav-item"><button class="nav-link active rounded-pill px-4" id="tab-active" onclick="app.setTab('active')">运行中</button></li>
                  <li class="nav-item"><button class="nav-link rounded-pill px-4 bg-transparent text-secondary border" id="tab-archived" onclick="app.setTab('archived')">归档</button></li>
              </ul>
          
              <div id="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
              <div class="row g-3" id="list-container"></div>
              <div id="empty-tips" class="text-center py-5" style="display:none; color: var(--text-sub)"><i class="far fa-folder-open fa-3x mb-3 opacity-50"></i><p>无项目</p></div>
          </div>
  
          <button class="fab" onclick="app.openModal()"><i class="fas fa-plus"></i></button>
      </div>
  
      <!-- 紧凑型编辑模态框 -->
      <div class="modal fade" id="itemModal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                  <div class="modal-header">
                      <h5 class="modal-title fw-bold">编辑事项</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" style="filter: invert(var(--invert-icon))"></button>
                  </div>
                  <div class="modal-body">
                      <form id="editorForm">
                          <input type="hidden" id="editId">
                          
                          <div class="mb-3">
                              <label class="form-label">名称</label>
                              <input type="text" class="form-control fw-bold" id="itemName" placeholder="例如:GV 保号" required>
                          </div>
  
                          <div class="mb-3">
                              <label class="form-label">模式</label>
                              <div class="btn-group w-100" role="group">
                                  <input type="radio" class="btn-check" name="modeType" id="modeCycle" value="cycle" checked onchange="app.toggleMode()">
                                  <label class="btn btn-outline-primary" for="modeCycle">循环重复</label>
                                  <input type="radio" class="btn-check" name="modeType" id="modeOne" value="target" onchange="app.toggleMode()">
                                  <label class="btn btn-outline-primary" for="modeOne">单次提醒</label>
                              </div>
                          </div>
  
                          <div id="group-cycle">
                              <div class="row g-2 mb-3">
                                  <div class="col-6">
                                      <label class="form-label">周期</label>
                                      <select class="form-select" id="cyclePreset" onchange="app.toggleCycleInput()">
                                          <option value="m-1">1个月</option>
                                          <option value="m-3" selected>3个月</option>
                                          <option value="m-6">6个月</option>
                                          <option value="m-12">1年</option>
                                          <option value="custom">自定义(天)</option>
                                      </select>
                                      <input type="number" id="customDaysInput" class="form-control mt-2" placeholder="天数" style="display:none" min="1">
                                  </div>
                                  <div class="col-6">
                                      <label class="form-label">上次操作</label>
                                      <input type="date" class="form-control" id="lastTime">
                                  </div>
                              </div>
                          </div>
  
                          <div id="group-target" style="display:none">
                              <div class="mb-3">
                                  <label class="form-label">截止日期</label>
                                  <input type="date" class="form-control" id="targetTime">
                              </div>
                          </div>
  
                          <div class="mb-3">
                              <label class="form-label">备注</label>
                              <textarea class="form-control" id="notes" rows="1" placeholder="选填"></textarea>
                          </div>
  
                          <div class="row g-2 mb-3 align-items-end">
                              <div class="col-7">
                                  <label class="form-label">提醒规则</label>
                                  <input type="text" class="form-control" id="reminders" value="" placeholder="到期日之前,逗号分隔">
                              </div>
                              <div class="col-5">
                                  <label class="form-label">通知时间</label>
                                  <!-- 自定义微型时间选择器 -->
                                  <div class="time-picker-wrapper">
                                      <input type="text" class="form-control text-center" id="notifyTime" readonly value="10:00" onclick="app.toggleTimePicker(event)">
                                      <div id="timePickerPopup" class="time-picker-popup" onclick="event.stopPropagation()">
                                          <div class="time-picker-header">选择时间</div>
                                          <div class="time-picker-body">
                                              <div class="time-col" id="tp-hour"></div>
                                              <div class="time-col" id="tp-min"></div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
  
                          <!-- 替换Telegram为微信企业应用通知配置 -->
                          <div class="p-2 rounded-3 border border-color d-flex justify-content-between align-items-center mb-1">
                              <label class="form-label m-0">微信企业应用</label>
                              <div class="form-check form-switch m-0">
                                  <input class="form-check-input" type="checkbox" id="notifyWxwork" checked>
                              </div>
                          </div>
                          <div id="wxworkConfig" class="mb-3 p-2 rounded-3 border border-color" style="background: var(--bg-body);">
                              <div class="row g-2">
                                  <div class="col-6">
                                      <label class="form-label">企业ID (corpid)</label>
                                      <input type="text" class="form-control" id="wxworkCorpid" placeholder="企业微信ID">
                                  </div>
                                  <div class="col-6">
                                      <label class="form-label">应用ID (agentid)</label>
                                      <input type="text" class="form-control" id="wxworkAgentid" placeholder="应用ID">
                                  </div>
                                  <div class="col-6">
                                      <label class="form-label">应用密钥 (secret)</label>
                                      <input type="text" class="form-control" id="wxworkSecret" placeholder="应用密钥">
                                  </div>
                                  <div class="col-6">
                                      <label class="form-label">接收用户ID</label>
                                      <input type="text" class="form-control" id="wxworkUserid" placeholder="用户ID列表，逗号分隔">
                                  </div>
                                  <div class="col-12">
                                      <label class="form-label">API代理地址（可选）</label>
                                      <input type="text" class="form-control" id="wxworkApiProxy" placeholder="如 https://proxy.com/cgi-bin/">
                                  </div>
                              </div>
                          </div>
  
                          <div class="p-2 rounded-3 border border-color d-flex justify-content-between align-items-center">
                              <label class="form-label m-0">Email (Resend)</label>
                              <div class="form-check form-switch m-0">
                                  <input class="form-check-input" type="checkbox" id="notifyEmail">
                              </div>
                          </div>
  
                      </form>
                  </div>
                  <div class="modal-footer">
                      <div class="d-flex align-items-center w-100 justify-content-between mb-2 mb-sm-0" style="margin-right:auto;">
                          <button type="button" class="btn-del-minimal bg-transparent border-0" id="btnDel" onclick="app.delItem()">删除</button>
                          <button type="button" class="btn-test-premium" id="btnTest" onclick="app.testNotify()">
                              <i class="fas fa-paper-plane"></i> 发送测试
                          </button>
                      </div>
                      <div class="d-flex gap-2 w-100">
                          <button type="button" class="btn btn-secondary flex-fill" data-bs-dismiss="modal">取消</button>
                          <button type="button" class="btn btn-primary flex-fill" onclick="app.save()">保存</button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script>
          const app = {
              data: [], tab: 'active', token: localStorage.getItem('er_token'), theme: localStorage.getItem('er_theme') || 'light',
              lastDataHash: '',
              
              init() {
                  document.documentElement.setAttribute('data-theme', this.theme);
                  this.updateThemeIcon();
                  const shDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
                  document.getElementById('lastTime').value = shDate; 
                  document.getElementById('targetTime').value = shDate;
                  
                  // 初始化自定义时间选择器DOM
                  this.initCustomTimePicker();
  
                  if(this.token) {
                      this.loadData();
                      setInterval(() => this.loadData(true), 30000);
                  }
                  
                  // 点击空白处关闭时间选择器
                  document.addEventListener('click', () => {
                      document.getElementById('timePickerPopup').style.display = 'none';
                  });
              },
  
              // 初始化时间选择器
              initCustomTimePicker() {
                  const hourContainer = document.getElementById('tp-hour');
                  const minContainer = document.getElementById('tp-min');
                  
                  // 生成小时选项
                  for(let i=0; i<24; i++) {
                      const h = i.toString().padStart(2, '0');
                      const div = document.createElement('div');
                      div.className = `time-item ${h === '10' ? 'active' : ''}`;
                      div.textContent = h;
                      div.dataset.value = h;
                      div.onclick = () => this.selectTimeItem('hour', div);
                      hourContainer.appendChild(div);
                  }
                  
                  // 生成分钟选项 (每5分钟)
                  for(let i=0; i<60; i+=5) {
                      const m = i.toString().padStart(2, '0');
                      const div = document.createElement('div');
                      div.className = `time-item ${m === '00' ? 'active' : ''}`;
                      div.textContent = m;
                      div.dataset.value = m;
                      div.onclick = () => this.selectTimeItem('min', div);
                      minContainer.appendChild(div);
                  }
              },
              
              // 选择时间项
              selectTimeItem(type, elem) {
                  // 移除同列其他active
                  Array.from(elem.parentElement.children).forEach(el => {
                      el.classList.remove('active');
                  });
                  // 添加当前active
                  elem.classList.add('active');
                  
                  // 更新显示值
                  const hour = document.querySelector('#tp-hour .active').dataset.value;
                  const min = document.querySelector('#tp-min .active').dataset.value;
                  document.getElementById('notifyTime').value = `${hour}:${min}`;
              },
              
              // 切换时间选择器显示
              toggleTimePicker(e) {
                  e.stopPropagation();
                  const popup = document.getElementById('timePickerPopup');
                  popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
              },
              
              // 切换主题
              toggleTheme() {
                  this.theme = this.theme === 'light' ? 'dark' : 'light';
                  document.documentElement.setAttribute('data-theme', this.theme);
                  localStorage.setItem('er_theme', this.theme);
                  this.updateThemeIcon();
              },
              
              updateThemeIcon() {
                  // 可以在这里更新主题图标
              },
              
              // 登录
              async login() {
                  const pass = document.getElementById('auth-pass').value;
                  const res = await fetch('/api/login', {
                      method: 'POST',
                      body: JSON.stringify({ password: pass })
                  });
                  
                  if(res.ok) {
                      const data = await res.json();
                      localStorage.setItem('er_token', data.token);
                      this.token = data.token;
                      document.getElementById('auth-overlay').style.display = 'none';
                      document.getElementById('app-box').style.display = 'block';
                      this.loadData();
                      setInterval(() => this.loadData(true), 30000);
                  } else {
                      alert('密码错误');
                  }
              },
              
              // 登出
              logout() {
                  localStorage.removeItem('er_token');
                  this.token = null;
                  document.getElementById('auth-overlay').style.display = 'flex';
                  document.getElementById('app-box').style.display = 'none';
              },
              
              // 加载数据
              async loadData(silent = false) {
                  if(!silent) document.getElementById('loading').style.display = 'block';
                  try {
                      const res = await fetch('/api/events', {
                          headers: { 'Authorization': `Bearer ${this.token}` }
                      });
                      
                      if(res.status === 401) {
                          this.logout();
                          return;
                      }
                      
                      const data = await res.json();
                      this.data = data;
                      this.render();
                  } catch(e) {
                      console.error('加载失败', e);
                  } finally {
                      document.getElementById('loading').style.display = 'none';
                  }
              },
              
              // 切换标签页
              setTab(tab) {
                  this.tab = tab;
                  document.getElementById('tab-active').className = tab === 'active' ? 'nav-link active rounded-pill px-4' : 'nav-link rounded-pill px-4 bg-transparent text-secondary border';
                  document.getElementById('tab-archived').className = tab === 'archived' ? 'nav-link active rounded-pill px-4' : 'nav-link rounded-pill px-4 bg-transparent text-secondary border';
                  this.render();
              },
              
              // 渲染列表
              render(search = '') {
                  const container = document.getElementById('list-container');
                  const filtered = this.data.filter(item => {
                      const matchesTab = (this.tab === 'active' && !item.archived) || (this.tab === 'archived' && item.archived);
                      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.notes?.toLowerCase().includes(search.toLowerCase());
                      return matchesTab && matchesSearch;
                  });
                  
                  if(filtered.length === 0) {
                      document.getElementById('empty-tips').style.display = 'block';
                      container.innerHTML = '';
                      return;
                  }
                  
                  document.getElementById('empty-tips').style.display = 'none';
                  
                  // 按剩余天数排序
                  filtered.sort((a, b) => {
                      const daysA = this.calculateDaysLeft(a);
                      const daysB = this.calculateDaysLeft(b);
                      return daysA - daysB;
                  });
                  
                  container.innerHTML = filtered.map(item => {
                      const daysLeft = this.calculateDaysLeft(item);
                      const status = this.getStatus(daysLeft);
                      const statusClass = status === '安全' ? 'pill-safe' : status === '警告' ? 'pill-warn' : 'pill-danger';
                      const nextDate = this.getNextDate(item);
                      
                      return `
                      <div class="col-12 col-sm-6 col-md-4 col-lg-3" onclick="app.openModal('${item.id}')">
                          <div class="task-card">
                              <div class="status-pill ${statusClass}">${status}</div>
                              <div class="days-big">${daysLeft}</div>
                              <div class="card-title">${item.name}</div>
                              <div class="card-date"><i class="far fa-calendar-alt fa-xs"></i> ${nextDate}</div>
                              ${item.notes ? `<div class="card-note">${item.notes}</div>` : ''}
                              <button class="btn-action ${item.archived ? 'btn-archive-action' : ''}" onclick="event.stopPropagation(); app.toggleArchive('${item.id}')">
                                  ${item.archived ? '<i class="fas fa-redo"></i> 恢复' : '<i class="fas fa-box-archive"></i> 归档'}
                              </button>
                          </div>
                      </div>
                      `;
                  }).join('');
              },
              
              // 计算剩余天数
              calculateDaysLeft(item) {
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  
                  const nextDate = new Date(this.getNextDate(item));
                  nextDate.setHours(0, 0, 0, 0);
                  
                  const diffTime = nextDate - now;
                  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              },
              
              // 获取状态
              getStatus(days) {
                  if(days <= 0) return '已到期';
                  if(days <= 3) return '紧急';
                  if(days <= 10) return '警告';
                  return '安全';
              },
              
              // 获取下次日期
              getNextDate(item) {
                  if(item.mode === 'target') {
                      return item.targetTime;
                  }
                  
                  // 循环模式计算下次日期
                  const last = new Date(item.lastTime);
                  let monthsToAdd = 0;
                  let daysToAdd = 0;
                  
                  if(item.cyclePreset === 'custom') {
                      daysToAdd = parseInt(item.customDays) || 30;
                  } else {
                      monthsToAdd = parseInt(item.cyclePreset.split('-')[1]) || 3;
                  }
                  
                  if(monthsToAdd > 0) {
                      last.setMonth(last.getMonth() + monthsToAdd);
                  } else {
                      last.setDate(last.getDate() + daysToAdd);
                  }
                  
                  return last.toISOString().split('T')[0];
              },
              
              // 打开编辑模态框
              openModal(id = null) {
                  const modal = new bootstrap.Modal(document.getElementById('itemModal'));
                  const form = document.getElementById('editorForm');
                  
                  // 重置表单
                  form.reset();
                  document.getElementById('editId').value = '';
                  document.getElementById('btnDel').style.display = 'none';
                  
                  if(id) {
                      // 编辑模式
                      const item = this.data.find(i => i.id === id);
                      if(!item) return;
                      
                      document.getElementById('editId').value = id;
                      document.getElementById('itemName').value = item.name;
                      document.getElementById('notes').value = item.notes || '';
                      document.getElementById('reminders').value = item.reminders || '';
                      document.getElementById('notifyTime').value = item.notifyTime || '10:00';
                      document.getElementById('notifyWxwork').checked = item.notifyWxwork !== false;
                      document.getElementById('notifyEmail').checked = item.notifyEmail === true;
                      
                      // 微信企业应用配置
                      document.getElementById('wxworkCorpid').value = item.wxworkCorpid || '';
                      document.getElementById('wxworkAgentid').value = item.wxworkAgentid || '';
                      document.getElementById('wxworkSecret').value = item.wxworkSecret || '';
                      document.getElementById('wxworkUserid').value = item.wxworkUserid || '';
                      document.getElementById('wxworkApiProxy').value = item.wxworkApiProxy || '';
                      
                      // 模式切换
                      if(item.mode === 'target') {
                          document.getElementById('modeOne').checked = true;
                          this.toggleMode();
                          document.getElementById('targetTime').value = item.targetTime;
                      } else {
                          document.getElementById('modeCycle').checked = true;
                          this.toggleMode();
                          document.getElementById('lastTime').value = item.lastTime;
                          document.getElementById('cyclePreset').value = item.cyclePreset || 'm-3';
                          this.toggleCycleInput();
                          if(item.cyclePreset === 'custom') {
                              document.getElementById('customDaysInput').value = item.customDays || '';
                          }
                      }
                      
                      document.getElementById('btnDel').style.display = 'block';
                      document.getElementById('btnTest').style.display = 'inline-flex';
                  } else {
                      // 新增模式
                      const now = new Date();
                      const dateStr = now.toISOString().split('T')[0];
                      document.getElementById('lastTime').value = dateStr;
                      document.getElementById('targetTime').value = dateStr;
                      document.getElementById('btnTest').style.display = 'none';
                  }
                  
                  modal.show();
              },
              
              // 切换模式显示
              toggleMode() {
                  const isCycle = document.getElementById('modeCycle').checked;
                  document.getElementById('group-cycle').style.display = isCycle ? 'block' : 'none';
                  document.getElementById('group-target').style.display = isCycle ? 'none' : 'block';
              },
              
              // 切换周期输入框
              toggleCycleInput() {
                  const isCustom = document.getElementById('cyclePreset').value === 'custom';
                  document.getElementById('customDaysInput').style.display = isCustom ? 'block' : 'none';
              },
              
              // 保存项目
              async save() {
                  const id = document.getElementById('editId').value;
                  const data = {
                      name: document.getElementById('itemName').value,
                      mode: document.getElementById('modeCycle').checked ? 'cycle' : 'target',
                      notes: document.getElementById('notes').value,
                      reminders: document.getElementById('reminders').value,
                      notifyTime: document.getElementById('notifyTime').value,
                      notifyWxwork: document.getElementById('notifyWxwork').checked,
                      notifyEmail: document.getElementById('notifyEmail').checked,
                      wxworkCorpid: document.getElementById('wxworkCorpid').value,
                      wxworkAgentid: document.getElementById('wxworkAgentid').value,
                      wxworkSecret: document.getElementById('wxworkSecret').value,
                      wxworkUserid: document.getElementById('wxworkUserid').value,
                      wxworkApiProxy: document.getElementById('wxworkApiProxy').value
                  };
                  
                  if(data.mode === 'cycle') {
                      data.lastTime = document.getElementById('lastTime').value;
                      data.cyclePreset = document.getElementById('cyclePreset').value;
                      if(data.cyclePreset === 'custom') {
                          data.customDays = document.getElementById('customDaysInput').value;
                      }
                  } else {
                      data.targetTime = document.getElementById('targetTime').value;
                  }
                  
                  try {
                      const method = id ? 'PUT' : 'POST';
                      const url = id ? `/api/events/${id}` : '/api/events';
                      
                      const res = await fetch(url, {
                          method,
                          headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${this.token}`
                          },
                          body: JSON.stringify(data)
                      });
                      
                      if(res.ok) {
                          this.loadData();
                          bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
                      } else {
                          alert('保存失败');
                      }
                  } catch(e) {
                      console.error('保存失败', e);
                      alert('保存失败');
                  }
              },
              
              // 删除项目
              async delItem() {
                  const id = document.getElementById('editId').value;
                  if(!id || !confirm('确定删除?')) return;
                  
                  try {
                      const res = await fetch(`/api/events/${id}`, {
                          method: 'DELETE',
                          headers: { 'Authorization': `Bearer ${this.token}` }
                      });
                      
                      if(res.ok) {
                          this.loadData();
                          bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
                      } else {
                          alert('删除失败');
                      }
                  } catch(e) {
                      console.error('删除失败', e);
                      alert('删除失败');
                  }
              },
              
              // 切换归档状态
              async toggleArchive(id) {
                  const item = this.data.find(i => i.id === id);
                  if(!item) return;
                  
                  try {
                      const res = await fetch(`/api/events/${id}`, {
                          method: 'PATCH',
                          headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${this.token}`
                          },
                          body: JSON.stringify({ archived: !item.archived })
                      });
                      
                      if(res.ok) {
                          this.loadData();
                      }
                  } catch(e) {
                      console.error('操作失败', e);
                  }
              },
              
              // 测试通知
              async testNotify() {
                  const id = document.getElementById('editId').value;
                  if(!id) return;
                  
                  try {
                      const res = await fetch(`/api/events/${id}/test`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${this.token}` }
                      });
                      
                      const data = await res.json();
                      alert(data.message || '测试通知已发送');
                  } catch(e) {
                      console.error('测试通知失败', e);
                      alert('发送失败');
                  }
              }
          };
  
          // 初始化应用
          app.init();
      </script>
  </body>
  </html>
  `;
  
  // --- 2. 后端逻辑 ---
  // KV 存储键名
  const KV_KEY_EVENTS = 'er_events';
  const KV_KEY_CONFIG = 'er_config';
  const KV_KEY_TOKEN = 'er_token';
  
  // 工具函数：生成UUID
  function generateUUID() {
    return crypto.randomUUID();
  }
  
  // 工具函数：验证Token
  async function verifyToken(token) {
    const storedToken = await KV.get(KV_KEY_TOKEN);
    return storedToken && token === storedToken;
  }
  
  // 工具函数：计算剩余天数
  function calculateDaysLeft(event) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let targetDate;
    if (event.mode === 'target') {
      targetDate = new Date(event.targetTime);
    } else {
      // 循环模式计算下次日期
      const last = new Date(event.lastTime);
      let monthsToAdd = 0;
      let daysToAdd = 0;
      
      if (event.cyclePreset === 'custom') {
        daysToAdd = parseInt(event.customDays) || 30;
        last.setDate(last.getDate() + daysToAdd);
      } else {
        monthsToAdd = parseInt(event.cyclePreset.split('-')[1]) || 3;
        last.setMonth(last.getMonth() + monthsToAdd);
      }
      targetDate = last;
    }
    
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  // 工具函数：获取状态文本
  function getStatus(days) {
    if (days <= 0) return '已到期';
    if (days <= 3) return '紧急';
    if (days <= 10) return '警告';
    return '安全';
  }
  
  // 微信企业应用通知发送函数
  async function sendWxworkNotification(event, config) {
    // 检查必要配置
    if (!config.wxworkCorpid || !config.wxworkAgentid || !config.wxworkSecret) {
      console.error('微信企业应用配置不完整');
      return false;
    }
  
    try {
      // 获取代理地址（优先使用事件配置，其次环境变量，最后官方地址）
      const apiBase = event.wxworkApiProxy || 
                     (config.wxworkApiProxy || '') || 
                     'https://qyapi.weixin.qq.com/cgi-bin/';
      
      // 1. 获取access_token
      const tokenUrl = `${apiBase}gettoken?corpid=${encodeURIComponent(config.wxworkCorpid)}&corpsecret=${encodeURIComponent(config.wxworkSecret)}`;
      const tokenResp = await fetch(tokenUrl);
      const tokenData = await tokenResp.json();
      
      if (!tokenData.access_token) {
        console.error('获取access_token失败:', tokenData);
        return false;
      }
  
      // 2. 发送消息
      const userIds = event.wxworkUserid || config.wxworkUserid || '@all';
      const msgUrl = `${apiBase}message/send?access_token=${tokenData.access_token}`;
      const daysLeft = calculateDaysLeft(event);
      
      const msgContent = {
        touser: userIds,
        agentid: config.wxworkAgentid,
        msgtype: 'text',
        text: {
          content: `【事件提醒】\n名称: ${event.name}\n状态: ${getStatus(daysLeft)}\n剩余: ${daysLeft}天\n备注: ${event.notes || '无'}`
        },
        safe: 0
      };
  
      const msgResp = await fetch(msgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgContent)
      });
  
      const msgData = await msgResp.json();
      if (msgData.errcode !== 0) {
        console.error('发送微信消息失败:', msgData);
        return false;
      }
  
      return true;
    } catch (error) {
      console.error('微信通知错误:', error);
      return false;
    }
  }
  
  // Email通知发送函数 (保留原功能)
  async function sendEmailNotification(event, config, daysLeft) {
    if (!config.resendApiKey || !config.resendEmail) {
      console.error('Resend配置不完整');
      return false;
    }
  
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.resendApiKey}`
        },
        body: JSON.stringify({
          from: 'Event Reminder <reminder@example.com>',
          to: [config.resendEmail],
          subject: `【事件提醒】${event.name} - ${getStatus(daysLeft)}`,
          text: `名称: ${event.name}\n状态: ${getStatus(daysLeft)}\n剩余: ${daysLeft}天\n备注: ${event.notes || '无'}`
        })
      });
  
      const data = await res.json();
      if (!res.ok) {
        console.error('发送邮件失败:', data);
        return false;
      }
  
      return true;
    } catch (error) {
      console.error('邮件通知错误:', error);
      return false;
    }
  }
  
  // 获取配置
  async function getConfig() {
    const data = await KV.get(KV_KEY_CONFIG);
    const config = data ? JSON.parse(data) : {
      password: '',
      resendApiKey: '',
      resendEmail: '',
      wxworkCorpid: '',
      wxworkAgentid: '',
      wxworkSecret: '',
      wxworkUserid: '',
      wxworkApiProxy: ''
    };
  
    // 从环境变量加载配置（环境变量优先级更高）
    if (ENV.WXWORK_CORPID) config.wxworkCorpid = ENV.WXWORK_CORPID;
    if (ENV.WXWORK_AGENTID) config.wxworkAgentid = ENV.WXWORK_AGENTID;
    if (ENV.WXWORK_SECRET) config.wxworkSecret = ENV.WXWORK_SECRET;
    if (ENV.WXWORK_USERID) config.wxworkUserid = ENV.WXWORK_USERID;
    if (ENV.WXWORK_API_PROXY) config.wxworkApiProxy = ENV.WXWORK_API_PROXY;
    if (ENV.RESEND_API_KEY) config.resendApiKey = ENV.RESEND_API_KEY;
    if (ENV.RESEND_EMAIL) config.resendEmail = ENV.RESEND_EMAIL;
    if (ENV.PASSWORD) config.password = ENV.PASSWORD;
  
    return config;
  }
  
  // 检查并发送通知
  async function checkAndSendNotifications() {
    const config = await getConfig();
    const eventsData = await KV.get(KV_KEY_EVENTS);
    const events = eventsData ? JSON.parse(eventsData) : [];
  
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
    // 检查是否在通知时间范围内
    const notifyTime = config.notifyTime || '10:00';
    if (currentTime !== notifyTime) return;
  
    for (const event of events) {
      if (event.archived) continue;
      
      // 计算剩余天数
      const daysLeft = calculateDaysLeft(event);
      const shouldNotify = event.reminders?.split(',').some(d => parseInt(d) === daysLeft) || false;
  
      if (shouldNotify) {
        // 微信企业应用通知
        if (event.notifyWxwork) {
          await sendWxworkNotification(event, config);
        }
  
        // Email通知
        if (event.notifyEmail) {
          await sendEmailNotification(event, config, daysLeft);
        }
      }
    }
  }
  
  // --- 3. 请求处理 ---
  async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
  
    // 处理定时任务 (Cloudflare Scheduled Events)
    if (request.method === 'POST' && path === '/__scheduled') {
      await checkAndSendNotifications();
      return new Response(JSON.stringify({ success: true }), { headers: DEFAULT_HEADERS });
    }
  
    // 提供前端页面
    if (request.method === 'GET' && path === '/') {
      return new Response(HTML_CONTENT, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  
    // API路由需要验证Token
    if (path.startsWith('/api/') && path !== '/api/login') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!await verifyToken(token)) {
        return new Response(JSON.stringify({ error: '未授权' }), {
          status: 401,
          headers: DEFAULT_HEADERS
        });
      }
    }
  
    // 登录API
    if (request.method === 'POST' && path === '/api/login') {
      const { password } = await request.json();
      const config = await getConfig();
      
      if (password === config.password) {
        // 生成并存储Token
        const token = generateUUID();
        await KV.put(KV_KEY_TOKEN, token);
        return new Response(JSON.stringify({ token }), { headers: DEFAULT_HEADERS });
      } else {
        return new Response(JSON.stringify({ error: '密码错误' }), {
          status: 401,
          headers: DEFAULT_HEADERS
        });
      }
    }
  
    // 事件列表API
    if (request.method === 'GET' && path === '/api/events') {
      const data = await KV.get(KV_KEY_EVENTS);
      const events = data ? JSON.parse(data) : [];
      return new Response(JSON.stringify(events), { headers: DEFAULT_HEADERS });
    }
  
    // 创建事件API
    if (request.method === 'POST' && path === '/api/events') {
      const event = await request.json();
      const data = await KV.get(KV_KEY_EVENTS);
      const events = data ? JSON.parse(data) : [];
      
      event.id = generateUUID();
      event.createdAt = new Date().toISOString();
      event.archived = false;
      
      events.push(event);
      await KV.put(KV_KEY_EVENTS, JSON.stringify(events));
      
      return new Response(JSON.stringify(event), {
        status: 201,
        headers: DEFAULT_HEADERS
      });
    }
  
    // 更新事件API
    if (request.method === 'PUT' && path.match(/^\/api\/events\/([^\/]+)$/)) {
      const id = path.split('/')[3];
      const updatedEvent = await request.json();
      const data = await KV.get(KV_KEY_EVENTS);
      const events = data ? JSON.parse(data) : [];
      
      const index = events.findIndex(e => e.id === id);
      if (index === -1) {
        return new Response(JSON.stringify({ error: '事件不存在' }), {
          status: 404,
          headers: DEFAULT_HEADERS
        });
      }
      
      events[index] = { ...events[index], ...updatedEvent, id };
      await KV.put(KV_KEY_EVENTS, JSON.stringify(events));
      
      return new Response(JSON.stringify(events[index]), { headers: DEFAULT_HEADERS });
    }
  
    // 部分更新事件(归档/恢复)
    if (request.method === 'PATCH' && path.match(/^\/api\/events\/([^\/]+)$/)) {
      const id = path.split('/')[3];
      const updates = await request.json();
      const data = await KV.get(KV_KEY_EVENTS);
      const events = data ? JSON.parse(data) : [];
      
      const index = events.findIndex(e => e.id === id);
      if (index === -1) {
        return new Response(JSON.stringify({ error: '事件不存在' }), {
          status: 404,
          headers: DEFAULT_HEADERS
        });
      }
      
      events[index] = { ...events[index], ...updates };
      await KV.put(KV_KEY_EVENTS, JSON.stringify(events));
      
      return new Response(JSON.stringify(events[index]), { headers: DEFAULT_HEADERS });
    }
  
    // 删除事件API
    if (request.method === 'DELETE' && path.match(/^\/api\/events\/([^\/]+)$/)) {
      const id = path.split('/')[3];
      const data = await KV.get(KV_KEY_EVENTS);
      const events = data ? JSON.parse(data) : [];
      
      const filtered = events.filter(e => e.id !== id);
      await KV.put(KV_KEY_EVENTS, JSON.stringify(filtered));
      
      return new Response(JSON.stringify({ success: true }), { headers: DEFAULT_HEADERS });
    }
  
    // 测试通知API
    if (request.method === 'POST' && path.match(/^\/api\/events\/([^\/]+)\/test$/)) {
      const id = path.split('/')[3];
      const data = await KV.get(KV_KEY_EVENTS);
      const events = data ? JSON.parse(data) : [];
      const event = events.find(e => e.id === id);
      
      if (!event) {
        return new Response(JSON.stringify({ error: '事件不存在' }), {
          status: 404,
          headers: DEFAULT_HEADERS
        });
      }
      
      const config = await getConfig();
      const daysLeft = calculateDaysLeft(event);
      let success = false;
      
      if (event.notifyWxwork) {
        success = await sendWxworkNotification(event, config);
      } else if (event.notifyEmail) {
        success = await sendEmailNotification(event, config, daysLeft);
      }
      
      return new Response(JSON.stringify({
        success,
        message: success ? '测试通知发送成功' : '测试通知发送失败'
      }), { headers: DEFAULT_HEADERS });
    }
  
    // 404响应
    return new Response(JSON.stringify({ error: '未找到' }), {
      status: 404,
      headers: DEFAULT_HEADERS
    });
  }
  
  // 导出Worker处理函数
  addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request));
  });
  
  // 处理定时任务
  addEventListener('scheduled', (event) => {
    event.waitUntil(checkAndSendNotifications());
  });
  `
