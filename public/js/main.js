const html = (strings, ...values) => String.raw({ raw: strings }, ...values);

function escapeHTML(str) {
    if (str === undefined || str === null) return '';
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getContrastingTextColor(hexColor) {
    // Remove the hash at the start if it's there
    hexColor = hexColor.replace(/^#/, '');

    // Parse the R, G, B values
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);

    // Calculate the perceptive luminance (aka luma) - human eye perception
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for bright colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const nav = document.querySelector('header nav');

    if (hamburgerMenu && nav) {
        hamburgerMenu.addEventListener('click', () => {
            nav.classList.toggle('is-active');
        });
    }
});