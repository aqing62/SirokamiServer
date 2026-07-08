/**
 * 白神服Sirokami — 服务器实时对局监控
 */

var POLL_INTERVAL_LIVE = 5000;
var STORAGE_KEY = 'live_duels_admin';
var adminCredentials = null;
var livePollTimer = null;
var liveDuelsOpen = false;

function initLiveDuelsModule() {
    restoreAdminSession();
    var trigger = document.getElementById('liveDuelsTrigger');
    if (trigger) trigger.onclick = openLiveDuels;
    document.getElementById('liveDuelsClose').onclick = closeLiveDuels;
    document.getElementById('liveDuelsOverlay').onclick = function(e) {
        if (e.target === this) closeLiveDuels();
    };
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && liveDuelsOpen) closeLiveDuels();
    });
    document.getElementById('adminLoginBtn').onclick = adminLogin;
    document.getElementById('adminLogoutBtn').onclick = adminLogout;
    document.getElementById('adminShoutBtn').onclick = sendShout;
    document.getElementById('adminShoutInput').onkeydown = function(e) {
        if (e.key === 'Enter') sendShout();
    };
    updateAdminUI();
}

function openLiveDuels() {
    document.getElementById('liveDuelsOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
    liveDuelsOpen = true;
    fetchLiveRooms();
    startPolling();
}

function closeLiveDuels() {
    document.getElementById('liveDuelsOverlay').classList.remove('show');
    document.body.style.overflow = '';
    liveDuelsOpen = false;
    stopPolling();
}

async function fetchLiveRooms() {
    try {
        var resp = await fetch('/api/liverooms');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var data = await resp.json();
        renderLiveDuels(data.rooms || []);
    } catch (e) {
        console.error(e);
        document.getElementById('liveDuelsBody').innerHTML = '<div class="loading-hint">无法获取对局数据</div>';
    }
}

function startPolling() {
    if (livePollTimer) return;
    livePollTimer = setInterval(fetchLiveRooms, POLL_INTERVAL_LIVE);
}

function stopPolling() {
    if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
}

function renderLiveDuels(rooms) {
    var body = document.getElementById('liveDuelsBody');
    var countEl = document.getElementById('liveDuelsCount');
    if (!rooms || rooms.length === 0) {
        countEl.textContent = '0';
        body.innerHTML = '<div class="empty-message">当前没有进行中的对局</div>';
        return;
    }
    var active = rooms.filter(function(r) { return r.users && r.users.length > 0; });
    countEl.textContent = active.length;
    if (active.length === 0) {
        body.innerHTML = '<div class="empty-message">当前没有进行中的对局</div>';
        return;
    }
    var html = '<div style="overflow-x:auto;"><table class="live-duels-table"><thead><tr>' +
        '<th>房间名</th><th>玩家1</th><th>LP</th><th>玩家2</th><th>LP</th>' +
        '<th>状态</th><th>卡组1</th><th>卡组2</th>';
    if (adminCredentials) html += '<th>操作</th>';
    html += '</tr></thead><tbody>';

    active.forEach(function(room) {
        var players = room.users.filter(function(u) { return u.pos >= 0 && u.pos <= 3; });
        var p1 = players.find(function(p) { return p.pos === 0; });
        var p2 = players.find(function(p) { return p.pos === 1; });
        var isDeath = room.istart && room.istart.indexOf('/Death') >= 0;
        var isDueling = room.istart && room.istart.indexOf('Turn:') >= 0;
        var rowClass = isDeath ? 'death' : (isDueling ? 'dueling' : 'waiting');
        var deck1 = p1 && p1.deck ? parseDeckInfo(p1.deck) : '—';
        var deck2 = p2 && p2.deck ? parseDeckInfo(p2.deck) : '—';
        html += '<tr class="' + rowClass + '">' +
            '<td>' + esc(room.roomname.replace(/\$.*$/, '')) + '</td>' +
            '<td>' + (p1 ? esc(p1.name) : '—') + '</td>' +
            '<td class="' + lpClass(p1) + '">' + fmtLp(p1) + '</td>' +
            '<td>' + (p2 ? esc(p2.name) : '—') + '</td>' +
            '<td class="' + lpClass(p2) + '">' + fmtLp(p2) + '</td>' +
            '<td>' + fmtInfo(room.istart) + '</td>' +
            '<td>' + deck1 + '</td>' +
            '<td>' + deck2 + '</td>';
        if (adminCredentials) {
            var rid = escAttr(room.roomid || room.roomname);
            html += '<td class="actions-cell">' +
                '<button class="action-btn-sm death-btn" onclick="window._death(\'' + rid + '\')">死三</button>' +
                '<button class="action-btn-sm kick-btn" onclick="window._kick(\'' + rid + '\')">关闭</button>' +
                '</td>';
        }
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    body.innerHTML = html;
}

function fmtLp(p) { return (p && p.status) ? String(p.status.lp || 0) : '—'; }
function lpClass(p) {
    var lp = p && p.status ? p.status.lp : null;
    if (lp == null) return '';
    if (lp >= 5000) return 'lp-high';
    if (lp >= 2000) return 'lp-mid';
    return 'lp-low';
}

function parseDeckInfo(d) {
    if (!d) return '—';
    try {
        var parts = d.replace('ydke://', '').split('!');
        var mc = Math.floor((parts[0] || '').length * 3 / 16);
        var ec = Math.floor((parts[1] || '').length * 3 / 16);
        return '主' + mc + '·额' + ec;
    } catch(e) {}
    return '已上传';
}

function fmtInfo(s) {
    if (!s || s === 'wait') return '等待中';
    if (s === 'start') return '已结束';
    var m = s.match(/Duel:(\d+)\s*(.*)/);
    if (!m) return s;
    var rest = m[2] || '';
    if (rest.indexOf('Turn:') === 0) {
        var tm = rest.match(/Turn:(\d+)(?:\/(\d+|Death))?/);
        if (tm) {
            var t = '第' + m[1] + '局 T' + tm[1];
            if (tm[2] === 'Death') t += ' <span style="color:#e74c3c">死</span>';
            else if (tm[2]) t += ' <span style="color:#e67e22">' + tm[2] + '</span>';
            return t;
        }
    }
    if (rest === 'Siding') return '第'+m[1]+'局 换备';
    if (rest === 'Finger') return '第'+m[1]+'局 猜拳';
    if (rest === 'FirstGo') return '第'+m[1]+'局 选先';
    return s;
}

function restoreAdminSession() {
    try { var s = localStorage.getItem(STORAGE_KEY); if (s) adminCredentials = JSON.parse(s); } catch(e) {}
}

async function adminLogin() {
    var u = document.getElementById('adminUsername').value.trim();
    var p = document.getElementById('adminPassword').value;
    if (!u || !p) { toast('请输入账号和密码'); return; }
    try {
        var qs = 'username=' + encodeURIComponent(u) + '&pass=' + encodeURIComponent(p) + '&shout=test';
        var r = await fetch('/api/admin?' + qs);
        var d = await r.json();
        if (d && d[0] && d[0].indexOf('密码') >= 0) { toast('账号或密码错误'); return; }
        adminCredentials = { username: u, password: p };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(adminCredentials));
        updateAdminUI();
        toast('管理员登录成功');
        fetchLiveRooms();
    } catch(e) { toast('连接失败'); }
}

function adminLogout() {
    adminCredentials = null; localStorage.removeItem(STORAGE_KEY);
    updateAdminUI(); toast('已退出'); fetchLiveRooms();
}

async function sendShout() {
    var inp = document.getElementById('adminShoutInput');
    var t = inp.value.trim();
    if (!t || !adminCredentials) return;
    try {
        var qs = 'username=' + encodeURIComponent(adminCredentials.username) + '&pass=' + encodeURIComponent(adminCredentials.password) + '&shout=' + encodeURIComponent(t);
        var r = await fetch('/api/admin?' + qs);
        var d = await r.json();
        toast(d && d[0] === 'shout ok' ? '广播成功' : '失败');
        if (d && d[0] === 'shout ok') inp.value = '';
    } catch(e) { toast('操作失败'); }
}

window._death = function(rid) {
    if (!adminCredentials) return;
    if (!confirm('确定对该房间开始死三倒计时？')) return;
    var qs = 'username=' + encodeURIComponent(adminCredentials.username) + '&pass=' + encodeURIComponent(adminCredentials.password) + '&death=' + encodeURIComponent(rid);
    fetch('/api/admin?' + qs).then(function(r) { return r.json(); }).then(function(d) {
        toast(d && d[0] === 'death ok' ? '死三已启动' : '失败'); fetchLiveRooms();
    }).catch(function() { toast('操作失败'); });
};

window._kick = function(rid) {
    if (!adminCredentials) return;
    if (!confirm('确定关闭该房间？')) return;
    var qs = 'username=' + encodeURIComponent(adminCredentials.username) + '&pass=' + encodeURIComponent(adminCredentials.password) + '&kick=' + encodeURIComponent(rid);
    fetch('/api/admin?' + qs).then(function(r) { return r.json(); }).then(function(d) {
        toast(d && d[0] === 'kick ok' ? '已关闭' : '失败'); fetchLiveRooms();
    }).catch(function() { toast('操作失败'); });
};

function updateAdminUI() {
    var lf = document.getElementById('adminLoginForm');
    var li = document.getElementById('adminLoggedIn');
    if (adminCredentials) {
        lf.style.display = 'none'; li.style.display = 'flex';
        document.getElementById('adminNameDisplay').textContent = adminCredentials.username;
    } else {
        lf.style.display = 'flex'; li.style.display = 'none';
    }
}

function toast(msg) {
    var t = document.getElementById('liveDuelsToast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.style.display = 'none'; }, 3000);
}

function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function escAttr(s) { return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
