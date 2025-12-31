/**
 * 事件提醒工具（无Telegram Bot，整合企业微信通知）
 * 部署环境：Cloudflare Workers
 * 数据存储：Cloudflare KV (KEEP_ALIVE_DB)
 */

// ===== 全局常量配置 =====
const DEFAULT_HEADERS = {
  "Content-Type": "application/json;charset=UTF-8",
  "Access-Control-Allow-Origin": "*"
};

// 企业微信默认配置（对齐参考项目）
const WECHAT_WORK_CONFIG = {
  BASE_URL: "https://qyapi.weixin.qq.com" // 企业微信接口根地址，固定不变
};

// 前端HTML内容（移除Telegram相关UI，新增企业微信配置）
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>事件提醒工具 (Event Reminder)</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --bs-body-bg: #f8f9fa;
      --bs-card-bg: #ffffff;
      --border-color: #dee2e6;
    }
    [data-bs-theme="dark"] {
      --bs-body-bg: #121212;
      --bs-card-bg: #1e1e1e;
      --border-color: #343a40;
    }
    body {
      min-height: 100vh;
      padding: 20px 0;
    }
    .card-event {
      transition: all 0.3s ease;
      margin-bottom: 15px;
    }
    .card-event.safe {
      border-left: 5px solid #28a745;
    }
    .card-event.warn {
      border-left: 5px solid #ffc107;
    }
    .card-event.urgent {
      border-left: 5px solid #fd7e14;
    }
    .card-event.danger {
      border-left: 5px solid #dc3545;
    }
    .config-section {
      margin-top: 30px;
      padding: 20px;
      background: var(--bs-card-bg);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
  </style>
</head>
<body data-bs-theme="auto">
  <div class="container">
    <header class="text-center mb-5">
      <h1>事件提醒工具</h1>
      <p class="text-muted">无服务器架构 · 企业微信+邮件通知</p>
    </header>

    <!-- 事件操作区域 -->
    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">添加/编辑事件</h5>
        <form id="eventForm">
          <input type="hidden" id="eventId">
          <div class="row g-3 mb-3">
            <div class="col-md-6">
              <label for="eventName" class="form-label">事件名称</label>
              <input type="text" class="form-control" id="eventName" placeholder="例如：服务器续费" required>
            </div>
            <div class="col-md-6">
              <label for="eventDate" class="form-label">截止日期</label>
              <input type="date" class="form-control" id="eventDate" required>
            </div>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-md-6">
              <label for="eventCycleType" class="form-label">提醒类型</label>
              <select class="form-select" id="eventCycleType">
                <option value="once">单次提醒</option>
                <option value="cycle">循环提醒</option>
              </select>
            </div>
            <div class="col-md-6" id="cycleContainer" style="display: none;">
              <label for="eventCycle" class="form-label">循环周期（例如：3个月/30天）</label>
              <input type="text" class="form-control" id="eventCycle" placeholder="3个月 或 30天">
            </div>
          </div>
          <div class="mb-3">
            <label for="eventNotes" class="form-label">备注信息</label>
            <textarea class="form-control" id="eventNotes" rows="2" placeholder="填写额外备注..."></textarea>
          </div>
          
          <!-- 通知开关（移除Telegram，保留Email+新增企业微信） -->
          <div class="mb-3">
            <h6>通知渠道</h6>
            <div class="p-2 rounded-3 border border-color d-flex justify-content-between align-items-center mb-1">
              <label class="form-label m-0">Email (Resend)</label>
              <div class="form-check form-switch m-0">
                <input class="form-check-input" type="checkbox" id="notifyEmail">
              </div>
            </div>
            <div class="p-2 rounded-3 border border-color d-flex justify-content-between align-items-center mb-1">
              <label class="form-label m-0">企业微信通知</label>
              <div class="form-check form-switch m-0">
                <input class="form-check-input" type="checkbox" id="notifyWechatWork">
              </div>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary">保存事件</button>
          <button type="button" class="btn btn-secondary" id="resetForm">重置</button>
        </form>
      </div>
    </div>

    <!-- 事件列表区域 -->
    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">事件列表</h5>
        <div class="d-flex justify-content-between mb-3">
          <button class="btn btn-sm btn-outline-secondary" id="toggleArchive">显示归档事件</button>
          <button class="btn btn-sm btn-outline-danger" id="clearExpired">清理已逾期归档事件</button>
        </div>
        <div id="eventList" class="row g-3"></div>
      </div>
    </div>

    <!-- 配置区域（移除Telegram，新增企业微信） -->
    <div class="config-section">
      <h5>系统配置</h5>
      <div class="accordion" id="configAccordion">
        <!-- Email (Resend) 配置 -->
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseEmail">
              Email (Resend) 配置
            </button>
          </h2>
          <div id="collapseEmail" class="accordion-collapse collapse show">
            <div class="accordion-body">
              <div class="mb-2">
                <label class="form-label">Resend API Key</label>
                <input type="text" class="form-control" id="emailApiKey" placeholder="Resend API Key">
              </div>
              <div class="mb-2">
                <label class="form-label">发送邮箱</label>
                <input type="text" class="form-control" id="emailFrom" placeholder="from@example.com">
              </div>
              <div class="mb-2">
                <label class="form-label">接收邮箱</label>
                <input type="text" class="form-control" id="emailTo" placeholder="to@example.com">
              </div>
              <button class="btn btn-sm btn-primary" onclick="saveEmailConfig()">保存Email配置</button>
              <button class="btn btn-sm btn-outline-primary" onclick="sendTestEmail()">发送测试邮件</button>
            </div>
          </div>
        </div>

        <!-- 企业微信配置（对齐参考项目） -->
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseWechatWork">
              企业微信配置
            </button>
          </h2>
          <div id="collapseWechatWork" class="accordion-collapse collapse show">
            <div class="accordion-body">
              <div class="row g-2 mb-2">
                <div class="col-6">
                  <label class="form-label">企业ID（corpId）</label>
                  <input type="text" class="form-control" id="wechatWorkCorpId" placeholder="企业微信ID">
                </div>
                <div class="col-6">
                  <label class="form-label">应用ID（agentId）</label>
                  <input type="text" class="form-control" id="wechatWorkAgentId" placeholder="应用ID">
                </div>
              </div>
              <div class="mb-2">
                <label class="form-label">应用密钥（corpSecret）</label>
                <input type="text" class="form-control" id="wechatWorkCorpSecret" placeholder="应用密钥">
              </div>
              <div class="mb-2">
                <label class="form-label">接收用户ID（touser）</label>
                <input type="text" class="form-control" id="wechatWorkTouser" placeholder="用户ID，多个用|分隔">
              </div>
              <div class="mb-2">
                <label class="form-label">接口根地址（baseUrl）</label>
                <input type="text" class="form-control" id="wechatWorkBaseUrl" value="https://qyapi.weixin.qq.com" readonly>
              </div>
              <button class="btn btn-sm btn-primary" onclick="saveWechatWorkConfig()">保存企业微信配置</button>
              <button class="btn btn-sm btn-outline-primary" onclick="sendTestWechatWork()">发送测试消息</button>
            </div>
          </div>
        </div>

        <!-- 通用配置 -->
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseGeneral">
              通用配置
            </button>
          </h2>
          <div id="collapseGeneral" class="accordion-collapse collapse show">
            <div class="accordion-body">
              <div class="mb-2">
                <label class="form-label">提醒规则（到期前天数，用逗号分隔）</label>
                <input type="text" class="form-control" id="remindDays" placeholder="30,15,7,3,1,0">
              </div>
              <div class="mb-2">
                <label class="form-label">每日通知发送时间（例如：10:00）</label>
                <input type="time" class="form-control" id="notifyTime" value="10:00">
              </div>
              <div class="mb-2">
                <label class="form-label">访问密码</label>
                <input type="password" class="form-control" id="accessPassword" placeholder="设置访问密码">
              </div>
              <button class="btn btn-sm btn-primary" onclick="saveGeneralConfig()">保存通用配置</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 脚本引入 -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // 全局应用对象
    const app = {
      token: localStorage.getItem('eventReminderToken') || '',
      showArchive: false,
      events: [],

      // 初始化
      init() {
        this.bindEvents();
        this.loadEvents();
        this.loadConfigs();
        this.initCycleTypeToggle();
      },

      // 绑定事件监听
      bindEvents() {
        document.getElementById('eventForm').addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveEvent();
        });
        document.getElementById('resetForm').addEventListener('click', () => {
          this.resetForm();
        });
        document.getElementById('toggleArchive').addEventListener('click', () => {
          this.toggleArchive();
        });
        document.getElementById('clearExpired').addEventListener('click', () => {
          this.clearExpiredArchive();
        });
      },

      // 循环类型切换
      initCycleTypeToggle() {
        const cycleType = document.getElementById('eventCycleType');
        const cycleContainer = document.getElementById('cycleContainer');
        cycleType.addEventListener('change', () => {
          cycleContainer.style.display = cycleType.value === 'cycle' ? 'block' : 'none';
        });
      },

      // 加载所有事件
      async loadEvents() {
        try {
          const response = await fetch('/api/events', {
            headers: { 'Authorization': 'Bearer ' + this.token }
          });
          const data = await response.json();
          if (data.success) {
            this.events = data.events || [];
            this.renderEvents();
          }
        } catch (error) {
          console.error('加载事件失败：', error);
          alert('加载事件失败，请刷新页面重试');
        }
      },

      // 渲染事件列表
      renderEvents() {
        const eventList = document.getElementById('eventList');
        eventList.innerHTML = '';

        const filteredEvents = this.events.filter(event => {
          return this.showArchive ? true : !event.archived;
        });

        if (filteredEvents.length === 0) {
          eventList.innerHTML = '<div class="col-12 text-center text-muted">暂无事件</div>';
          return;
        }

        filteredEvents.forEach(event => {
          const eventDate = new Date(event.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysLeft = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

          // 判定状态
          let status = 'safe';
          if (daysLeft < 0) {
            status = 'danger';
          } else if (daysLeft <= 3) {
            status = 'urgent';
          } else if (daysLeft <= 7) {
            status = 'warn';
          }

          // 构建卡片
          const card = document.createElement('div');
          card.className = `col-12 col-md-6 col-lg-4`;
          card.innerHTML = `
            <div class="card card-event ${status} h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="card-title m-0">${event.name}</h6>
                <span class="badge bg-${status === 'safe' ? 'success' : status === 'warn' ? 'warning' : status === 'urgent' ? 'info' : 'danger'}">
                  ${daysLeft >= 0 ? `剩余${daysLeft}天` : `已逾期${-daysLeft}天`}
                </span>
              </div>
              <div class="card-body">
                <p class="card-text"><small>截止日期：${eventDate.toLocaleDateString('zh-CN')}</small></p>
                <p class="card-text"><small>类型：${event.cycleType === 'cycle' ? `循环（${event.cycle || '未知周期'}）` : '单次'}</small></p>
                ${event.notes ? `<p class="card-text text-muted small">备注：${event.notes}</p>` : ''}
                <p class="card-text">
                  <small>通知：${event.notifyEmail ? '✅ Email ' : '❌ Email '}
                  ${event.notifyWechatWork ? '✅ 企业微信' : '❌ 企业微信'}</small>
                </p>
              </div>
              <div class="card-footer d-flex justify-content-between">
                <button class="btn btn-sm btn-outline-primary" onclick="app.editEvent('${event.id}')">编辑</button>
                <div>
                  ${event.archived ? 
                    `<button class="btn btn-sm btn-outline-success" onclick="app.activateEvent('${event.id}')">激活</button>` : 
                    `<button class="btn btn-sm btn-outline-secondary" onclick="app.archiveEvent('${event.id}')">归档</button>`
                  }
                  <button class="btn btn-sm btn-outline-danger" onclick="app.deleteEvent('${event.id}')">删除</button>
                </div>
              </div>
            </div>
          `;
          eventList.appendChild(card);
        });
      },

      // 保存事件
      async saveEvent() {
        const eventId = document.getElementById('eventId').value;
        const eventData = {
          id: eventId || crypto.randomUUID(),
          name: document.getElementById('eventName').value,
          date: document.getElementById('eventDate').value,
          cycleType: document.getElementById('eventCycleType').value,
          cycle: document.getElementById('eventCycle').value,
          notes: document.getElementById('eventNotes').value,
          notifyEmail: document.getElementById('notifyEmail').checked,
          notifyWechatWork: document.getElementById('notifyWechatWork').checked,
          archived: false
        };

        try {
          const method = eventId ? 'PUT' : 'POST';
          const response = await fetch('/api/events', {
            method: method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + this.token
            },
            body: JSON.stringify(eventData)
          });

          const data = await response.json();
          if (data.success) {
            this.resetForm();
            this.loadEvents();
            alert(eventId ? '事件编辑成功' : '事件添加成功');
          } else {
            alert('保存事件失败：' + data.message);
          }
        } catch (error) {
          console.error('保存事件失败：', error);
          alert('保存事件失败，请刷新页面重试');
        }
      },

      // 编辑事件
      editEvent(id) {
        const event = this.events.find(item => item.id === id);
        if (!event) return;

        document.getElementById('eventId').value = event.id;
        document.getElementById('eventName').value = event.name;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventCycleType').value = event.cycleType || 'once';
        document.getElementById('eventCycle').value = event.cycle || '';
        document.getElementById('eventNotes').value = event.notes || '';
        document.getElementById('notifyEmail').checked = event.notifyEmail || false;
        document.getElementById('notifyWechatWork').checked = event.notifyWechatWork || false;

        // 切换循环容器显示
        const cycleContainer = document.getElementById('cycleContainer');
        cycleContainer.style.display = event.cycleType === 'cycle' ? 'block' : 'none';

        // 滚动到表单
        document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
      },

      // 重置表单
      resetForm() {
        document.getElementById('eventForm').reset();
        document.getElementById('eventId').value = '';
        const cycleContainer = document.getElementById('cycleContainer');
        cycleContainer.style.display = 'none';
      },

      // 归档事件
      async archiveEvent(id) {
        if (!confirm('确定要归档该事件吗？归档后可在归档列表中查看')) return;

        try {
          const response = await fetch(`/api/events/${id}/archive`, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + this.token }
          });

          const data = await response.json();
          if (data.success) {
            this.loadEvents();
            alert('事件归档成功');
          } else {
            alert('归档事件失败：' + data.message);
          }
        } catch (error) {
          console.error('归档事件失败：', error);
          alert('归档事件失败，请刷新页面重试');
        }
      },

      // 激活事件
      async activateEvent(id) {
        if (!confirm('确定要激活该事件吗？激活后将重新显示在事件列表中')) return;

        try {
          const response = await fetch(`/api/events/${id}/activate`, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + this.token }
          });

          const data = await response.json();
          if (data.success) {
            this.loadEvents();
            alert('事件激活成功');
          } else {
            alert('激活事件失败：' + data.message);
          }
        } catch (error) {
          console.error('激活事件失败：', error);
          alert('激活事件失败，请刷新页面重试');
        }
      },

      // 删除事件
      async deleteEvent(id) {
        if (!confirm('确定要删除该事件吗？删除后无法恢复')) return;

        try {
          const response = await fetch(`/api/events/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + this.token }
          });

          const data = await response.json();
          if (data.success) {
            this.loadEvents();
            alert('事件删除成功');
          } else {
            alert('删除事件失败：' + data.message);
          }
        } catch (error) {
          console.error('删除事件失败：', error);
          alert('删除事件失败，请刷新页面重试');
        }
      },

      // 切换归档显示
      toggleArchive() {
        this.showArchive = !this.showArchive;
        document.getElementById('toggleArchive').textContent = this.showArchive ? '隐藏归档事件' : '显示归档事件';
        this.renderEvents();
      },

      // 清理已逾期归档事件
      async clearExpiredArchive() {
        if (!confirm('确定要清理已逾期的归档事件吗？清理后无法恢复')) return;

        try {
          const response = await fetch('/api/events/clear-expired', {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + this.token }
          });

          const data = await response.json();
          if (data.success) {
            this.loadEvents();
            alert('已成功清理已逾期归档事件');
          } else {
            alert('清理失败：' + data.message);
          }
        } catch (error) {
          console.error('清理归档事件失败：', error);
          alert('清理失败，请刷新页面重试');
        }
      },

      // 加载所有配置
      loadConfigs() {
        this.loadEmailConfig();
        this.loadWechatWorkConfig();
        this.loadGeneralConfig();
      }
    };

    // ===== Email 配置相关函数 =====
    async function loadEmailConfig() {
      try {
        const response = await fetch('/api/config?type=email', {
          headers: { 'Authorization': 'Bearer ' + app.token }
        });
        const data = await response.json();
        if (data.success && data.config) {
          document.getElementById('emailApiKey').value = data.config.apiKey || '';
          document.getElementById('emailFrom').value = data.config.from || '';
          document.getElementById('emailTo').value = data.config.to || '';
        }
      } catch (error) {
        console.error('加载Email配置失败：', error);
      }
    }

    async function saveEmailConfig() {
      const config = {
        apiKey: document.getElementById('emailApiKey').value,
        from: document.getElementById('emailFrom').value,
        to: document.getElementById('emailTo').value
      };

      try {
        const response = await fetch('/api/config?type=email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + app.token
          },
          body: JSON.stringify(config)
        });

        const data = await response.json();
        if (data.success) {
          alert('Email配置保存成功');
          loadEmailConfig();
        } else {
          alert('保存失败：' + data.message);
        }
      } catch (error) {
        console.error('保存Email配置失败：', error);
        alert('保存失败，请重试');
      }
    }

    async function sendTestEmail() {
      try {
        const response = await fetch('/api/test/email', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + app.token }
        });

        const data = await response.json();
        if (data.success) {
          alert('测试邮件发送成功，请查收');
        } else {
          alert('测试邮件发送失败：' + data.message);
        }
      } catch (error) {
        console.error('发送测试邮件失败：', error);
        alert('发送失败，请重试');
      }
    }

    // ===== 企业微信配置相关函数（对齐参考项目）=====
    async function loadWechatWorkConfig() {
      try {
        const response = await fetch('/api/config?type=wechatWork', {
          headers: { 'Authorization': 'Bearer ' + app.token }
        });
        const data = await response.json();
        if (data.success && data.config) {
          document.getElementById('wechatWorkCorpId').value = data.config.corpId || '';
          document.getElementById('wechatWorkAgentId').value = data.config.agentId || '';
          document.getElementById('wechatWorkCorpSecret').value = data.config.corpSecret || '';
          document.getElementById('wechatWorkTouser').value = data.config.touser || '';
          document.getElementById('wechatWorkBaseUrl').value = data.config.baseUrl || WECHAT_WORK_CONFIG.BASE_URL;
        }
      } catch (error) {
        console.error('加载企业微信配置失败：', error);
      }
    }

    async function saveWechatWorkConfig() {
      const config = {
        corpId: document.getElementById('wechatWorkCorpId').value,
        corpSecret: document.getElementById('wechatWorkCorpSecret').value,
        agentId: document.getElementById('wechatWorkAgentId').value,
        touser: document.getElementById('wechatWorkTouser').value,
        baseUrl: document.getElementById('wechatWorkBaseUrl').value
      };

      try {
        const response = await fetch('/api/config?type=wechatWork', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + app.token
          },
          body: JSON.stringify(config)
        });

        const data = await response.json();
        if (data.success) {
          alert('企业微信配置保存成功');
          loadWechatWorkConfig();
        } else {
          alert('保存失败：' + data.message);
        }
      } catch (error) {
        console.error('保存企业微信配置失败：', error);
        alert('保存失败，请重试');
      }
    }

    async function sendTestWechatWork() {
      try {
        const response = await fetch('/api/test/wechatWork', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + app.token }
        });

        const data = await response.json();
        if (data.success) {
          alert('企业微信测试消息发送成功，请查收');
        } else {
          alert('企业微信测试消息发送失败：' + data.message);
        }
      } catch (error) {
        console.error('发送企业微信测试消息失败：', error);
        alert('发送失败，请重试');
      }
    }

    // ===== 通用配置相关函数 =====
    async function loadGeneralConfig() {
      try {
        const response = await fetch('/api/config?type=general', {
          headers: { 'Authorization': 'Bearer ' + app.token }
        });
        const data = await response.json();
        if (data.success && data.config) {
          document.getElementById('remindDays').value = data.config.remindDays || '30,15,7,3,1,0';
          document.getElementById('notifyTime').value = data.config.notifyTime || '10:00';
          document.getElementById('accessPassword').value = data.config.accessPassword || '';
        }
      } catch (error) {
        console.error('加载通用配置失败：', error);
      }
    }

    async function saveGeneralConfig() {
      const config = {
        remindDays: document.getElementById('remindDays').value,
        notifyTime: document.getElementById('notifyTime').value,
        accessPassword: document.getElementById('accessPassword').value
      };

      try {
        const response = await fetch('/api/config?type=general', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + app.token
          },
          body: JSON.stringify(config)
        });

        const data = await response.json();
        if (data.success) {
          alert('通用配置保存成功');
          loadGeneralConfig();
        } else {
          alert('保存失败：' + data.message);
        }
      } catch (error) {
        console.error('保存通用配置失败：', error);
        alert('保存失败，请重试');
      }
    }

    // 页面加载完成后初始化
    window.onload = () => {
      app.init();
      loadWechatWorkConfig();
    };
  </script>
</body>
</html>
`;

// ===== 后端核心逻辑 =====

/**
 * 获取企业微信Access Token（完全复用参考项目逻辑）
 * @param {Object} config 企业微信配置（corpid/corpsecret/baseUrl）
 * @returns {Promise<string>} access_token
 */
async function getWechatWorkAccessToken(config) {
  const { corpId, corpSecret, baseUrl } = {
    ...WECHAT_WORK_CONFIG,
    ...config
  };

  const tokenUrl = `${baseUrl}/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;
  
  try {
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("获取企业微信access_token失败");
    }

    return tokenData.access_token;
  } catch (error) {
    console.error("企业微信Token获取失败：", error.message);
    throw error;
  }
}

/**
 * 发送企业微信通知（对齐参考项目消息发送逻辑）
 * @param {Object} config 企业微信完整配置
 * @param {Object} event 待提醒的事件对象
 * @param {number} daysLeft 剩余天数（可正可负）
 * @returns {Promise<Object>} 发送结果
 */
async function sendWechatWorkNotification(config, event, daysLeft) {
  const { corpId, corpSecret, touser, agentId, baseUrl } = {
    ...WECHAT_WORK_CONFIG,
    ...config
  };

  // 1. 获取Access Token（复用参考项目逻辑）
  let accessToken;
  try {
    accessToken = await getWechatWorkAccessToken({ corpId, corpSecret, baseUrl });
  } catch (error) {
    return { success: false, message: error.message };
  }

  // 2. 构建事件提醒消息内容
  const statusMap = {
    safe: "状态良好",
    warn: "即将到期",
    urgent: "紧急提醒",
    danger: "已逾期"
  };

  // 判定事件状态
  let eventStatus = 'safe';
  if (daysLeft < 0) {
    eventStatus = 'danger';
  } else if (daysLeft <= 3) {
    eventStatus = 'urgent';
  } else if (daysLeft <= 7) {
    eventStatus = 'warn';
  }

  const messageContent = `【事件提醒】
名称：${event.name || '测试事件'}
状态：${statusMap[eventStatus] || "未知状态"}
${daysLeft >= 0 ? `剩余：${daysLeft}天` : `已逾期：${-daysLeft}天`}
备注：${event.notes || "无"}
提醒时间：${new Date().toLocaleString("zh-CN")}`;

  // 3. 构建参考项目一致的消息体
  const messageData = {
    touser: touser || "@all",
    msgtype: "text",
    agentid: parseInt(agentId),
    text: {
      content: messageContent
    },
    safe: 0
  };

  // 4. 发送消息（完全复用参考项目的接口调用逻辑）
  try {
    const messageUrl = `${baseUrl}/cgi-bin/message/send?access_token=${accessToken}`;
    const messageResponse = await fetch(messageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(messageData)
    });

    const messageResult = await messageResponse.json();

    if (messageResult.errcode === 0) {
      return { success: true, message: "企业微信通知发送成功" };
    } else {
      return { success: false, message: messageResult.errmsg };
    }
  } catch (error) {
    console.error("企业微信消息发送失败：", error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 发送Email通知（保留原Resend逻辑）
 * @param {Object} config Email配置
 * @param {Object} event 待提醒事件
 * @param {number} daysLeft 剩余天数
 * @returns {Promise<Object>} 发送结果
 */
async function sendEmailNotification(config, event, daysLeft) {
  if (!config.apiKey || !config.from || !config.to) {
    return { success: false, message: "Email配置不完整" };
  }

  // 判定事件状态
  let eventStatus = '状态良好';
  if (daysLeft < 0) {
    eventStatus = '已逾期';
  } else if (daysLeft <= 3) {
    eventStatus = '紧急提醒';
  } else if (daysLeft <= 7) {
    eventStatus = '即将到期';
  }

  const subject = `【事件提醒】${event.name} - ${eventStatus}`;
  const html = `
    <h3>事件提醒</h3>
    <p>事件名称：${event.name}</p>
    <p>事件状态：${eventStatus}</p>
    <p>${daysLeft >= 0 ? `剩余天数：${daysLeft}天` : `已逾期：${-daysLeft}天`}</p>
    <p>截止日期：${new Date(event.date).toLocaleDateString('zh-CN')}</p>
    <p>备注信息：${event.notes || '无'}</p>
    <p>发送时间：${new Date().toLocaleString('zh-CN')}</p>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        subject: subject,
        html: html
      })
    });

    const data = await response.json();
    if (data.id) {
      return { success: true, message: "Email通知发送成功" };
    } else {
      return { success: false, message: data.error || "Email发送失败" };
    }
  } catch (error) {
    console.error("Email发送失败：", error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 发送所有通知（移除Telegram，保留Email+企业微信）
 * @param {Array} events 待提醒事件列表
 * @param {Object} configs 全局配置
 */
async function sendNotifications(events, configs) {
  const emailConfig = configs.email || {};
  const wechatWorkConfig = configs.wechatWork || {};
  const generalConfig = configs.general || {};
  const remindDays = (generalConfig.remindDays || '30,15,7,3,1,0').split(',').map(Number);

  for (const event of events) {
    // 跳过归档事件
    if (event.archived) continue;

    // 计算剩余天数
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

    // 判定是否需要发送提醒
    if (!remindDays.includes(daysLeft)) continue;

    // 发送Email通知
    if (event.notifyEmail) {
      const emailResult = await sendEmailNotification(emailConfig, event, daysLeft);
      if (emailResult.success) {
        console.log(`Email通知发送成功（事件：${event.name}）`);
      } else {
        console.error(`Email通知发送失败（事件：${event.name}）：`, emailResult.message);
      }
    }

    // 发送企业微信通知
    if (event.notifyWechatWork) {
      const wechatResult = await sendWechatWorkNotification(wechatWorkConfig, event, daysLeft);
      if (wechatResult.success) {
        console.log(`企业微信通知发送成功（事件：${event.name}）`);
      } else {
        console.error(`企业微信通知发送失败（事件：${event.name}）：`, wechatResult.message);
      }
    }
  }
}

/**
 * 处理配置相关请求
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量（KV绑定）
 * @returns {Response} 响应对象
 */
async function handleConfigRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const configType = url.searchParams.get('type');

  // GET请求：读取配置
  if (method === 'GET') {
    try {
      const configStr = await env.KEEP_ALIVE_DB.get(`config_${configType}`);
      const config = configStr ? JSON.parse(configStr) : {};
      return new Response(
        JSON.stringify({ success: true, config: config }),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // POST请求：保存配置
  if (method === 'POST') {
    try {
      const configData = await request.json();
      await env.KEEP_ALIVE_DB.put(`config_${configType}`, JSON.stringify(configData));
      return new Response(
        JSON.stringify({ success: true, message: "配置保存成功" }),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 不支持的请求方法
  return new Response(
    JSON.stringify({ success: false, message: "不支持的请求方法" }),
    { status: 405, headers: DEFAULT_HEADERS }
  );
}

/**
 * 处理事件相关请求
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量（KV绑定）
 * @returns {Response} 响应对象
 */
async function handleEventRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;

  // 获取所有事件
  if (method === 'GET') {
    try {
      const eventsStr = await env.KEEP_ALIVE_DB.get('events');
      const events = eventsStr ? JSON.parse(eventsStr) : [];
      return new Response(
        JSON.stringify({ success: true, events: events }),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 添加/编辑事件
  if (method === 'POST' || method === 'PUT') {
    try {
      const eventData = await request.json();
      const eventsStr = await env.KEEP_ALIVE_DB.get('events');
      const events = eventsStr ? JSON.parse(eventsStr) : [];

      // 编辑事件（根据ID匹配）
      if (method === 'PUT') {
        const eventIndex = events.findIndex(item => item.id === eventData.id);
        if (eventIndex !== -1) {
          events[eventIndex] = eventData;
        } else {
          return new Response(
            JSON.stringify({ success: false, message: "事件不存在" }),
            { status: 404, headers: DEFAULT_HEADERS }
          );
        }
      } else {
        // 添加新事件
        events.push(eventData);
      }

      await env.KEEP_ALIVE_DB.put('events', JSON.stringify(events));
      return new Response(
        JSON.stringify({ success: true, message: method === 'POST' ? "事件添加成功" : "事件编辑成功" }),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 归档/激活事件
  if (method === 'PATCH') {
    try {
      const eventId = url.pathname.split('/').pop();
      const action = url.pathname.includes('archive') ? 'archive' : 'activate';
      const eventsStr = await env.KEEP_ALIVE_DB.get('events');
      const events = eventsStr ? JSON.parse(eventsStr) : [];

      const eventIndex = events.findIndex(item => item.id === eventId);
      if (eventIndex === -1) {
        return new Response(
          JSON.stringify({ success: false, message: "事件不存在" }),
          { status: 404, headers: DEFAULT_HEADERS }
        );
      }

      events[eventIndex].archived = action === 'archive';
      await env.KEEP_ALIVE_DB.put('events', JSON.stringify(events));
      return new Response(
        JSON.stringify({ success: true, message: action === 'archive' ? "事件归档成功" : "事件激活成功" }),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 删除单个事件
  if (method === 'DELETE' && url.pathname.includes('/events/') && !url.pathname.includes('clear-expired')) {
    try {
      const eventId = url.pathname.split('/').pop();
      const eventsStr = await env.KEEP_ALIVE_DB.get('events');
      const events = eventsStr ? JSON.parse(eventsStr) : [];

      const newEvents = events.filter(item => item.id !== eventId);
      await env.KEEP_ALIVE_DB.put('events', JSON.stringify(newEvents));
      return new Response(
        JSON.stringify({ success: true, message: "事件删除成功" }),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 清理已逾期归档事件
  if (method === 'DELETE' && url.pathname.includes('clear-expired')) {
    try {
      const eventsStr = await env.KEEP_ALIVE_DB.get('events');
      const events = eventsStr ? JSON.parse(eventsStr) : [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const newEvents = events.filter(event => {
        // 保留未归档事件，或已归档但未逾期的事件
        if (!event.archived) return true;
        const eventDate = new Date(event.date);
        const daysLeft = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        return daysLeft >= 0;
      });

      await env.KEEP_ALIVE_DB.put('events', JSON.stringify(newEvents));
      return new Response(
        JSON.stringify({ success: true, message: "已清理已逾期归档事件" }),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 不支持的请求方法
  return new Response(
    JSON.stringify({ success: false, message: "不支持的请求方法" }),
    { status: 405, headers: DEFAULT_HEADERS }
  );
}

/**
 * 处理测试相关请求
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量（KV绑定）
 * @returns {Response} 响应对象
 */
async function handleTestRequest(request, env) {
  const url = new URL(request.url);
  const testType = url.pathname.split('/').pop();

  // 测试Email发送
  if (testType === 'email') {
    try {
      const emailConfigStr = await env.KEEP_ALIVE_DB.get('config_email');
      const emailConfig = emailConfigStr ? JSON.parse(emailConfigStr) : {};

      const testEvent = {
        name: "测试事件",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: "这是一封测试邮件，用于验证Email通知功能是否正常"
      };

      const result = await sendEmailNotification(emailConfig, testEvent, 7);
      return new Response(
        JSON.stringify(result),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 测试企业微信发送
  if (testType === 'wechatWork') {
    try {
      const wechatConfigStr = await env.KEEP_ALIVE_DB.get('config_wechatWork');
      const wechatConfig = wechatConfigStr ? JSON.parse(wechatConfigStr) : {};

      const testEvent = {
        name: "测试事件",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: "这是一条企业微信测试消息，用于验证通知功能是否正常"
      };

      const result = await sendWechatWorkNotification(wechatConfig, testEvent, 7);
      return new Response(
        JSON.stringify(result),
        { headers: DEFAULT_HEADERS }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: DEFAULT_HEADERS }
      );
    }
  }

  // 不支持的测试类型
  return new Response(
    JSON.stringify({ success: false, message: "不支持的测试类型" }),
    { status: 404, headers: DEFAULT_HEADERS }
  );
}

/**
 * 处理定时任务（Cloudflare Workers Cron Trigger）
 * @param {Object} env 环境变量（KV绑定）
 */
async function handleCronTask(env) {
  try {
    // 读取所有配置
    const emailConfigStr = await env.KEEP_ALIVE_DB.get('config_email');
    const wechatWorkConfigStr = await env.KEEP_ALIVE_DB.get('config_wechatWork');
    const generalConfigStr = await env.KEEP_ALIVE_DB.get('config_general');
    const eventsStr = await env.KEEP_ALIVE_DB.get('events');

    const configs = {
      email: emailConfigStr ? JSON.parse(emailConfigStr) : {},
      wechatWork: wechatWorkConfigStr ? JSON.parse(wechatWorkConfigStr) : {},
      general: generalConfigStr ? JSON.parse(generalConfigStr) : {}
    };

    const events = eventsStr ? JSON.parse(eventsStr) : [];

    // 验证当前时间是否符合通知时间
    const now = new Date();
    const notifyTime = configs.general.notifyTime || '10:00';
    const [notifyHour, notifyMinute] = notifyTime.split(':').map(Number);

    if (now.getHours() === notifyHour && now.getMinutes() === notifyMinute) {
      await sendNotifications(events, configs);
      console.log("定时通知任务执行完成");
    }
  } catch (error) {
    console.error("定时任务执行失败：", error.message);
  }
}

/**
 * 主请求处理函数
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量（KV绑定）
 * @param {Object} ctx 上下文对象
 * @returns {Response} 响应对象
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 处理定时任务（Cron Trigger）
  if (pathname === '/cron' && request.method === 'POST') {
    await handleCronTask(env);
    return new Response(
      JSON.stringify({ success: true, message: "定时任务执行完成" }),
      { headers: DEFAULT_HEADERS }
    );
  }

  // 处理API请求
  if (pathname.startsWith('/api/')) {
    // 配置相关API
    if (pathname.startsWith('/api/config')) {
      return handleConfigRequest(request, env);
    }

    // 事件相关API
    if (pathname.startsWith('/api/events')) {
      return handleEventRequest(request, env);
    }

    // 测试相关API
    if (pathname.startsWith('/api/test')) {
      return handleTestRequest(request, env);
    }

    // 未知API
    return new Response(
      JSON.stringify({ success: false, message: "未知API接口" }),
      { status: 404, headers: DEFAULT_HEADERS }
    );
  }

  // 返回前端页面
  return new Response(HTML_CONTENT, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8'
    }
  });
}

// 注册Fetch事件监听
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env, event.ctx));
});
