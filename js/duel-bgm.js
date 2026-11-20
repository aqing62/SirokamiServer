/* 决斗页背景音乐（2026-11-20）
 *
 * 播放：进决斗页后等第一次点击/按键再开始（浏览器自动播放策略），循环播放，默认音量 0.35。
 *
 * 关于"不让人下载"：
 *   音频文件放在**站点根目录之外**（服务器 /root/servers/bgm，见 vote_server.py 的 BGM_DIR），
 *   静态路由永远取不到；页面只能向 /api/bgm/duel 要，而且要先领一个
 *   「绑定本浏览器 cookie + 30 分钟有效」的令牌（/api/bgm/token）。
 *   效果：右键另存 / 复制链接转发 / 直接猜路径都拿不到；但浏览器能播的东西
 *   技术上总能被录下来（开发者工具、录音），这条线只能防君子。
 *
 * 开关：右下角 🎵 按钮（在音效按钮左边），或按 B 键；偏好记在 localStorage。
 */
(function () {
    var KEY = 'duel';
    var VOL = 0.35;
    var LS = 'siro_bgm_muted';
    var audio = null;
    var muted = false;
    var loading = false;
    var lastTry = 0;
    var retried = false;

    try { muted = localStorage.getItem(LS) === '1'; } catch (e) {}

    function el() {
        if (audio) return audio;
        audio = document.createElement('audio');
        audio.id = 'ypBgm';
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = VOL;
        audio.style.display = 'none';
        // 图标按**实际是否在响**显示（默认还没开始 → 🔇）
        audio.addEventListener('play', updateBtn);
        audio.addEventListener('pause', updateBtn);
        audio.addEventListener('playing', updateBtn);
        // 令牌过期 / 网络抖动：换一个新令牌重试一次（之后就不再骚扰接口）
        audio.addEventListener('error', function () {
            if (retried) return;
            retried = true;
            setTimeout(function () { load(true); }, 800);
        });
        document.body.appendChild(audio);
        return audio;
    }

    function playing() {
        return !!(audio && audio.src && !audio.paused && !audio.ended);
    }

    function load(force) {
        if (loading) return;
        loading = true;
        var url = '/api/bgm/token?key=' + encodeURIComponent(KEY);
        fetch(url, { cache: 'no-store', credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) throw new Error('token ' + r.status);
                return r.json();
            })
            .then(function (j) {
                if (!j || !j.t) throw new Error('no token');
                var a = el();
                a.src = '/api/bgm/' + encodeURIComponent(KEY) + '?t=' + encodeURIComponent(j.t);
                a.muted = muted;
                if (force) retried = false;
                loading = false;
                if (!muted) {
                    var p = a.play();
                    if (p && p.catch) p.catch(function () { /* 等下一次手势再试 */ });
                }
            })
            .catch(function () {
                loading = false;
                if (force) retried = true;      // 强制重试也失败 → 不再循环
            });
    }

    function start() {
        if (muted) return;                       // 静音状态不下载，省流量
        // 先停「匹配等待」音乐，避免两首叠在一起
        try { if (window.__ypWaitBgm && window.__ypWaitBgm.stop) window.__ypWaitBgm.stop(); } catch (e) {}
        var now = Date.now();
        if (loading || now - lastTry < 2500) return;
        lastTry = now;
        load(false);
    }

    function stop() {
        if (audio) { try { audio.pause(); } catch (e) {} }
    }

    function setMuted(m) {
        muted = !!m;
        try { localStorage.setItem(LS, muted ? '1' : '0'); } catch (e) {}
        if (audio) {
            audio.muted = muted;
            if (muted) {
                try { audio.pause(); } catch (e) {}
            } else if (audio.src) {
                var p = audio.play();
                if (p && p.catch) p.catch(function () {});
            } else {
                start();
            }
        } else if (!muted) {
            start();
        }
        updateBtn();
    }

    function updateBtn() {
        var b = document.getElementById('duelBgmBtn');
        if (!b) return;
        // 按**实际是否在响**显示：没响就是 🔇，在响才是 🎵
        var on = playing();
        b.textContent = on ? '🎵' : '🔇';
        b.title = on ? '背景音乐：开（点击关闭 / B）' : '背景音乐：关（点击开启 / B）';
        b.style.opacity = on ? '0.85' : '0.4';
    }

    function mountBtn() {
        if (document.getElementById('duelBgmBtn')) return;
        var b = document.createElement('button');
        b.id = 'duelBgmBtn';
        b.type = 'button';
        b.setAttribute('aria-label', '背景音乐开关');
        // 紧挨着音效按钮（右下角），不挡场地
        b.style.cssText = 'position:fixed;right:45px;bottom:9px;z-index:2147483000;' +
            'width:30px;height:30px;border-radius:50%;border:1px solid rgba(212,175,55,.5);' +
            'background:rgba(12,10,16,.82);color:#FFD700;font-size:14px;line-height:28px;' +
            'padding:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);';
        b.onclick = function (e) {
            e.stopPropagation();
            setMuted(playing());        // 在响 → 关；没响 → 开
        };
        document.body.appendChild(b);
        updateBtn();
    }

    // PATCH(白神服) 2026-11-20: 不再「第一次手势就放」—— 决斗页开局前是
    //   「匹配等待音乐」(wait-bgm.js) 的时段，对局 BGM 由 duel-client 的
    //   setUiPhase('duel') 在真正开局时调用 start() 切换过来。
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'b' && e.key !== 'B') return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        setMuted(playing());
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountBtn);
    } else {
        mountBtn();
    }

    // 调试/测试用
    window.__ypDuelBgm = {
        start: start,
        stop: stop,
        setMuted: setMuted,
        isPlaying: playing,
        element: function () { return audio; }
    };
})();
