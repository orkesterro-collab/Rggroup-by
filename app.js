document.documentElement.classList.add('js');

const menu = document.querySelector('.site-nav');
const menuToggle = document.querySelector('.menu-toggle');

if (menu && menuToggle) {
  function setMenu(open) {
    menu.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-head')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('open')) {
      setMenu(false);
      menuToggle.focus();
    }
  });
  window.matchMedia('(min-width:741px)').addEventListener('change', () => setMenu(false));
}
