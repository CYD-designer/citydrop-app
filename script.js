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

const btnInventory = document.getElementById('tabInventory');
const inventoryModal = document.getElementById('inventoryModal');
const inventoryList = document.getElementById('inventoryList');
const albumFilters = document.querySelectorAll('.album-filter');

// Платное открытие (кнопка на лету)
const paidBtn = document.createElement('button');
paidBtn.textContent = "Платное открытие";
paidBtn.className = "primary big";
document.querySelector('.case').appendChild(paidBtn);

// ==== Карты ====
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
    if(r<0.5) return cards[0];
    if(r<0.75) return cards[1];
    if(r<0.95) return cards[2];
    return cards[3];
  } else {
    if(r < PAID_LEGENDARY_CHANCE) return cards[2];
    if(r < PAID_LEGENDARY_CHANCE+0.3) return cards[1];
    if(r < PAID_LEGENDARY_CHANCE+0.45) return cards[0];
    return cards[3];
  }
}

// ==== UI: показываем карту с glow и анимацией ====
function showDrop(d) {
  if (!d) return;
  drop = d;
  cardImg.src = d.image;
  cardTitle.textContent = d.title;
  cardRarity.textContent = d.rarity || 'Неизвестно';

  // Сбрасываем старые классы и добавляем редкость + анимацию
  cardRarity.className = `rarity ${d.rarity || ''}`;
  cardEl.className = `card ${d.rarity || ''} revealed`;

  cardEl.classList.remove('hidden');
  cardEl.setAttribute('aria-hidden', 'false');
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
openAgainBtn.addEventListener('click',()=>{
  const avail = availableFreeOpens();
  if(avail.left<=0){ alert('Бесплатные открытия закончились'); return; }
  const d = getRandomCard(true);
  registerOpen();
  addToInventory(d);
  showDrop(d);
});
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
albumFilters.forEach(btn=>{
  btn.addEventListener('click',()=>{ renderInventory(btn.dataset.rarity); });
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

// === Tab bar навигация ===
const tabHome = document.getElementById('tabHome');
const tabInventory = document.getElementById('tabInventory');
const tabShopBtn = document.getElementById('tabShop');
const tabShareBtn = document.getElementById('tabShare');

tabHome.addEventListener('click', ()=>{
  tabSetActive(tabHome);
  document.querySelector('.case').scrollIntoView({behavior:'smooth'});
});
tabInventory.addEventListener('click', ()=>{
  tabSetActive(tabInventory);
  openInventory();
});
tabShopBtn.addEventListener('click', ()=>{
  tabSetActive(tabShopBtn);
  shopModal.classList.remove('hidden');
});
tabShareBtn.addEventListener('click', ()=>{
  tabSetActive(tabShareBtn);
  shareModal.classList.remove('hidden');
});

function tabSetActive(btn) {
  document.querySelectorAll('.tabbar button').forEach(b=> b.classList.remove('active'));
  btn.classList.add('active');
}


// === Фон с частицами ===
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let stars = [];

function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initStars(){
  stars = [];
  for(let i=0;i<100;i++){
    stars.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      r: Math.random()*1.5+0.5,
      dx: (Math.random()-0.5)*0.5,
      dy: (Math.random()-0.5)*0.5
    });
  }
}
initStars();

function drawStars(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#ffffff";
  stars.forEach(s=>{
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.r,0,2*Math.PI);
    ctx.fill();
    s.x+=s.dx; s.y+=s.dy;
    if(s.x<0||s.x>canvas.width) s.dx*=-1;
    if(s.y<0||s.y>canvas.height) s.dy*=-1;
  });
  requestAnimationFrame(drawStars);
}
drawStars();
