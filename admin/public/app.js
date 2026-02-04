// State
let currentImages = [];
let pendingUploads = [];
let deleteTarget = null;

// Elements
const dashboard = document.getElementById('dashboard');
const formContainer = document.getElementById('form-container');
const animalForm = document.getElementById('animal-form');
const formTitle = document.getElementById('form-title');
const formType = document.getElementById('form-type');
const formId = document.getElementById('form-id');
const imagePreview = document.getElementById('image-preview');
const deleteModal = document.getElementById('delete-modal');

// Followup elements
const followupBtn = document.getElementById('followup-btn');
const followupCountEl = document.getElementById('followup-count');
const followupModal = document.getElementById('followup-modal');
const followupList = document.getElementById('followup-list');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadAnimals();
  pollFollowups();
  setInterval(pollFollowups, 30000);
});
animalForm.addEventListener('submit', handleSubmit);

// Load and display animals
async function loadAnimals() {
  try {
    const res = await fetch('/api/animals');
    const data = await res.json();

    renderAnimalList('chickens', data.chickens);
    renderAnimalList('goats', data.goats);
  } catch (err) {
    console.error('Failed to load animals:', err);
  }
}

function renderAnimalList(type, animals) {
  const container = document.getElementById(`${type}-list`);

  if (animals.length === 0) {
    container.innerHTML = `<div class="empty-state">No ${type} yet. Add your first one!</div>`;
    return;
  }

  container.innerHTML = animals.map(animal => `
    <div class="animal-card">
      <img
        src="${animal.images?.[0] || '/images/placeholder.svg'}"
        alt="${animal.name}"
        class="animal-card-image"
        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23E0D0BC%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236B5A45%22 font-size=%2212%22>No image</text></svg>'"
      >
      <div class="animal-card-body">
        <div class="animal-card-name">${animal.name}</div>
        <div class="animal-card-meta">
          <span class="availability-badge ${animal.availability}">${capitalize(animal.availability)}</span>
          <span style="color: var(--earth-400); font-size: 0.8rem;">${animal.images?.length || 0} images</span>
        </div>
        <div class="animal-card-actions">
          <button class="btn btn-secondary" onclick="editAnimal('${type}', '${animal.id}')">Edit</button>
          <button class="btn btn-danger" onclick="showDeleteModal('${type}', '${animal.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Show form for create/edit
function showForm(type, animal = null) {
  formType.value = type;
  formId.value = animal?.id || '';
  formTitle.textContent = animal ? `Edit ${capitalize(type).slice(0, -1)}` : `Add New ${capitalize(type).slice(0, -1)}`;

  document.getElementById('name').value = animal?.name || '';
  document.getElementById('description').value = animal?.description || '';
  document.getElementById('availability').value = animal?.availability || '';

  currentImages = animal?.images || [];
  pendingUploads = [];
  renderImagePreviews();

  dashboard.classList.add('hidden');
  formContainer.classList.remove('hidden');
}

function hideForm() {
  formContainer.classList.add('hidden');
  dashboard.classList.remove('hidden');
  animalForm.reset();
  currentImages = [];
  pendingUploads = [];
}

async function editAnimal(type, id) {
  try {
    const res = await fetch(`/api/animals/${type}/${id}`);
    const animal = await res.json();
    showForm(type, animal);
  } catch (err) {
    console.error('Failed to load animal:', err);
    alert('Failed to load animal details');
  }
}

// Form submission
async function handleSubmit(e) {
  e.preventDefault();

  const type = formType.value;
  const id = formId.value;
  const isEdit = !!id;

  // Upload any pending images first
  if (pendingUploads.length > 0) {
    const formData = new FormData();
    pendingUploads.forEach(file => formData.append('images', file));

    try {
      const uploadRes = await fetch(`/api/upload/${type}`, {
        method: 'POST',
        body: formData
      });
      const { urls } = await uploadRes.json();
      currentImages = [...currentImages, ...urls];
    } catch (err) {
      console.error('Failed to upload images:', err);
      alert('Failed to upload images');
      return;
    }
  }

  const data = {
    name: document.getElementById('name').value,
    description: document.getElementById('description').value,
    availability: document.getElementById('availability').value,
    images: currentImages
  };

  try {
    const url = isEdit ? `/api/animals/${type}/${id}` : `/api/animals/${type}`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save');
    }

    hideForm();
    loadAnimals();
  } catch (err) {
    console.error('Failed to save:', err);
    alert(err.message || 'Failed to save animal');
  }
}

// Image handling
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');

  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  addPendingImages(files);
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  addPendingImages(files);
  e.target.value = ''; // Reset input
}

function addPendingImages(files) {
  pendingUploads = [...pendingUploads, ...files];
  renderImagePreviews();
}

function renderImagePreviews() {
  const existingHtml = currentImages.map((url, index) => `
    <div class="image-preview-item">
      <img src="${url}" alt="Image ${index + 1}">
      <button type="button" class="remove-btn" onclick="removeExistingImage(${index})">&times;</button>
    </div>
  `).join('');

  const pendingHtml = pendingUploads.map((file, index) => `
    <div class="image-preview-item">
      <img src="${URL.createObjectURL(file)}" alt="Pending ${index + 1}">
      <button type="button" class="remove-btn" onclick="removePendingImage(${index})">&times;</button>
    </div>
  `).join('');

  imagePreview.innerHTML = existingHtml + pendingHtml;
}

function removeExistingImage(index) {
  currentImages.splice(index, 1);
  renderImagePreviews();
}

function removePendingImage(index) {
  pendingUploads.splice(index, 1);
  renderImagePreviews();
}

// Delete functionality
function showDeleteModal(type, id) {
  deleteTarget = { type, id };
  deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteTarget = null;
  deleteModal.classList.add('hidden');
}

async function confirmDelete() {
  if (!deleteTarget) return;

  try {
    const res = await fetch(`/api/animals/${deleteTarget.type}/${deleteTarget.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete');

    closeDeleteModal();
    loadAnimals();
  } catch (err) {
    console.error('Failed to delete:', err);
    alert('Failed to delete animal');
  }
}

// Followup queue
async function pollFollowups() {
  try {
    const res = await fetch('/api/followups/count');
    const { count } = await res.json();

    if (count > 0) {
      followupCountEl.textContent = count;
      followupBtn.classList.remove('hidden');
    } else {
      followupBtn.classList.add('hidden');
    }
  } catch (err) {
    // Silently ignore — Redis may not be running
  }
}

async function toggleFollowupPanel() {
  followupModal.classList.toggle('hidden');
  if (!followupModal.classList.contains('hidden')) {
    await loadFollowups();
  }
}

function closeFollowupPanel() {
  followupModal.classList.add('hidden');
}

async function loadFollowups() {
  try {
    const res = await fetch('/api/followups');
    const followups = await res.json();

    if (followups.length === 0) {
      followupList.innerHTML = '<div class="empty-state">No unanswered questions</div>';
      return;
    }

    followupList.innerHTML = followups.map(f => `
      <div class="followup-item">
        <div class="followup-item-header">
          <span class="followup-sender">Sender: ${f.sender_id}</span>
          <span class="followup-time">${formatTimestamp(f.timestamp)}</span>
        </div>
        <div class="followup-question">${escapeHtml(f.question)}</div>
        <div class="followup-response">"${escapeHtml(f.bot_response)}"</div>
        <button class="btn btn-secondary" onclick="dismissFollowup(${f.index})">Dismiss</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load followups:', err);
    followupList.innerHTML = '<div class="empty-state">Failed to load followups</div>';
  }
}

async function dismissFollowup(index) {
  try {
    await fetch(`/api/followups/${index}`, { method: 'DELETE' });
    await loadFollowups();
    await pollFollowups();
  } catch (err) {
    console.error('Failed to dismiss followup:', err);
  }
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Deploy
async function deployChanges() {
  const btn = document.getElementById('deploy-btn');
  const originalText = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<span>Deploying...</span>';

  try {
    const res = await fetch('/api/deploy', { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      btn.innerHTML = '<span>Deployed!</span>';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);
    } else {
      throw new Error(data.error || 'Deploy failed');
    }
  } catch (err) {
    console.error('Deploy failed:', err);
    alert('Deploy failed: ' + err.message);
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Utilities
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
