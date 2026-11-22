(() => {
  const projectList = document.querySelector('.in-project-list');
  if (!projectList) return;

  const filterGroup = document.querySelector('.in-filters');
  const result = document.getElementById('filter-result');
  const filters = Array.from(filterGroup.querySelectorAll('button'));
  const projects = Array.from(projectList.querySelectorAll('.in-project'));
  let sector = 'all';

  function selectSector(value) {
    sector = value;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sector === value)));
    projects.forEach(project => {
      project.hidden = value !== 'all' && project.dataset.projectSector !== value;
    });
    result.textContent = 'Показано объектов: ' + projects.filter(project => !project.hidden).length;
  }

  function showProjectFromURL() {
    const current = projects.find(project => '#' + project.id === window.location.hash);
    projects.forEach(project => { project.open = project === current; });
    if (!current) return;
    if (sector !== 'all' && sector !== current.dataset.projectSector) selectSector('all');
    current.scrollIntoView({block: 'start'});
  }

  filterGroup.hidden = false;
  filterGroup.addEventListener('click', event => {
    const button = event.target.closest('button[data-sector]');
    if (!button) return;
    selectSector(button.dataset.sector);
    const current = projects.find(project => '#' + project.id === window.location.hash);
    if (current && current.hidden) {
      current.open = false;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });

  projects.forEach(project => {
    project.querySelector('summary').addEventListener('click', event => {
      event.preventDefault();
      const opening = !project.open;
      projects.forEach(item => { item.open = opening && item === project; });
      const nextURL = window.location.pathname + window.location.search + (opening ? '#' + project.id : '');
      window.history.pushState(null, '', nextURL);
    });
  });

  window.addEventListener('hashchange', showProjectFromURL);
  if (window.location.hash) showProjectFromURL();
})();
