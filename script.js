// script.js — основной клиент
// ========== Настройки ==========
const CARDS_JSON = './assets/cards.json';
const DAILY_LIMIT = 3; // бесплатных открытий в 24 часа
const LEGENDARY_FREE_CHANCE = 1 / 10000; // шанс легендарки в бесплатном открытии (прибл.)
const KREML_CHANCE = 1 / 100000; // шанс Астраханского Кремля (прибл.)

// paid: повышенные шансы (пример)
const PAID_LEGENDARY_CHANCE = 1 / 200; // при платном кейсе (тестовое значение)

// ========== Инициализация UI ==========
const tg = window.Telegram?.WebApp;
const isTelegram = !!tg;
if (isTelegram) { tg.ready(); tg.expand(); }

const openBtn = document.getElementById('openBtn');
const cardEl = document.getElementById('card');
const cardImg = document.getElementById('cardImg');
const cardTitle = document.getElementById('cardTitle');
const cardRarity = document.getElementById('cardRarity');
const claimBtn = document.getElementById('claimBtn');
const openAgainBtn = document.getElementById('openAgainBtn');
const notice = document.getElementById('notice');
const leftCountEl = document.getElementById('leftCount');
const welcomeEl = document.getElementById('welcome');

const btnInventory = document.getElementById('btnInventory');
const inventoryModal = document.getElementById('inventoryModal');
const inventoryList = document.getElementById('inventoryList');
const closeInventory = document.getElementById('closeInventory');
const albumFilters = document.querySelectorAll('.album-filter');

const btnShop = document.getElementById('btnShop');
const shopModal = document.getElementById('shopModal');
const closeShop = document.getElementById('closeShop');

const btnShare = document.getElementById('btnShare');
const shareModal = document.getElementById('shareModal');
const closeShare = document.getElementById('closeShare');

let cards = [];
let drop = null;

// ========== User identity (localStorage keying) ==========
function getUserKey() {
  // если Telegram, используем id, иначе 'guest'
  const uid = tg?.initDataUnsafe?.user?.id;
  return uid ? `user_${uid}` : 'guest';
}
const USER_KEY = getUserKey();

// ========== Load cards ==========
async function loadCards() {
  try {
    const res = await fetch(CARDS_JSON);
    if (!res.ok) throw new Error('cards.json load failed');
    cards = await res.json();
  } catch (e) {
    console.error(e);
    notice.classList.remove('hidden');
    cards = [];
  }
}
loadCards();

// ========== Helper: pools by rarity ==========
function poolByRarity(r) {
  return cards.filter(c => c.rarity === r);
}
function allExceptLegendary() {
  return cards.filter(c => c.rarity !== 'легендарный' && c.rarity !== 'супер редкий');
}

// ========== Weighted random for general use ==========
function weightedRandom(items) {
  if (!items?.length) return null;
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item.weight || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ========== Free vs Paid drop logic ==========
function getFreeDrop() {
  // First check for Kremlin ultra-rare
  if (Math.random() < KREML_CHANCE) {
    const k = cards.find(c => c.id === 'astr_kreml');
    if (k) return k;
  }
  // Legendary chance (very small)
  if (Math.random() < LEGENDARY_FREE_CHANCE) {
    const pool = poolByRarity('легендарный');
    if (pool.length) return weightedRandom(pool);
  }
  // Otherwise choose from all except legendary
  const pool = allExceptLegendary();
  return weightedRandom(pool);
}

function getPaidDrop() {
  // Paid packs have much higher chance for legend (example)
  if (Math.random() < PAID_LEGENDARY_CHANCE) {
    const pool = poolByRarity('легендарный');
    return weightedRandom(pool);
  }
  // else weighted
  return weightedRandom(cards);
}

// ========== Inventory storage ==========
function loadUserData() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return { inventory: [], opens: [] }; // opens = timestamps of free opens
  try { return JSON.parse(raw); } catch { return { inventory: [], opens: [] }; }
}
function saveUserData(data) {
  localStorage.setItem(USER_KEY, JSON.stringify(data));
}

// ========== Daily limit logic ==========
function availableFreeOpens() {
  const data = loadUserData();
  const now = Date.now();
  const opens = (data.opens || []).filter(t => now - t < 24 * 3600 * 1000);
  const left = Math.max(0, DAILY_LIMIT - opens.length);
  return { left, opensCount: opens.length, opens };
}
function registerOpen() {
  const data = loadUserData();
  data.opens = data.opens || [];
  data.opens.push(Date.now());
  saveUserData(data);
}

