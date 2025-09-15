// Data keys
const STORAGE_KEY = 'lost_found_items_v1';
const THEME_KEY = 'lf_theme';

// Elements
const form = document.getElementById('itemForm');
const typeInput = document.getElementById('itemType');
const nameInput = document.getElementById('itemName');
const descInput = document.getElementById('itemDescription');
const locationInput = document.getElementById('itemLocation');
const dateInput = document.getElementById('itemDate');
const categoryInput = document.getElementById('itemCategory');
const contactInput = document.getElementById('itemContact');
const imageInput = document.getElementById('itemImage');
const imagePreview = document.getElementById('imagePreview');

const lostListEl = document.getElementById('lostList');
const foundListEl = document.getElementById('foundList');

const searchInput = document.getElementById('searchInput');
const filterType = document.getElementById('filterType');

const toastEl = document.getElementById('toast');
const themeToggle = document.getElementById('themeToggle');

// Helpers
function loadItems(){
    try{
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }catch(e){
        console.error('Failed to load items', e);
        return [];
    }
}

function saveItems(items){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function createId(){
    return 'itm_' + Math.random().toString(36).slice(2) + Date.now();
}

function showToast(message){
    if(!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), 1800);
}

function readFileAsDataURL(file){
    return new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderImagePreview(file){
    if(!file){ imagePreview.classList.add('hidden'); imagePreview.innerHTML=''; return; }
    const url = URL.createObjectURL(file);
    imagePreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = url;
    imagePreview.appendChild(img);
    imagePreview.classList.remove('hidden');
}

function clearForm(){
    form.reset();
    imagePreview.innerHTML='';
    imagePreview.classList.add('hidden');
}

// Rendering
function renderLists(){
    const items = loadItems().filter(i => !i.returned);
    const query = (searchInput.value || '').toLowerCase().trim();
    const typeFilter = filterType.value;

    const matches = (item) => {
        if(typeFilter !== 'all' && item.type !== typeFilter) return false;
        if(!query) return true;
        const hay = [item.name, item.description, item.location, item.category, item.contact]
            .filter(Boolean)
            .join(' ').toLowerCase();
        return hay.includes(query);
    };

    const lost = items.filter(i => i.type === 'lost' && matches(i));
    const found = items.filter(i => i.type === 'found' && matches(i));

    drawCards(lostListEl, lost);
    drawCards(foundListEl, found);
}

function drawCards(container, list){
    container.innerHTML = '';
    if(list.length === 0){
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.innerHTML = '<div class="meta">No items yet.</div>';
        container.appendChild(empty);
        return;
    }
    list.forEach(item =>{
        const card = document.createElement('div');
        card.className = 'card';

        if(item.image){
            const img = document.createElement('img');
            img.className = 'thumb';
            img.src = item.image;
            img.alt = item.name;
            card.appendChild(img);
        }

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = item.name;
        card.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const dateLabel = item.date ? new Date(item.date).toLocaleDateString() : '—';
        meta.textContent = `${item.type === 'lost' ? 'Lost' : 'Found'} at ${item.location || 'Unknown'} • ${dateLabel}`;
        card.appendChild(meta);

        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = item.description;
        card.appendChild(desc);

        const tags = document.createElement('div');
        tags.style.display = 'flex';
        tags.style.gap = '6px';
        if(item.category){
            const tag1 = document.createElement('span');
            tag1.className = 'tag';
            tag1.textContent = item.category;
            tags.appendChild(tag1);
        }
        if(item.contact){
            const tag2 = document.createElement('span');
            tag2.className = 'tag';
            tag2.textContent = item.contact;
            tags.appendChild(tag2);
        }
        card.appendChild(tags);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const returnedBtn = document.createElement('button');
        returnedBtn.className = 'ghost';
        returnedBtn.textContent = 'Mark Returned';
        returnedBtn.addEventListener('click', () => markReturned(item.id));
        actions.appendChild(returnedBtn);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'ghost';
        copyBtn.textContent = 'Copy Contact';
        copyBtn.addEventListener('click', async () => {
            if(navigator.clipboard && item.contact){
                await navigator.clipboard.writeText(item.contact);
                showToast('Contact copied');
            }
        });
        actions.appendChild(copyBtn);

        card.appendChild(actions);

        container.appendChild(card);
    });
}

function markReturned(id){
    const items = loadItems();
    const idx = items.findIndex(i => i.id === id);
    if(idx !== -1){
        items[idx].returned = true;
        saveItems(items);
        renderLists();
        showToast('Item marked as returned');
    }
}

// Theme
function applyTheme(theme){
    const root = document.documentElement;
    if(theme === 'dark'){
        root.classList.add('dark');
        themeToggle.textContent = '☀️';
    }else{
        root.classList.remove('dark');
        themeToggle.textContent = '🌙';
    }
}
function loadTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved){ applyTheme(saved); return; }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
}

// Events
if(imageInput){
    imageInput.addEventListener('change', () => {
        const file = imageInput.files && imageInput.files[0];
        renderImagePreview(file);
    });
}

if(form){
    form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        if(!nameInput.value.trim() || !descInput.value.trim() || !locationInput.value.trim() || !contactInput.value.trim()){
            showToast('Please fill all required fields');
            return;
        }

        let imageData = '';
        const file = imageInput.files && imageInput.files[0];
        if(file){
            try{
                // Cap very large images by warning but still store (note: base64 grows ~33%)
                if(file.size > 500_000){ showToast('Large image; consider smaller for speed'); }
                imageData = await readFileAsDataURL(file);
            }catch(err){ console.warn('Image read failed', err); }
        }

        const newItem = {
            id: createId(),
            type: typeInput.value,
            name: nameInput.value.trim(),
            description: descInput.value.trim(),
            location: locationInput.value.trim(),
            contact: contactInput.value.trim(),
            date: dateInput.value || new Date().toISOString().slice(0,10),
            category: categoryInput.value.trim(),
            image: imageData,
            returned: false,
            createdAt: Date.now()
        };

        const items = loadItems();
        items.unshift(newItem); // newest first
        saveItems(items);
        renderLists();
        showToast('Item added');
        clearForm();
    });
}

if(document.getElementById('resetForm')){
    document.getElementById('resetForm').addEventListener('click', ()=> clearForm());
}

if(searchInput){ searchInput.addEventListener('input', renderLists); }
if(filterType){ filterType.addEventListener('change', renderLists); }

if(themeToggle){
    themeToggle.addEventListener('click', ()=>{
        const isDark = document.documentElement.classList.toggle('dark');
        const next = isDark ? 'dark' : 'light';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
    });
}

// Init
loadTheme();
renderLists();


