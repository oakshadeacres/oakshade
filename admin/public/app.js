// State
const TABS = [
  { id: 'breeds', label: 'Breeds' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'hero', label: 'Hero' },
  { id: 'about', label: 'About' },
  { id: 'order', label: 'Order' },
  { id: 'pickupShipping', label: 'Pickup & Shipping' },
  { id: 'careGuide', label: 'Care Guide' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'contact', label: 'Contact' },
  { id: 'nav', label: 'Nav' },
  { id: 'footer', label: 'Footer' },
];

let site = null;
let breeds = [];
let activeTab = 'breeds';
let activeBreedId = null;

// DOM
const tabBar = document.getElementById('tab-bar');
const tabPanel = document.getElementById('tab-panel');
const saveIndicator = document.getElementById('save-indicator');

// Init
document.addEventListener('DOMContentLoaded', async () => {
  renderTabs();
  await Promise.all([loadSite(), loadBreeds()]);
  renderPanel();
  pollFollowups();
  setInterval(pollFollowups, 30000);
});

function renderTabs() {
  tabBar.innerHTML = TABS.map(t =>
    `<button class="tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');
  tabBar.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      activeBreedId = null;
      renderTabs();
      renderPanel();
    });
  });
}

async function loadSite() {
  const res = await fetch('/api/site');
  site = await res.json();
}

async function loadBreeds() {
  const res = await fetch('/api/breeds');
  breeds = await res.json();
}

async function saveSection(key, value) {
  flashSaving();
  const res = await fetch(`/api/site/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    flashError(err.error || 'Save failed');
    return false;
  }
  site[key] = value;
  flashSaved();
  return true;
}

