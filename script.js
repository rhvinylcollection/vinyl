const STORAGE_KEY = 'vinylCollection';
const collectionEl = document.getElementById('collection');
const emptyEl = document.getElementById('empty');
const barcodeInput = document.getElementById('barcodeInput');
const addBtn = document.getElementById('addBtn');
const exportBtn = document.getElementById('exportBtn');

let collection = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}

function render() {
  collectionEl.innerHTML = '';
  if (collection.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  collection.forEach(item => {
    const card = document.createElement('div');
    card.className = 'record';
    card.innerHTML = `
      <img class="cover" src="${item.cover || 'https://via.placeholder.com/400x400/1a1a1a/666?text=No+Cover'}" alt="${item.title}">
      <div class="info">
        <div class="artist">${item.artist || 'Unknown Artist'}</div>
        <div class="title">${item.title || 'Untitled'}</div>
        <div class="meta">${item.year || ''} ${item.label ? '· ' + item.label : ''}</div>
      </div>
    `;
    collectionEl.appendChild(card);
  });
}

async function lookupBarcode(barcode) {
  const url = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(barcode)}&type=release&per_page=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VinylCollectionApp/1.0' }
  });
  if (!res.ok) throw new Error('Lookup failed');
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;

  const r = data.results[0];
  return {
    barcode,
    artist: r.title.split(' - ')[0] || r.title,
    title: r.title.includes(' - ') ? r.title.split(' - ').slice(1).join(' - ') : r.title,
    year: r.year || '',
    label: r.label?.[0] || '',
    cover: r.cover_image || r.thumb || '',
    discogsId: r.id
  };
}

async function addRecord() {
  const barcode = barcodeInput.value.trim();
  if (!barcode) return;

  addBtn.disabled = true;
  addBtn.textContent = 'Looking up…';

  try {
    const existing = collection.find(c => c.barcode === barcode);
    if (existing) {
      alert('This barcode is already in your collection.');
      return;
    }

    const release = await lookupBarcode(barcode);
    if (!release) {
      alert('No matching release found for this barcode.');
      return;
    }

    collection.unshift(release); // newest first
    save();
    render();
    barcodeInput.value = '';
  } catch (e) {
    alert('Could not look up the barcode. Check your connection or try again.');
    console.error(e);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = 'Add Record';
  }
}

function exportBarcodes() {
  if (collection.length === 0) {
    alert('Collection is empty.');
    return;
  }
  const barcodes = collection.map(c => c.barcode).join('\n');
  navigator.clipboard.writeText(barcodes).then(() => {
    alert('Barcodes copied to clipboard.\n\nTo update the public site, paste them into data.json on GitHub (one per line inside the array).');
  }).catch(() => {
    prompt('Copy these barcodes:', barcodes);
  });
}

addBtn.addEventListener('click', addRecord);
barcodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addRecord();
});
exportBtn.addEventListener('click', exportBarcodes);

// Load any public data.json if present (for shared version)
async function loadPublicData() {
  try {
    const res = await fetch('data.json');
    if (res.ok) {
      const barcodes = await res.json();
      if (Array.isArray(barcodes) && barcodes.length && collection.length === 0) {
        // Only auto-load if local collection is empty
        for (const bc of barcodes) {
          const release = await lookupBarcode(bc);
          if (release) collection.push(release);
        }
        save();
        render();
      }
    }
  } catch (_) {}
}

render();
loadPublicData();