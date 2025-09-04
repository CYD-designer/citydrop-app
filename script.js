// script.js — основной клиент
// ========== Настройки ==========
const CARDS_JSON = './assets/cards.json';
const DAILY_LIMIT = 3; // бесплатных открытий в 24 часа
const LEGENDARY_FREE_CHANCE = 1 / 10000; // шанс легендарки в бесплатном открытии
const KREML_CHANCE = 1 / 100000; // шанс Астраханского Кремля

// платные шансы (пример)
const PAID_LEGENDARY_CHANCE = 1 / 200;

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

// ========== User identity ==========
function getUserKey() {
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

// ========== Pools by rarity ==========
function poolByRarity(r) {
  return cards.filter(c => c.rarity === r);
}
function allExceptLegendary() {
  return cards.filter(c => c.rarity !== 'легендарный' && c.rarity !== 'супер редкий');
}

// ========== Weighted random ==========
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

// ========== Drop logic ==========
function getFreeDrop() {
  if (Math.random() < KREML_CHANCE) {
    const k = cards.find(c => c.id === 'astr_kreml');
    if (k) return k;
  }
  if (Math.random() < LEGENDARY_FREE_CHANCE) {
    const pool = poolByRarity('легендарный');
    if (pool.length) return weightedRandom(pool);
  }
  return weightedRandom(allExceptLegendary());
}

function getPaidDrop() {
  if (Math.random() < PAID_LEGENDARY_CHANCE) {
    const pool = poolByRarity('легендарный');
    return weightedRandom(pool);
  }
  return weightedRandom(cards);
}

// ========== Inventory storage ==========
function loadUserData() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return { inventory: [], opens: [] };
  try { return JSON.parse(raw); } catch { return { inventory: [], opens: [] }; }
}
function saveUserData(data) {
  localStorage.setItem(USER_KEY, JSON.stringify(data));
}

// ========== Daily limit ==========
function availableFreeOpens() {
  const data = loadUserData();
  const now = Date.now();
  const opens = (data.opens || []).filter(t => now - t < 24 * 3600 * 1000);
  return { left: Math.max(0, DAILY_LIMIT - opens.length), opensCount: opens.length, opens };
}
function registerOpen() {
  const data = loadUserData();
  data.opens = data.opens || [];
  data.opens.push(Date.now());
  saveUserData(data);
}

// ========== Add to inventory ==========
function addToInventory(card) {
  const data = loadUserData();
  data.inventory = data.inventory || [];
  data.inventory.push({ id: card.id, title: card.title, rarity: card.rarity, image: card.image, ts: Date.now() });
  saveUserData(data);
}

// ========== Show drop ==========
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

// ========== Open buttons ==========
openBtn.addEventListener('click', () => {
  const avail = availableFreeOpens();
  if (avail.left <= 0) { alert('Бесплатные открытия закончились.'); return; }
  const d = getFreeDrop();
  registerOpen();
  addToInventory(d);
  showDrop(d);
});
openAgainBtn.addEventListener('click', () => {
  const avail = availableFreeOpens();
  if (avail.left <= 0) { alert('Бесплатные открытия закончились.'); return; }
  const d = getFreeDrop();
  registerOpen();
  addToInventory(d);
  showDrop(d);
});

// ========== Claim ==========
claimBtn.addEventListener('click', () => {
  if (!drop) return;
  const payload = { action:'claim', cardId:drop.id, title:drop.title, rarity:drop.rarity, image:drop.image, user: tg?.initDataUnsafe?.user||null };
  if (isTelegram && typeof tg.sendData === 'function') tg.sendData(JSON.stringify(payload));
  else { try { navigator.clipboard.writeText(JSON.stringify(payload)); alert('Payload скопирован'); } catch { console.log(payload); alert('Payload в консоли'); } }
});

// ========== Inventory & filters ==========
btnInventory?.addEventListener('click', openInventory);
closeInventory?.addEventListener('click', ()=>inventoryModal.classList.add('hidden'));
albumFilters.forEach(btn=>{
  btn.addEventListener('click', ()=> renderInventory(btn.dataset.rarity));
});

function openInventory() { inventoryModal.classList.remove('hidden'); renderInventory('all'); }

function renderInventory(filter='all') {
  const data = loadUserData();
  const inv = data.inventory || [];
  inventoryList.innerHTML = '';
  const filtered = inv.filter(item => filter==='all' ? true : item.rarity === filter);
  if (!filtered.length) { inventoryList.innerHTML = '<div>Инвентарь пуст</div>'; return; }
  filtered.slice().reverse().forEach(it => {
    const el = document.createElement('div');
    el.className = `inventory-card ${it.rarity}`;
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
  document.querySelectorAll('.share-card').forEach(b=>b.addEventListener('click', ()=>shareCardById(b.dataset.id)));
  document.querySelectorAll('.offer-card').forEach(b=>b.addEventListener('click', ()=>createOffer(b.dataset.id)));
}

// ========== Helpers ==========
function updateLeftCount(){ leftCountEl.textContent = availableFreeOpens().left; }
function setWelcome(){ 
  const user = tg?.initDataUnsafe?.user;
  welcomeEl.textContent = user ? `Привет, ${user.first_name||'Игрок'} ${user.username?`(@${user.username})`:''}` : 'Привет!';
}
setTimeout(()=>{ updateLeftCount(); setWelcome(); }, 600);
window.acceptOffer = acceptOffer;