// ========== Add card to inventory ==========
function addToInventory(card) {
  const data = loadUserData();
  data.inventory = data.inventory || [];
  data.inventory.push({ id: card.id, title: card.title, rarity: card.rarity, image: card.image, ts: Date.now() });
  saveUserData(data);
}

// ========== UI: show drop ==========
function showDrop(d) {
  if (!d) return;
  drop = d;
  cardImg.src = d.image;
  cardTitle.textContent = d.title;
  cardRarity.textContent = d.rarity || 'Неизвестно';
  cardRarity.className = `rarity ${d.rarity || ''}`;
  cardEl.classList.remove('hidden');
  cardEl.setAttribute('aria-hidden', 'false');
  updateLeftCount();
}

// ========== Open button handler ==========
openBtn.addEventListener('click', () => {
  const avail = availableFreeOpens();
  if (avail.left <= 0) {
    alert('Бесплатные открытия закончились. Купи пакет в магазине или подожди 24 часа.');
    return;
  }
  // get free drop
  const d = getFreeDrop();
  registerOpen();
  addToInventory(d);
  showDrop(d);
});

// Open again (just another free if left)
openAgainBtn.addEventListener('click', () => {
  const avail = availableFreeOpens();
  if (avail.left <= 0) {
    alert('Бесплатные открытия закончились.');
    return;
  }
  const d = getFreeDrop();
  registerOpen();
  addToInventory(d);
  showDrop(d);
});

// Claim sends data to bot (if in Telegram), otherwise copies payload
claimBtn.addEventListener('click', () => {
  if (!drop) return;
  const payload = {
    action: 'claim',
    cardId: drop.id,
    title: drop.title,
    rarity: drop.rarity,
    image: drop.image,
    user: tg?.initDataUnsafe?.user || null
  };
  if (isTelegram && typeof tg.sendData === 'function') {
    tg.sendData(JSON.stringify(payload));
  } else { 
    try {
      navigator.clipboard.writeText(JSON.stringify(payload));
      alert('Payload скопирован в буфер обмена (тест)');
    } catch {
      console.log(payload);
      alert('Payload выведен в консоль (F12)');
    }
  }
});

// ========== Inventory UI and filters ==========
btnInventory?.addEventListener('click', () => {
  openInventory();
});
closeInventory?.addEventListener('click', () => {
  inventoryModal.classList.add('hidden');
});
albumFilters.forEach(btn=>{
  btn.addEventListener('click', ()=> {
    const r = btn.dataset.rarity;
    renderInventory(r);
  });
});

function openInventory() {
  inventoryModal.classList.remove('hidden');
  renderInventory('all');
}

function renderInventory(filter='all') {
  const data = loadUserData();
  const inv = data.inventory || [];
  inventoryList.innerHTML = '';
  const filtered = inv.filter(item => filter==='all' ? true : item.rarity === filter);
  if (!filtered.length) {
    inventoryList.innerHTML = '<div>Инвентарь пуст</div>';
    return;
  }
  filtered.slice().reverse().forEach(it => {
    const el = document.createElement('div');
    el.className = 'inventory-card';
    el.innerHTML = `
      <img src="${it.image}" alt="${it.title}" />
      <div class="card-title">${it.title}</div>
      <div class="card-rarity">${it.rarity}</div>
      <div class="card-actions">
        <button class="share-card" data-id="${it.id}">Поделиться</button>
        <button class="offer-card" data-id="${it.id}">Создать оффер</button>
      </div>
    `;
    inventoryList.appendChild(el);
  });

  // attach events for share/offer
  document.querySelectorAll('.share-card').forEach(b=>{
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      shareCardById(id);
    });
  });
  document.querySelectorAll('.offer-card').forEach(b=>{
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      createOffer(id);
    });
  });
}

// ========== Share card (simple) ==========
function shareCardById(cardId) {
  const card = cards.find(c => c.id === cardId);
  if (!card) { alert('Карта не найдена'); return; }
  const text = `Я получил карту "${card.title}"! Посмотри: `;
  const url = window.location.href;
  // use Web Share API if available
  if (navigator.share) {
    navigator.share({ title: 'Городские кейсы', text: text, url }).catch(()=>{});
  } else {
    // fallback — open Telegram share
    const tgShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    window.open(tgShare, '_blank');
  }
}

