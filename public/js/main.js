document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const nav = document.querySelector('.header nav');

    if (hamburgerMenu && nav) {
        hamburgerMenu.addEventListener('click', () => {
            nav.classList.toggle('is-active');
        });
    }
});