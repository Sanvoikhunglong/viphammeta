function setGoogtransCookie(lang) {
    var value = '/en/' + lang;
    var domain = location.hostname;

    // Xóa cookie cũ nếu có
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + domain + ';';

    // Set cookie mới
    document.cookie = 'googtrans=' + value + '; path=/';
    if (domain && domain !== 'localhost' && !domain.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        // Ghi cookie cho root domain (bao gồm subdomains)
        var rootDomain = domain.split('.').slice(-2).join('.');
        document.cookie = 'googtrans=' + value + '; path=/; domain=.' + rootDomain;
    }
}
