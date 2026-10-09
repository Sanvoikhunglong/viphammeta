<!-- 1. Google Translate Element (Ẩn khỏi giao diện) -->
<div id="google_translate_element" style="display:none;"></div>
<script type="text/javascript">
    function googleTranslateElementInit() {
        new google.translate.TranslateElement({
            pageLanguage: 'en',
            autoDisplay: false
        }, 'google_translate_element');
    }
</script>
<script type="text/javascript" src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>

<!-- 2. Script Tự Động Định Vị IP & Đổi Ngôn Ngữ -->
<script type="text/javascript">
(function () {
    const LANG_MAP = {
        // English
        'US': 'en', 'GB': 'en', 'CA': 'en', 'AU': 'en', 'NZ': 'en', 'IE': 'en', 'SG': 'en',

        // Asia
        'VN': 'vi',
        'JP': 'ja',
        'KR': 'ko',
        'CN': 'zh-CN',
        'TW': 'zh-TW',
        'HK': 'zh-TW',
        'TH': 'th',
        'ID': 'id',
        'MY': 'ms',
        'PH': 'tl',
        'IN': 'hi',
        'PK': 'ur',
        'BD': 'bn',

        // Europe major
        'FR': 'fr',
        'DE': 'de',
        'IT': 'it',
        'ES': 'es',
        'PT': 'pt',
        'NL': 'nl',
        'BE': 'fr',
        'CH': 'de',
        'AT': 'de',

        // Scandinavia
        'SE': 'sv',
        'NO': 'no',
        'DK': 'da',
        'FI': 'fi',
        'IS': 'is',

        // Eastern Europe
        'PL': 'pl',
        'CZ': 'cs',
        'SK': 'sk',
        'HU': 'hu',
        'RO': 'ro',
        'BG': 'bg',
        'HR': 'hr',
        'SI': 'sl',
        'RS': 'sr',
        'BA': 'bs',
        'ME': 'sr',
        'MK': 'mk',

        // Baltic
        'LT': 'lt',
        'LV': 'lv',
        'EE': 'et',

        // Southern Europe
        'GR': 'el',
        'AL': 'sq',

        // Middle East
        'SA': 'ar',
        'AE': 'ar',
        'EG': 'ar',
        'IQ': 'ar',
        'MA': 'ar',
        'IL': 'he',
        'IR': 'fa',
        'AF': 'fa',
        'TR': 'tr',

        // Latin America
        'MX': 'es',
        'AR': 'es',
        'CO': 'es',
        'CL': 'es',
        'PE': 'es',
        'VE': 'es',
        'UY': 'es',
        'PY': 'es',
        'BO': 'es',
        'EC': 'es',

        // Brazil
        'BR': 'pt',

        // Africa (major)
        'ZA': 'en',
        'NG': 'en',
        'KE': 'en',

        // Ukraine / Russia
        'UA': 'uk',
        'RU': 'ru',
    };

    // ── Overlay Loading ──────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.id = 'translate-overlay';
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:999999',
        'background:rgba(255, 255, 255, 0.6)',
        'backdrop-filter:blur(6px)',
        '-webkit-backdrop-filter:blur(6px)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'transition:opacity 0.4s ease',
        'opacity:1',
    ].join(';');

    var spinner = document.createElement('div');
    spinner.style.cssText = [
        'width:36px', 'height:36px',
        'border:3px solid #e0e0e0',
        'border-top-color:#1877f2',
        'border-radius:50%',
        'animation:_tl_spin 0.7s linear infinite',
    ].join(';');

    var style = document.createElement('style');
    style.textContent = '@keyframes _tl_spin{to{transform:rotate(360deg)}}';

    document.head.appendChild(style);
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);

    function removeOverlay() {
        overlay.style.opacity = '0';
        setTimeout(function () {
            overlay.parentNode && overlay.parentNode.removeChild(overlay);
        }, 420);
    }

    // ── Cookie Helpers ────────────────────────────────────────────────────
    function getGoogtransCookie() {
        var m = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
        return m ? decodeURIComponent(m[1]) : null;
    }

    function setGoogtransCookie(lang) {
        var value = '/en/' + lang;
        var domain = location.hostname;

        // Reset cookie cũ
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // Ghi cookie mới cho domain hiện tại
        document.cookie = 'googtrans=' + value + '; path=/';
        
        // Ghi cookie cho Root Domain nếu có Subdomain
        if (domain && domain !== 'localhost' && !domain.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            var parts = domain.split('.');
            if (parts.length > 1) {
                var rootDomain = parts.slice(-2).join('.');
                document.cookie = 'googtrans=' + value + '; path=/; domain=.' + rootDomain;
            }
        }
    }

    // ── Lấy Quốc gia qua Cloudflare CDN Trace (Không bao giờ bị AdBlock chặn) ──
    async function getCountryCode() {
        try {
            var res = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
            if (!res.ok) throw new Error('Network error');
            var text = await res.text();
            
            var locLine = text.split('\n').find(function(line) {
                return line.startsWith('loc=');
            });
            
            if (locLine) {
                return locLine.split('=')[1].trim().toUpperCase();
            }
        } catch (e) {
            // Backup nếu Cloudflare gặp sự cố hy hữu
            try {
                var res2 = await fetch('https://ipapi.co/json/');
                var data2 = await res2.json();
                return (data2.country_code || '').toUpperCase();
            } catch (e2) {}
        }
        return '';
    }

    // ── Chờ Google Translate hoàn thành dịch ──────────────────────────────
    function waitForTranslation(timeout) {
        return new Promise(function (resolve) {
            var html = document.documentElement;
            if (/translated-(ltr|rtl)/.test(html.className)) {
                return resolve();
            }
            var timer = setTimeout(resolve, timeout || 5000);
            var obs = new MutationObserver(function () {
                if (/translated-(ltr|rtl)/.test(html.className)) {
                    clearTimeout(timer);
                    obs.disconnect();
                    resolve();
                }
            });
            obs.observe(html, { attributes: true, attributeFilter: ['class'] });
        });
    }

    // ── Thực thi chính ─────────────────────────────────────────────────────
    async function run() {
        var existing = getGoogtransCookie();

        // Nếu đã có cookie dịch trước đó
        if (existing && existing !== '/en/' && existing !== '/en/undefined') {
            if (existing !== '/en/en') {
                await waitForTranslation(6000);
            }
            removeOverlay();
            return;
        }

        // Lần đầu vào trang: Lấy quốc gia và set ngôn ngữ
        var countryCode = await getCountryCode();
        var targetLang = countryCode ? LANG_MAP[countryCode] : null;

        if (!targetLang || targetLang === 'en') {
            if (targetLang === 'en') {
                setGoogtransCookie('en');
            }
            removeOverlay();
            return;
        }

        setGoogtransCookie(targetLang);
        location.reload();
    }

    if (document.body) {
        run();
    } else {
        document.addEventListener('DOMContentLoaded', run);
    }
})();
</script>
