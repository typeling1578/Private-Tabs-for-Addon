document.addEventListener("DOMContentLoaded", function() {
    for (let elem of document.querySelectorAll('[data-i18n-type="text"]')) {
        elem.innerText = browser.i18n.getMessage(elem.getAttribute("data-i18n-id"));
    }
    for (let elem of document.querySelectorAll('[data-i18n-type="value"]')) {
        elem.value = browser.i18n.getMessage(elem.getAttribute("data-i18n-id"));
    }
});