// ========== Exchange: create offer code (local) ==========
function createOffer(cardId) {
  const data = loadUserData();
  const idx = data.inventory?.findIndex(i => i.id === cardId);
  if (idx == null || idx === -1) { alert('Карта не найдена в инвентаре'); return; }
  const offer = {
    id: `offer_${Date.now()}_${Math.floor(Math.random()*9999)}`,
    cardId,
    from: tg?.initDataUnsafe?.user ? `${tg.initDataUnsafe.user.first_name || ''} ${tg.initDataUnsafe.user.username ? '@'+tg.initDataUnsafe.user.username : ''}` : 'guest',
    ts: Date.now()
  };
  // remove card from inventory (reserved)
  data.inventory.splice(idx,1);
  saveUserData(data);
  // save offer globally in localStorage (offers pool)
  const offers = JSON.parse(localStorage.getItem('offers_pool') || '[]');
  offers.push(offer);
  localStorage.setItem('offers_pool', JSON.stringify(offers));
  alert(`Оффер создан. Код: ${offer.id}\nОтправь код получателю. Оффер сохраняется на твоем устройстве.`);
  renderInventory('all');
}

// To accept an offer (recipient):
function acceptOffer(offerId) {
  const offers = JSON.parse(localStorage.getItem('offers_pool') || '[]');
  const off = offers.find(o=>o.id === offerId);
  if (!off) { alert('Оффер не найден'); return; }
  // transfer card to you
  const card = cards.find(c => c.id === off.cardId);
  if (!card) { alert('Карта шаблон не найдена'); return; }
  addToInventory(card);
  // remove offer
  const newOffers = offers.filter(o=>o.id !== offerId);
  localStorage.setItem('offers_pool', JSON.stringify(newOffers));
  alert(`Оффер принят. Карта ${card.title} добавлена в ваш инвентарь.`);
}

// ========== Shop (simulated purchase) ==========
btnShop?.addEventListener('click', ()=> shopModal.classList.remove('hidden'));
closeShop?.addEventListener('click', ()=> shopModal.classList.add('hidden'));

document.querySelectorAll('.shop-items .buy').forEach(b=>{
  b.addEventListener('click', ()=> {
    const count = parseInt(b.dataset.count,10);
    if (!confirm(`Симулировать покупку ${count} кейсов? (тестовое действие)`)) return;
    // simulate immediate results: paid drops
    for (let i=0;i<count;i++){
      const d = getPaidDrop();
      addToInventory(d);
    }
    alert(`${count} кейсов добавлено в ваш инвентарь (симуляция). Откройте инвентарь, чтобы увидеть.`);
    shopModal.classList.add('hidden');
  });
});

// ========== Sharing modal ==========
btnShare?.addEventListener('click', ()=> shareModal.classList.remove('hidden'));
closeShare?.addEventListener('click', ()=> shareModal.classList.add('hidden'));

document.getElementById('shareTelegram')?.addEventListener('click', ()=>{
  const url = window.location.href;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Открой кейсы города!')}`,'_blank');
});
document.getElementById('shareWhatsApp')?.addEventListener('click', ()=>{
  const url = window.location.href;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Открой кейсы города! ' + url)}`,'_blank');
});
document.getElementById('shareVK')?.addEventListener('click', ()=> {
  const url = window.location.href;
  window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}`,'_blank');
});
document.getElementById('shareInstagram')?.addEventListener('click', ()=> {
  alert('Instagram sharing из браузера — ограничено. Копируй ссылку и делись в историях вручную.');
});

// ========== Helpers ==========
function updateLeftCount(){
  const left = availableFreeOpens().left;
  leftCountEl.textContent = left;
}

// welcome text
function setWelcome(){
  const user = tg?.initDataUnsafe?.user;
  if (user) {
    const name = user.first_name || 'Игрок';
    const uname = user.username ? `(@${user.username})` : '';
    welcomeEl.textContent = `Привет, ${name} ${uname}`;
  } else {
    welcomeEl.textContent = 'Привет!';
  }
}

// on load
setTimeout(()=>{ updateLeftCount(); setWelcome(); }, 600);

// expose acceptOffer for manual testing (e.g., in console)
window.acceptOffer = acceptOffer;

