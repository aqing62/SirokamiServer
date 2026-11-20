/**
 * 白神服Sirokami — 玩家论坛模块
 * 4个分区 + 发帖/回复 + 卡组嵌入 + 卡片嵌入 + 个人中心 + 头像裁剪
 */
function initCommunityModule() {
    'use strict';

    var wrapper = document.getElementById('communityWrapper');
    var SECTIONS = ['all', 'casual', 'feedback', 'deck', 'qa'];
    var SECTION_NAMES = { all: '全部帖子', casual: '休闲杂谈', feedback: '卡片反馈', deck: '卡组分享', qa: '答疑解忧' };
    var OCG_PIC_URL = 'https://cdn.233.momobako.com/ygopro/pics/';
    var SP_PIC_URL = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/';
    var DIY_PIC_URL = 'https://api.ygopro3.cn/pics/siro/';
    var EMOJI_URL = 'xiaobaibiaoqingbao/';
    var EMOJI_LIST = ['happy','anger','shy','shock','helpless','weary','Confused','Embarrassed','Envious','Grievance','Heartwarming','Infatuation','Panicked','SlackingOff','Teasing','Tsundere'];
    var EMOJI_NAMES = { happy: '开心', anger: '生气', shy: '害羞', shock: '震惊', helpless: '无语', weary: '疲倦', Confused: '疑惑', Embarrassed: '尴尬', Envious: '羡慕', Grievance: '委屈', Heartwarming: '暖心', Infatuation: '花痴', Panicked: '慌张', SlackingOff: '偷懒', Teasing: '调戏', Tsundere: '傲娇' };

    // ── 卡信息：不依赖「卡池列表」是否打开过 ──
    //   优先用卡池页已经建好的 window._cardIndex；
    //   没打开过卡池时，按需向 /api/cards?ids=… 只取用到的几张（不拉 11MB 全表）。
    var _cmCardMap = {};
    var _cmCardPendingIds = {};

    function cardFromIndex(cardId) {
        var index = window._cardIndex;
        if (!index || !index.size) return null;
        var card = index.get(cardId);
        if (card) return card;
        // 查别名：遍历找 alias === cardId 的卡
        var found = null;
        index.forEach(function (c) {
            if (!found && c.alias && parseInt(c.alias) === cardId) found = c;
        });
        return found || null;
    }

    function getCardInfoById(cardId) {
        var id = parseInt(cardId, 10);
        if (!id) return null;
        if (_cmCardMap[id]) return _cmCardMap[id];
        return cardFromIndex(id);
    }

    // 按需批量补卡（一次请求，返回 Promise）
    function ensureCards(ids) {
        var missing = [];
        (ids || []).forEach(function (raw) {
            var id = parseInt(raw, 10);
            if (!id || _cmCardMap[id] || _cmCardPendingIds[id]) return;
            if (cardFromIndex(id)) return;
            if (missing.indexOf(id) === -1) missing.push(id);
        });
        if (!missing.length) return Promise.resolve();
        missing.forEach(function (id) { _cmCardPendingIds[id] = true; });
        return fetch('/api/cards?ids=' + missing.join(','))
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (cards) {
                (cards || []).forEach(function (c) {
                    var id = parseInt(c.id, 10);
                    if (id) _cmCardMap[id] = c;
                });
            })
            .catch(function () {})
            .then(function () {
                missing.forEach(function (id) { delete _cmCardPendingIds[id]; });
            });
    }

    function collectCardIds(post, replyData) {
        var ids = [];
        function scan(blocks) {
            (blocks || []).forEach(function (b) {
                if (b && b.type === 'card' && b.id) ids.push(b.id);
            });
        }
        scan(post && post.contentJson);
        ((replyData && replyData.replies) || []).forEach(function (r) { scan(r.contentJson); });
        return ids;
    }

    // ── G-Ext 分值（卡组块展示总分） ──
    var _cmScoresCache = null;
    var _cmScoreLimit = 100;

    function loadCmScores() {
        if (_cmScoresCache) return Promise.resolve(_cmScoresCache);
        return fetch('/api/scores?t=' + Date.now()).then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var limit = parseInt(resp.headers.get('X-GExt-Limit'), 10);
            if (!isNaN(limit) && limit > 0) _cmScoreLimit = limit;
            return resp.json();
        }).then(function (d) {
            _cmScoresCache = d;
            return _cmScoresCache;
        }).catch(function () {
            console.warn('加载分值失败');
            _cmScoresCache = {};
            return _cmScoresCache;
        });
    }

    function calcCmDeckScore(deck, sm) {
        var t = 0;
        if (!deck) return 0;
        ['main', 'extra', 'side'].forEach(function (sec) {
            (deck[sec] || []).forEach(function (id) {
                var s = sm && sm[id];
                if (s) t += (s.score || 0);
            });
        });
        return t;
    }

    function fillDeckBlockScores(root) {
        var blocks = (root || document).querySelectorAll('.cp-deck-block[data-deck]');
        if (!blocks.length) return;
        loadCmScores().then(function (sm) {
            blocks.forEach(function (b) {
                var d;
                try { d = JSON.parse(b.getAttribute('data-deck')); } catch (e) { return; }
                var sc = calcCmDeckScore(d, sm);
                var div = document.createElement('div');
                div.style.cssText = 'font-size:0.75rem;color:#F0E68C;margin-top:4px;letter-spacing:0.3px;';
                div.innerHTML = '总分：<b style="color:#fff;">' + sc + '</b>/' + _cmScoreLimit
                    + (sc > _cmScoreLimit ? ' <span style="color:#ff6b6b;">⚠️超限</span>' : '');
                b.appendChild(div);
            });
        });
    }

    function isAdmin() {
        // 论坛管理身份由服务端判定（srv_user.permissions 带 sudo/judge），
        //   登录 / 刷新时从 /api/forum/status、/api/forum/login 写进 window._communityIsAdmin。
        return !!window._communityIsAdmin;
    }

    var _cardUrlCache = window._deckCommunityCardCache || {};
    window._deckCommunityCardCache = _cardUrlCache;

    function cardImgSrc(cardId) {
        if (_cardUrlCache[cardId]) return _cardUrlCache[cardId];
        return OCG_PIC_URL + cardId + '.jpg';
    }

    function cardImgOnLoad(cardId) {
        return 'if(!this.src.includes(\'cover.jpg\')){'
            + 'window._deckCommunityCardCache=window._deckCommunityCardCache||{};'
            + 'window._deckCommunityCardCache[' + cardId + ']=this.src;'
            + '}';
    }

    function cardImgOnError(cardId) {
        return 'this.onerror=null;this.src=\'' + SP_PIC_URL + cardId + '.jpg\';'
            + 'this.onerror=function(){this.onerror=null;this.src=\'' + DIY_PIC_URL + cardId + '.jpg\';'
            + 'this.onload=function(){' + cardImgOnLoad(cardId) + '};'
            + 'this.onerror=function(){this.src=\'cover.jpg\';}};'
            + 'this.onload=function(){' + cardImgOnLoad(cardId) + '};';
    }

    function avatarImg(accountName, size) {
        if (!accountName) return '';
        var px = size || 24;
        var radius = px >= 32 ? 6 : 3;
        return '<img class="cp-avatar" src="/api/forum/avatar/' + encodeURIComponent(accountName) + '?v=' + Date.now() + '"'
            + ' style="width:' + px + 'px;height:' + px + 'px;border-radius:' + radius + 'px;border:1px solid rgba(216,30,68,0.3);object-fit:cover;flex-shrink:0;'
            + (px >= 32 ? '' : 'margin-right:6px;') + '"'
            + ' onerror="this.style.display=\'none\'">';
    }

    function cardThumbImg(cardId) {
        return '<img src="' + cardImgSrc(cardId) + '" style="width:44px;height:64px;object-fit:cover;border-radius:3px;flex-shrink:0;"'
            + ' onerror="' + cardImgOnError(cardId) + '">';
    }

    function getPreviewThumbs(contentJson) {
        if (!contentJson || !contentJson.length) return '';
        var thumbs = [];
        for (var i = 0; i < contentJson.length && thumbs.length < 3; i++) {
            var b = contentJson[i];
            if (b.type === 'card') {
                thumbs.push(cardThumbImg(b.id));
            } else if (b.type === 'deck' && b.main && b.main.length) {
                thumbs.push(cardThumbImg(b.main[0]));
            }
        }
        return thumbs.length ? '<div class="cp-thumbs" style="display:flex;gap:4px;margin-top:6px;">' + thumbs.join('') + '</div>' : '';
    }

    var state = {
        section: 'all',
        sort: 'latest',
        search: '',
        page: 1,
        pageSize: 12,
        total: 0,
    };

    // ═══════════════════════════ API ═══════════════════════════

    function api(path, opts) {
        var url = path;
        var options = opts || {};
        if (!options.headers) options.headers = {};
        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
            options.headers['Content-Type'] = 'application/json';
        }
        return fetch(url, options).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    }

    // ── 论坛作者称号：与玩家排名同一套接口/稀有度配色（紫=任务称号）──
    var _forumTitles = {};
    var _forumTitlesAt = 0;
    var _forumTitlesPromise = null;

    function ensureForumTitles(force) {
        var now = Date.now();
        if (!force && _forumTitlesPromise && now - _forumTitlesAt < 60000) return _forumTitlesPromise;
        _forumTitlesAt = now;
        _forumTitlesPromise = api('/api/ladder/titles?t=' + now).then(function (data) {
            _forumTitles = (data && data.titles) || {};
            return _forumTitles;
        }).catch(function () {
            return _forumTitles;
        });
        return _forumTitlesPromise;
    }

    function forumTitleHtml(authorName, accountName) {
        var info = _forumTitles[authorName] || _forumTitles[accountName];
        if (!info || !info.length) return '';
        var keys = ['白', '绿', '蓝', '黄', '红', '紫'];
        var html = '';
        info.forEach(function (t) {
            var r = keys.indexOf(t.rarity) >= 0 ? t.rarity : '紫';
            html += '<span class="forum-title" data-rarity="' + r + '">' + esc(t.title) + '</span>';
        });
        return html;
    }

    function getAuth() {
        var a = window._communityAuth;
        if (!a) return null;
        return 'username=' + encodeURIComponent(a.username) + '&pass=' + encodeURIComponent(a.password);
    }

    function requireLogin() {
        if (!window._communityLoggedIn) {
            alert('请先登录后再操作');
            // 弹出登录弹窗
            var glModal = document.getElementById('glModalOverlay');
            if (glModal) glModal.classList.add('active');
            return false;
        }
        return true;
    }

    function authApi(path, opts) {
        var auth = getAuth();
        if (!auth) return Promise.reject(new Error('未登录'));
        if (path.indexOf('?') === -1) path += '?' + auth;
        else path += '&' + auth;
        return api(path, opts);
    }

    // ═══════════════════════════ 渲染 ═══════════════════════════

    function esc(text) {
        var div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function timeAgo(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        var now = new Date();
        var diff = Math.floor((now - d) / 1000);
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
        if (diff < 604800) return Math.floor(diff / 86400) + '天前';
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    // 列表卡片第二行：有回复显示「回复于」，否则「发布于」
    function postTimeLabel(post) {
        if (!post) return '';
        if (post.replyCount > 0 && post.lastReplyAt) return '回复于 ' + timeAgo(post.lastReplyAt);
        return '发布于 ' + timeAgo(post.createTime);
    }

    // 没有卡图时的「一行内容」摘要（去掉 [deck]/[card]/[img] 标记）
    function postExcerpt(post) {
        var text = String((post && post.content) || '');
        text = text.replace(/\[deck\][\s\S]*?\[\/deck\]/g, ' ')
            .replace(/\[card\]\d+\[\/card\]/g, ' ')
            .replace(/\[img\][a-zA-Z]+\[\/img\]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) return '';
        if (text.length > 90) text = text.slice(0, 90) + '…';
        return '<div class="cp-excerpt">' + esc(text) + '</div>';
    }

    // 分享 = 复制一段带标题的分享文案（含帖子深链）
    function sharePost(post) {
        var url = location.origin + '/?goto=forum&post=' + post.id;
        var text = '【白神论坛】' + (post.title || '') + '：' + url + '\n来讨论看看吧~';
        var copied = function () { alert('已复制分享文案，直接粘贴给好友就行：\n\n' + text); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(copied, function () { prompt('复制下面的内容分享：', text); });
        } else {
            prompt('复制下面的内容分享：', text);
        }
    }

    // ═══════════════════════════ 本地模拟数据（部署后删除） ═══════════════════════
    var _mockId = 100;
    var MOCK_POSTS = [
        { id: 1, section: 'casual', title: '欢迎来到白神服论坛！', tags: '公告', content: '大家好啊，这是休闲杂谈区。这里可以聊游戏心得、分享趣事，注意友好交流哦～', authorName: '管理员', accountName: 'admin', likeCount: 5, replyCount: 2, viewCount: 128, isPinned: true, createTime: new Date(Date.now() - 86400000).toISOString(),
            contentJson: [{ type: 'text', text: '大家好啊，这是休闲杂谈区。这里可以聊游戏心得、分享趣事，注意友好交流哦～' }] },
        { id: 2, section: 'deck', title: '青眼白龙卡组分享', tags: '构筑', content: '这套卡组主打卡差和展开...[deck]\n#main\n89631139\n89631139\n89631139\n23995346\n23995346\n23995346\n63442604\n63442604\n5446550\n5446550\n81644744\n81644744\n54693926\n54693926\n54693926\n36224040\n36224040\n10000000\n10000010\n10000020\n#extra\n11793047\n27565379\n21123811\n!side\n65172737\n65172737\n[/deck]\n以上就是卡组！', authorName: '决斗者A', accountName: 'a', likeCount: 12, replyCount: 2, viewCount: 56, isPinned: false, createTime: new Date(Date.now() - 3600000).toISOString(),
            contentJson: [
                { type: 'text', text: '这套卡组主打卡差和展开，白龙的强度还是很不错的！下面是卡组：' },
                { type: 'deck', main: [89631139,89631139,89631139,23995346,23995346,23995346,63442604,63442604,5446550,5446550,81644744,81644744,54693926,54693926,54693926,36224040,36224040,10000000,10000010,10000020], extra: [11793047,27565379,21123811], side: [65172737,65172737] },
                { type: 'text', text: '以上就是卡组，欢迎交流！' },
            ] },
        { id: 3, section: 'feedback', title: '这几张DIY卡强度讨论', tags: '讨论', content: '最近新出的几张卡感觉太强了，大家怎么看？先看看这张 [card]13131367[/card] ，再看看这张 [card]23995346[/card] 的效果。', authorName: '玩家B', accountName: 'b', likeCount: 8, replyCount: 1, viewCount: 34, isPinned: false, createTime: new Date(Date.now() - 1800000).toISOString(),
            contentJson: [
                { type: 'text', text: '最近新出的几张卡感觉太强了，大家怎么看？先看看这张' },
                { type: 'card', id: 13131367 },
                { type: 'text', text: '，再看看这张' },
                { type: 'card', id: 23995346 },
                { type: 'text', text: '的效果。' },
            ] },
        { id: 4, section: 'qa', title: '新人提问：怎么注册账号？', tags: '已解决,新人', content: '刚下载游戏，不知道怎么注册，求教。另外新人适合用什么卡组入门？', authorName: '新手', accountName: 'c', likeCount: 0, replyCount: 3, viewCount: 89, isPinned: false, createTime: new Date(Date.now() - 600000).toISOString(),
            contentJson: [{ type: 'text', text: '刚下载游戏，不知道怎么注册，求教。另外新人适合用什么卡组入门？' }] },
    ];
    var MOCK_REPLIES = {
        1: [{ id: 1, postId: 1, content: '支持！这个论坛功能真好用', contentJson: [{ type: 'text', text: '支持！这个论坛功能真好用' }], authorName: '决斗者A', accountName: 'a', createTime: new Date(Date.now() - 43200000).toISOString() }],
        2: [
            { id: 2, postId: 2, content: '白龙永远的信仰！我也来分享一套：[deck]\n#main\n89631139\n23995346\n[/deck]', contentJson: [{ type: 'text', text: '白龙永远的信仰！我也来分享一套：' }, { type: 'deck', main: [89631139, 23995346], extra: [], side: [] }], authorName: '玩家B', accountName: 'b', createTime: new Date(Date.now() - 1800000).toISOString() },
            { id: 3, postId: 2, content: '这套构筑不错，建议加一张 [card]63442604[/card] 更好', contentJson: [{ type: 'text', text: '这套构筑不错，建议加一张' }, { type: 'card', id: 63442604 }, { type: 'text', text: '更好' }], authorName: '新手', accountName: 'c', createTime: new Date(Date.now() - 900000).toISOString() },
        ],
    };
    var USE_MOCK = false;

    function mockFeed() {
        var posts = MOCK_POSTS.filter(function (p) {
            var sectionMatch = state.section === 'all' || p.section === state.section;
            var searchMatch = !state.search
                || (p.title || '').toLowerCase().indexOf(state.search.toLowerCase()) !== -1
                || (p.content || '').toLowerCase().indexOf(state.search.toLowerCase()) !== -1
                || (p.authorName || '').toLowerCase().indexOf(state.search.toLowerCase()) !== -1;
            return sectionMatch && searchMatch;
        });
        state.total = posts.length;
        // 排序
        if (state.sort === 'hot') {
            posts.sort(function (a, b) { return b.likeCount - a.likeCount || b.createTime.localeCompare(a.createTime); });
        } else {
            posts.sort(function (a, b) { return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.createTime.localeCompare(a.createTime); });
        }
        // 分页
        var start = (state.page - 1) * state.pageSize;
        return { posts: posts.slice(start, start + state.pageSize), total: posts.length };
    }

    function mockNewPost(section, title, content, contentJson, tags) {
        var id = ++_mockId;
        var post = {
            id: id, section: section, title: title, content: content,
            contentJson: contentJson || [{ type: 'text', text: content }],
            tags: tags || '',
            authorName: window._communityUsername || '测试用户',
            accountName: window._communityUsername || 'test',
            likeCount: 0, replyCount: 0, viewCount: 0, isPinned: false,
            createTime: new Date().toISOString(),
        };
        MOCK_POSTS.unshift(post);
        return post;
    }

    function mockLike(postId) {
        var post = MOCK_POSTS.find(function (p) { return p.id === postId; });
        if (post) post.likeCount++;
        return { likeCount: post ? post.likeCount : 0 };
    }

    function mockReply(postId, content, contentJson) {
        var id = ++_mockId;
        var reply = {
            id: id, postId: postId, content: content,
            contentJson: contentJson || [{ type: 'text', text: content }],
            authorName: window._communityUsername || '测试用户',
            accountName: window._communityUsername || 'test',
            createTime: new Date().toISOString(),
        };
        if (!MOCK_REPLIES[postId]) MOCK_REPLIES[postId] = [];
        MOCK_REPLIES[postId].push(reply);
        var post = MOCK_POSTS.find(function (p) { return p.id === postId; });
        if (post) post.replyCount = MOCK_REPLIES[postId].length;
        return { id: id, replyCount: post ? post.replyCount : 0 };
    }

    // 初始化时修正所有帖子的回复数
    MOCK_POSTS.forEach(function (post) {
        post.replyCount = (MOCK_REPLIES[post.id] || []).length;
    });

    function mockGetPost(postId) {
        return MOCK_POSTS.find(function (p) { return p.id === postId; });
    }

    function mockGetReplies(postId) {
        return MOCK_REPLIES[postId] || [];
    }
    // ═══════════════════════════ 本地模拟数据结束 ═══════════════════════

    // ═══════════════════════════ 帖子列表 ═══════════════════════

    function initShell() {
        if (!wrapper) return;
        var html = '';
        // 固定 Tabs + 搜索（手机端同行）
        html += '<div class="community-tabs" id="cmTabs">';
        SECTIONS.forEach(function (s) {
            var active = s === state.section ? ' active' : '';
            html += '<button class="community-tab' + active + '" data-section="' + s + '">'
                + SECTION_NAMES[s] + '</button>';
        });
        html += '<input class="community-input cm-search-inline" id="cmSearch" placeholder="搜索帖子...">';
        html += '</div>';
        // 固定 Toolbar
        html += '<div class="community-toolbar" id="cmToolbar">';
        html += '<button class="community-btn" id="cmPubBtn">+ 发帖</button>';
        html += '<button class="community-sort' + (state.sort === 'latest' ? ' active' : '')
            + '" data-sort="latest">最新</button>';
        html += '<button class="community-sort' + (state.sort === 'hot' ? ' active' : '')
            + '" data-sort="hot">最热</button>';
        html += '<button class="community-sort' + (state.sort === 'recent' ? ' active' : '')
            + '" data-sort="recent">最新回复</button>';
        html += '<span class="community-count" id="cmCount">共 0 篇</span>';
        html += '</div>';
        // Feed 区域（动态刷新）
        html += '<div id="cmFeedArea"><div class="community-loading">加载中...</div></div>';
        wrapper.innerHTML = html;
        bindShellEvents();
        loadFeed();
    }

    function bindShellEvents() {
        // Tabs
        wrapper.querySelectorAll('#cmTabs .community-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.section = btn.getAttribute('data-section');
                state.page = 1;
                // 更新tab高亮
                wrapper.querySelectorAll('#cmTabs .community-tab').forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                loadFeed();
            });
        });
        // 排序
        wrapper.querySelectorAll('#cmToolbar .community-sort').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.sort = btn.getAttribute('data-sort');
                state.page = 1;
                wrapper.querySelectorAll('#cmToolbar .community-sort').forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                loadFeed();
            });
        });
        // 发帖
        var pubBtn = document.getElementById('cmPubBtn');
        if (pubBtn) pubBtn.addEventListener('click', function () {
            if (!requireLogin()) return;
            openPublish();
        });

        // 搜索（在 tabs 行内）
        var searchInput = document.getElementById('cmSearch');
        var searchTimer = 0;
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                var q = this.value.trim();
                searchTimer = setTimeout(function () {
                    state.search = q;
                    state.page = 1;
                    loadFeed();
                }, 400);
            });
        }
    }

    function loadFeed() {
        var feedArea = document.getElementById('cmFeedArea');
        if (!feedArea) return;
        feedArea.innerHTML = '<div class="community-loading">加载中...</div>';

        if (USE_MOCK) {
            var mockData = mockFeed();
            state.total = mockData.total;
            renderFeed(mockData);
            return;
        }

        var qs = '?section=' + state.section + '&sort=' + state.sort
            + '&page=' + state.page + '&pageSize=' + state.pageSize;
        if (state.search) qs += '&search=' + encodeURIComponent(state.search);

        ensureForumTitles().then(function () {
            return api('/api/forum/posts' + qs);
        }).then(function (data) {
            state.total = data.total || 0;
            renderFeed(data);
        }).catch(function (e) {
            feedArea.innerHTML = '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
        });
    }

    function renderFeed(data) {
        var feedArea = document.getElementById('cmFeedArea');
        if (!feedArea) return;

        // 更新计数
        var countEl = document.getElementById('cmCount');
        if (countEl) countEl.textContent = '共 ' + state.total + ' 篇';

        var html = '';
        if (!data.posts || !data.posts.length) {
            html += '<div class="cp-empty">暂无帖子，快来发布第一篇吧</div>';
        } else {
            html += '<div class="community-feed">';
            data.posts.forEach(function (post) {
                html += '<div class="community-post' + (post.isPinned ? ' pinned' : '')
                    + '" data-id="' + post.id + '">';
                // ① 头部：头像（左侧跨两行）+ 名称/主副称号 + 回复时间
                html += '<div class="cp-head">';
                html += '<div class="cp-avatar-col">' + avatarImg(post.accountName, 40) + '</div>';
                html += '<div class="cp-head-main">';
                html += '<div class="cp-name-row">'
                    + '<span class="cp-name">' + esc(post.authorName) + '</span>'
                    + forumTitleHtml(post.authorName, post.accountName)
                    + '</div>';
                html += '<div class="cp-sub-row">'
                    + '<span class="cp-time">' + postTimeLabel(post) + '</span>'
                    + (post.isPinned ? '<span class="cp-pin">置顶</span>' : '')
                    + '<span class="cp-section-tag">' + SECTION_NAMES[post.section] + '</span>';
                (post.tags || '').split(',').filter(Boolean).forEach(function (t) {
                    html += '<span class="cp-tag">' + esc(t.trim()) + '</span>';
                });
                html += '</div>';
                html += '</div></div>';
                // ② 标题
                html += '<div class="cp-title">' + esc(post.title) + '</div>';
                // ③ 预览：有卡图先放卡图，再补一行内容摘要（两者都要）
                html += getPreviewThumbs(post.contentJson);
                html += postExcerpt(post);
                // ④ 底部：分享 / 评论 / 点赞
                html += '<div class="cp-actions">'
                    + '<button class="cp-act" data-act="share" title="复制分享文案">分享</button>'
                    + '<button class="cp-act" data-act="reply" title="查看评论">评论 ' + (post.replyCount || 0) + '</button>'
                    + '<button class="cp-act" data-act="like" title="点赞">点赞 ' + (post.likeCount || 0) + '</button>'
                    + '<span class="cp-views">👁 ' + (post.viewCount || 0) + '</span>'
                    + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Pagination
        var totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
        html += '<div class="community-pagination">';
        html += '<button class="community-page-btn" id="cmPrev" ' + (state.page <= 1 ? 'disabled' : '') + '>← 上一页</button>';
        html += '<span class="community-page-info">第 ' + state.page + ' / ' + totalPages + ' 页</span>';
        html += '<button class="community-page-btn" id="cmNext" ' + (state.page >= totalPages ? 'disabled' : '') + '>下一页 →</button>';
        html += '</div>';

        feedArea.innerHTML = html;

        // 卡片底部动作：分享 / 评论 / 点赞（点卡片其它区域 = 打开详情）
        (data.posts || []).forEach(function (post) {
            var card = feedArea.querySelector('.community-post[data-id="' + post.id + '"]');
            if (!card) return;
            var shareBtn = card.querySelector('[data-act="share"]');
            if (shareBtn) shareBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                sharePost(post);
            });
            var replyBtn = card.querySelector('[data-act="reply"]');
            if (replyBtn) replyBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                openDetail(post.id);
            });
            var likeBtn = card.querySelector('[data-act="like"]');
            if (likeBtn) likeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!requireLogin()) return;
                authApi('/api/forum/posts/' + post.id + '/like', { method: 'POST' }).then(function (r) {
                    if (r && typeof r.likeCount === 'number') post.likeCount = r.likeCount;
                    likeBtn.textContent = ((r && r.liked) ? '已赞 ' : '点赞 ') + (post.likeCount || 0);
                    likeBtn.classList.toggle('active', !!(r && r.liked));
                }).catch(function () {});
            });
        });

        // 分页
        var prev = document.getElementById('cmPrev');
        var next = document.getElementById('cmNext');
        if (prev) prev.addEventListener('click', function () {
            if (state.page > 1) { state.page--; loadFeed(); }
        });
        if (next) next.addEventListener('click', function () {
            if (state.page < totalPages) { state.page++; loadFeed(); }
        });
        // 帖子详情
        feedArea.querySelectorAll('.community-post').forEach(function (post) {
            post.addEventListener('click', function () {
                openDetail(parseInt(post.getAttribute('data-id')));
            });
        });
    }

    // ═══════════════════════════ 帖子详情弹窗 ═══════════════════════

    var _detailOverlay = null;
    var _detailPostId = 0;

    function openDetail(postId) {
        _detailPostId = postId;
        var overlay = document.createElement('div');
        overlay.className = 'community-modal-overlay active';
        overlay.innerHTML = '<div class="community-modal">'
            + '<div class="community-modal-header">'
            + '<span class="community-modal-title">帖子详情</span>'
            + '<button class="community-modal-close">&times;</button>'
            + '</div>'
            + '<div class="community-modal-body"><div class="community-loading">加载中...</div></div>'
            + '</div>';
        document.body.appendChild(overlay);
        _detailOverlay = overlay;
        document.body.style.overflow = 'hidden';

        overlay.querySelector('.community-modal-close').addEventListener('click', closeDetail);

        // 加载帖子
        if (USE_MOCK) {
            var post = mockGetPost(postId);
            if (post) {
                renderDetail(post, { replies: mockGetReplies(postId), total: mockGetReplies(postId).length });
            } else {
                overlay.querySelector('.community-modal-body').innerHTML = '<div class="cp-empty">帖子不存在</div>';
            }
            return;
        }
        ensureForumTitles().then(function () {
            return api('/api/forum/posts/' + postId);
        }).then(function (post) {
            loadReplies(post);
        }).catch(function (e) {
            overlay.querySelector('.community-modal-body').innerHTML =
                '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
        });
    }

    function loadReplies(post) {
        if (USE_MOCK) {
            var replyData = { replies: mockGetReplies(post.id), total: mockGetReplies(post.id).length };
            renderDetail(post, replyData);
            return;
        }
        api('/api/forum/posts/' + post.id + '/replies').then(function (replyData) {
            // 先把帖子/回复里用到的卡补齐（没打开过卡池也能显示卡名）
            return ensureCards(collectCardIds(post, replyData)).then(function () {
                renderDetail(post, replyData);
            });
        }).catch(function () {
            ensureCards(collectCardIds(post, null)).then(function () {
                renderDetail(post, { replies: [], total: 0 });
            });
        });
    }

    function renderDetail(post, replyData) {
        var body = _detailOverlay.querySelector('.community-modal-body');
        var html = '';

        // 帖子内容
        html += '<div style="margin-bottom:20px;">';
        html += '<h2 style="color:#F0E68C;margin:0 0 8px;">' + esc(post.title) + '</h2>';
        // 浏览量 + 标签
        html += '<div style="color:#666;font-size:0.72rem;margin-bottom:8px;">👁 ' + (post.viewCount || 0) + ' 次浏览';
        var tags = (post.tags || '').split(',').filter(Boolean);
        tags.forEach(function (t) {
            html += ' <span style="font-size:0.65rem;background:rgba(240,230,140,0.1);color:#F0E68C;padding:1px 6px;border-radius:2px;">' + esc(t.trim()) + '</span>';
        });
        html += '</div>';
        // 作者行：头像跨两行 —— 第一行「名字 主称号 副称号」，第二行「时间 板块 编辑 删除」
        var isMine = !!(window._communityUsername && window._communityUsername === post.accountName);
        var canManage = isMine || isAdmin();
        html += '<div class="cp-head" style="margin-bottom:12px;">';
        html += '<div class="cp-avatar-col">' + avatarImg(post.accountName, 40) + '</div>';
        html += '<div class="cp-head-main">';
        html += '<div class="cp-name-row"><span class="cp-name">' + esc(post.authorName) + '</span>'
            + forumTitleHtml(post.authorName, post.accountName) + '</div>';
        html += '<div class="cp-sub-row">'
            + '<span class="cp-time">' + timeAgo(post.createTime) + '</span>'
            + '<span class="cp-section-tag">' + SECTION_NAMES[post.section] + '</span>';
        if (canManage) {
            html += '<button class="cp-edit-btn" id="cmEditPost" style="font-size:0.68rem;">✏ '
                + (isMine ? '编辑' : '管理编辑') + '</button>';
            html += '<button class="cp-edit-btn" id="cmDelPost" style="font-size:0.68rem;color:#ff6b6b;">🗑 '
                + (isMine ? '删除' : '管理删除') + '</button>';
        }
        html += '</div></div></div>';
        // 渲染内容块：文字与卡图在同一行内流动（卡图不强制换行），连续卡图并排一行
        html += '<div class="cp-content" style="color:#ccc;line-height:1.7;margin-bottom:12px;">';
        var cardBuf = [];
        function flushCards() {
            if (!cardBuf.length) return;
            html += '<span class="cp-card-row">' + cardBuf.join('') + '</span>';
            cardBuf = [];
        }
        function cardChip(id) {
            var cardInfo = getCardInfoById(id);
            var cardName = cardInfo ? (cardInfo.name || '') : '';
            var nameHtml = cardName ? '<span style="color:#F0E68C;font-size:0.78rem;max-width:120px;line-height:1.3;">' + esc(cardName) + '</span>' : '';
            var paddingX = cardName ? '10px' : '4px';
            return '<span class="cp-card-inline" data-card-id="' + id + '"'
                + ' style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;'
                + 'background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:4px ' + paddingX + ' 4px 4px;cursor:pointer;">'
                + '<img src="' + cardImgSrc(id) + '" style="width:44px;height:64px;object-fit:cover;border-radius:3px;"'
                + ' onerror="' + cardImgOnError(id) + '">'
                + nameHtml
                + '</span>';
        }
        (post.contentJson || []).forEach(function (block) {
            if (block.type === 'card') {
                cardBuf.push(cardChip(block.id));
                return;
            }
            flushCards();
            if (block.type === 'text') {
                if (!block.text) return;
                // 保留作者敲的换行（卡图后面按回车就靠它）
                html += '<span style="white-space:pre-wrap;">' + esc(block.text) + '</span>';
            } else if (block.type === 'img') {
                html += '<img src="' + EMOJI_URL + esc(block.name) + '.png" style="max-width:80px;max-height:80px;vertical-align:middle;margin:2px;" loading="lazy">';
            } else if (block.type === 'deck') {
                html += '<div class="cp-deck-block" style="background:#111;border:1px solid #2a2a2a;'
                    + 'border-radius:8px;padding:12px;margin:8px 0;cursor:pointer;"'
                    + ' data-deck=\'' + JSON.stringify({ main: block.main, extra: block.extra, side: block.side }).replace(/'/g, "\\'") + '\'>'
                    + '🃏 卡组 (' + (block.main || []).length + (block.extra || []).length + (block.side || []).length + '张) — 点击查看详情</div>';
            }
        });
        flushCards();
        html += '</div>';
        // 点赞 + 评论数 + 置顶按钮
        html += '<div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">';
        html += '<button class="community-btn" id="cmLikeBtn" style="font-size:0.82rem;">❤ ' + post.likeCount + '</button>';
        html += '<span style="color:#888;font-size:0.82rem;">💬 ' + post.replyCount + ' 条评论</span>';
        // 管理员才显示置顶按钮
        if (isAdmin()) {
            html += '<button class="community-sort" id="cmPinBtn" style="margin-left:auto;font-size:0.78rem;">'
                + (post.isPinned ? '📌 取消置顶' : '📌 置顶') + '</button>';
        }
        html += '</div>';
        html += '</div>';

        // 评论区
        html += '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:14px;">';
        html += '<h3 style="color:#aaa;font-size:0.9rem;margin-bottom:10px;">评论</h3>';
        if (!replyData.replies || !replyData.replies.length) {
            html += '<div style="color:#666;font-size:0.82rem;text-align:center;padding:20px;">暂无评论</div>';
        } else {
            replyData.replies.forEach(function (r) {
                html += '<div class="community-reply">';
                html += avatarImg(r.accountName) + '<span class="cr-author">' + esc(r.authorName) + '</span>'
                    + forumTitleHtml(r.authorName, r.accountName);
                html += '<span class="cr-time">' + timeAgo(r.createTime) + '</span>';
                // 自己的回复显示编辑/删除
                if (window._communityUsername && window._communityUsername === r.accountName) {
                    html += '<button class="cp-edit-btn edit-reply-btn" data-rid="' + r.id + '" style="font-size:0.65rem;">✏</button>';
                    html += '<button class="cp-edit-btn del-reply-btn" data-rid="' + r.id + '" style="font-size:0.65rem;color:#ff6b6b;">🗑</button>';
                }
                html += '<div class="cr-content">';
                // 渲染回复的内容块
                if (r.contentJson && r.contentJson.length) {
                    r.contentJson.forEach(function (block) {
                        if (block.type === 'text') {
                            html += '<span style="white-space:pre-wrap;">' + esc(block.text) + '</span>';
                        } else if (block.type === 'img') {
                            html += '<img src="' + EMOJI_URL + esc(block.name) + '.png" style="max-width:72px;max-height:72px;vertical-align:middle;margin:2px;" loading="lazy">';
                        } else if (block.type === 'deck') {
                            var total = (block.main || []).length + (block.extra || []).length + (block.side || []).length;
                            html += '<div class="cp-deck-block" style="background:#111;border:1px solid #2a2a2a;'
                                + 'border-radius:8px;padding:10px;margin:6px 0;cursor:pointer;font-size:0.82rem;"'
                                + ' data-deck=\'' + JSON.stringify({ main: block.main, extra: block.extra, side: block.side }).replace(/'/g, "\\'") + '\'>'
                                + '🃏 卡组 (' + total + '张) — 点击查看详情</div>';
                        } else if (block.type === 'card') {
                            var cardInfo = getCardInfoById(block.id);
                            var cardName = cardInfo ? (cardInfo.name || '') : '';
                            var replyNameHtml = cardName ? '<span style="color:#F0E68C;font-size:0.72rem;max-width:100px;line-height:1.3;">' + esc(cardName) + '</span>' : '';
                            var replyPadX = cardName ? '10px' : '4px';
                            html += '<span class="cp-card-inline" data-card-id="' + block.id + '"'
                                + ' style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin:2px 4px;'
                                + 'background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:4px ' + replyPadX + ' 4px 4px;cursor:pointer;">'
                                + '<img src="' + cardImgSrc(block.id) + '" style="width:36px;height:52px;object-fit:cover;border-radius:3px;"'
                                + ' onerror="' + cardImgOnError(block.id) + '">'
                                + replyNameHtml
                                + '</span> ';
                        }
                    });
                } else {
                    html += esc(r.content);
                }
                html += '</div></div>';
            });
        }
        html += '</div>';

        // 回复输入
        html += '<div style="display:flex;gap:8px;margin-top:8px;">';
        html += '<textarea class="community-input" id="cmReplyInput" placeholder="输入回复... (Ctrl+Enter发送)"'
            + ' style="margin-bottom:0;flex:1;min-height:60px;" rows="2"></textarea>';
        html += '<button class="community-btn" id="cmReplyBtn" style="flex-shrink:0;align-self:flex-end;">发送</button>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;">';
        html += '<button class="community-sort" id="cmReplyDeckBtn" style="font-size:0.72rem;">📦 卡组</button>';
        html += '<button class="community-sort" id="cmReplyCardBtn" style="font-size:0.72rem;">🔍 卡片</button>';
        html += '<button class="community-sort" id="cmReplyEmojiBtn" style="font-size:0.72rem;">😊 表情</button>';
        html += '</div>';

        body.innerHTML = html;

        // 卡组块总分（帖子正文 + 回复）
        fillDeckBlockScores(body);

        // 点赞按钮
        var likeBtn = document.getElementById('cmLikeBtn');
        if (likeBtn) {
            likeBtn.addEventListener('click', function () {
                if (!requireLogin()) return;
                if (USE_MOCK) {
                    var r = mockLike(post.id);
                    likeBtn.textContent = '❤ ' + r.likeCount;
                    return;
                }
                authApi('/api/forum/posts/' + post.id + '/like', { method: 'POST' }).then(function (r) {
                    likeBtn.textContent = '❤ ' + r.likeCount;
                }).catch(function () {});
            });
        }

        // 置顶按钮
        var pinBtn = document.getElementById('cmPinBtn');
        if (pinBtn) {
            pinBtn.addEventListener('click', function () {
                var newPinned = !post.isPinned;
                if (USE_MOCK) {
                    post.isPinned = newPinned;
                    closeDetail();
                    openDetail(post.id);
                    return;
                }
                authApi('/api/forum/posts/' + post.id + '/pin', {
                    method: 'POST',
                    body: { pinned: newPinned },
                }).then(function () {
                    closeDetail();
                    openDetail(post.id);
                }).catch(function (e) {
                    alert('操作失败: ' + (e && e.message || '权限不足'));
                });
            });
        }

        // 回复
        var replyInput = document.getElementById('cmReplyInput');
        var replyBtn = document.getElementById('cmReplyBtn');
        var _replyDeck = null;

        function doReply() {
            if (!requireLogin()) return;
            var content = (replyInput.value || '').trim();
            if (!content && !_replyDeck) return;
            var contentJson = buildContentJson(content, _replyDeck);
            if (USE_MOCK) {
                mockReply(post.id, content || '(卡组)', contentJson);
                replyInput.value = '';
                _replyDeck = null;
                loadReplies(post);
                return;
            }
            authApi('/api/forum/posts/' + post.id + '/replies', {
                method: 'POST',
                body: { content: content, contentJson: contentJson },
            }).then(function () {
                replyInput.value = '';
                _replyDeck = null;
                loadReplies(post);
            }).catch(function (e) {
                alert('回复失败: ' + e.message);
            });
        }
        if (replyBtn) replyBtn.addEventListener('click', doReply);
        if (replyInput) replyInput.addEventListener('keydown', function (e) {
            if (e.ctrlKey && e.key === 'Enter') doReply();
        });

        // 回复嵌入卡组
        var replyDeckBtn = document.getElementById('cmReplyDeckBtn');
        if (replyDeckBtn) replyDeckBtn.addEventListener('click', function () {
            var ydk = prompt('请粘贴 YDK 卡组内容:');
            if (!ydk) return;
            if (window.DeckViewer && window.DeckViewer.parse) {
                var deck = window.DeckViewer.parse(ydk);
                if (deck) {
                    _replyDeck = deck;
                    var total = (deck.main || []).length + (deck.extra || []).length + (deck.side || []).length;
                    if (replyInput) replyInput.value += '\n[卡组：主' + (deck.main || []).length
                        + '张·额' + (deck.extra || []).length + '张·副' + (deck.side || []).length
                        + '张 (共' + total + '张)]\n';
                    return;
                }
            }
            alert('无法解析卡组内容');
        });
        // 回复嵌入卡片
        var replyCardBtn = document.getElementById('cmReplyCardBtn');
        if (replyCardBtn) replyCardBtn.addEventListener('click', openCardSearchForReply);

        var replyEmojiBtn = document.getElementById('cmReplyEmojiBtn');
        if (replyEmojiBtn) replyEmojiBtn.addEventListener('click', function () {
            openEmojiPicker(function (name) {
                if (replyInput) replyInput.value += '[img]' + name + '[/img]';
            });
        });

        function openCardSearchForReply() {
            var origClose = typeof openCardSearch === 'function' ? openCardSearch : null;
            // 复用全局卡片搜索，但把结果插入到回复框
            openCardSearchGeneric(function (cardId) {
                if (replyInput) replyInput.value += '[card]' + cardId + '[/card]';
            });
        }

        // 卡组块点击（帖子 + 回复）
        body.querySelectorAll('.cp-deck-block').forEach(function (block) {
            block.addEventListener('click', function () {
                var deckData = JSON.parse(block.getAttribute('data-deck'));
                if (window.DeckViewer && window.DeckViewer.showDeck) {
                    window.DeckViewer.showDeck(deckData, post.title);
                }
            });
        });

        // 卡片 inline 点击
        body.querySelectorAll('.cp-card-inline').forEach(function (ref) {
            ref.addEventListener('click', function () {
                var cardId = parseInt(ref.getAttribute('data-card-id'));
                if (cardId) openCardTooltip(cardId, ref);
            });
        });

        // 编辑帖子 — 复用发帖 UI
        var editBtn = document.getElementById('cmEditPost');
        if (editBtn) editBtn.addEventListener('click', function () {
            // PATCH: 用「文字 + [deck]/[card]/[img] 标记」回填，保存时重新解析成 contentJson；
            //   只回填纯文本 content 会把帖子里嵌入的卡组块丢掉。
            var editContent = (post.contentJson && post.contentJson.length)
                ? serializeBlocksToText(post.contentJson)
                : (post.content || '');
            openPublish({
                id: post.id,
                section: post.section,
                title: post.title,
                content: editContent,
                tags: post.tags || '',
            }, { allowSection: isAdmin() });
        });
        // 删除帖子
        var delBtn = document.getElementById('cmDelPost');
        if (delBtn) delBtn.addEventListener('click', function () {
            var tip = isMine ? '确定删除这个帖子吗？'
                : ('确定以管理员身份删除「' + (post.authorName || post.accountName || '') + '」的帖子吗？删除后无法恢复。');
            if (!confirm(tip)) return;
            if (USE_MOCK) {
                MOCK_POSTS = MOCK_POSTS.filter(function (p) { return p.id !== post.id; });
                closeDetail();
                loadFeed();
                return;
            }
            authApi('/api/forum/posts/' + post.id + '?' + getAuth(), { method: 'DELETE' })
                .then(function () { closeDetail(); loadFeed(); })
                .catch(function (e) { alert('删除失败: ' + (e && e.message)); });
        });
        // 编辑回复
        body.querySelectorAll('.edit-reply-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var rid = parseInt(btn.getAttribute('data-rid'));
                var reply = null;
                // id 可能是数字也可能是字符串，统一按整数比
                (replyData.replies || []).forEach(function (x) {
                    if (parseInt(x.id, 10) === rid) reply = x;
                });
                if (!reply) { alert('这条回复已不存在，请关闭后重新打开帖子'); return; }
                // PATCH: 用「文字 + [deck]/[card]/[img] 标记」回填，编辑后重新解析成 contentJson。
                //   原来只传纯文本 content，保存后回复里嵌入的卡组块/卡片块会整段丢失。
                var origBlocks = (reply.contentJson && reply.contentJson.length)
                    ? reply.contentJson
                    : [{ type: 'text', text: reply.content || '' }];
                var newContent = prompt('编辑回复（可直接改文字；卡组/卡片标记请一并保留）:',
                    serializeBlocksToText(origBlocks));
                if (newContent === null) return;      // 点了取消
                newContent = newContent.trim();
                if (!newContent) { alert('回复内容不能为空'); return; }
                var contentJson = buildContentJson(newContent, null);
                if (USE_MOCK) {
                    var r = MOCK_REPLIES[post.id] ? MOCK_REPLIES[post.id].find(function (x) { return x.id === rid; }) : null;
                    if (r) { r.content = newContent; r.contentJson = contentJson; }
                    closeDetail();
                    openDetail(post.id);
                    return;
                }
                authApi('/api/forum/replies/' + rid, {
                    method: 'PUT',
                    body: { content: newContent, contentJson: contentJson },
                }).then(function () { closeDetail(); openDetail(post.id); })
                  .catch(function (e) { alert('编辑失败: ' + (e && e.message)); });
            });
        });
        // 删除回复
        body.querySelectorAll('.del-reply-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var rid = parseInt(btn.getAttribute('data-rid'));
                if (!confirm('确定删除这条回复吗？')) return;
                if (USE_MOCK) {
                    if (MOCK_REPLIES[post.id]) {
                        MOCK_REPLIES[post.id] = MOCK_REPLIES[post.id].filter(function (x) { return x.id !== rid; });
                        post.replyCount = MOCK_REPLIES[post.id].length;
                    }
                    closeDetail();
                    openDetail(post.id);
                    return;
                }
                authApi('/api/forum/replies/' + rid + '?' + getAuth(), { method: 'DELETE' })
                    .then(function () { closeDetail(); openDetail(post.id); })
                    .catch(function (e) { alert('删除失败: ' + (e && e.message)); });
            });
        });
    }

    function closeDetail() {
        if (_detailOverlay) {
            _detailOverlay.remove();
            _detailOverlay = null;
            _detailPostId = 0;
            document.body.style.overflow = '';
        }
    }

    // ═══════════════════════════ 发帖弹窗 ═══════════════════════

    var _publishOverlay = null;
    var _publishDeck = null;
    var _editingPostId = null;

    function openPublish(editData, opts) {
        var isEdit = !!editData;
        // 分区：新建时可选；编辑时只有管理员能改（作者只能改标题/正文/标签）
        var allowSection = !isEdit || !!(opts && opts.allowSection);
        var overlay = document.createElement('div');
        overlay.className = 'community-modal-overlay active';
        overlay.innerHTML = '<div class="community-modal" style="width:min(600px,95vw);">'
            + '<div class="community-modal-header">'
            + '<span class="community-modal-title">' + (isEdit ? '编辑帖子' : '发布帖子') + '</span>'
            + '<button class="community-modal-close">&times;</button>'
            + '</div>'
            + '<div class="community-modal-body">'
            + '<label class="community-form-label">分区</label>'
            + '<select class="community-input" id="cmPubSection" style="width:auto;"'
            + ((isEdit && !allowSection) ? ' disabled title="分区不可修改"' : '') + '>'
            + SECTIONS.filter(function (s) { return s !== 'all'; }).map(function (s) { return '<option value="' + s + '"' + (editData && editData.section === s ? ' selected' : '') + '>' + SECTION_NAMES[s] + '</option>'; }).join('')
            + '</select>'
            + (isEdit && !allowSection
                ? '<div style="color:#666;font-size:0.7rem;margin:-4px 0 8px;">编辑时不能改分区，需要调整分区请联系管理员</div>'
                : '')
            + '<label class="community-form-label">标题</label>'
            + '<input class="community-input" id="cmPubTitle" maxlength="60" placeholder="帖子标题" value="' + (editData ? esc(editData.title) : '') + '">'
            + '<label class="community-form-label">标签（逗号分隔，如「构筑,已解决」）</label>'
            + '<input class="community-input" id="cmPubTags" maxlength="100" placeholder="可选标签" value="' + (editData ? esc(editData.tags || '') : '') + '">'
            + '<label class="community-form-label">正文（支持 [deck]...[/deck] 卡组，[card]ID[/card] 卡片）</label>'
            + '<textarea class="community-input community-textarea" id="cmPubContent" maxlength="2000"'
            + ' placeholder="在这里写下你想分享的内容...">' + (editData ? esc(editData.content) : '') + '</textarea>'
            + '<div style="display:flex;gap:8px;margin-bottom:10px;">'
            + '<button class="community-sort" id="cmPubDeckBtn">📦 卡组</button>'
            + '<button class="community-sort" id="cmPubCardBtn">🔍 卡片</button>'
            + '<button class="community-sort" id="cmPubEmojiBtn">😊 表情</button>'
            + '</div>'
            + '<div id="cmPubPreview" style="margin-bottom:10px;"></div>'
            + '<div style="display:flex;gap:10px;">'
            + '<button class="community-page-btn" id="cmPubCancel">取消</button>'
            + '<button class="community-btn" id="cmPubSubmit" style="flex:1;">' + (isEdit ? '保存' : '发布') + '</button>'
            + '</div>'
            + '</div></div>';
        document.body.appendChild(overlay);
        _publishOverlay = overlay;
        _publishDeck = null;
        _editingPostId = isEdit ? editData.id : null;
        document.body.style.overflow = 'hidden';

        overlay.querySelector('.community-modal-close').addEventListener('click', closePublish);
        document.getElementById('cmPubCancel').addEventListener('click', closePublish);

        // 嵌入卡组
        document.getElementById('cmPubDeckBtn').addEventListener('click', function () {
            var ydk = prompt('请粘贴 YDK 卡组内容（#main/#extra/!side 格式，或纯数字列表）:');
            if (!ydk) return;
            if (window.DeckViewer && window.DeckViewer.parse) {
                var deck = window.DeckViewer.parse(ydk);
                if (deck) {
                    _publishDeck = deck;
                    var total = (deck.main || []).length + (deck.extra || []).length + (deck.side || []).length;
                    var preview = document.getElementById('cmPubPreview');
                    if (preview) preview.innerHTML = '<div style="background:#111;padding:8px 12px;border-radius:6px;'
                        + 'border:1px solid rgba(216,30,68,0.3);color:#F0E68C;font-size:0.82rem;">'
                        + '📦 卡组：主' + (deck.main || []).length + '张 · 额'
                        + (deck.extra || []).length + '张 · 副' + (deck.side || []).length + '张 (共' + total + '张)</div>';
                    return;
                }
            }
            alert('无法解析卡组内容');
        });

        // 嵌入卡片搜索
        document.getElementById('cmPubCardBtn').addEventListener('click', openCardSearch);
        document.getElementById('cmPubEmojiBtn').addEventListener('click', function () {
            openEmojiPicker(function (name) {
                var textarea = document.getElementById('cmPubContent');
                if (textarea) textarea.value += '[img]' + name + '[/img]';
            });
        });

        // 发布
        document.getElementById('cmPubSubmit').addEventListener('click', function () {
            var title = (document.getElementById('cmPubTitle').value || '').trim();
            var content = (document.getElementById('cmPubContent').value || '').trim();
            var section = document.getElementById('cmPubSection').value;
            var tags = (document.getElementById('cmPubTags').value || '').trim();
            if (!title) { alert('请输入标题'); return; }
            if (!content && !_publishDeck) { alert('请输入内容'); return; }

            var contentJson = buildContentJson(content, _publishDeck);
            var btn = document.getElementById('cmPubSubmit');
            btn.disabled = true;
            btn.textContent = _editingPostId ? '保存中...' : '发布中...';

            if (_editingPostId) {
                // 编辑模式：只有管理员带 section（站点代理侧还会再校验一次，非管理员会被剥掉）
                var putBody = { title: title, content: content, contentJson: contentJson, tags: tags };
                if (allowSection) putBody.section = section;
                authApi('/api/forum/posts/' + _editingPostId, {
                    method: 'PUT',
                    body: putBody,
                }).then(function (res) {
                    closePublish();
                    if (_detailPostId === _editingPostId) { closeDetail(); }
                    loadFeed();
                    // 服务端回读发现分区没生效时给的提示（正文已保存）
                    if (res && res.warning) alert(res.warning);
                }).catch(function (e) {
                    alert('保存失败: ' + e.message);
                    btn.disabled = false;
                    btn.textContent = '保存';
                });
            } else {
                // 新建模式
                if (USE_MOCK) {
                    mockNewPost(section, title, content, contentJson, tags);
                    closePublish();
                    state.page = 1;
                    loadFeed();
                    return;
                }
                authApi('/api/forum/posts', {
                    method: 'POST',
                    body: { section: section, title: title, content: content, contentJson: contentJson, tags: tags },
                }).then(function () {
                    closePublish();
                    state.page = 1;
                    loadFeed();
                }).catch(function (e) {
                    alert('发布失败: ' + e.message);
                    btn.disabled = false;
                    btn.textContent = '发布';
                });
            }
        });
    }

    function closePublish() {
        if (_publishOverlay) {
            _publishOverlay.remove();
            _publishOverlay = null;
            _publishDeck = null;
            _editingPostId = null;
            document.body.style.overflow = '';
        }
    }

    // ── 内容块 ↔ 文本标记 互转（编辑时无损回填）──
    //   正文在服务端存两份：纯文本 content + 块数组 contentJson。
    //   卡组块只活在 contentJson 里，编辑框如果只回填 content，保存后卡组就没了。
    function deckToYdk(deck) {
        var lines = ['#main'];
        (deck.main || []).forEach(function (id) { lines.push(String(id)); });
        lines.push('#extra');
        (deck.extra || []).forEach(function (id) { lines.push(String(id)); });
        lines.push('!side');
        (deck.side || []).forEach(function (id) { lines.push(String(id)); });
        return lines.join('\n');
    }

    function serializeBlocksToText(blocks) {
        var out = [];
        (blocks || []).forEach(function (b) {
            if (!b) return;
            if (b.type === 'text') out.push(b.text || '');
            else if (b.type === 'card') out.push('[card]' + b.id + '[/card]');
            else if (b.type === 'img') out.push('[img]' + b.name + '[/img]');
            else if (b.type === 'deck') {
                var ydk = (b.ydk && b.ydk.trim()) ? b.ydk.trim() : deckToYdk(b);
                out.push('[deck]\n' + ydk + '\n[/deck]');
            }
        });
        // 不再用 \n 连接：文本块自己保留了原始换行，再加分隔符会让每次编辑都多出空行
        return out.join('');
    }

    function buildContentJson(content, deck) {
        var blocks = [];
        // 先解析标记
        var regex = /\[deck\]([\s\S]*?)\[\/deck\]|\[card\](\d+)\[\/card\]|\[img\]([a-zA-Z]+)\[\/img\]/g;
        var lastIdx = 0;
        var match;
        // 文本块保留原始空白（尤其换行）：卡图后面按回车要能真的换行，不能 trim 掉
        var keepRaw = function (raw) {
            if (!raw) return false;
            return raw.trim().length > 0 || raw.indexOf('\n') !== -1;
        };
        while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIdx) {
                var raw = content.slice(lastIdx, match.index);
                if (keepRaw(raw)) blocks.push({ type: 'text', text: raw });
            }
            if (match[1] !== undefined) {
                if (window.DeckViewer && window.DeckViewer.parse) {
                    var d = window.DeckViewer.parse(match[1].trim());
                    if (d) blocks.push({ type: 'deck', ydk: match[1].trim(), main: d.main, extra: d.extra, side: d.side });
                }
            } else if (match[2] !== undefined) {
                blocks.push({ type: 'card', id: parseInt(match[2], 10) });
            } else if (match[3] !== undefined) {
                blocks.push({ type: 'img', name: match[3] });
            }
            lastIdx = match.index + match[0].length;
        }
        if (lastIdx < content.length) {
            var tail = content.slice(lastIdx);
            if (keepRaw(tail)) blocks.push({ type: 'text', text: tail });
        }
        if (blocks.length === 0 && content.trim()) {
            blocks.push({ type: 'text', text: content.trim() });
        }
        // 如果还有嵌入的 deck 但标记中未包含，追加
        if (deck && !blocks.some(function (b) { return b.type === 'deck'; })) {
            blocks.push({
                type: 'deck',
                ydk: '',
                main: deck.main || [],
                extra: deck.extra || [],
                side: deck.side || [],
            });
        }
        return blocks;
    }

    // ═══════════════════════════ 卡片搜索 ═══════════════════════

    var _cardSearchOverlay = null;

    function openCardSearch() {
        openCardSearchGeneric(function (cardId) {
            var textarea = document.getElementById('cmPubContent');
            if (textarea) {
                var pos = textarea.selectionStart || textarea.value.length;
                var before = textarea.value.slice(0, pos);
                var after = textarea.value.slice(pos);
                textarea.value = before + '[card]' + cardId + '[/card]' + after;
            }
        });
    }

    function openCardSearchGeneric(onSelect) {
        var overlay = document.createElement('div');
        overlay.className = 'card-search-overlay active';
        overlay.innerHTML = '<div class="card-search-box">'
            + '<div class="card-search-header" style="display:flex;gap:8px;align-items:center;">'
            + '<input class="card-search-input" id="csInput" placeholder="输入卡名或卡ID搜索..." style="flex:1;">'
            + '<button id="csCloseBtn" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;padding:4px 8px;">&times;</button>'
            + '</div>'
            + '<div class="card-search-results" id="csResults">'
            + '<div style="color:#888;text-align:center;padding:20px;grid-column:1/-1;">输入关键词搜索卡片</div>'
            + '</div>'
            + '</div>';
        document.body.appendChild(overlay);
        _cardSearchOverlay = overlay;

        // 仅通过 × 按钮、Esc 或选择卡片关闭搜索框
        document.getElementById('csCloseBtn').addEventListener('click', function () {
            overlay.remove();
            _cardSearchOverlay = null;
        });

        var timer = 0;
        document.getElementById('csInput').addEventListener('input', function () {
            clearTimeout(timer);
            var q = this.value.trim();
            if (!q) return;
            timer = setTimeout(function () { searchCards(q, onSelect); }, 300);
        });
    }

    // 官方卡名（按译名偏好，复用 deck-viewer 的字段解析）
    function officialCardName(c) {
        if (window.DeckViewer && window.DeckViewer.officialCardFields) {
            try { return window.DeckViewer.officialCardFields(c).name; } catch (e) {}
        }
        return c.sc_name || c.cn_name || c.en_name || ('卡牌 ' + c.id);
    }

    function searchCards(q, onSelect) {
        var results = document.getElementById('csResults');
        if (!results) return;
        results.innerHTML = '<div style="color:#888;text-align:center;padding:20px;grid-column:1/-1;">搜索中...</div>';

        var qLower = q.toLowerCase();

        // DIY 结果（本地卡池）
        var diyPromise;
        var index = window._cardIndex;
        if (index && index.size) {
            var matches = [];
            index.forEach(function (card) {
                if (matches.length >= 30) return;
                if ((card.name || '').toLowerCase().indexOf(qLower) !== -1 || String(card.id).indexOf(q) !== -1) {
                    matches.push(card);
                }
            });
            diyPromise = Promise.resolve(matches);
        } else {
            diyPromise = fetch('/api/cards?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (cards) {
                var m = [];
                cards.forEach(function (card) {
                    if (m.length >= 30) return;
                    if ((card.name || '').toLowerCase().indexOf(qLower) !== -1 || String(card.id).indexOf(q) !== -1) m.push(card);
                });
                return m;
            }).catch(function () { return []; });
        }

        // 官方结果（百鸽 ygocdb 同源代理，与 DIY 合并去重）
        var officialPromise = fetch('/api/ygocdb/?search=' + encodeURIComponent(q))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) { return data.result || []; })
            .catch(function () { return []; });

        Promise.all([diyPromise, officialPromise]).then(function (parts) {
            var diy = parts[0];
            var official = parts[1];
            var diyIds = {};
            diy.forEach(function (c) { diyIds[String(c.id)] = true; });
            var merged = diy.slice(0, 30);
            official.forEach(function (c) {
                if (merged.length >= 30) return;
                if (diyIds[String(c.id)]) return; // DIY 已有的不重复
                merged.push({
                    id: c.id,
                    name: officialCardName(c),
                    official: true,
                });
            });
            renderCardSearchResults(merged, onSelect);
        });
    }

    function renderCardSearchResults(cards, onSelect) {
        var results = document.getElementById('csResults');
        if (!results) return;
        if (!cards.length) {
            results.innerHTML = '<div style="color:#888;text-align:center;padding:20px;grid-column:1/-1;">无匹配卡片</div>';
            return;
        }
        var OCG = 'https://cdn.233.momobako.com/ygopro/pics/';
        var SP = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/';
        var DIY = 'https://api.ygopro3.cn/pics/siro/';
        results.innerHTML = cards.map(function (c) {
            return '<div class="card-search-item" data-card-id="' + c.id + '">'
                + '<img src="' + OCG + c.id + '.jpg" loading="lazy"'
                + ' onerror="this.onerror=null;this.src=\'' + SP + c.id + '.jpg\';'
                + 'this.onerror=function(){this.onerror=null;this.src=\'' + DIY + c.id + '.jpg\';'
                + 'this.onerror=function(){this.src=\'cover.jpg\';}}">'
                + '<span class="card-search-item-name">' + esc(c.name || '')
                + (c.official ? ' <small style="color:#7fbfff;">官方</small>' : '')
                + '<br><small style="color:#888;">#' + c.id + '</small></span>'
                + '</div>';
        }).join('');

        results.querySelectorAll('.card-search-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var cardId = item.getAttribute('data-card-id');
                if (onSelect) onSelect(cardId);
                if (_cardSearchOverlay) { _cardSearchOverlay.remove(); _cardSearchOverlay = null; }
            });
        });
    }

    function openCardTooltip(cardId, anchor) {
        var card = getCardInfoById(cardId);
        // 本地还没有这张卡（没打开过卡池）→ 先按 id 补一张再弹
        if (!card) {
            ensureCards([cardId]).then(function () {
                showCardTooltip(cardId, anchor);
            });
            return;
        }
        showCardTooltip(cardId, anchor);
    }

    function showCardTooltip(cardId, anchor) {
        var card = getCardInfoById(cardId);

        // 渲染弹窗（DIY 或官方字段）
        var show = function (fields) {
            var overlay = document.createElement('div');
            overlay.className = 'community-modal-overlay active';
            overlay.style.zIndex = '60001';
            overlay.innerHTML = '<div class="community-modal" style="width:min(420px,92vw);">'
                + '<div class="community-modal-header">'
                + '<span class="community-modal-title">' + esc(fields.cardName)
                + ' <small style="color:#888;font-weight:400;">#' + cardId + '</small></span>'
                + '<button class="community-modal-close">&times;</button>'
                + '</div>'
                + '<div class="community-modal-body" style="text-align:center;">'
                + '<img src="' + OCG_PIC_URL + cardId + '.jpg" style="width:200px;border-radius:6px;margin-bottom:12px;"'
                + ' onerror="this.onerror=null;this.src=\'' + SP_PIC_URL + cardId + '.jpg\';'
                + 'this.onerror=function(){this.onerror=null;this.src=\'' + DIY_PIC_URL + cardId + '.jpg\';'
                + 'this.onerror=function(){this.src=\'cover.jpg\';}}">'
                + (fields.cardType ? '<div style="color:#aaa;font-size:0.82rem;margin-bottom:4px;">' + esc(fields.cardType) + '</div>' : '')
                + (fields.attrRace ? '<div style="color:#999;font-size:0.78rem;margin-bottom:2px;">' + esc(fields.attrRace) + '</div>' : '')
                + (fields.atkDef ? '<div style="color:#ddd;font-weight:600;margin-bottom:8px;">' + fields.atkDef + '</div>' : '')
                + (fields.desc ? '<div style="color:#bbb;font-size:0.78rem;line-height:1.5;text-align:left;white-space:pre-line;">' + esc(fields.desc) + '</div>' : '')
                + '</div></div>';
            document.body.appendChild(overlay);

            var close = function () { overlay.remove(); };
            overlay.querySelector('.community-modal-close').addEventListener('click', close);
            document.addEventListener('keydown', function escClose(e) {
                if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); }
            });
        };

        if (card) {
            var isMonster = card.typeInfo && card.typeInfo.baseType === '怪兽';
            show({
                cardName: card.name || ('#' + cardId),
                cardType: card.typeInfo ? card.typeInfo.fullType : '',
                attrRace: isMonster ? ((card.attrName || '') + ' | ' + (card.raceName || '') + (card.level ? ' | Lv' + card.level : '')) : '',
                atkDef: isMonster ? ('ATK ' + (card.atk < 0 ? '?' : card.atk) + ' / DEF ' + (((card.type | 0) & 0x4000000) ? '—' : (card.def < 0 ? '?' : card.def))) : '',
                desc: card.processedDesc || '',
            });
        } else if (window.DeckViewer && window.DeckViewer.fetchOfficialCard) {
            // 非 DIY 卡：从官方卡查补充
            window.DeckViewer.fetchOfficialCard(cardId).then(function (official) {
                if (!official) {
                    show({ cardName: '#' + cardId, cardType: '', attrRace: '', atkDef: '', desc: '' });
                    return;
                }
                var f = window.DeckViewer.officialCardFields(official);
                show({ cardName: f.name, cardType: f.fullType, attrRace: f.raceAttr, atkDef: f.atkDef, desc: f.desc });
            });
        } else {
            show({ cardName: '#' + cardId, cardType: '', attrRace: '', atkDef: '', desc: '' });
        }
    }

    // ═══════════════════════════ 个人中心 ═══════════════════════

    window._openProfilePanel = function (initialTab) {
        // 确保社区 CSS 已激活（从主页直接打开时需要）
        var cssLink = document.getElementById('css-deck-community');
        if (cssLink && cssLink.media !== 'all') cssLink.media = 'all';

        var overlay = document.createElement('div');
        overlay.className = 'community-modal-overlay active';
        overlay.style.zIndex = '100000';
        overlay.innerHTML =
            '<div class="community-modal profile-modal profile-nav-modal">'
            + '<div class="community-modal-header">'
            + '<span class="community-modal-title">个人中心</span>'
            + '<button class="community-modal-close">&times;</button>'
            + '</div>'
            + '<div class="community-modal-body profile-nav-body">'
            + '<div class="profile-nav">'
            + '<button class="profile-nav-item active" data-psection="info">个人信息</button>'
            + '<button class="profile-nav-item" data-psection="forum">论坛信息</button>'
            + '<button class="profile-nav-item" data-psection="settings">编辑设置</button>'
            + '</div>'
            + '<div id="cmProfileContent" class="profile-content"></div>'
            + '</div></div>';
        document.body.appendChild(overlay);

        var closeProfile = function () { overlay.remove(); };
        overlay.querySelector('.community-modal-close').addEventListener('click', closeProfile);

        function showSection(name) {
            overlay.querySelectorAll('.profile-nav-item').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-psection') === name);
            });
            if (name === 'settings') {
                openSettingsInModal(overlay);
            } else if (name === 'forum') {
                renderForumInfo(overlay);
            } else {
                renderProfileInfo(overlay);
            }
        }

        overlay.querySelectorAll('.profile-nav-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                showSection(btn.getAttribute('data-psection'));
            });
        });

        // Esc 关闭
        var escClose = function (e) { if (e.key === 'Escape') { closeProfile(); document.removeEventListener('keydown', escClose); } };
        document.addEventListener('keydown', escClose);

        // 有未读提醒时，在「论坛信息」导航上点一个小红点
        if (typeof window._forumNotifRefresh === 'function') {
            window._forumNotifRefresh().then(function (d) {
                var btn = overlay.querySelector('.profile-nav-item[data-psection="forum"]');
                if (!btn || !d) return;
                var n = ((d.unread && d.unread.replies) || 0) + ((d.unread && d.unread.likes) || 0);
                btn.classList.toggle('has-dot', n > 0);
            });
        }

        // 打开时定位到指定板块（默认：个人信息）
        showSection(initialTab === 'forum' || initialTab === 'settings' ? initialTab : 'info');
    };

    // ── 个人信息：头像+称号卡 + 对战记录 ─────────────
    function renderProfileInfo(overlay) {
        var container = overlay.querySelector('#cmProfileContent');
        if (!container) return;
        container.innerHTML = '<div class="community-loading">加载中...</div>';

        var auth = window._communityAuth;
        var username = auth ? auth.username : '';
        api('/api/forum/profile?' + getAuth()).then(function (profile) {
            var html = '<div class="profile-card">'
                + '<img class="profile-card-avatar" src="' + (profile.avatarVersion
                    ? '/api/forum/avatar/' + encodeURIComponent(username) + '?v=' + profile.avatarVersion
                    : 'cover.jpg') + '" alt="头像">'
                + '<div class="profile-card-info">'
                + '<div class="profile-card-name">' + esc(profile.displayName || username) + '</div>'
                + '<div class="profile-card-account">账号：' + esc(username) + '</div>'
                + '<div class="profile-card-ladder" id="profileCardLadder">' + (window._profileLadderHtml || '') + '</div>'
                + '<div class="profile-card-title" id="profileCardTitle"><span style="color:#888;font-size:12px;">加载称号中...</span></div>'
                + '</div></div>'
                + '<div class="profile-notif" id="profileNotif"></div>'
                + '<div class="profile-section-title">⚔ 对战记录（当前赛季）</div>'
                + '<div id="profileDuelsBox"><div class="community-loading">加载对局中...</div></div>';
            container.innerHTML = html;

            // 新回复 / 新点赞（与头像红点同一份数据）
            if (typeof window._forumNotifRefresh === 'function') {
                window._forumNotifRefresh().then(function (d) {
                    var box = container.querySelector('#profileNotif');
                    if (!box || !d) return;
                    var r = (d.unread && d.unread.replies) || 0;
                    var l = (d.unread && d.unread.likes) || 0;
                    box.innerHTML = (r || l)
                        ? '<span class="pn-chip">💬 回复我的 ' + r + '</span>'
                          + '<span class="pn-chip">❤ 点赞我的 ' + l + '</span>'
                        : '';
                });
            }

            // 天梯排名与段位（当前赛季）
            authApi('/api/forum/profile/ladder').then(function (ld) {
                var box = document.getElementById('profileCardLadder');
                if (!box) return;
                var tier = (ld.tier || '').replace(/^S\d+\s+/, ''); // S2 钻石 → 钻石
                var parts = [];
                if (ld.rank != null && ld.rank > 0) {
                    parts.push('天梯第 ' + ld.rank + ' 名');
                } else if (ld.rating > 0) {
                    parts.push('天梯未上榜');
                }
                if (tier) parts.push(tier);
                if (ld.rating > 0) parts.push(ld.rating + '分');
                if (parts.length) {
                    window._profileLadderHtml = parts.join(' · ');
                    box.innerHTML = esc(parts.join(' · '));
                } else {
                    box.innerHTML = '<span style="color:#888;font-size:12px;">暂无天梯数据</span>';
                }
            }).catch(function () {});

            // 称号（主+副）
            authApi('/api/forum/profile/titles').then(function (td) {
                var box = document.getElementById('profileCardTitle');
                if (!box) return;
                var parts = [];
                if (td.selectedTitle) parts.push(td.selectedTitle);
                if (td.selectedTitle2) parts.push(td.selectedTitle2);
                if (!parts.length && td.titles && td.titles.length) parts.push(td.titles[td.titles.length - 1]);
                box.innerHTML = parts.length
                    ? parts.map(function (t) { return '<span class="profile-title-chip">' + esc(t) + '</span>'; }).join('')
                    : '<span style="color:#888;font-size:12px;">暂无称号</span>';
            }).catch(function () {
                var box = document.getElementById('profileCardTitle');
                if (box) box.innerHTML = '';
            });

            // 对战记录
            authApi('/api/forum/profile/duels').then(function (data) {
                var box = document.getElementById('profileDuelsBox');
                if (box) renderDuels(data, box);
            }).catch(function (e) {
                var box = document.getElementById('profileDuelsBox');
                if (box) box.innerHTML = '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
            });
        }).catch(function (e) {
            container.innerHTML = '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
        });
    }

    // ── 论坛信息：发帖/回复/点赞 子页签 ─────────────
    function renderForumInfo(overlay) {
        var container = overlay.querySelector('#cmProfileContent');
        if (!container) return;
        container.innerHTML =
            '<div class="forum-sub-tabs">'
            + '<button class="forum-sub-tab active" data-ftab="posts">我的发帖</button>'
            + '<button class="forum-sub-tab" data-ftab="replies">我的回复</button>'
            + '<button class="forum-sub-tab" data-ftab="liked">点赞过的</button>'
            + '<button class="forum-sub-tab" data-ftab="inbox-replies" id="ftabInboxReplies">回复我的</button>'
            + '<button class="forum-sub-tab" data-ftab="inbox-likes" id="ftabInboxLikes">点赞我的</button>'
            + '</div>'
            + '<div id="forumSubContent"></div>';
        var sub = container.querySelector('#forumSubContent');
        renderForumList('posts', sub, overlay);
        container.querySelectorAll('.forum-sub-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                container.querySelectorAll('.forum-sub-tab').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                renderForumList(btn.getAttribute('data-ftab'), sub, overlay);
            });
        });

        // 未读红点标在两个板块上（点进去看的时候才标记已读）
        if (typeof window._forumNotifRefresh === 'function') {
            window._forumNotifRefresh().then(function (d) {
                if (!d) return;
                var r = (d.unread && d.unread.replies) || 0;
                var l = (d.unread && d.unread.likes) || 0;
                var tr = container.querySelector('#ftabInboxReplies');
                var tl = container.querySelector('#ftabInboxLikes');
                if (tr) tr.classList.toggle('has-dot', r > 0);
                if (tl) tl.classList.toggle('has-dot', l > 0);
            });
        }
    }

    // 「回复我的 / 点赞我的」两个板块
    function renderInbox(tab, sub, overlay) {
        sub.innerHTML = '<div class="community-loading">加载中...</div>';
        var isReply = tab === 'inbox-replies';
        var load = (typeof window._forumNotifRefresh === 'function')
            ? window._forumNotifRefresh()
            : Promise.resolve({ replies: [], likes: [] });
        load.then(function (d) {
            var list = (d && (isReply ? d.replies : d.likes)) || [];
            if (!list.length) {
                sub.innerHTML = '<div class="cp-empty">' + (isReply ? '还没人回复你的帖子' : '还没人赞你的帖子') + '</div>';
                return;
            }
            sub.innerHTML = '<div class="inbox-list">' + list.map(function (x) {
                var head = '<b>' + esc(x.authorName) + '</b> '
                    + (isReply ? '回复了' : '赞了') + '《' + esc(x.postTitle) + '》';
                return '<div class="inbox-item' + (x.unread ? ' unread' : '') + '" data-post="' + x.postId + '">'
                    + '<div class="inbox-line">' + head
                    + '<span class="inbox-time">' + timeAgo(new Date((x.ts || 0) * 1000).toISOString()) + '</span>'
                    + '</div>'
                    + (isReply && x.content ? '<div class="inbox-content">' + esc(x.content) + '</div>' : '')
                    + '</div>';
            }).join('') + '</div>';
            sub.querySelectorAll('.inbox-item').forEach(function (el) {
                el.addEventListener('click', function () {
                    var pid = parseInt(el.getAttribute('data-post'), 10);
                    var ov = sub.closest('.community-modal-overlay');
                    if (ov) ov.remove();
                    if (pid) openDetail(pid);
                });
            });
            // 看过了 → 标记已读（下次进来红点/未读高亮就没了）
            if (typeof window._forumNotifMarkRead === 'function') window._forumNotifMarkRead();
        }).catch(function (e) {
            sub.innerHTML = '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
        });
    }

    function renderForumList(tab, sub, overlay) {
        if (tab === 'inbox-replies' || tab === 'inbox-likes') {
            renderInbox(tab, sub, overlay);
            return;
        }
        sub.innerHTML = '<div class="community-loading">加载中...</div>';
        var url = tab === 'posts' ? '/api/forum/my-posts'
            : tab === 'replies' ? '/api/forum/my-replies'
                : '/api/forum/liked-posts';
        authApi(url).then(function (data) {
            if (tab === 'replies') { renderMyReplies(data, sub); return; }
            var list = data.posts || [];
            if (!list.length) { sub.innerHTML = '<div class="cp-empty">暂无内容</div>'; return; }
            sub.innerHTML = '<div class="community-feed">' + list.map(function (p) {
                return '<div class="community-post" data-id="' + p.id + '">'
                    + '<div class="cp-title">' + esc(p.title || p.postTitle || '') + '</div>'
                    + '<div class="cp-meta">'
                    + '<span>' + timeAgo(p.createTime) + '</span>'
                    + '<span class="cp-section-tag">' + (SECTION_NAMES[p.section] || '') + '</span>'
                    + '<span style="margin-left:auto;">❤ ' + (p.likeCount || 0) + ' 💬 ' + (p.replyCount || 0) + '</span>'
                    + '</div></div>';
            }).join('') + '</div>';
            sub.querySelectorAll('.community-post').forEach(function (el) {
                el.addEventListener('click', function () {
                    var ov = sub.closest('.community-modal-overlay');
                    if (ov) ov.remove();
                    openDetail(parseInt(el.getAttribute('data-id')));
                });
            });
        }).catch(function (e) {
            sub.innerHTML = '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
        });
    }

    function loadProfileTabInModal(tab, overlay) {
        var container = overlay.querySelector('#cmProfileContent');
        if (!container) return;
        container.innerHTML = '<div class="community-loading">加载中...</div>';

        var url = tab === 'posts' ? '/api/forum/my-posts'
            : tab === 'replies' ? '/api/forum/my-replies'
                : tab === 'duels' ? '/api/forum/profile/duels'
                    : '/api/forum/liked-posts';

        authApi(url).then(function (data) {
            if (tab === 'duels') {
                renderDuels(data, container);
            } else if (tab === 'replies') {
                renderMyReplies(data, container);
            } else {
                var list = data.posts || [];
                if (!list.length) {
                    container.innerHTML = '<div class="cp-empty">暂无内容</div>';
                    return;
                }
                container.innerHTML = '<div class="community-feed">' + list.map(function (p) {
                    return '<div class="community-post" data-id="' + p.id + '">'
                        + '<div class="cp-title">' + esc(p.title || p.postTitle || '') + '</div>'
                        + '<div class="cp-meta">'
                        + '<span>' + timeAgo(p.createTime) + '</span>'
                        + '<span class="cp-section-tag">' + (SECTION_NAMES[p.section] || '') + '</span>'
                        + '<span style="margin-left:auto;">❤ ' + (p.likeCount || 0) + ' 💬 ' + (p.replyCount || 0) + '</span>'
                        + '</div></div>';
                }).join('') + '</div>';
                container.querySelectorAll('.community-post').forEach(function (el) {
                    el.addEventListener('click', function () {
                        overlay.remove();
                        openDetail(parseInt(el.getAttribute('data-id')));
                    });
                });
            }
        }).catch(function (e) {
            container.innerHTML = '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
        });
    }

    // ═══════════════ 称号选择（个人中心设置共用） ═══════════════

    function renderTitleSettings() {
        var box = document.getElementById('cmTitleBox');
        if (!box) return;
        authApi('/api/forum/profile/titles').then(function (data) {
            var titles = data.titles || [];
            if (!titles.length) {
                box.innerHTML = '<div style="color:#999;font-size:0.78rem;">暂无赛季称号，完成天梯定级赛并在赛季结算后可获得</div>';
                return;
            }
            var main = data.selectedTitle || titles[titles.length - 1];
            var sub = data.selectedTitle2 || '';

            var html = '';
            html += '<div style="color:#ccc;font-size:0.75rem;margin-bottom:4px;">主称号</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">';
            titles.forEach(function (t) {
                var sel = t === main ? ' checked' : '';
                html += '<label style="padding:4px 10px;border:1px solid ' + (sel ? '#ff6b6b' : '#444') + ';border-radius:12px;cursor:pointer;font-size:0.75rem;color:' + (sel ? '#ff6b6b' : '#ccc') + ';">'
                    + '<input type="radio" name="cmMainTitle" value="' + esc(t) + '"' + sel + ' style="display:none;">' + esc(t) + '</label>';
            });
            html += '</div>';
            html += '<div style="color:#ccc;font-size:0.75rem;margin:10px 0 4px;">副称号（可选）</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">';
            titles.forEach(function (t) {
                var sel = t === sub ? ' checked' : '';
                html += '<label style="padding:4px 10px;border:1px solid ' + (sel ? '#ffd700' : '#444') + ';border-radius:12px;cursor:pointer;font-size:0.75rem;color:' + (sel ? '#ffd700' : '#ccc') + ';">'
                    + '<input type="radio" name="cmSubTitle" value="' + esc(t) + '"' + sel + ' style="display:none;">' + esc(t) + '</label>';
            });
            html += '</div>';
            html += '<button class="community-btn" id="cmTitleSaveBtn" style="margin-top:8px;">保存称号</button>';
            box.innerHTML = html;

            // 称号选择：点击选中并互斥高亮，再次点击已选中的取消选择
            function bindTitleToggle(name, color) {
                var inputs = box.querySelectorAll('input[name="' + name + '"]');
                inputs.forEach(function (inp) {
                    var lb = inp.parentElement;
                    lb.addEventListener('click', function (e) {
                        e.preventDefault(); // 阻止 label 隐式激活 input
                        if (inp.checked) {
                            inp.checked = false; // 再次点击 → 取消
                        } else {
                            inputs.forEach(function (i) { i.checked = false; });
                            inp.checked = true;   // 互斥选中
                        }
                        inputs.forEach(function (i) {
                            var lb2 = i.parentElement;
                            var on = i.checked;
                            lb2.style.borderColor = on ? color : '#444';
                            lb2.style.color = on ? color : '#ccc';
                        });
                    });
                });
            }
            bindTitleToggle('cmMainTitle', '#ff6b6b');
            bindTitleToggle('cmSubTitle', '#ffd700');

            document.getElementById('cmTitleSaveBtn').addEventListener('click', function () {
                var m = box.querySelector('input[name="cmMainTitle"]:checked');
                var s = box.querySelector('input[name="cmSubTitle"]:checked');
                var selectedTitle = m ? m.value : '';
                var selectedTitle2 = s ? s.value : '';
                if (selectedTitle && selectedTitle === selectedTitle2) {
                    alert('主称号与副称号不能相同');
                    return;
                }
                authApi('/api/forum/profile/title', {
                    method: 'POST',
                    body: { selectedTitle: selectedTitle, selectedTitle2: selectedTitle2 },
                }).then(function () {
                    alert('称号已保存，游戏内下次登录生效');
                }).catch(function (e) {
                    alert('保存失败: ' + e.message);
                });
            });
        }).catch(function (e) {
            box.innerHTML = '<div class="cp-empty">加载称号失败: ' + esc(e.message) + '</div>';
        });
    }

    function openSettingsInModal(overlay) {
        var container = overlay.querySelector('#cmProfileContent');
        if (!container) return;
        var auth = window._communityAuth;
        var username = auth ? auth.username : '';
        api('/api/forum/profile?' + getAuth()).then(function (profile) {
            var html = '<div style="max-width:400px;">';
            html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">';
            html += '<img id="cmSettingAvatar" src="' + (profile.avatarVersion
                ? '/api/forum/avatar/' + encodeURIComponent(username) + '?v=' + profile.avatarVersion
                : 'cover.jpg') + '" style="width:64px;height:64px;border-radius:4px;border:1px solid #333;object-fit:cover;">';
            html += '<div>';
            html += '<button class="community-btn" id="cmAvatarBtn" style="font-size:0.78rem;margin-bottom:6px;"'
                + (profile.canChangeAvatar ? '' : 'disabled') + '>'
                + (profile.canChangeAvatar ? '修改头像' : '今天已修改过头像') + '</button>';
            html += '<div style="color:#666;font-size:0.65rem;">64×64 缩略图 · 每天限1次</div>';
            html += '</div></div>';
            html += '<label class="community-form-label">显示名</label>';
            html += '<div style="display:flex;gap:8px;margin-bottom:8px;">';
            html += '<input class="community-input" id="cmSettingName" style="margin-bottom:0;flex:1;"'
                + ' value="' + esc(profile.displayName || '') + '" maxlength="64"'
                + (profile.canChangeName ? '' : ' disabled') + '>';
            html += '<button class="community-btn" id="cmNameBtn" style="font-size:0.78rem;flex-shrink:0;"'
                + (profile.canChangeName ? '' : 'disabled') + '>'
                + (profile.canChangeName ? '保存' : '今天已修改') + '</button>';
            html += '</div>';
            html += '<div style="color:#666;font-size:0.65rem;">同步天梯显示名 · 每天限1次</div>';
            html += '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">';
            html += '<label class="community-form-label">称号展示（游戏内显示主+副）</label>';
            html += '<div id="cmTitleBox"><div class="community-loading">加载称号中...</div></div>';
            html += '<div style="color:#666;font-size:0.65rem;">赛季结算自动累积 · 可随时切换</div>';
            html += '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">';
            html += '<label class="community-form-label">修改密码</label>';
            html += '<input class="community-input" id="cmOldPwd" type="password" placeholder="当前密码">';
            html += '<input class="community-input" id="cmNewPwd" type="password" placeholder="新密码（至少6位）">';
            html += '<input class="community-input" id="cmNewPwd2" type="password" placeholder="确认新密码">';
            html += '<button class="community-btn" id="cmPwdBtn" style="font-size:0.78rem;">修改密码</button>';
            html += '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">';
            html += '<button style="display:block;width:100%;background:none;border:1px solid #ff6b6b;color:#ff6b6b;border-radius:4px;padding:8px;font-size:0.78rem;cursor:pointer;" id="cmLogoutBtn">退出登录</button>';
            html += '</div>';
            container.innerHTML = html;

            renderTitleSettings();

            var pwdBtn = document.getElementById('cmPwdBtn');
            if (pwdBtn) pwdBtn.addEventListener('click', function () {
                var oldP = (document.getElementById('cmOldPwd').value || '').trim();
                var np = document.getElementById('cmNewPwd').value || '';
                var np2 = document.getElementById('cmNewPwd2').value || '';
                if (!oldP) { alert('请输入当前密码'); return; }
                if (np.length < 6) { alert('新密码至少 6 位'); return; }
                if (np !== np2) { alert('两次输入的新密码不一致'); return; }
                authApi('/api/forum/profile/password', { method: 'POST', body: { oldPassword: oldP, newPassword: np } })
                    .then(function () {
                        alert('密码已修改！请重新登录。');
                        fetch('/api/forum/logout', { method: 'POST' }).then(function () {}).catch(function () {})
                            .finally(function () {
                                window._communityLoggedIn = false;
                                window._communityUsername = '';
                                window._communityAuth = null;
                                window._communityIsAdmin = false;
                                overlay.remove();
                                initShell();
                            });
                    })
                    .catch(function (e) { alert('修改失败: ' + (e && e.message)); });
            });

            var logoutBtn = document.getElementById('cmLogoutBtn');
            if (logoutBtn) logoutBtn.addEventListener('click', function () {
                fetch('/api/forum/logout', { method: 'POST' }).then(function () {})
                    .catch(function () {}).finally(function () {
                        window._communityLoggedIn = false;
                        window._communityUsername = '';
                        window._communityAuth = null;
                        window._communityIsAdmin = false;
                        overlay.remove();
                        initShell();
                    });
            });

            var avatarBtn = document.getElementById('cmAvatarBtn');
            if (avatarBtn && profile.canChangeAvatar) {
                avatarBtn.addEventListener('click', function () {
                    openAvatarCrop(username, profile.avatarVersion);
                });
            }
            var nameBtn = document.getElementById('cmNameBtn');
            if (nameBtn && profile.canChangeName) {
                nameBtn.addEventListener('click', function () {
                    var newName = (document.getElementById('cmSettingName').value || '').trim();
                    if (!newName) { alert('显示名不能为空'); return; }
                    authApi('/api/forum/profile/display-name', {
                        method: 'POST',
                        body: { displayName: newName },
                    }).then(function () {
                        alert('显示名已修改！');
                        openSettingsInModal(overlay);
                    }).catch(function (e) {
                        alert('修改失败: ' + e.message);
                    });
                });
            }
        }).catch(function (e) {
            container.innerHTML = '<div class="cp-empty">加载设置失败: ' + esc(e.message) + '</div>';
        });
    }

    function loadProfileTab(tab) {
        var container = document.getElementById('cmProfileContent');
        if (!container) return;
        container.innerHTML = '<div class="community-loading">加载中...</div>';

        var url = tab === 'posts' ? '/api/forum/my-posts'
            : tab === 'replies' ? '/api/forum/my-replies'
                : tab === 'duels' ? '/api/forum/profile/duels'
                    : '/api/forum/liked-posts';

        authApi(url).then(function (data) {
            if (tab === 'duels') {
                renderDuels(data, container);
            } else if (tab === 'replies') {
                renderMyReplies(data, container);
            } else {
                var list = data.posts || [];
                if (!list.length) {
                    container.innerHTML = '<div class="cp-empty">暂无内容</div>';
                    return;
                }
                container.innerHTML = '<div class="community-feed">' + list.map(function (p) {
                    return '<div class="community-post" data-id="' + p.id + '">'
                        + '<div class="cp-title">' + esc(p.title || p.postTitle || '') + '</div>'
                        + '<div class="cp-meta">'
                        + '<span>' + timeAgo(p.createTime) + '</span>'
                        + '<span class="cp-section-tag">' + (SECTION_NAMES[p.section] || '') + '</span>'
                        + '<span style="margin-left:auto;">❤ ' + (p.likeCount || 0) + ' 💬 ' + (p.replyCount || 0) + '</span>'
                        + '</div></div>';
                }).join('') + '</div>';
                container.querySelectorAll('.community-post').forEach(function (el) {
                    el.addEventListener('click', function () {
                        openDetail(parseInt(el.getAttribute('data-id')));
                    });
                });
            }
        }).catch(function (e) {
            container.innerHTML = '<div class="cp-empty">加载失败: ' + esc(e.message) + '</div>';
        });
    }

    // 对战记录：时间(小字) 房间(黄) 自己 vs(红) 对手 回放码(黄)，一行一条
    function renderDuels(data, container) {
        var list = data.duels || [];
        if (!list.length) {
            container.innerHTML = '<div class="cp-empty">暂无对局记录</div>';
            return;
        }
        var html = list.map(function (d) {
            var t = new Date(d.time);
            var ts = (t.getMonth() + 1) + '/' + t.getDate() + ' ' +
                String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
            var resultTag = d.draw
                ? '<span class="duel-result duel-draw">平</span>'
                : (d.win
                    ? '<span class="duel-result duel-win">胜</span>'
                    : '<span class="duel-result duel-lose">负</span>');
            return '<div class="duel-item">'
                + resultTag
                + '<span class="duel-time">' + ts + '</span>'
                + '<span class="duel-room">' + esc(d.roomName) + '</span>'
                + '<span class="duel-name">' + esc(d.selfName) + '</span>'
                + '<span class="duel-vs">vs</span>'
                + '<span class="duel-name">' + esc(d.opponentName) + '</span>'
                + '<span class="duel-right">'
                + (d.ladder ? '<span class="duel-tag">天梯</span>' : '')
                + '<span class="duel-replay" data-code="' + esc(d.replayCode) + '" title="点击复制回放码">' + esc(d.replayCode) + '</span>'
                + '<button class="duel-watch" data-code="' + esc(d.replayCode) + '" title="弹窗播放回放">▶ 回放</button>'
                + '</span>'
                + '</div>';
        }).join('');
        container.innerHTML = '<div class="duel-list">' + html + '</div>';

        container.querySelectorAll('.duel-replay').forEach(function (el) {
            el.addEventListener('click', function () {
                var code = el.getAttribute('data-code') || '';
                var done = function () { alert('已复制回放码: ' + code); };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code).then(done).catch(done);
                } else {
                    done();
                }
            });
        });
        container.querySelectorAll('.duel-watch').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (window.openReplay) window.openReplay(btn.getAttribute('data-code') || '');
            });
        });
    }

    function renderMyReplies(data, container) {
        var replies = data.replies || [];
        if (!replies.length) {
            container.innerHTML = '<div class="cp-empty">暂无回复</div>';
            return;
        }
        container.innerHTML = replies.map(function (r) {
            return '<div class="community-post" data-id="' + r.postId + '"'
                + (r.postDeleted ? ' style="opacity:0.5;"' : '') + '>'
                + '<div class="cp-title">' + esc(r.postTitle) + '</div>'
                + '<div class="cr-content">' + esc(r.content) + '</div>'
                + '<div class="cp-meta"><span>' + timeAgo(r.createTime) + '</span></div>'
                + '</div>';
        }).join('');
        container.querySelectorAll('.community-post').forEach(function (el) {
            el.addEventListener('click', function () {
                openDetail(parseInt(el.getAttribute('data-id')));
            });
        });
    }

    function openSettings() {
        var container = document.getElementById('cmProfileContent');
        if (!container) return;
        var auth = window._communityAuth;
        var username = auth ? auth.username : '';
        api('/api/forum/profile?' + getAuth()).then(function (profile) {
            var html = '<div style="max-width:400px;margin:0 auto;">';
            html += '<h3 style="color:#F0E68C;margin-bottom:16px;">个人设置</h3>';
            // 头像
            html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">';
            html += '<img id="cmSettingAvatar" src="' + (profile.avatarVersion
                ? '/api/forum/avatar/' + encodeURIComponent(username) + '?v=' + profile.avatarVersion
                : 'cover.jpg') + '" style="width:64px;height:64px;border-radius:4px;border:1px solid #333;object-fit:cover;">';
            html += '<div>';
            html += '<button class="community-btn" id="cmAvatarBtn" style="font-size:0.78rem;margin-bottom:6px;"'
                + (profile.canChangeAvatar ? '' : 'disabled') + '>'
                + (profile.canChangeAvatar ? '修改头像' : '今天已修改过头像') + '</button>';
            html += '<div style="color:#666;font-size:0.65rem;">64×64 缩略图 · 每天限1次</div>';
            html += '</div></div>';
            // 显示名
            html += '<label class="community-form-label">显示名</label>';
            html += '<div style="display:flex;gap:8px;margin-bottom:8px;">';
            html += '<input class="community-input" id="cmSettingName" style="margin-bottom:0;flex:1;"'
                + ' value="' + esc(profile.displayName || '') + '" maxlength="64"'
                + (profile.canChangeName ? '' : ' disabled') + '>';
            html += '<button class="community-btn" id="cmNameBtn" style="font-size:0.78rem;flex-shrink:0;"'
                + (profile.canChangeName ? '' : 'disabled') + '>'
                + (profile.canChangeName ? '保存' : '今天已修改') + '</button>';
            html += '</div>';
            html += '<div style="color:#666;font-size:0.65rem;">同步天梯显示名 · 每天限1次</div>';
            html += '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">';
            html += '<label class="community-form-label">称号展示（游戏内显示主+副）</label>';
            html += '<div id="cmTitleBox"><div class="community-loading">加载称号中...</div></div>';
            html += '<div style="color:#666;font-size:0.65rem;">赛季结算自动累积 · 可随时切换</div>';
            html += '</div>';
            container.innerHTML = html;

            renderTitleSettings();

            // 头像上传
            var avatarBtn = document.getElementById('cmAvatarBtn');
            if (avatarBtn && profile.canChangeAvatar) {
                avatarBtn.addEventListener('click', function () {
                    openAvatarCrop(username, profile.avatarVersion);
                });
            }
            // 显示名
            var nameBtn = document.getElementById('cmNameBtn');
            if (nameBtn && profile.canChangeName) {
                nameBtn.addEventListener('click', function () {
                    var newName = (document.getElementById('cmSettingName').value || '').trim();
                    if (!newName) { alert('显示名不能为空'); return; }
                    authApi('/api/forum/profile/display-name', {
                        method: 'POST',
                        body: { displayName: newName },
                    }).then(function () {
                        alert('显示名已修改！');
                        openSettings();
                    }).catch(function (e) {
                        alert('修改失败: ' + e.message);
                    });
                });
            }
        }).catch(function (e) {
            container.innerHTML = '<div class="cp-empty">加载设置失败: ' + esc(e.message) + '</div>';
        });
    }

    // ═══════════════════════════ 头像裁剪 ═══════════════════════

    function openAvatarCrop(username, curVersion) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function () {
            var file = input.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                showCropDialog(reader.result, username, curVersion);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    function showCropDialog(dataUrl, username, curVersion) {
        var overlay = document.createElement('div');
        overlay.className = 'community-modal-overlay active';
        overlay.style.zIndex = '100001';
        overlay.innerHTML = '<div class="community-modal" style="width:min(600px,95vw);">'
            + '<div class="community-modal-header">'
            + '<span class="community-modal-title">裁剪头像</span>'
            + '<button class="community-modal-close">&times;</button>'
            + '</div>'
            + '<div class="community-modal-body" style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">'
            + '<div style="flex:1;min-width:200px;">'
            + '<canvas id="cmCropCanvas" style="width:100%;border:1px solid #333;cursor:crosshair;"></canvas>'
            + '</div>'
            + '<div style="text-align:center;">'
            + '<div style="color:#aaa;font-size:0.78rem;margin-bottom:6px;">预览</div>'
            + '<canvas id="cmPreviewCanvas" width="64" height="64"'
            + ' style="border:1px solid #333;border-radius:4px;"></canvas>'
            + '</div>'
            + '</div>'
            + '<div style="padding:12px 16px;display:flex;gap:10px;border-top:1px solid rgba(255,255,255,0.06);">'
            + '<button class="community-page-btn" id="cmCropCancel">取消</button>'
            + '<button class="community-btn" id="cmCropConfirm" style="flex:1;">确认上传</button>'
            + '</div></div>';
        document.body.appendChild(overlay);

        var img = new Image();
        img.onload = function () {
            var canvas = document.getElementById('cmCropCanvas');
            var preview = document.getElementById('cmPreviewCanvas');
            var ctx = canvas.getContext('2d');
            var pctx = preview.getContext('2d');

            // 缩放适配
            var maxW = canvas.parentElement.clientWidth;
            var scale = Math.min(maxW / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // 选区：初始 1:1 居中
            var selSize = Math.min(canvas.width, canvas.height) * 0.7;
            var selX = (canvas.width - selSize) / 2;
            var selY = (canvas.height - selSize) / 2;
            var dragging = false, resizing = false;
            var dragStart = { x: 0, y: 0 };
            var dragSelStart = { x: 0, y: 0, s: 0 };
            var handleSize = 12;
            var minSel = 30;

            function redraw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, selX / scale, selY / scale, selSize / scale, selSize / scale, selX, selY, selSize, selSize);
                ctx.strokeStyle = '#F0E68C';
                ctx.lineWidth = 2;
                ctx.strokeRect(selX, selY, selSize, selSize);
                // 拖拽角标
                ctx.fillStyle = '#F0E68C';
                ctx.fillRect(selX + selSize - handleSize, selY + selSize - handleSize, handleSize, handleSize);
                pctx.drawImage(img, selX / scale, selY / scale, selSize / scale, selSize / scale, 0, 0, 64, 64);
            }

            redraw();

            function getPos(e) {
                var rect = canvas.getBoundingClientRect();
                return {
                    x: (e.clientX - rect.left) * (canvas.width / rect.width),
                    y: (e.clientY - rect.top) * (canvas.height / rect.height)
                };
            }

            canvas.addEventListener('wheel', function (e) {
                e.preventDefault();
                var delta = e.deltaY > 0 ? -10 : 10;
                var newSize = Math.max(minSel, Math.min(Math.min(canvas.width, canvas.height), selSize + delta));
                var cx = selX + selSize / 2, cy = selY + selSize / 2;
                selSize = newSize;
                selX = Math.max(0, cx - selSize / 2);
                selY = Math.max(0, cy - selSize / 2);
                if (selX + selSize > canvas.width) selX = canvas.width - selSize;
                if (selY + selSize > canvas.height) selY = canvas.height - selSize;
                redraw();
            }, { passive: false });

            canvas.addEventListener('mousedown', function (e) {
                var p = getPos(e);
                // 右下角resize
                if (Math.abs(p.x - (selX + selSize)) < 20 && Math.abs(p.y - (selY + selSize)) < 20) {
                    resizing = true;
                    dragStart = p;
                    dragSelStart = { x: selX, y: selY, s: selSize };
                    canvas.style.cursor = 'nwse-resize';
                } else if (p.x >= selX && p.x <= selX + selSize && p.y >= selY && p.y <= selY + selSize) {
                    dragging = true;
                    dragStart = p;
                    dragSelStart = { x: selX, y: selY, s: selSize };
                    canvas.style.cursor = 'grabbing';
                }
            });
            canvas.addEventListener('mousemove', function (e) {
                var p = getPos(e);
                if (dragging) {
                    selX = Math.max(0, Math.min(canvas.width - selSize, dragSelStart.x + (p.x - dragStart.x)));
                    selY = Math.max(0, Math.min(canvas.height - selSize, dragSelStart.y + (p.y - dragStart.y)));
                    redraw();
                } else if (resizing) {
                    var ns = Math.max(minSel, Math.min(Math.min(canvas.width, canvas.height), dragSelStart.s + (p.x - dragStart.x)));
                    selSize = ns;
                    redraw();
                } else {
                    canvas.style.cursor = (Math.abs(p.x - (selX + selSize)) < 20 && Math.abs(p.y - (selY + selSize)) < 20) ? 'nwse-resize' : 'crosshair';
                }
            });
            document.addEventListener('mouseup', function () { dragging = false; resizing = false; canvas.style.cursor = 'crosshair'; });

            // 触摸
            canvas.addEventListener('touchstart', function (e) {
                var p = getPos(e.touches[0]);
                if (Math.abs(p.x - (selX + selSize)) < 20 && Math.abs(p.y - (selY + selSize)) < 20) {
                    resizing = true; dragStart = p; dragSelStart = { x: selX, y: selY, s: selSize };
                } else if (p.x >= selX && p.x <= selX + selSize && p.y >= selY && p.y <= selY + selSize) {
                    dragging = true; dragStart = p; dragSelStart = { x: selX, y: selY, s: selSize };
                }
            }, { passive: false });
            canvas.addEventListener('touchmove', function (e) {
                if (!dragging && !resizing) return;
                e.preventDefault();
                var p = getPos(e.touches[0]);
                if (dragging) {
                    selX = Math.max(0, Math.min(canvas.width - selSize, dragSelStart.x + (p.x - dragStart.x)));
                    selY = Math.max(0, Math.min(canvas.height - selSize, dragSelStart.y + (p.y - dragStart.y)));
                } else if (resizing) {
                    selSize = Math.max(minSel, Math.min(Math.min(canvas.width, canvas.height), dragSelStart.s + (p.x - dragStart.x)));
                }
                redraw();
            }, { passive: false });
            canvas.addEventListener('touchend', function () { dragging = false; resizing = false; });

            // 确认上传
            document.getElementById('cmCropConfirm').addEventListener('click', function () {
                var resultCanvas = document.createElement('canvas');
                resultCanvas.width = 64;
                resultCanvas.height = 64;
                var rctx = resultCanvas.getContext('2d');
                rctx.drawImage(img, selX / scale, selY / scale, selSize / scale, selSize / scale, 0, 0, 64, 64);
                var avatarB64 = resultCanvas.toDataURL('image/png');

                authApi('/api/forum/profile/avatar', {
                    method: 'POST',
                    body: { avatar: avatarB64 },
                }).then(function () {
                    overlay.remove();
                    alert('头像已更新！');
                    // 刷新头像
                    var glAvatar = document.getElementById('glAvatar');
                    if (glAvatar) {
                        var newVer = (curVersion || 1) + 1;
                        glAvatar.src = '/api/forum/avatar/' + encodeURIComponent(username) + '?v=' + newVer;
                    }
                    openSettings();
                }).catch(function (e) {
                    alert('上传失败: ' + e.message);
                });
            });
        };
        img.src = dataUrl;

        overlay.querySelector('.community-modal-close').addEventListener('click', function () { overlay.remove(); });
        document.getElementById('cmCropCancel').addEventListener('click', function () { overlay.remove(); });
    }

    // ═══════════════════════════ 看板娘表情选择器 ═══════════════════════

    function openEmojiPicker(onInsert) {
        var overlay = document.createElement('div');
        overlay.className = 'card-search-overlay active';
        overlay.style.zIndex = '60002';
        overlay.innerHTML = '<div class="card-search-box" style="width:min(420px,92vw);">'
            + '<div class="card-search-header" style="display:flex;justify-content:space-between;align-items:center;">'
            + '<span style="color:#F0E68C;font-size:0.9rem;">表情包</span>'
            + '<button id="emojiCloseBtn" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;">&times;</button>'
            + '</div>'
            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px;overflow-y:auto;max-height:50vh;">'
            + EMOJI_LIST.map(function (name) {
                return '<div style="cursor:pointer;text-align:center;padding:6px;border-radius:6px;transition:background 0.15s;"'
                    + ' onmouseover="this.style.background=\'rgba(216,30,68,0.1)\'"'
                    + ' onmouseout="this.style.background=\'transparent\'"'
                    + ' data-emoji="' + name + '">'
                    + '<img src="' + EMOJI_URL + name + '.png" style="width:64px;height:64px;object-fit:contain;" loading="lazy">'
                    + '<div style="color:#aaa;font-size:0.65rem;margin-top:2px;">' + (EMOJI_NAMES[name] || name) + '</div>'
                    + '</div>';
            }).join('')
            + '</div></div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); } });
        overlay.querySelector('#emojiCloseBtn').addEventListener('click', function () { overlay.remove(); });

        overlay.querySelectorAll('[data-emoji]').forEach(function (el) {
            el.addEventListener('click', function () {
                var name = el.getAttribute('data-emoji');
                if (onInsert) onInsert(name);
                overlay.remove();
            });
        });
    }

    // ═══════════════════════════ 初始化 ═══════════════════════════

    // 监听全局登录态变化
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (_detailOverlay) closeDetail();
            if (_publishOverlay) closePublish();
            if (_cardSearchOverlay) { _cardSearchOverlay.remove(); _cardSearchOverlay = null; }
        }
    });

    // 深链：?goto=forum&post=<id>（分享按钮复制出来的就是这个链接）
    window._openForumPost = function (id) {
        var pid = parseInt(id, 10);
        if (pid > 0) openDetail(pid);
    };

    initShell();
}
