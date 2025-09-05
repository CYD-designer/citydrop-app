// ==== Эмуляция Telegram WebApp ====
window.Telegram = {
  WebApp: {
    initDataUnsafe: { user: { id: 12345, first_name: "Тест", username: "test_user" } },
    ready() { console.log("TG WebApp ready"); },
    expand() { console.log("TG WebApp expand"); },
    sendData(d) { console.log("TG sendData:", d); alert("sendData: " + d); }
  }
};

// ==== Настройки ====
const DAILY_LIMIT = 3;
const PAID_LEGENDARY_CHANCE = 0.5; // 50% шанс легендарной карты в платном кейсе

// ==== DOM ====
const openBtn = document.getElementById('openBtn');
const cardEl = document.getElementById('card');
const cardImg = document.getElementById('cardImg');
const cardTitle = document.getElementById('cardTitle');
const cardRarity = document.getElementById('cardRarity');
const claimBtn = document.getElementById('claimBtn');
const openAgainBtn = document.getElementById('openAgainBtn');
const leftCountEl = document.getElementById('leftCount');
const welcomeEl = document.getElementById('welcome');

const btnInventory = document.getElementById('btnInventory');
const inventoryModal = document.getElementById('inventoryModal');
const inventoryList = document.getElementById('inventoryList');
const closeInventory = document.getElementById('closeInventory');
const albumFilters = document.querySelectorAll('.album-filter');

// Платное открытие (создадим кнопку на лету)
const paidBtn = document.createElement('button');
paidBtn.textContent = "Платное открытие";
paidBtn.className = "primary big";
document.querySelector('.case').appendChild(paidBtn);

let cards = [
  {id:'c1',title:'Карта 1',rarity:'обычный',image:'assets/images/card1.jpg'},
  {id:'c2',title:'Карта 2',rarity:'редкий',image:'assets/images/card2.jpg'},
  {id:'c3',title:'Карта 3',rarity:'легендарный',image:'assets/images/card3.jpg'},
  {id:'c4',title:'Карта 4',rarity:'супер редкий',image:'assets/images/card4.jpg'},
];
let drop = null;

// ==== User data ====
function getUserKey(){ return 'user_test'; }
const USER_KEY = getUserKey();

function loadUserData() {
  const raw = localStorage.getItem(USER_KEY);
  if(!raw) return { inventory: [], opens: [] };
  try { return JSON.parse(raw); } catch { return { inventory: [], opens: [] }; }
}
function saveUserData(data){ localStorage.setItem(USER_KEY,JSON.stringify(data)); }

function availableFreeOpens() {
  const data = loadUserData();
  const now = Date.now();
  const opens = (data.opens || []).filter(t => now - t < 24*3600*1000);
  const left = Math.max(0, DAILY_LIMIT - opens.length);
  return { left, opens };
}
function registerOpen() {
  const data = loadUserData();
  data.opens = data.opens || [];
  data.opens.push(Date.now());
  saveUserData(data);
}
function addToInventory(card){
  const data = loadUserData();
  data.inventory = data.inventory || [];
  data.inventory.push(card);
  saveUserData(data);
}

// ==== Random drop ====
function getRandomCard(free=true){
  const r = Math.random();
  if(free){
    if(r<0.5) return cards[0]; // обычный
    if(r<0.75) return cards[1]; // редкий
    if(r<0.95) return cards[2]; // легендарный
    return cards[3]; // супер редкий
  } else {
    // Платное открытие: шанс легендарного повышен
    if(r < PAID_LEGENDARY_CHANCE) return cards[2]; // легендарный
    if(r < PAID_LEGENDARY_CHANCE+0.3) return cards[1]; // редкий
    if(r < PAID_LEGENDARY_CHANCE+0.45) return cards[0]; // обычный
    return cards[3]; // супер редкий
  }
}

// ==== UI ====
function showDrop(d){
  drop = d;
  cardImg.src = d.image;
  cardTitle.textContent = d.title;
  cardRarity.textContent = d.rarity;
  cardRarity.className = 'rarity '+d.rarity;
  cardEl.classList.remove('hidden');
  updateLeftCount();
}
function updateLeftCount(){
  leftCountEl.textContent = availableFreeOpens().left;
}

// ==== Events ====
// Бесплатное открытие
openBtn.addEventListener('click',()=>{
  const avail = availableFreeOpens();
  if(avail.left<=0){ alert('Бесплатные открытия закончились'); return; }
  const d = getRandomCard(true);
  registerOpen();
  addToInventory(d);
  showDrop(d);
});
// Бесплатное повторное
openAgainBtn.addEventListener('click',()=>{
  const avail = availableFreeOpens();
  if(avail.left<=0){ alert('Бесплатные открытия закончились'); return; }
  const d = getRandomCard(true);
  registerOpen();
  addToInventory(d);
  showDrop(d);
});
// Платное открытие
paidBtn.addEventListener('click',()=>{
  const d = getRandomCard(false);
  addToInventory(d);
  showDrop(d);
});

// Забрать карту
claimBtn.addEventListener('click',()=>{
  if(!drop) return;
  const payload = { action:'claim', cardId:drop.id, title:drop.title, rarity:drop.rarity, image:drop.image };
  Telegram.WebApp.sendData(JSON.stringify(payload));
});

// ==== Inventory ====
btnInventory.addEventListener('click',()=>{ inventoryModal.classList.remove('hidden'); renderInventory('all'); });
closeInventory.addEventListener('click',()=>{ inventoryModal.classList.add('hidden'); });

albumFilters.forEach(btn=>{
  btn.addEventListener('click',()=>{
    renderInventory(btn.dataset.rarity);
  });
});

function renderInventory(filter='all'){
  const data = loadUserData();
  const inv = data.inventory || [];
  inventoryList.innerHTML = '';
  const filtered = inv.filter(c=>filter==='all'?true:c.rarity===filter);
  if(!filtered.length){ inventoryList.innerHTML='<div>Инвентарь пуст</div>'; return; }
  filtered.slice().reverse().forEach(c=>{
    const el = document.createElement('div');
    el.className='inventory-card';
    el.innerHTML = `<img src="${c.image}" alt="${c.title}"><div class="card-title">${c.title}</div><div class="card-rarity">${c.rarity}</div>`;
    inventoryList.appendChild(el);
  });
}

// ==== Welcome ====
function setWelcome(){
  const user = Telegram.WebApp.initDataUnsafe.user;
  welcomeEl.textContent = `Привет, ${user.first_name} (@${user.username})`;
}
setWelcome();
updateLeftCount();
// ===== Tab bar navigation =====
document.querySelectorAll('.tabbar button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const pageId = btn.dataset.page;
    document.querySelectorAll('.container, .page').forEach(p=>p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
  });
});
