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

    function getCardInfoById(cardId) {
        var index = window._cardIndex;
        if (!index || !index.size) return null;
        var card = index.get(cardId);
        if (card) return card;
        // 查别名：遍历找 alias === cardId 的卡
        var found = null;
        index.forEach(function (c) {
            if (!found && c.alias && parseInt(c.alias) === cardId) found = c;
        });
        return found;
    }

    function isAdmin() {
        // TODO: 部署后改为从服务端权限判断
        var adminAccounts = ['aqing', 'root'];
        return adminAccounts.indexOf(window._communityUsername) !== -1;
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

    function avatarImg(accountName) {
        if (!accountName) return '';
        return '<img src="/api/forum/avatar/' + encodeURIComponent(accountName) + '?v=' + Date.now() + '"'
            + ' style="width:24px;height:24px;border-radius:3px;border:1px solid rgba(216,30,68,0.3);object-fit:cover;flex-shrink:0;margin-right:6px;"'
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
        return thumbs.length ? '<div style="display:flex;gap:4px;margin-top:6px;">' + thumbs.join('') + '</div>' : '';
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
        // 手机端：右上角头像入口
        html += '<div class="cm-mobile-avatar" id="cmMobileAvatar" style="display:none;">';
        html += '<img id="cmMobileAvatarImg" src="cover.jpg" style="width:32px;height:32px;border-radius:4px;border:1px solid rgba(216,30,68,0.3);object-fit:cover;cursor:pointer;" title="个人中心">';
        html += '</div>';
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
        updateMobileAvatar();
        loadFeed();
    }

    function updateMobileAvatar() {
        var avatarWrap = document.getElementById('cmMobileAvatar');
        var avatarImg = document.getElementById('cmMobileAvatarImg');
        if (!avatarWrap || !avatarImg) return;
        var isMobile = window.innerWidth <= 768;
        var loggedIn = window._communityLoggedIn && window._communityUsername;
        if (isMobile && loggedIn) {
            avatarWrap.style.display = 'block';
            var username = window._communityUsername;
            avatarImg.src = '/api/forum/avatar/' + encodeURIComponent(username) + '?v=' + Date.now();
            avatarImg.onerror = function () { this.src = 'cover.jpg'; };
            avatarWrap.onclick = function () {
                if (typeof window._openProfilePanel === 'function') window._openProfilePanel();
            };
        } else {
            avatarWrap.style.display = 'none';
        }
    }
    window._refreshMobileAvatar = updateMobileAvatar;

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

        api('/api/forum/posts' + qs).then(function (data) {
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
                html += '<div class="cp-title">' + (post.isPinned ? '📌 ' : '') + esc(post.title) + '</div>';
                html += getPreviewThumbs(post.contentJson);
                html += '<div class="cp-meta">';
                var tags = (post.tags || '').split(',').filter(Boolean);
                html += avatarImg(post.accountName);
                html += '<span>' + esc(post.authorName) + '</span>';
                html += '<span>' + timeAgo(post.createTime) + '</span>';
                html += '<span class="cp-section-tag">' + SECTION_NAMES[post.section] + '</span>';
                tags.forEach(function (t) {
                    html += '<span style="font-size:0.65rem;background:rgba(240,230,140,0.1);color:#F0E68C;padding:1px 6px;border-radius:2px;">' + esc(t.trim()) + '</span>';
                });
                html += '<span style="margin-left:auto;" class="cp-stats">👁 ' + (post.viewCount || 0) + '  ❤ ' + post.likeCount + '  💬 ' + post.replyCount + '</span>';
                html += '</div></div>';
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
        api('/api/forum/posts/' + postId).then(function (post) {
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
            renderDetail(post, replyData);
        }).catch(function () {
            renderDetail(post, { replies: [], total: 0 });
        });
    }

    function renderDetail(post, replyData) {
        var body = _detailOverlay.querySelector('.community-modal-body');
        var html = '';

        // 帖子内容
        html += '<div style="margin-bottom:20px;">';
        html += '<h2 style="color:#F0E68C;margin:0 0 8px;">' + esc(post.title) + '</h2>';
        // 浏览量
        html += '<div style="color:#666;font-size:0.72rem;margin-bottom:6px;">👁 ' + (post.viewCount || 0) + ' 次浏览';
        var tags = (post.tags || '').split(',').filter(Boolean);
        tags.forEach(function (t) {
            html += ' <span style="font-size:0.65rem;background:rgba(240,230,140,0.1);color:#F0E68C;padding:1px 6px;border-radius:2px;">' + esc(t.trim()) + '</span>';
        });
        html += '</div>';
        html += '<div class="cp-meta" style="margin-bottom:10px;">';
        html += avatarImg(post.accountName);
        html += '<span>' + esc(post.authorName) + '</span>';
        html += '<span>' + timeAgo(post.createTime) + '</span>';
        html += '<span class="cp-section-tag">' + SECTION_NAMES[post.section] + '</span>';
        // 自己发的帖子显示编辑/删除
        if (window._communityUsername && window._communityUsername === post.accountName) {
            html += '<button class="cp-edit-btn" id="cmEditPost" style="font-size:0.7rem;margin-left:4px;">✏ 编辑</button>';
            html += '<button class="cp-edit-btn" id="cmDelPost" style="font-size:0.7rem;color:#ff6b6b;">🗑 删除</button>';
        }
        html += '</div>';
        // 渲染内容块
        html += '<div style="color:#ccc;line-height:1.7;margin-bottom:12px;">';
        (post.contentJson || []).forEach(function (block) {
            if (block.type === 'text') {
                html += '<p style="white-space:pre-wrap;">' + esc(block.text) + '</p>';
            } else if (block.type === 'img') {
                html += '<img src="' + EMOJI_URL + esc(block.name) + '.png" style="max-width:80px;max-height:80px;vertical-align:middle;margin:2px;" loading="lazy">';
            } else if (block.type === 'deck') {
                var total = (block.main || []).length + (block.extra || []).length + (block.side || []).length;
                html += '<div class="cp-deck-block" style="background:#111;border:1px solid #2a2a2a;'
                    + 'border-radius:8px;padding:12px;margin:8px 0;cursor:pointer;"'
                    + ' data-deck=\'' + JSON.stringify({ main: block.main, extra: block.extra, side: block.side }).replace(/'/g, "\\'") + '\'>'
                    + '🃏 卡组 (' + total + '张) — 点击查看详情</div>';
            } else if (block.type === 'card') {
                var cardInfo = getCardInfoById(block.id);
                var cardName = cardInfo ? (cardInfo.name || '') : '';
                var nameHtml = cardName ? '<span style="color:#F0E68C;font-size:0.78rem;max-width:120px;line-height:1.3;">' + esc(cardName) + '</span>' : '';
                var paddingX = cardName ? '10px' : '4px';
                html += '<span class="cp-card-inline" data-card-id="' + block.id + '"'
                    + ' style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin:2px 4px;'
                    + 'background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:4px ' + paddingX + ' 4px 4px;cursor:pointer;">'
                    + '<img src="' + cardImgSrc(block.id) + '" style="width:44px;height:64px;object-fit:cover;border-radius:3px;"'
                    + ' onerror="' + cardImgOnError(block.id) + '">'
                    + nameHtml
                    + '</span> ';
            }
        });
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
                html += avatarImg(r.accountName) + '<span class="cr-author">' + esc(r.authorName) + '</span>';
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
            openPublish({
                id: post.id,
                section: post.section,
                title: post.title,
                content: post.content,
                tags: post.tags || '',
            });
        });
        // 删除帖子
        var delBtn = document.getElementById('cmDelPost');
        if (delBtn) delBtn.addEventListener('click', function () {
            if (!confirm('确定删除这个帖子吗？')) return;
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
                var newContent = prompt('编辑回复:');
                if (!newContent) return;
                if (USE_MOCK) {
                    var r = MOCK_REPLIES[post.id] ? MOCK_REPLIES[post.id].find(function (x) { return x.id === rid; }) : null;
                    if (r) { r.content = newContent.trim(); r.contentJson = [{ type: 'text', text: newContent.trim() }]; }
                    closeDetail();
                    openDetail(post.id);
                    return;
                }
                authApi('/api/forum/replies/' + rid, {
                    method: 'PUT',
                    body: { content: newContent.trim(), username: window._communityAuth.username, password: window._communityAuth.password },
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

    function openPublish(editData) {
        var isEdit = !!editData;
        var overlay = document.createElement('div');
        overlay.className = 'community-modal-overlay active';
        overlay.innerHTML = '<div class="community-modal" style="width:min(600px,95vw);">'
            + '<div class="community-modal-header">'
            + '<span class="community-modal-title">' + (isEdit ? '编辑帖子' : '发布帖子') + '</span>'
            + '<button class="community-modal-close">&times;</button>'
            + '</div>'
            + '<div class="community-modal-body">'
            + '<label class="community-form-label">分区</label>'
            + '<select class="community-input" id="cmPubSection" style="width:auto;">'
            + SECTIONS.filter(function (s) { return s !== 'all'; }).map(function (s) { return '<option value="' + s + '"' + (editData && editData.section === s ? ' selected' : '') + '>' + SECTION_NAMES[s] + '</option>'; }).join('')
            + '</select>'
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
                // 编辑模式
                authApi('/api/forum/posts/' + _editingPostId, {
                    method: 'PUT',
                    body: { title: title, content: content, contentJson: contentJson, tags: tags },
                }).then(function () {
                    closePublish();
                    if (_detailPostId === _editingPostId) { closeDetail(); }
                    loadFeed();
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

    function buildContentJson(content, deck) {
        var blocks = [];
        // 先解析标记
        var regex = /\[deck\]([\s\S]*?)\[\/deck\]|\[card\](\d+)\[\/card\]|\[img\]([a-zA-Z]+)\[\/img\]/g;
        var lastIdx = 0;
        var match;
        while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIdx) {
                var text = content.slice(lastIdx, match.index).trim();
                if (text) blocks.push({ type: 'text', text: text });
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
            var tail = content.slice(lastIdx).trim();
            if (tail) blocks.push({ type: 'text', text: tail });
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

    function searchCards(q, onSelect) {
        var results = document.getElementById('csResults');
        if (!results) return;
        results.innerHTML = '<div style="color:#888;text-align:center;padding:20px;grid-column:1/-1;">搜索中...</div>';

        // 优先用已加载的 cardIndex
        var index = window._cardIndex;
        if (index && index.size) {
            var matches = [];
            var qLower = q.toLowerCase();
            index.forEach(function (card) {
                if (matches.length >= 30) return;
                var nameMatch = (card.name || '').toLowerCase().indexOf(qLower) !== -1;
                var idMatch = String(card.id).indexOf(q) !== -1;
                if (nameMatch || idMatch) matches.push(card);
            });
            renderCardSearchResults(matches, onSelect);
        } else {
            // 回退 API
            fetch('/api/cards').then(function (r) { return r.json(); }).then(function (cards) {
                var matches = [];
                var qLower = q.toLowerCase();
                cards.forEach(function (card) {
                    if (matches.length >= 30) return;
                    var nameMatch = (card.name || '').toLowerCase().indexOf(qLower) !== -1;
                    var idMatch = String(card.id).indexOf(q) !== -1;
                    if (nameMatch || idMatch) matches.push(card);
                });
                renderCardSearchResults(matches, onSelect);
            }).catch(function () {
                results.innerHTML = '<div style="color:#888;text-align:center;padding:20px;grid-column:1/-1;">搜索失败</div>';
            });
        }
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
                + '<span class="card-search-item-name">' + esc(c.name || '') + '<br><small style="color:#888;">#' + c.id + '</small></span>'
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
        var index = window._cardIndex;
        var card = index ? index.get(cardId) : null;
        var cardName = card ? card.name : ('#' + cardId);
        var cardType = card && card.typeInfo ? card.typeInfo.fullType : '';
        var isMonster = card && card.typeInfo && card.typeInfo.baseType === '怪兽';
        var atkDef = isMonster ? 'ATK ' + (card.atk < 0 ? '?' : card.atk) + ' / DEF ' + (card.def < 0 ? '?' : card.def) : '';
        var desc = card ? (card.processedDesc || '') : '';
        var attrRace = isMonster ? (card.attrName || '') + ' | ' + (card.raceName || '') + (card.level ? ' | Lv' + card.level : '') : '';

        var overlay = document.createElement('div');
        overlay.className = 'community-modal-overlay active';
        overlay.style.zIndex = '60001';
        overlay.innerHTML = '<div class="community-modal" style="width:min(420px,92vw);">'
            + '<div class="community-modal-header">'
            + '<span class="community-modal-title">' + esc(cardName)
            + ' <small style="color:#888;font-weight:400;">#' + cardId + '</small></span>'
            + '<button class="community-modal-close">&times;</button>'
            + '</div>'
            + '<div class="community-modal-body" style="text-align:center;">'
            + '<img src="' + OCG_PIC_URL + cardId + '.jpg" style="width:200px;border-radius:6px;margin-bottom:12px;"'
            + ' onerror="this.onerror=null;this.src=\'' + SP_PIC_URL + cardId + '.jpg\';'
            + 'this.onerror=function(){this.onerror=null;this.src=\'' + DIY_PIC_URL + cardId + '.jpg\';'
            + 'this.onerror=function(){this.src=\'cover.jpg\';}}">'
            + (cardType ? '<div style="color:#aaa;font-size:0.82rem;margin-bottom:4px;">' + esc(cardType) + '</div>' : '')
            + (attrRace ? '<div style="color:#999;font-size:0.78rem;margin-bottom:2px;">' + esc(attrRace) + '</div>' : '')
            + (atkDef ? '<div style="color:#ddd;font-weight:600;margin-bottom:8px;">' + atkDef + '</div>' : '')
            + (desc ? '<div style="color:#bbb;font-size:0.78rem;line-height:1.5;text-align:left;">' + esc(desc) + '</div>' : '')
            + '</div></div>';
        document.body.appendChild(overlay);

        var close = function () { overlay.remove(); };
        overlay.querySelector('.community-modal-close').addEventListener('click', close);
        document.addEventListener('keydown', function escClose(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); }
        });
    }

    // ═══════════════════════════ 个人中心 ═══════════════════════

    window._openProfilePanel = function () {
        // 确保社区 CSS 已激活（从主页直接打开时需要）
        var cssLink = document.getElementById('css-deck-community');
        if (cssLink && cssLink.media !== 'all') cssLink.media = 'all';

        var overlay = document.createElement('div');
        overlay.className = 'community-modal-overlay active';
        overlay.style.zIndex = '100000';
        overlay.innerHTML = '<div class="community-modal profile-modal" style="width:min(600px,95vw);">'
            + '<div class="community-modal-header">'
            + '<span class="community-modal-title">个人中心</span>'
            + '<button class="community-modal-close">&times;</button>'
            + '</div>'
            + '<div class="community-modal-body" id="cmProfileBody">'
            + '<div class="community-tabs profile-panel" style="margin-bottom:12px;">'
            + '<button class="community-tab active" data-ptab="posts">我的发帖</button>'
            + '<button class="community-tab" data-ptab="replies">我的回复</button>'
            + '<button class="community-tab" data-ptab="liked">点赞过的</button>'
            + '<button class="community-tab" data-ptab="settings" style="margin-left:auto;">⚙ 设置</button>'
            + '</div><div id="cmProfileContent"></div>'
            + '</div></div>';
        document.body.appendChild(overlay);

        var closeProfile = function () { overlay.remove(); };
        overlay.querySelector('.community-modal-close').addEventListener('click', closeProfile);


        loadProfileTab('posts');

        overlay.querySelectorAll('[data-ptab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tab = btn.getAttribute('data-ptab');
                overlay.querySelectorAll('[data-ptab]').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                if (tab === 'settings') {
                    openSettingsInModal(overlay);
                } else {
                    loadProfileTabInModal(tab, overlay);
                }
            });
        });

        // Esc 关闭
        var escClose = function (e) { if (e.key === 'Escape') { closeProfile(); document.removeEventListener('keydown', escClose); } };
        document.addEventListener('keydown', escClose);
    };

    function loadProfileTabInModal(tab, overlay) {
        var container = overlay.querySelector('#cmProfileContent');
        if (!container) return;
        container.innerHTML = '<div class="community-loading">加载中...</div>';

        var url = tab === 'posts' ? '/api/forum/my-posts'
            : tab === 'replies' ? '/api/forum/my-replies'
                : '/api/forum/liked-posts';

        authApi(url).then(function (data) {
            if (tab === 'replies') {
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
                html += '<label style="padding:4px 10px;border:1px solid ' + (sel ? '#ffd700' : '#444') + ';border-radius:12px;cursor:pointer;font-size:0.75rem;color:' + (sel ? '#ffd700' : '#ccc') + ';">'
                    + '<input type="radio" name="cmMainTitle" value="' + esc(t) + '"' + sel + ' style="display:none;">' + esc(t) + '</label>';
            });
            html += '</div>';
            html += '<div style="color:#ccc;font-size:0.75rem;margin:10px 0 4px;">副称号（可选，单选）</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">';
            html += '<label style="padding:4px 10px;border:1px solid ' + (!sub ? '#7fbfff' : '#444') + ';border-radius:12px;cursor:pointer;font-size:0.75rem;color:' + (!sub ? '#7fbfff' : '#ccc') + ';">'
                + '<input type="radio" name="cmSubTitle" value=""' + (!sub ? ' checked' : '') + ' style="display:none;">无</label>';
            titles.forEach(function (t) {
                var sel = t === sub ? ' checked' : '';
                html += '<label style="padding:4px 10px;border:1px solid ' + (sel ? '#7fbfff' : '#444') + ';border-radius:12px;cursor:pointer;font-size:0.75rem;color:' + (sel ? '#7fbfff' : '#ccc') + ';">'
                    + '<input type="radio" name="cmSubTitle" value="' + esc(t) + '"' + sel + ' style="display:none;">' + esc(t) + '</label>';
            });
            html += '</div>';
            html += '<button class="community-btn" id="cmTitleSaveBtn" style="margin-top:8px;">保存称号</button>';
            box.innerHTML = html;

            // 主称号：点击互斥高亮（金色）
            box.querySelectorAll('input[name="cmMainTitle"]').forEach(function (inp) {
                inp.addEventListener('change', function () {
                    box.querySelectorAll('input[name="cmMainTitle"]').forEach(function (i) {
                        var lb = i.parentElement;
                        var on = i.checked;
                        lb.style.borderColor = on ? '#ffd700' : '#444';
                        lb.style.color = on ? '#ffd700' : '#ccc';
                    });
                });
            });
            // 副称号：点击切换高亮（蓝色，单选互斥）
            box.querySelectorAll('input[name="cmSubTitle"]').forEach(function (inp) {
                inp.addEventListener('change', function () {
                    box.querySelectorAll('input[name="cmSubTitle"]').forEach(function (i) {
                        var lb = i.parentElement;
                        var on = i.checked;
                        lb.style.borderColor = on ? '#7fbfff' : '#444';
                        lb.style.color = on ? '#7fbfff' : '#ccc';
                    });
                });
            });

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
            html += '<button style="display:block;width:100%;background:none;border:1px solid #ff6b6b;color:#ff6b6b;border-radius:4px;padding:8px;font-size:0.78rem;cursor:pointer;" id="cmLogoutBtn">退出登录</button>';
            html += '</div>';
            container.innerHTML = html;

            renderTitleSettings();

            var logoutBtn = document.getElementById('cmLogoutBtn');
            if (logoutBtn) logoutBtn.addEventListener('click', function () {
                fetch('/api/forum/logout', { method: 'POST' }).then(function () {})
                    .catch(function () {}).finally(function () {
                        window._communityLoggedIn = false;
                        window._communityUsername = '';
                        window._communityAuth = null;
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
                : '/api/forum/liked-posts';

        authApi(url).then(function (data) {
            if (tab === 'replies') {
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

    initShell();
}
