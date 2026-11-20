/* 匹配等待音乐（2026-11-20）
 *
 * 用途：还没开局时（大厅 / 房间里等对手、等准备）放这首，开局瞬间停掉、换成对局 BGM。
 * 和另外两首一样走令牌接口，文件在站点根目录之外，右键另存/复制链接都拿不到。
 *
 * 与其他 BGM 的关系（互相排斥，不会两首一起响）：
 *   - 本脚本 start() 会先停对局 BGM；
 *   - 对局 BGM 的 start() 会先停本脚本；
 *   - duel-client 的 setUiPhase() 负责切换：room → 等待音乐，duel → 对局音乐。
 *
 * 默认**开启**（用户要求）：进页面就尝试播；浏览器要求先有交互，所以第一次点击/按键
 * 就会响（按钮图标按实际有没有声音显示）。
 *
 * 开关：右下角 🎵 按钮，或按 B；偏好存 localStorage.siro_wait_bgm_off
 */
(function () {
    var KEY = 'wait';
    var VOL = 0.3;
    var LS = 'siro_wait_bgm_off';

    var audio = null;
    var off = false;            // 用户明确关掉才记住
    var loading = false;
    var retried = false;
    var starting = false;

    try { off = localStorage.getItem(LS) === '1'; } catch (e) {}

    function playing() {
        return !!(audio && audio.src && !audio.paused && !audio.ended);
    }

    function el() {
        if (audio) return audio;
        audio = document.createElement('audio');
        audio.id = 'ypWaitBgm';
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = VOL;
        audio.style.display = 'none';
        audio.addEventListener('play', updateBtn);
        audio.addEventListener('pause', updateBtn);
        audio.addEventListener('playing', updateBtn);
        // 令牌过期 / 网络抖动：换一个新令牌重试一次
        audio.addEventListener('error', function () {
            if (retried || off) return;
            retried = true;
            setTimeout(function () { loadFile(true); }, 800);
        });
        document.body.appendChild(audio);
        return audio;
    }

    function loadFile(force) {
        if (loading || off) return;
        loading = true;
        fetch('/api/bgm/token?key=' + encodeURIComponent(KEY), {
            cache: 'no-store', credentials: 'same-origin'
        })
            .then(function (r) { if (!r.ok) throw new Error('token ' + r.status); return r.json(); })
            .then(function (j) {
                if (!j || !j.t) throw new Error('no token');
                if (off) { loading = false; return; }
                var a = el();
                a.src = '/api/bgm/' + encodeURIComponent(KEY) + '?t=' + encodeURIComponent(j.t);
                a.muted = false;
                if (force) retried = false;
                loading = false;
                var p = a.play();
                if (p && p.catch) p.catch(function () { /* 等下一次手势 */ });
            })
            .catch(function () { loading = false; });
    }

    function start() {
        if (off || playing()) return;
        // 先停对局 BGM，避免两首叠在一起
        try { if (window.__ypDuelBgm && window.__ypDuelBgm.stop) window.__ypDuelBgm.stop(); } catch (e) {}
        if (audio && audio.src) {
            var p = audio.play();
            if (p && p.catch) p.catch(function () {});
            return;
        }
        loadFile(false);
    }

    function stop() {
        if (audio) { try { audio.pause(); } catch (e) {} }
    }

    function setOff(v) {
        off = !!v;
        try { localStorage.setItem(LS, off ? '1' : '0'); } catch (e) {}
        if (off) stop(); else start();
        updateBtn();
    }

    function updateBtn() {
        var b = document.getElementById('waitBgmBtn');
        if (!b) return;
        var on = playing();
        b.textContent = on ? '🎵' : '🔇';
        b.title = on ? '等待音乐：开（点击关闭 / B）' : '等待音乐：关（点击开启 / B）';
        b.style.opacity = on ? '0.85' : '0.4';
    }

    function mountBtn() {
        if (document.getElementById('waitBgmBtn')) return;
        // 决斗页右下角已经有 音效(9px) / 对局BGM(45px) 两个按钮 → 排到 81px
        var right = /duel/i.test(location.pathname) ? 81 : 9;
        var b = document.createElement('button');
        b.id = 'waitBgmBtn';
        b.type = 'button';
        b.setAttribute('aria-label', '匹配等待音乐开关');
        b.style.cssText = 'position:fixed;right:' + right + 'px;bottom:9px;z-index:2147483000;' +
            'width:30px;height:30px;border-radius:50%;border:1px solid rgba(212,175,55,.5);' +
            'background:rgba(12,10,16,.82);color:#FFD700;font-size:14px;line-height:28px;' +
            'padding:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);';
        b.onclick = function (e) {
            e.stopPropagation();
            setOff(playing());
        };
        document.body.appendChild(b);
        updateBtn();
    }

    // 默认开启：进页面先试一次（可能被自动播放策略拦），之后任何手势再试
    function kick() {
        start();
    }
    document.addEventListener('pointerdown', kick, { capture: true, passive: true });
    document.addEventListener('touchstart', kick, { capture: true, passive: true });
    document.addEventListener('keydown', kick, { capture: true });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'b' && e.key !== 'B') return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        setOff(playing());
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { mountBtn(); kick(); });
    } else {
        mountBtn(); kick();
    }

    window.__ypWaitBgm = {
        start: start,
        stop: stop,
        setOff: setOff,
        isPlaying: playing,
        element: function () { return audio; }
    };
})();
