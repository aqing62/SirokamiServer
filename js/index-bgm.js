/* 首页背景音乐（2026-11-20）
 *
 * 歌单不写死：服务端扫 /root/servers/bgm/index/ 目录，按文件名排序**轮流播放**。
 * 往那个目录里放/删 mp3，刷新页面就生效，不用改代码、不用重启。
 *
 * 取音频和决斗页一样要令牌（绑定浏览器 cookie + 30 分钟），文件不在站点根目录里，
 * 所以右键另存 / 复制链接转发都拿不到。
 *
 * 开关：右下角按钮，或按 B 键；偏好存 localStorage。
 *   图标按**实际是否在响**显示：没响就是 🔇，在响才是 🎵。
 *   （默认"不开"：浏览器要求先有点击/按键才允许出声，所以进页面时是 🔇，
 *    用户点一下页面或点按钮才开始。）
 */
(function () {
    var SCENE = 'index';
    var VOL = 0.3;
    var LS = 'siro_index_bgm_off';

    var audio = null;
    var tracks = [];        // [{k, name}]
    var idx = 0;
    var off = false;        // 用户明确关掉（不是"还没开始"）
    var started = false;
    var loadingList = false;
    var failCount = 0;

    try { off = localStorage.getItem(LS) === '1'; } catch (e) {}

    function playing() {
        return !!(audio && audio.src && !audio.paused && !audio.ended);
    }

    function el() {
        if (audio) return audio;
        audio = document.createElement('audio');
        audio.id = 'indexBgm';
        audio.preload = 'auto';
        audio.volume = VOL;
        audio.style.display = 'none';
        audio.addEventListener('ended', function () { next(1); });
        audio.addEventListener('play', updateBtn);
        audio.addEventListener('pause', updateBtn);
        audio.addEventListener('playing', updateBtn);
        document.body.appendChild(audio);
        return audio;
    }

    function loadList() {
        if (loadingList) return Promise.resolve(tracks);
        loadingList = true;
        return fetch('/api/bgm/list?scene=' + encodeURIComponent(SCENE), {
            cache: 'no-store', credentials: 'same-origin'
        })
            .then(function (r) { if (!r.ok) throw new Error('list ' + r.status); return r.json(); })
            .then(function (j) {
                loadingList = false;
                tracks = ((j && j.tracks) || []).filter(function (t) { return t && t.k; });
                updateBtn();
                return tracks;
            })
            .catch(function () { loadingList = false; tracks = []; return tracks; });
    }

    function playTrack(i) {
        if (!tracks.length || off) return Promise.resolve();
        idx = ((i % tracks.length) + tracks.length) % tracks.length;
        var t = tracks[idx];
        var a = el();
        return fetch('/api/bgm/token?key=' + encodeURIComponent(t.k), {
            cache: 'no-store', credentials: 'same-origin'
        })
            .then(function (r) { if (!r.ok) throw new Error('token ' + r.status); return r.json(); })
            .then(function (j) {
                if (!j || !j.t) throw new Error('no token');
                if (off) return;
                a.src = '/api/bgm/' + encodeURIComponent(t.k) + '?t=' + encodeURIComponent(j.t);
                a.muted = false;
                failCount = 0;
                var p = a.play();
                if (p && p.catch) p.catch(function () { /* 等下一次手势 */ });
                updateBtn();
            })
            .catch(function () {
                // 这首歌拿不到就跳过（最多连续跳完一轮，避免无线循环请求）
                failCount++;
                if (failCount < tracks.length) setTimeout(function () { next(1); }, 800);
            });
    }

    function next(step) {
        if (!tracks.length || off) return;
        playTrack(idx + (step || 1));
    }

    function start() {
        if (off || started) return;
        started = true;
        loadList().then(function (list) {
            if (!list.length) { started = false; return; }   // 还没放歌 → 静静地不播
            // 每次进首页换一首开头：用日期做偏移，避免总从第一首开始
            var day = Math.floor(Date.now() / 86400000);
            playTrack(day % list.length);
        });
    }

    function setOff(v) {
        off = !!v;
        try { localStorage.setItem(LS, off ? '1' : '0'); } catch (e) {}
        if (off) {
            if (audio) { try { audio.pause(); } catch (e) {} }
            updateBtn();
        } else {
            if (audio && audio.src) {
                var p = audio.play();
                if (p && p.catch) p.catch(function () {});
                updateBtn();
            } else {
                start();
            }
        }
    }

    function updateBtn() {
        var b = document.getElementById('indexBgmBtn');
        if (!b) return;
        if (!tracks.length) { b.style.display = 'none'; return; }   // 没歌：不显示（点了也没反应）
        b.style.display = '';
        var on = playing();
        b.textContent = on ? '🎵' : '🔇';
        b.title = on
            ? ('背景音乐：开 · ' + (tracks[idx] ? tracks[idx].name : '') + '（点击关闭 / B）')
            : '背景音乐：关（点击开启 / B）';
        b.style.opacity = on ? '0.85' : '0.4';
    }

    function mountBtn() {
        if (document.getElementById('indexBgmBtn')) return;
        var b = document.createElement('button');
        b.id = 'indexBgmBtn';
        b.type = 'button';
        b.setAttribute('aria-label', '背景音乐开关');
        b.style.cssText = 'position:fixed;right:9px;bottom:9px;z-index:2147483000;' +
            'width:32px;height:32px;border-radius:50%;border:1px solid rgba(212,175,55,.5);' +
            'background:rgba(12,10,16,.82);color:#FFD700;font-size:15px;line-height:30px;' +
            'padding:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);';
        b.style.display = 'none';       // 歌单加载出来再显示
        b.onclick = function (e) {
            e.stopPropagation();
            setOff(playing());          // 在响 → 关；没响 → 开
        };
        document.body.appendChild(b);
        loadList().then(function (list) {
            if (list.length) { b.style.display = ''; updateBtn(); }
        });
    }

    // 任何手势都可以开始（按钮点击自己会走 setOff，不受影响）
    document.addEventListener('pointerdown', start, { capture: true, passive: true });
    document.addEventListener('touchstart', start, { capture: true, passive: true });
    document.addEventListener('keydown', start, { capture: true });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'b' && e.key !== 'B') return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        setOff(playing());
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountBtn);
    } else {
        mountBtn();
    }

    window.__indexBgm = {
        start: start,
        setOff: setOff,
        next: function () { next(1); },
        isPlaying: playing,
        tracks: function () { return tracks.slice(); },
        element: function () { return audio; }
    };
})();