async function saveBreed(id, data) {
  flashSaving();
  const res = await fetch(`/api/breeds/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    flashError('Save failed');
    return false;
  }
  const saved = await res.json();
  const idx = breeds.findIndex(b => b.id === id);
  if (idx >= 0) breeds[idx] = saved;
  flashSaved();
  return true;
}

function flashSaving() { saveIndicator.textContent = 'Saving…'; saveIndicator.className = 'save-indicator saving'; }
function flashSaved() { saveIndicator.textContent = 'Saved'; saveIndicator.className = 'save-indicator saved'; setTimeout(() => { saveIndicator.textContent = ''; saveIndicator.className = 'save-indicator'; }, 1500); }
function flashError(msg) { saveIndicator.textContent = msg; saveIndicator.className = 'save-indicator error'; setTimeout(() => { saveIndicator.textContent = ''; saveIndicator.className = 'save-indicator'; }, 3000); }

// Panel rendering
function renderPanel() {
  tabPanel.innerHTML = '';
  switch (activeTab) {
    case 'breeds': return renderBreedsTab();
    case 'schedule': return renderScheduleTab();
    case 'hero': return renderHeroTab();
    case 'about': return renderAboutTab();
    case 'order': return renderOrderTab();
    case 'pickupShipping': return renderPickupShippingTab();
    case 'careGuide': return renderCareGuideTab();
    case 'faqs': return renderFaqsTab();
    case 'testimonials': return renderTestimonialsTab();
    case 'contact': return renderContactTab();
    case 'nav': return renderNavTab();
    case 'footer': return renderFooterTab();
  }
}

// ===== Helpers =====
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else if (v != null) el.setAttribute(k, v);
  });
  [].concat(children).forEach(c => {
    if (c == null || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

function card(title, ...children) {
  return h('section', { class: 'panel-card' }, [
    title ? h('h2', { class: 'panel-card-title' }, title) : null,
    ...children
  ]);
}

function field(label, input, hint) {
  return h('div', { class: 'form-group' }, [
    h('label', {}, label),
    input,
    hint ? h('small', { class: 'hint' }, hint) : null,
  ]);
}

function textInput(value, onchange, placeholder = '') {
  return h('input', { type: 'text', value: value || '', placeholder, onchange: (e) => onchange(e.target.value) });
}

function textareaInput(value, onchange, rows = 4) {
  return h('textarea', { rows, onchange: (e) => onchange(e.target.value) }, value || '');
}

function numberInput(value, onchange) {
  return h('input', { type: 'number', value: value ?? 0, onchange: (e) => onchange(Number(e.target.value)) });
}

function selectInput(value, options, onchange, blankLabel = '— none —') {
  const sel = h('select', { onchange: (e) => onchange(e.target.value || undefined) });
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = blankLabel;
  if (!value) blank.selected = true;
  sel.appendChild(blank);
  (options || []).forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

function checkboxInput(checked, onchange, labelText) {
  return h('label', { class: 'checkbox-label' }, [
    h('input', { type: 'checkbox', checked: !!checked, onchange: (e) => onchange(e.target.checked) }),
    h('span', {}, labelText),
  ]);
}

function chipListEditor(items, onchange) {
  const wrap = h('div', { class: 'chip-list' });
  function render() {
    wrap.innerHTML = '';
    (items || []).forEach((item, i) => {
      const chip = h('span', { class: 'chip' }, [
        h('input', { type: 'text', value: item, onchange: (e) => { items[i] = e.target.value; onchange(items); } }),
        h('button', { type: 'button', class: 'chip-del', onclick: () => { items.splice(i, 1); onchange(items); render(); } }, '×'),
      ]);
      wrap.appendChild(chip);
    });
    const addBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => { items.push(''); onchange(items); render(); } }, '+ Add');
    wrap.appendChild(addBtn);
  }
  render();
  return wrap;
}

function listEditor(items, itemRenderer, onchange, addLabel = '+ Add') {
  const wrap = h('div', { class: 'list-editor' });
  function render() {
    wrap.innerHTML = '';
    (items || []).forEach((item, i) => {
      const row = h('div', { class: 'list-item' }, [
        itemRenderer(item, i, () => { onchange(items); }, () => render()),
        h('div', { class: 'list-item-actions' }, [
          i > 0 ? h('button', { type: 'button', class: 'btn btn-sm btn-secondary', onclick: () => { [items[i-1], items[i]] = [items[i], items[i-1]]; onchange(items); render(); } }, '↑') : null,
          i < items.length - 1 ? h('button', { type: 'button', class: 'btn btn-sm btn-secondary', onclick: () => { [items[i], items[i+1]] = [items[i+1], items[i]]; onchange(items); render(); } }, '↓') : null,
          h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: () => { items.splice(i, 1); onchange(items); render(); } }, 'Delete'),
        ]),
      ]);
      wrap.appendChild(row);
    });
    const addBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', style: 'margin-top: 0.5rem', onclick: () => { onchange(items); } }, addLabel);
    addBtn.addEventListener('click', (e) => e.preventDefault());
    wrap.appendChild(addBtn);
  }
  render();
  return { element: wrap, render };
}

function applyVarietyChangeToImages(breed, prev, next) {
  const imgs = breed.images || [];
  if (next.length === prev.length) {
    for (let i = 0; i < next.length; i++) {
      if (prev[i] !== next[i]) {
        const from = prev[i], to = next[i];
        imgs.forEach((img) => {
          if (img.variety === from) {
            if (to) img.variety = to; else delete img.variety;
          }
        });
        return;
      }
    }
  } else if (next.length === prev.length - 1) {
    const remaining = next.slice();
    let removed = null;
    for (const p of prev) {
      const idx = remaining.indexOf(p);
      if (idx !== -1) remaining.splice(idx, 1);
      else if (removed === null) removed = p;
    }
    if (removed) {
      imgs.forEach((img) => { if (img.variety === removed) delete img.variety; });
    }
  }
}

// ===== Tab: Breeds =====
function renderBreedsTab() {
  const container = h('div', { class: 'panel' });
  if (activeBreedId) {
    const breed = breeds.find(b => b.id === activeBreedId);
    if (!breed) { activeBreedId = null; return renderBreedsTab(); }
    container.appendChild(renderBreedEditor(breed));
  } else {
    container.appendChild(card('Breeds', renderBreedsList()));
  }
  tabPanel.appendChild(container);
}

function renderBreedsList() {
  const list = h('div', { class: 'breed-list-grid' });
  breeds.forEach(b => {
    const firstUrl = b.images && b.images[0] ? b.images[0].url : '';
    const preview = firstUrl ? firstUrl.replace(/(\.webp)$/, '-thumb$1') : '';
    list.appendChild(h('div', { class: 'breed-list-card' }, [
      h('div', { class: 'breed-list-thumb' }, preview ? h('img', { src: preview, alt: b.name }) : '—'),
      h('div', { class: 'breed-list-info' }, [
        h('div', { class: 'breed-list-name' }, [
          b.name,
          b.specialty ? h('span', { class: 'star' }, ' ★') : null,
        ]),
        h('div', { class: 'breed-list-meta' }, `${(b.varieties || []).length} varieties · ${(b.images || []).length} images`),
        h('button', { class: 'btn btn-primary btn-sm', onclick: () => { activeBreedId = b.id; renderPanel(); } }, 'Edit'),
      ]),
    ]));
  });
  return list;
}

function renderBreedEditor(breed) {
  const wrap = h('div', {});
  const header = h('div', { class: 'editor-header' }, [
    h('button', { class: 'btn btn-back', onclick: () => { activeBreedId = null; renderPanel(); } }, '← Back to breeds'),
    h('h2', {}, `Edit ${breed.name}`),
  ]);
  wrap.appendChild(header);

  wrap.appendChild(card('Basic info',
    field('Name', textInput(breed.name, (v) => { breed.name = v; saveBreed(breed.id, breed); })),
    field('Specialty flag', checkboxInput(breed.specialty, (v) => { breed.specialty = v; saveBreed(breed.id, breed); }, 'Mark as our specialty breed (shown with ★)')),
    field('Display order', numberInput(breed.order, (v) => { breed.order = v; saveBreed(breed.id, breed); }), 'Lower numbers show first'),
    field('Description', textareaInput(breed.description, (v) => { breed.description = v; saveBreed(breed.id, breed); }, 5)),
  ));

  const traitsWrap = h('div', {});
  function renderTraits() {
    traitsWrap.innerHTML = '';
    (breed.traits || []).forEach((t, i) => {
      traitsWrap.appendChild(h('div', { class: 'trait-row' }, [
        textInput(t.label, (v) => { breed.traits[i].label = v; saveBreed(breed.id, breed); }, 'Trait label'),
        textInput(t.val, (v) => { breed.traits[i].val = v; saveBreed(breed.id, breed); }, 'Value'),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => { breed.traits.splice(i, 1); saveBreed(breed.id, breed); renderTraits(); } }, 'Remove'),
      ]));
    });
    traitsWrap.appendChild(h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { breed.traits = breed.traits || []; breed.traits.push({ label: '', val: '' }); saveBreed(breed.id, breed); renderTraits(); } }, '+ Add trait'));
  }
  renderTraits();
  wrap.appendChild(card('Traits', traitsWrap));

  let prevVarieties = (breed.varieties || []).slice();
  wrap.appendChild(card('Varieties',
    h('p', { class: 'hint' }, 'Add a pill for each color/variety you carry. Shown under the breed description. Renaming or deleting a variety will update any photos tagged with it.'),
    chipListEditor(breed.varieties || [], (next) => {
      applyVarietyChangeToImages(breed, prevVarieties, next);
      breed.varieties = next;
      prevVarieties = next.slice();
      saveBreed(breed.id, breed);
    })
  ));

  wrap.appendChild(card(`Availability (${site?.schedule?.springLabel || 'Spring'})`,
    h('p', { class: 'hint' }, 'What varieties of this breed are available this spring.'),
    chipListEditor(breed.spring || [], (v) => { breed.spring = v; saveBreed(breed.id, breed); })
  ));

  wrap.appendChild(card(`Availability (${site?.schedule?.fallLabel || 'Fall'})`,
    h('p', { class: 'hint' }, 'What varieties of this breed are available this fall.'),
    chipListEditor(breed.fall || [], (v) => { breed.fall = v; saveBreed(breed.id, breed); })
  ));

  wrap.appendChild(card('Gallery images',
    h('p', { class: 'hint' }, 'Tag each photo with a variety so the matching pill highlights when visitors click through the gallery.'),
    renderImageManager('breeds/' + breed.id, breed.images || [], breed.varieties || [], (imgs) => { breed.images = imgs; saveBreed(breed.id, breed); })
  ));

  return wrap;
}

function renderImageManager(target, images, varieties, onchange) {
  const wrap = h('div', { class: 'image-manager' });

  function refresh() {
    wrap.innerHTML = '';
    const grid = h('div', { class: 'image-grid' });
    (images || []).forEach((img, i) => {
      const url = img.url;
      const thumb = url.replace(/(\.webp)$/, '-thumb$1');
      grid.appendChild(h('div', { class: 'image-item' }, [
        h('img', { src: thumb, alt: '', onerror: (e) => { e.target.src = url; } }),
        h('div', { class: 'image-variety' }, [
          h('label', { class: 'image-variety-label' }, 'Variety'),
          selectInput(img.variety, varieties || [], (v) => {
            if (v) images[i].variety = v; else delete images[i].variety;
            onchange(images);
          }, '— untagged —'),
        ]),
        h('div', { class: 'image-actions' }, [
          i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [images[i-1], images[i]] = [images[i], images[i-1]]; onchange(images); refresh(); } }, '←') : null,
          i < images.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [images[i], images[i+1]] = [images[i+1], images[i]]; onchange(images); refresh(); } }, '→') : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
            const ok = await confirmAction('Delete this image?', 'The file will be removed from disk.');
            if (!ok) return;
            await fetch('/api/images', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: url }) });
            images.splice(i, 1);
            onchange(images);
            refresh();
          } }, '×'),
        ]),
      ]));
    });
    wrap.appendChild(grid);

    const uploader = h('div', { class: 'image-uploader' }, [
      h('p', {}, 'Upload new images (JPEG/PNG/WebP, up to 10 at a time). Each one opens a square crop editor — pan and zoom to frame it.'),
      h('input', { type: 'file', multiple: true, accept: 'image/*', onchange: (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length) return;
        openCropQueue(files, async (results) => {
          if (!results.length) return;
          flashSaving();
          const fd = new FormData();
          fd.append('type', target);
          results.forEach(r => fd.append('images', r.blob, r.name));
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          if (!res.ok) { flashError('Upload failed'); return; }
          const data = await res.json();
          data.urls.forEach((u) => images.push({ url: u }));
          onchange(images);
          flashSaved();
          refresh();
        });
      } }),
    ]);
    wrap.appendChild(uploader);
  }
  refresh();
  return wrap;
}

function openCropQueue(files, onDone) {
  const modal = document.getElementById('crop-modal');
  const img = modal.querySelector('.crop-img');
  const counter = modal.querySelector('.crop-counter');
  const btnNext = modal.querySelector('.crop-next');
  const btnSkip = modal.querySelector('.crop-skip');
  const btnReset = modal.querySelector('.crop-reset');
  const btnZoomIn = modal.querySelector('.crop-zoom-in');
  const btnZoomOut = modal.querySelector('.crop-zoom-out');
  const btnCancel = modal.querySelector('.crop-cancel');

  let cropper = null;
  let currentUrl = null;
  let index = 0;
  let busy = false;
  const results = [];

  function loadCurrent() {
    if (cropper) { cropper.destroy(); cropper = null; }
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
    const file = files[index];
    counter.textContent = `${index + 1} of ${files.length} — ${file.name}`;
    btnNext.textContent = (index === files.length - 1) ? 'Save all' : 'Next';
    currentUrl = URL.createObjectURL(file);
    img.onload = () => {
      cropper = new Cropper(img, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1,
        dragMode: 'move',
        zoomable: true,
        scalable: false,
        rotatable: false,
        movable: true,
        toggleDragModeOnDblclick: false,
        background: true,
      });
    };
    img.src = currentUrl;
  }

  function close() {
    if (cropper) { cropper.destroy(); cropper = null; }
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
    img.onload = null;
    img.removeAttribute('src');
    modal.hidden = true;
    btnNext.onclick = btnSkip.onclick = btnReset.onclick = null;
    btnZoomIn.onclick = btnZoomOut.onclick = btnCancel.onclick = null;
  }

  function advance() {
    index += 1;
    busy = false;
    if (index >= files.length) {
      const out = results.slice();
      close();
      onDone(out);
    } else {
      loadCurrent();
    }
  }

  btnReset.onclick = () => { if (cropper) cropper.reset(); };
  btnZoomIn.onclick = () => { if (cropper) cropper.zoom(0.1); };
  btnZoomOut.onclick = () => { if (cropper) cropper.zoom(-0.1); };
  btnCancel.onclick = () => { if (!busy) close(); };

  btnSkip.onclick = () => {
    if (busy) return;
    const f = files[index];
    results.push({ blob: f, name: f.name });
    advance();
  };

  btnNext.onclick = () => {
    if (busy || !cropper) return;
    busy = true;
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 2000,
      maxHeight: 2000,
      imageSmoothingQuality: 'high',
    });
    if (!canvas) { busy = false; return; }
    canvas.toBlob((blob) => {
      if (!blob) { busy = false; return; }
      const original = files[index];
      const baseName = original.name.replace(/\.[^.]+$/, '');
      results.push({ blob, name: `${baseName}.jpg` });
      advance();
    }, 'image/jpeg', 0.92);
  };

  modal.hidden = false;
  loadCurrent();
}

// ===== Tab: Schedule =====
function renderScheduleTab() {
  const s = site.schedule;
  const container = h('div', {});
  container.appendChild(card('Schedule labels',
    field('Section label', textInput(s.label, (v) => { s.label = v; saveSection('schedule', s); })),
    field('Section title', textInput(s.title, (v) => { s.title = v; saveSection('schedule', s); })),
    field('Subtitle / intro', textareaInput(s.sub, (v) => { s.sub = v; saveSection('schedule', s); }, 2)),
    field('Spring season label', textInput(s.springLabel, (v) => { s.springLabel = v; saveSection('schedule', s); })),
    field('Fall season label', textInput(s.fallLabel, (v) => { s.fallLabel = v; saveSection('schedule', s); })),
    field('Footer note', textareaInput(s.footerNote, (v) => { s.footerNote = v; saveSection('schedule', s); }, 2)),
  ));
  container.appendChild(card('What\'s available each season',
    h('p', { class: 'hint' }, 'Edit per-breed availability on the Breeds tab — each breed has its own Spring and Fall lists.'),
    h('div', { class: 'schedule-matrix' }, breeds.map(b =>
      h('div', { class: 'schedule-matrix-row' }, [
        h('div', { class: 'schedule-matrix-breed' }, b.name),
        h('div', { class: 'schedule-matrix-col' }, [
          h('strong', {}, s.springLabel),
          (b.spring || []).length ? h('ul', {}, (b.spring || []).map(v => h('li', {}, v))) : h('em', {}, 'none'),
        ]),
        h('div', { class: 'schedule-matrix-col' }, [
          h('strong', {}, s.fallLabel),
          (b.fall || []).length ? h('ul', {}, (b.fall || []).map(v => h('li', {}, v))) : h('em', {}, 'none'),
        ]),
      ])
    )),
  ));
  tabPanel.appendChild(container);
}

// ===== Tab: Hero =====
function renderHeroTab() {
  const hero = site.hero;
  const container = h('div', {});
  container.appendChild(card('Hero text',
    field('Logo image path', textInput(hero.logoImage, (v) => { hero.logoImage = v; saveSection('hero', hero); }), 'Usually /images/site/logo.jpg — upload replacements below'),
    field('Title', textInput(hero.title, (v) => { hero.title = v; saveSection('hero', hero); })),
    field('Tagline', textareaInput(hero.tagline, (v) => { hero.tagline = v; saveSection('hero', hero); }, 2)),
  ));

  const badgesWrap = h('div', {});
  function renderBadges() {
    badgesWrap.innerHTML = '';
    (hero.badges || []).forEach((b, i) => {
      badgesWrap.appendChild(h('div', { class: 'trait-row' }, [
        textInput(b.label, (v) => { hero.badges[i].label = v; saveSection('hero', hero); }, 'Badge text'),
        checkboxInput(b.sage, (v) => { hero.badges[i].sage = v; saveSection('hero', hero); }, 'Sage color'),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => { hero.badges.splice(i, 1); saveSection('hero', hero); renderBadges(); } }, 'Remove'),
      ]));
    });
    badgesWrap.appendChild(h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { hero.badges = hero.badges || []; hero.badges.push({ label: '', sage: false }); saveSection('hero', hero); renderBadges(); } }, '+ Add badge'));
  }
  renderBadges();
  container.appendChild(card('Badges', badgesWrap));

  const ctasWrap = h('div', {});
  function renderCtas() {
    ctasWrap.innerHTML = '';
    (hero.ctas || []).forEach((c, i) => {
      ctasWrap.appendChild(h('div', { class: 'trait-row' }, [
        textInput(c.label, (v) => { hero.ctas[i].label = v; saveSection('hero', hero); }, 'Button label'),
        textInput(c.href, (v) => { hero.ctas[i].href = v; saveSection('hero', hero); }, 'Link'),
        checkboxInput(c.primary, (v) => { hero.ctas[i].primary = v; saveSection('hero', hero); }, 'Primary'),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => { hero.ctas.splice(i, 1); saveSection('hero', hero); renderCtas(); } }, 'Remove'),
      ]));
    });
    ctasWrap.appendChild(h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { hero.ctas = hero.ctas || []; hero.ctas.push({ label: '', href: '', primary: false }); saveSection('hero', hero); renderCtas(); } }, '+ Add button'));
  }
  renderCtas();
  container.appendChild(card('Call-to-action buttons', ctasWrap));

  container.appendChild(card('Logo upload',
    renderImageManager('site', [], async () => { await loadSite(); renderPanel(); }),
    h('p', { class: 'hint' }, 'Uploaded logos land in /images/site/. Copy the URL into the logo image path above.')
  ));

  tabPanel.appendChild(container);
}

// ===== Tab: About =====
function renderAboutTab() {
  const about = site.about;
  const container = h('div', {});
  container.appendChild(card('About section',
    field('Section label', textInput(about.label, (v) => { about.label = v; saveSection('about', about); })),
    field('Title', textInput(about.title, (v) => { about.title = v; saveSection('about', about); })),
    field('Image path (optional)', textInput(about.image, (v) => { about.image = v; saveSection('about', about); }), 'Leave blank for the placeholder illustration'),
  ));

  const paragraphsWrap = h('div', {});
  function renderParagraphs() {
    paragraphsWrap.innerHTML = '';
    (about.paragraphs || []).forEach((p, i) => {
      paragraphsWrap.appendChild(h('div', { class: 'list-item' }, [
        textareaInput(p, (v) => { about.paragraphs[i] = v; saveSection('about', about); }, 4),
        h('div', { class: 'list-item-actions' }, [
          i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [about.paragraphs[i-1], about.paragraphs[i]] = [about.paragraphs[i], about.paragraphs[i-1]]; saveSection('about', about); renderParagraphs(); } }, '↑') : null,
          i < about.paragraphs.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [about.paragraphs[i], about.paragraphs[i+1]] = [about.paragraphs[i+1], about.paragraphs[i]]; saveSection('about', about); renderParagraphs(); } }, '↓') : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => { about.paragraphs.splice(i, 1); saveSection('about', about); renderParagraphs(); } }, 'Remove'),
        ]),
      ]));
    });
    paragraphsWrap.appendChild(h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { about.paragraphs = about.paragraphs || []; about.paragraphs.push(''); saveSection('about', about); renderParagraphs(); } }, '+ Add paragraph'));
  }
  renderParagraphs();
  container.appendChild(card('Paragraphs', paragraphsWrap));

  tabPanel.appendChild(container);
}

// ===== Tab: Order =====
function renderOrderTab() {
  const order = site.order;
  const container = h('div', {});
  container.appendChild(card('Order section',
    field('Section label', textInput(order.label, (v) => { order.label = v; saveSection('order', order); })),
    field('Title', textInput(order.title, (v) => { order.title = v; saveSection('order', order); })),
    field('Intro', textareaInput(order.intro, (v) => { order.intro = v; saveSection('order', order); }, 2)),
    field('Facebook URL', textInput(order.facebookUrl, (v) => { order.facebookUrl = v; saveSection('order', order); })),
    field('CTA button label', textInput(order.ctaLabel, (v) => { order.ctaLabel = v; saveSection('order', order); })),
    field('CTA note', textInput(order.ctaNote, (v) => { order.ctaNote = v; saveSection('order', order); })),
  ));

  const stepsWrap = h('div', {});
  function renderSteps() {
    stepsWrap.innerHTML = '';
    (order.steps || []).forEach((step, i) => {
      stepsWrap.appendChild(h('div', { class: 'list-item' }, [
        h('div', { class: 'form-group' }, [
          h('label', {}, `Step ${i + 1} title`),
          textInput(step.title, (v) => { order.steps[i].title = v; saveSection('order', order); }),
          h('label', {}, 'Text'),
          textareaInput(step.text, (v) => { order.steps[i].text = v; saveSection('order', order); }, 3),
        ]),
        h('div', { class: 'list-item-actions' }, [
          i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [order.steps[i-1], order.steps[i]] = [order.steps[i], order.steps[i-1]]; saveSection('order', order); renderSteps(); } }, '↑') : null,
          i < order.steps.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [order.steps[i], order.steps[i+1]] = [order.steps[i+1], order.steps[i]]; saveSection('order', order); renderSteps(); } }, '↓') : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => { order.steps.splice(i, 1); saveSection('order', order); renderSteps(); } }, 'Remove'),
        ]),
      ]));
    });
    stepsWrap.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: () => { order.steps = order.steps || []; order.steps.push({ title: '', text: '' }); saveSection('order', order); renderSteps(); } }, '+ Add step'));
  }
  renderSteps();
  container.appendChild(card('Steps', stepsWrap));
  tabPanel.appendChild(container);
}

// ===== Tab: Pickup & Shipping =====
function renderPickupShippingTab() {
  const container = h('div', {});
  const section = site.pickupShippingSection;
  container.appendChild(card('Section heading',
    field('Section label', textInput(section.label, (v) => { section.label = v; saveSection('pickupShippingSection', section); })),
    field('Title', textInput(section.title, (v) => { section.title = v; saveSection('pickupShippingSection', section); })),
  ));

  const cards = site.pickupShipping;
  const cardsWrap = h('div', {});
  function renderCards() {
    cardsWrap.innerHTML = '';
    cards.forEach((c, i) => {
      cardsWrap.appendChild(h('div', { class: 'list-item' }, [
        h('div', { class: 'form-group' }, [
          h('label', {}, 'Icon / emoji'),
          textInput(c.icon, (v) => { cards[i].icon = v; saveSection('pickupShipping', cards); }),
          h('label', {}, 'Title'),
          textInput(c.title, (v) => { cards[i].title = v; saveSection('pickupShipping', cards); }),
          h('label', {}, 'Text'),
          textareaInput(c.text, (v) => { cards[i].text = v; saveSection('pickupShipping', cards); }, 3),
        ]),
        h('div', { class: 'list-item-actions' }, [
          i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [cards[i-1], cards[i]] = [cards[i], cards[i-1]]; saveSection('pickupShipping', cards); renderCards(); } }, '↑') : null,
          i < cards.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [cards[i], cards[i+1]] = [cards[i+1], cards[i]]; saveSection('pickupShipping', cards); renderCards(); } }, '↓') : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => { cards.splice(i, 1); saveSection('pickupShipping', cards); renderCards(); } }, 'Remove'),
        ]),
      ]));
    });
    cardsWrap.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: () => { cards.push({ icon: '📦', title: '', text: '' }); saveSection('pickupShipping', cards); renderCards(); } }, '+ Add card'));
  }
  renderCards();
  container.appendChild(card('Cards', cardsWrap));
  tabPanel.appendChild(container);
}

// ===== Tab: Care Guide =====
function renderCareGuideTab() {
  const container = h('div', {});
  const section = site.careGuideSection;
  container.appendChild(card('Section heading',
    field('Section label', textInput(section.label, (v) => { section.label = v; saveSection('careGuideSection', section); })),
    field('Title', textInput(section.title, (v) => { section.title = v; saveSection('careGuideSection', section); })),
    field('Subtitle', textInput(section.sub, (v) => { section.sub = v; saveSection('careGuideSection', section); })),
  ));
  container.appendChild(card('Guide entries', renderQAList('careGuide')));
  tabPanel.appendChild(container);
}

// ===== Tab: FAQs =====
function renderFaqsTab() {
  const container = h('div', {});
  const section = site.faqSection;
  container.appendChild(card('Section heading',
    field('Section label', textInput(section.label, (v) => { section.label = v; saveSection('faqSection', section); })),
    field('Title', textInput(section.title, (v) => { section.title = v; saveSection('faqSection', section); })),
  ));
  container.appendChild(card('Questions', renderQAList('faqs')));
  tabPanel.appendChild(container);
}

function renderQAList(key) {
  const items = site[key];
  const wrap = h('div', {});
  function render() {
    wrap.innerHTML = '';
    items.forEach((item, i) => {
      wrap.appendChild(h('div', { class: 'list-item' }, [
        h('div', { class: 'form-group' }, [
          h('label', {}, 'Question'),
          textInput(item.q, (v) => { items[i].q = v; saveSection(key, items); }),
          h('label', {}, 'Answer'),
          textareaInput(item.a, (v) => { items[i].a = v; saveSection(key, items); }, 4),
        ]),
        h('div', { class: 'list-item-actions' }, [
          i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [items[i-1], items[i]] = [items[i], items[i-1]]; saveSection(key, items); render(); } }, '↑') : null,
          i < items.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [items[i], items[i+1]] = [items[i+1], items[i]]; saveSection(key, items); render(); } }, '↓') : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => { items.splice(i, 1); saveSection(key, items); render(); } }, 'Remove'),
        ]),
      ]));
    });
    wrap.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: () => { items.push({ q: '', a: '' }); saveSection(key, items); render(); } }, '+ Add'));
  }
  render();
  return wrap;
}

// ===== Tab: Testimonials =====
function renderTestimonialsTab() {
  const container = h('div', {});
  const section = site.testimonialsSection;
  container.appendChild(card('Section heading',
    field('Section label', textInput(section.label, (v) => { section.label = v; saveSection('testimonialsSection', section); })),
    field('Title', textInput(section.title, (v) => { section.title = v; saveSection('testimonialsSection', section); })),
  ));

  const items = site.testimonials;
  const wrap = h('div', {});
  function render() {
    wrap.innerHTML = '';
    items.forEach((t, i) => {
      wrap.appendChild(h('div', { class: 'list-item' }, [
        h('div', { class: 'form-group' }, [
          h('label', {}, 'Name'),
          textInput(t.name, (v) => { items[i].name = v; saveSection('testimonials', items); }),
          h('label', {}, 'Testimonial'),
          textareaInput(t.text, (v) => { items[i].text = v; saveSection('testimonials', items); }, 3),
          h('label', {}, 'Stars (1–5)'),
          numberInput(t.stars, (v) => { items[i].stars = Math.max(1, Math.min(5, v)); saveSection('testimonials', items); }),
        ]),
        h('div', { class: 'list-item-actions' }, [
          i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [items[i-1], items[i]] = [items[i], items[i-1]]; saveSection('testimonials', items); render(); } }, '↑') : null,
          i < items.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [items[i], items[i+1]] = [items[i+1], items[i]]; saveSection('testimonials', items); render(); } }, '↓') : null,
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => { items.splice(i, 1); saveSection('testimonials', items); render(); } }, 'Remove'),
        ]),
      ]));
    });
    wrap.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: () => { items.push({ name: '', text: '', stars: 5 }); saveSection('testimonials', items); render(); } }, '+ Add'));
  }
  render();
  container.appendChild(card('Testimonials', wrap));
  tabPanel.appendChild(container);
}

// ===== Tab: Contact =====
function renderContactTab() {
  const contact = site.contact;
  const container = h('div', {});
  container.appendChild(card('Contact section',
    field('Section label', textInput(contact.label, (v) => { contact.label = v; saveSection('contact', contact); })),
    field('Title', textInput(contact.title, (v) => { contact.title = v; saveSection('contact', contact); })),
    field('Intro', textareaInput(contact.intro, (v) => { contact.intro = v; saveSection('contact', contact); }, 3)),
    field('Contact email', textInput(contact.email, (v) => { contact.email = v; saveSection('contact', contact); }), 'Fallback address. Used for mailto: when the form endpoint is empty.'),
    field('Form endpoint URL', textInput(contact.endpoint || '', (v) => { contact.endpoint = v; saveSection('contact', contact); }), 'Public URL of the /api/contact endpoint (e.g. https://admin.oakshadeacres.com/api/contact). Leave blank to fall back to mailto.'),
  ));
  const rows = contact.infoRows;
  const wrap = h('div', {});
  function render() {
    wrap.innerHTML = '';
    rows.forEach((row, i) => {
      wrap.appendChild(h('div', { class: 'trait-row' }, [
        textInput(row.icon, (v) => { rows[i].icon = v; saveSection('contact', contact); }, 'Icon'),
        textInput(row.text, (v) => { rows[i].text = v; saveSection('contact', contact); }, 'Text'),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => { rows.splice(i, 1); saveSection('contact', contact); render(); } }, 'Remove'),
      ]));
    });
    wrap.appendChild(h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { rows.push({ icon: '📍', text: '' }); saveSection('contact', contact); render(); } }, '+ Add row'));
  }
  render();
  container.appendChild(card('Info rows (shown next to the form)', wrap));
  tabPanel.appendChild(container);
}

// ===== Tab: Nav =====
function renderNavTab() {
  const nav = site.nav;
  const container = h('div', {});
  container.appendChild(card('Nav basics',
    field('Logo / brand text', textInput(nav.logo, (v) => { nav.logo = v; saveSection('nav', nav); })),
    field('CTA button label', textInput(nav.cta.label, (v) => { nav.cta.label = v; saveSection('nav', nav); })),
    field('CTA button link', textInput(nav.cta.href, (v) => { nav.cta.href = v; saveSection('nav', nav); })),
  ));
  const links = nav.links;
  const wrap = h('div', {});
  function render() {
    wrap.innerHTML = '';
    links.forEach((link, i) => {
      wrap.appendChild(h('div', { class: 'trait-row' }, [
        textInput(link.label, (v) => { links[i].label = v; saveSection('nav', nav); }, 'Label'),
        textInput(link.href, (v) => { links[i].href = v; saveSection('nav', nav); }, 'Link'),
        i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [links[i-1], links[i]] = [links[i], links[i-1]]; saveSection('nav', nav); render(); } }, '↑') : null,
        i < links.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [links[i], links[i+1]] = [links[i+1], links[i]]; saveSection('nav', nav); render(); } }, '↓') : null,
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => { links.splice(i, 1); saveSection('nav', nav); render(); } }, 'Remove'),
      ]));
    });
    wrap.appendChild(h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { links.push({ label: '', href: '' }); saveSection('nav', nav); render(); } }, '+ Add link'));
  }
  render();
  container.appendChild(card('Nav links', wrap));
  tabPanel.appendChild(container);
}

// ===== Tab: Footer =====
function renderFooterTab() {
  const footer = site.footer;
  const container = h('div', {});
  container.appendChild(card('Brand',
    field('Logo path', textInput(footer.logoImage, (v) => { footer.logoImage = v; saveSection('footer', footer); })),
    field('Brand name', textInput(footer.brandName, (v) => { footer.brandName = v; saveSection('footer', footer); })),
    field('Brand text', textareaInput(footer.brandText, (v) => { footer.brandText = v; saveSection('footer', footer); }, 2), 'Use Enter for line breaks.'),
    field('Copyright line', textInput(footer.copyright, (v) => { footer.copyright = v; saveSection('footer', footer); })),
  ));

  container.appendChild(card('Get-in-touch column',
    field('Column title', textInput(footer.getInTouch.title, (v) => { footer.getInTouch.title = v; saveSection('footer', footer); })),
    field('Note (shown below links)', textareaInput(footer.getInTouch.note, (v) => { footer.getInTouch.note = v; saveSection('footer', footer); }, 2)),
    renderFooterLinkList(footer.getInTouch.items, () => saveSection('footer', footer)),
  ));

  container.appendChild(card('Quick links',
    field('Column title', textInput(footer.quickLinks.title, (v) => { footer.quickLinks.title = v; saveSection('footer', footer); })),
    renderFooterLinkList(footer.quickLinks.items, () => saveSection('footer', footer)),
  ));

  tabPanel.appendChild(container);
}

function renderFooterLinkList(items, save) {
  const wrap = h('div', {});
  function render() {
    wrap.innerHTML = '';
    items.forEach((link, i) => {
      wrap.appendChild(h('div', { class: 'trait-row' }, [
        textInput(link.label, (v) => { items[i].label = v; save(); }, 'Label'),
        textInput(link.href, (v) => { items[i].href = v; save(); }, 'Link'),
        i > 0 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [items[i-1], items[i]] = [items[i], items[i-1]]; save(); render(); } }, '↑') : null,
        i < items.length - 1 ? h('button', { class: 'btn btn-sm btn-secondary', onclick: () => { [items[i], items[i+1]] = [items[i+1], items[i]]; save(); render(); } }, '↓') : null,
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => { items.splice(i, 1); save(); render(); } }, 'Remove'),
      ]));
    });
    wrap.appendChild(h('button', { class: 'btn btn-secondary btn-sm', onclick: () => { items.push({ label: '', href: '' }); save(); render(); } }, '+ Add link'));
  }
  render();
  return wrap;
}

// ===== Modal =====
function confirmAction(title, body) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-body').textContent = body || '';
    modal.classList.remove('hidden');
    const ok = document.getElementById('confirm-ok');
    const cleanup = (val) => { modal.classList.add('hidden'); ok.onclick = null; resolve(val); };
    ok.onclick = () => cleanup(true);
    window._closeConfirm = () => cleanup(false);
  });
}
function closeConfirmModal() { if (window._closeConfirm) window._closeConfirm(); }

// ===== Followups & deploy =====
async function pollFollowups() {
  try {
    const res = await fetch('/api/followups/count');
    const { count } = await res.json();
    const btn = document.getElementById('followup-btn');
    const label = document.getElementById('followup-count');
    if (count > 0) { label.textContent = count; btn.classList.remove('hidden'); }
    else { btn.classList.add('hidden'); }
  } catch {}
}

async function toggleFollowupPanel() {
  const modal = document.getElementById('followup-modal');
  modal.classList.toggle('hidden');
  if (!modal.classList.contains('hidden')) await loadFollowups();
}

function closeFollowupPanel() { document.getElementById('followup-modal').classList.add('hidden'); }

async function loadFollowups() {
  const list = document.getElementById('followup-list');
  try {
    const res = await fetch('/api/followups');
    const items = await res.json();
    if (!items.length) { list.innerHTML = '<div class="empty-state">No unanswered questions</div>'; return; }
    list.innerHTML = items.map(f => `
      <div class="followup-item">
        <div class="followup-item-header">
          <span class="followup-sender">Sender: ${f.sender_id}</span>
          <span class="followup-time">${new Date(f.timestamp).toLocaleString()}</span>
        </div>
        <div class="followup-question">${escapeHtml(f.question)}</div>
        <div class="followup-response">"${escapeHtml(f.bot_response)}"</div>
        <button class="btn btn-secondary" onclick="dismissFollowup(${f.index})">Dismiss</button>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div class="empty-state">Failed to load</div>';
  }
}

async function dismissFollowup(index) {
  await fetch(`/api/followups/${index}`, { method: 'DELETE' });
  await loadFollowups();
  await pollFollowups();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

async function deployChanges() {
  const btn = document.getElementById('deploy-btn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Deploying…</span>';
  try {
    const res = await fetch('/api/deploy', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Deploy failed');
    btn.innerHTML = `<span>${data.message || 'Deployed!'}</span>`;
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2200);
  } catch (err) {
    alert('Deploy failed: ' + err.message);
    btn.innerHTML = original;
    btn.disabled = false;
  }
}
