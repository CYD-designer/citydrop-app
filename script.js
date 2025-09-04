// Telegram WebApp (если открыт внутри Telegram)
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

let cards = [];
let drop = null;

async function loadCards() {
  try {
    const res = await fetch('./assets/cards.json');
    if (!res.ok) throw new Error('Не удалось загрузить cards.json');
    cards = await res.json();
  } catch (e) {
    console.error(e);
    notice.classList.remove('hidden');
    cards = [];
  }
}
loadCards();

function weightedRandom(items) {
  if (!items?.length) return null;
  const total = items.reduce((s,i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item.weight || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function showDrop(d) {
  if (!d) return;
  cardImg.src = d.image;
  cardTitle.textContent = d.title;
  cardRarity.textContent = (d.rarity || 'UNKNOWN').toUpperCase();
  cardRarity.className = `rarity ${d.rarity || ''}`;
  cardEl.classList.remove('hidden');
  cardEl.setAttribute('aria-hidden', 'false');
}

openBtn.addEventListener('click', () => {
  drop = weightedRandom(cards);
  if (!drop) { alert('Карты не загружены. Открой страницу через HTTP(S) или залей на GitHub Pages.'); return; }
  showDrop(drop);
});

openAgainBtn.addEventListener('click', () => {
  drop = weightedRandom(cards);
  showDrop(drop);
});

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
    // отправляет данные боту как web_app_data
    tg.sendData(JSON.stringify(payload));
  } else {
    // fallback — локальное тестирование: копируем payload в буфер и показываем в консоли
    try {
      navigator.clipboard.writeText(JSON.stringify(payload));
      alert('Тест: payload скопирован в буфер обмена. Открой бота в Telegram для реальной отправки.');
    } catch (e) {
      console.log('payload', payload);
      alert('Тест: payload выведен в консоль (F12). Открой в Telegram для реальной отправки.');
    }
  }
});
