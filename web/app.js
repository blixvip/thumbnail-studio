const $ = selector => document.querySelector(selector);
let library = { images: [], sources: [] };
let selectedSource = '', filter = 'all', limit = 60;
let favorites;
try { favorites = new Set(JSON.parse(localStorage.getItem('thumbnail-favorites') || '[]')); }
catch { favorites = new Set(); }

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function showPreview(item) {
  $('#preview-image').src = `/media/${item.file}`;
  $('#preview-image').alt = item.alt || `Image from ${item.sources[0].name}`;
  $('#preview-title').textContent = item.alt || item.sources[0].name;
  $('#dimensions').textContent = `${item.width} × ${item.height} · ${(item.bytes / 1024).toFixed(0)} KB · Imported original`;
  $('#original').href = `/media/${item.file}`;
  $('#original').download = `${item.sources[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${item.id.slice(0, 8)}.${item.file.split('.').pop()}`;
  $('#provenance').replaceChildren(element('span', 'Source:'));
  const seen = new Set();
  for (const source of item.sources) {
    if (seen.has(source.page)) continue;
    seen.add(source.page);
    const link = element('a', source.name);
    link.href = source.page;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    $('#provenance').append(link);
  }
  $('#preview').showModal();
}

function card(item) {
  const article = element('article', '', 'card');
  const button = element('button', '', 'image-button');
  button.setAttribute('aria-label', `Preview ${item.alt || item.sources[0].name}`);
  const img = element('img');
  img.src = `/media/${item.preview}`;
  img.alt = item.alt || `Imported image from ${item.sources[0].name}`;
  img.loading = 'lazy'; img.decoding = 'async';
  img.addEventListener('error', () => { img.alt = 'Preview unavailable. Open to view original.'; });
  button.append(img); button.addEventListener('click', () => showPreview(item));
  const meta = element('div', '', 'card-meta');
  const label = element('div');
  label.append(element('p', item.sources[0].name), element('small', `${item.width} × ${item.height}`));
  const favorite = element('button', favorites.has(item.id) ? '★' : '☆', 'favorite');
  favorite.setAttribute('aria-label', `Favorite image from ${item.sources[0].name}`);
  favorite.setAttribute('aria-pressed', String(favorites.has(item.id)));
  favorite.addEventListener('click', () => {
    favorites.has(item.id) ? favorites.delete(item.id) : favorites.add(item.id);
    try { localStorage.setItem('thumbnail-favorites', JSON.stringify([...favorites])); } catch { /* Favorites remain usable in memory. */ }
    favorite.textContent = favorites.has(item.id) ? '★' : '☆';
    favorite.setAttribute('aria-pressed', String(favorites.has(item.id)));
    if (filter === 'favorites') render();
  });
  meta.append(label, favorite); article.append(button, meta);
  return article;
}

function render() {
  const search = $('#search').value.toLowerCase().trim();
  const matches = library.images.filter(item => {
    return (!selectedSource || item.sources.some(source => source.name === selectedSource))
      && (filter === 'all' || (filter === 'thumbnail' ? item.kind === 'thumbnail' : favorites.has(item.id)))
      && (!search || `${item.alt} ${item.sources.map(s => s.name).join(' ')} ${item.width} ${item.height}`.toLowerCase().includes(search));
  });
  $('#gallery').replaceChildren(...matches.slice(0, limit).map(card));
  $('#gallery').setAttribute('aria-busy', 'false');
  $('#result-count').textContent = `${matches.length.toLocaleString()} images${selectedSource ? ` from ${selectedSource}` : ' across your collection'}`;
  $('#empty').hidden = matches.length !== 0;
  $('#empty h2').textContent = library.images.length ? 'No matching images' : 'Your library is empty';
  $('#empty p').textContent = library.images.length ? 'Try another source or search term.' : 'Import your portfolio sources to start collecting.';
  $('#more').hidden = matches.length <= limit;
}

function selectSource(name) {
  selectedSource = name; limit = 60;
  document.querySelectorAll('.source').forEach(button => {
    const active = (button.dataset.source || '') === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  render();
}

async function load() {
  for (let i = 0; i < 9; i++) $('#gallery').append(element('div', '', 'skeleton'));
  try {
    const response = await fetch('/api/library');
    if (!response.ok) throw new Error('Library unavailable');
    library = await response.json();
    library.images.sort((a, b) => Number(b.kind === 'thumbnail') - Number(a.kind === 'thumbnail'));
    $('#total').textContent = library.images.length.toLocaleString();
    $('#all-count').textContent = library.images.length.toLocaleString();
    for (const source of library.sources) {
      const count = library.images.filter(item => item.sources.some(origin => origin.name === source.name)).length;
      const button = element('button', '', 'source');
      button.dataset.source = source.name;
      button.append(element('span', source.name), element('span', String(count)));
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => selectSource(source.name));
      $('#sources').append(button);
      $('#import-details').append(element('p', `${source.name}: ${count} saved; ${source.errors.length} skipped or failed.`));
    }
    render();
  } catch {
    $('#gallery').replaceChildren(); $('#gallery').setAttribute('aria-busy', 'false');
    $('#result-count').textContent = 'Could not load the library. Reload to try again.';
  }
}

$('#all-sources').addEventListener('click', () => selectSource(''));
$('#search').addEventListener('input', () => { limit = 60; render(); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter; limit = 60;
  document.querySelectorAll('[data-filter]').forEach(tab => {
    tab.classList.toggle('active', tab === button);
    tab.setAttribute('aria-pressed', String(tab === button));
  });
  render();
}));
$('#more').addEventListener('click', () => { limit += 60; render(); });
$('#close').addEventListener('click', () => $('#preview').close());
$('#preview').addEventListener('click', event => { if (event.target === $('#preview')) $('#preview').close(); });
load();
