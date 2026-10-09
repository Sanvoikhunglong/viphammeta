(function () {
    'use strict';

    const LANG_MAP = {
        // English
        US: 'en', GB: 'en', CA: 'en', AU: 'en',
        NZ: 'en', IE: 'en', SG: 'en',

        // Asia
        JP: 'ja', KR: 'ko', CN: 'zh-CN',
        TW: 'zh-TW', HK: 'zh-TW', TH: 'th',
        ID: 'id', MY: 'ms', PH: 'tl', IN: 'hi',
        PK: 'ur', BD: 'bn',

        // Europe
        FR: 'fr', DE: 'de', IT: 'it', ES: 'es',
        PT: 'pt', NL: 'nl', BE: 'fr', CH: 'de',
        AT: 'de', SE: 'sv', NO: 'no', DK: 'da',
        FI: 'fi', IS: 'is', PL: 'pl', CZ: 'cs',
        SK: 'sk', HU: 'hu', RO: 'ro', BG: 'bg',
        HR: 'hr', SI: 'sl', RS: 'sr', BA: 'bs',
        ME: 'sr', MK: 'mk', LT: 'lt', LV: 'lv',
        EE: 'et', GR: 'el', AL: 'sq', UA: 'uk',
        RU: 'ru',

        // Middle East
        SA: 'ar', AE: 'ar', EG: 'ar', IQ: 'ar',
        MA: 'ar', IL: 'he', IR: 'fa', AF: 'fa',
        TR: 'tr',

        // Latin America
        MX: 'es', AR: 'es', CO: 'es', CL: 'es',
        PE: 'es', VE: 'es', UY: 'es', PY: 'es',
        BO: 'es', EC: 'es', BR: 'pt',

        // Africa
        ZA: 'en', NG: 'en', KE: 'en'
    };

    const OVERLAY_ID = 'translate-overlay';
    const COOKIE_NAME = 'googtrans';
    const IPINFO_TOKEN = ''; // Điền token IPinfo mới nếu sử dụng API có token.

    // Tạo overlay
    function createOverlay() {
        if (!document.body ||
            document.getElementById(OVERLAY_ID)) return;

        if (!document.getElementById('translate-overlay-style')) {
            const style = document.createElement('style');
            style.id = 'translate-overlay-style';
            style.textContent = `
                @keyframes _tl_spin {
                    to { transform: rotate(360deg); }
                }
                #${OVERLAY_ID} {
                    position: fixed;
                    inset: 0;
                    z-index: 999999;
                    background: rgba(255,255,255,.48);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 1;
                    transition: opacity .4s ease;
                }
                #${OVERLAY_ID} .tl-spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid #e0e0e0;
                    border-top-color: #1877f2;
                    border-radius: 50%;
                    animation: _tl_spin .7s linear infinite;
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;

        const spinner = document.createElement('div');
        spinner.className = 'tl-spinner';

        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
    }

    function removeOverlay() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;

        overlay.style.opacity = '0';

        setTimeout(function () {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 420);
    }

    // Đọc cookie
    function getGoogtransCookie() {
        const match = document.cookie.match(
            /(?:^|;\s*)googtrans=([^;]*)/
        );

        if (!match) return null;

        try {
            return decodeURIComponent(match[1]);
        } catch (e) {
            return match[1];
        }
    }

    // Ghi cookie theo đường dẫn hiện tại
    function setGoogtransCookie(lang) {
        const value = encodeURIComponent('/en/' + lang);
        const secure = location.protocol === 'https:'
            ? '; Secure'
            : '';

        // Cookie host-only, phù hợp cả subdomain và localhost
        document.cookie =
            COOKIE_NAME + '=' + value +
            '; Path=/; Max-Age=31536000; SameSite=Lax' +
            secure;
    }

    // Gọi API có timeout và kiểm tra dữ liệu
    async function fetchCountry(url) {
        const controller = new AbortController();
        const timeout = setTimeout(function () {
            controller.abort();
        }, 4500);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                cache: 'no-store',
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();

            const code = String(
                data.country_code ||
                data.countryCode ||
                data.country ||
                ''
            ).trim().toUpperCase();

            // API phải trả về mã quốc gia gồm đúng 2 chữ cái
            if (/^[A-Z]{2}$/.test(code)) {
                return code;
            }

            throw new Error('API không trả về mã quốc gia hợp lệ');
        } finally {
            clearTimeout(timeout);
        }
    }

    // IPinfo trước, các dịch vụ dự phòng sau
    async function getCountryCode() {
        const endpoints = [];

        if (IPINFO_TOKEN.trim()) {
            endpoints.push(
                'https://api.ipinfo.io/lite/me?token=' +
                encodeURIComponent(IPINFO_TOKEN.trim())
            );
        }

        // API IPinfo cũ: không cần token, nhưng có giới hạn lượt gọi
        endpoints.push('https://ipinfo.io/json');

        // API dự phòng
        endpoints.push('https://ipapi.co/json/');

        for (const url of endpoints) {
            try {
                const code = await fetchCountry(url);
                console.info('[Translate] Country detected:', code);
                return code;
            } catch (error) {
                console.warn(
                    '[Translate] Country API failed:',
                    url,
                    error.message
                );
            }
        }

        return '';
    }

    // Chờ Google Translate áp dụng bản dịch
    function waitForTranslation(timeout) {
        return new Promise(function (resolve) {
            const html = document.documentElement;

            if (/translated-(ltr|rtl)/.test(html.className)) {
                resolve(true);
                return;
            }

            let finished = false;
            let observer;

            const timer = setTimeout(function () {
                finish(false);
            }, timeout || 6000);

            function finish(translated) {
                if (finished) return;
                finished = true;

                clearTimeout(timer);
                if (observer) observer.disconnect();

                resolve(translated);
            }

            observer = new MutationObserver(function () {
                if (/translated-(ltr|rtl)/.test(html.className)) {
                    finish(true);
                }
            });

            observer.observe(html, {
                attributes: true,
                attributeFilter: ['class']
            });
        });
    }

    // Luồng chính
    async function run() {
        createOverlay();

        try {
            const existing = getGoogtransCookie();

            // Đã có lựa chọn ngôn ngữ: không tự đổi lại
            if (existing && /^\/en\/[a-zA-Z-]+$/.test(existing)) {
                const currentLang = existing.split('/')[2];

                if (currentLang !== 'en') {
                    await waitForTranslation(6000);
                }

                return;
            }

            const countryCode = await getCountryCode();
            const targetLang = LANG_MAP[countryCode];

            // Không xác định được quốc gia hoặc không cần dịch
            if (!targetLang || targetLang === 'en') {
                if (targetLang === 'en') {
                    setGoogtransCookie('en');
                }
                return;
            }

            // Ghi cookie trước khi reload
            setGoogtransCookie(targetLang);

            // Chỉ reload một lần khi chưa có cookie
            location.reload();

        } catch (error) {
            console.error('[Translate] Initialization error:', error);
        } finally {
            // Không để overlay che trang nếu API lỗi
            // Khi reload, trình duyệt sẽ tải lại toàn bộ trang.
            setTimeout(removeOverlay, 6000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, {
            once: true
        });
    } else {
        run();
    }
})();
