/* 对局/回放音效（用户提供的 WAV，2026-11-17）
   浏览器策略：音频必须由用户手势解锁；这里第一次点击/触摸时播一次点击音，
   之后的召唤/攻击/发动等动作音就能正常播放。 */
(function () {
    var BASE = 'audio/duel/';
    var MAP = {
        click: 'click.wav',
        summon: 'summon.wav',
        specialSummon: 'special-summon.wav',
        effect: 'activate-effect.wav',
        trapQuick: 'activate-trap-quick.wav',
        flipMonster: 'flip-monster.wav',
        transmission: 'transmission.wav',
        attackBall: 'attack-ball.wav',
        hpChange: 'hp-change.wav',
        hpDone: 'hp-done.wav',
        move: 'move.wav',
        destroy: 'destroy.wav',
        phase: 'phase.wav'
    };
    var VOL = {
        click: 0.38, summon: 0.62, specialSummon: 0.62,
        effect: 0.55, trapQuick: 0.6, flipMonster: 0.5,
        transmission: 0.42, attackBall: 0.62,
        hpChange: 0.5, hpDone: 0.5,
        move: 0.4, destroy: 0.6, phase: 0.45
    };
    // 血量动画固定约 1 秒；原 hp-change.wav 长 1.77s，播放时加速到动画长度
    var RATE = { hpChange: 1.7 };
    var enabled = true;
    try { enabled = localStorage.getItem('siro_duel_sfx') !== '0'; } catch (e) {}
    var preloaded = {};

    function preload() {
        Object.keys(MAP).forEach(function (k) {
            try {
                var a = new Audio(BASE + MAP[k]);
                a.preload = 'auto';
                a.volume = VOL[k] || 0.5;
                preloaded[k] = a;
            } catch (e) {}
        });
    }

    function play(name) {
        if (!enabled) return;
        var file = MAP[name];
        if (!file) return;
        try {
            // 每次都新建，允许攻击球/点击音重叠
            var a = new Audio(BASE + file);
            a.volume = VOL[name] !== undefined ? VOL[name] : 0.5;
            if (RATE[name]) {
                try { a.playbackRate = RATE[name]; } catch (e) {}
            }
            var p = a.play();
            if (p && p.catch) p.catch(function () {});
        } catch (e) {}
    }

    function setEnabled(on) {
        enabled = !!on;
        try { localStorage.setItem('siro_duel_sfx', enabled ? '1' : '0'); } catch (e) {}
        updateBtn();
    }
    function updateBtn() {
        var b = document.getElementById('duelSfxBtn');
        if (!b) return;
        b.textContent = enabled ? '🔊' : '🔇';
        b.title = enabled ? '对局音效：开（点击关闭 / M）' : '对局音效：关（点击开启 / M）';
        b.style.opacity = enabled ? '0.6' : '0.35';
    }
    function mountBtn() {
        if (document.getElementById('duelSfxBtn')) return;
        var b = document.createElement('button');
        b.id = 'duelSfxBtn';
        b.type = 'button';
        b.setAttribute('aria-label', '对局音效开关');
        b.style.cssText = 'position:fixed;right:9px;bottom:9px;z-index:2147483000;' +
            'width:30px;height:30px;border-radius:50%;border:1px solid rgba(212,175,55,.5);' +
            'background:rgba(12,10,16,.82);color:#FFD700;font-size:15px;line-height:28px;' +
            'padding:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);';
        b.onclick = function (e) {
            e.stopPropagation();
            setEnabled(!enabled);
            if (enabled) play('click');
        };
        document.body.appendChild(b);
        updateBtn();
    }

    preload();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountBtn);
    } else {
        mountBtn();
    }

    // 第一次手势解锁（播放一次很轻的点击音）
    var unlocked = false;
    function unlock() {
        if (unlocked) return;
        unlocked = true;
        // 只解锁，不在这里出声；真正的点击音交给下面的 click 监听，避免第一次点按钮双响
    }
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('touchstart', unlock, { capture: true, passive: true });

    // UI 按钮点击音（全局捕获，动态生成的按钮也生效）
    document.addEventListener('click', function (e) {
        try {
            var t = e.target;
            var el = t && t.closest ? t.closest('button,a,[role="button"],.rp-ctl,.yp-menu-item') : null;
            if (!el || el.id === 'duelSfxBtn' || el.disabled) return;
            if (el.closest && el.closest('.no-sfx')) return;
            play('click');
        } catch (err) {}
    }, true);

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'm' && e.key !== 'M') return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        setEnabled(!enabled);
    });

    window.__duelSfx = {
        play: play,
        setEnabled: setEnabled,
        isEnabled: function () { return enabled; },
        unlock: function () { unlocked = true; }
    };
})();
