// debug.js — панель разработчика: переходы по этапам, ночи, читы шахты и план.
// Открывается по F2 в любой момент. Это не часть сюжета: панель живёт поверх HUD,
// снимает pointer lock и ничего не пишет в сохранения (их в игре нет).

const PLAN = [
  ['1. Утро', 'Дом: записка, гости, чай. Выйти на улицу.'],
  ['2. Улица', 'Бочка с огнём. День 2 — лицей справа. Дальше — «Бедронка».'],
  ['3. Бедронка', 'Взять 1–3 предмета, пока Людмила не смотрит, и выйти в дверь.'],
  ['4. Дом', 'Лечь спать [E] у кровати в спальне.'],
  ['5. Ночь', 'Глазок, впустить или отказать, вердикт: оставить / застрелить / в подвал.'],
  ['6. Шахта', 'С 3-й ночи: подвал → люк → 4 горизонта. Головоломки, погоня, белый свет.'],
  ['7. Финал', 'Восьмое утро: концовка зависит от вердиктов и выбора в шахте.']
];

const html = () => `
  <header id="debug-head">
    <span>DEBUG · F2</span>
    <button id="debug-close" type="button" aria-label="Закрыть">×</button>
  </header>
  <div id="debug-status">—</div>
  <section class="debug-group">
    <h3>ПЕРЕХОД</h3>
    <div class="debug-grid" data-group="jump">
      <button data-act="jump" data-id="home">Дом</button>
      <button data-act="jump" data-id="street">Улица</button>
      <button data-act="jump" data-id="store">Бедронка</button>
      <button data-act="jump" data-id="lyceum">Лицей</button>
      <button data-act="jump" data-id="basement">Подвал</button>
      <button data-act="jump" data-id="mine1">Шахта 1</button>
      <button data-act="jump" data-id="mine2">Шахта 2</button>
      <button data-act="jump" data-id="mine3">Шахта 3</button>
      <button data-act="jump" data-id="mine4">Шахта 4</button>
    </div>
  </section>
  <section class="debug-group">
    <h3>ВРЕМЯ</h3>
    <div class="debug-grid" data-group="day">
      <button data-act="day" data-n="1">Д1</button>
      <button data-act="day" data-n="2">Д2</button>
      <button data-act="day" data-n="3">Д3</button>
      <button data-act="day" data-n="4">Д4</button>
      <button data-act="day" data-n="5">Д5</button>
      <button data-act="day" data-n="6">Д6</button>
      <button data-act="day" data-n="7">Д7</button>
    </div>
    <div class="debug-grid" data-group="night">
      <button data-act="night" data-n="1">Н1</button>
      <button data-act="night" data-n="2">Н2</button>
      <button data-act="night" data-n="3">Н3</button>
      <button data-act="night" data-n="4">Н4</button>
      <button data-act="night" data-n="5">Н5</button>
      <button data-act="night" data-n="6">Н6</button>
      <button data-act="night" data-n="7">Н7</button>
    </div>
    <div class="debug-grid wide">
      <button data-act="skip-night">ПРОПУСТИТЬ НОЧЬ</button>
      <button data-act="next-day">СЛЕД. ДЕНЬ</button>
    </div>
  </section>
  <section class="debug-group">
    <h3>ЧИТЫ</h3>
    <div class="debug-grid wide">
      <button data-act="kit">Инвентарь шахты</button>
      <button data-act="unlock-mine">Открыть шахту</button>
      <button data-act="solve">Решить головоломки</button>
      <button data-act="supplies">+5 запасов · 3 ♥</button>
      <button data-act="calm">Сбросить внимание</button>
      <button data-act="caught">Сымитировать поимку</button>
      <button data-act="chase">Погоня на горизонте 3</button>
      <button data-act="end">Финальная концовка</button>
    </div>
  </section>
  <section class="debug-group">
    <h3>ПЛАН</h3>
    <ol id="debug-plan"></ol>
  </section>
  <footer id="debug-foot">F2 — закрыть · кнопки работают и во время игры</footer>
`;

export function createDebug(app, game) {
  if (!app || !game || document.getElementById('debug-panel')) return null;
  const panel = document.createElement('section');
  panel.id = 'debug-panel';
  panel.className = 'hidden';
  panel.setAttribute('aria-label', 'Панель разработчика');
  panel.innerHTML = html();
  document.body.appendChild(panel);

  const statusEl = panel.querySelector('#debug-status');
  const planEl = panel.querySelector('#debug-plan');
  for (const [title, text] of PLAN) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = title;
    li.appendChild(b);
    li.appendChild(document.createTextNode(' — ' + text));
    planEl.appendChild(li);
  }

  let open = false;
  function refresh() {
    const sc = app.scenes[app.mode];
    const loc = sc && sc.title && sc.title.toLowerCase() !== app.mode ? sc.title : '';
    statusEl.textContent = `день ${game.day} · ${game.phase} · ${app.mode}${loc ? ' · ' + loc : ''}` +
      ` · карманы ${game.cart.length}/3 · внимание ${Math.round(game.storeSuspicion || 0)}%`;
  }
  function show(v) {
    open = v;
    panel.classList.toggle('hidden', !open);
    document.body.classList.toggle('debug-open', open);
    if (open) {
      app.unlockPointer();
      refresh();
    }
  }

  function teleport(id) {
    game.clearTimers();
    game.ui.dialogue(null, null, []);
    game.ui.prompt(null);
    game.ui.fade(false);
    app.transitioning = false;
    if (id === 'store') {
      game.day = Math.max(1, game.day);
      game.phase = 'store';
      game.storeTripDone = false;
      game.cart = [];
      game.storePurchased.clear();
      game.storeSuspicion = 0;
      game.storeCaught = 0;
      game.storeWarned = 0;
      game.syncStoreItems();
      game.updateCart();
      app.goto('store', { x: 0, z: 4.55 }, 0);
      game.msg('DEBUG: «Бедронка». Подойди к полке, возьми 1–3 предмета и не попадись.', 5000);
      return;
    }
    if (id === 'street') {
      game.phase = 'street';
      app.goto('street', { x: 0, z: 1.45 }, 0);
      return;
    }
    if (id === 'lyceum') {
      game.day = Math.max(2, game.day);
      game.phase = 'street';
      app.goto('lyceum', { x: 0, z: 3.25 }, 0);
      return;
    }
    if (id === 'basement' || /^mine[1-4]$/.test(id)) {
      game.day = Math.max(3, game.day);
      game.mineUnlocked = true;
      game.phase = 'night';
      game.syncMineAccess();
      if (id === 'basement') {
        app.goto('basement', { x: 0, z: 1.6 }, 0);
        game.msg('DEBUG: подвал. Люк открыт — [E] у люка.', 4500);
      } else {
        const level = Number(id.slice(-1));
        game.enterMine(level, false);
        game.msg(`DEBUG: шахта ${level}. Воздух и головоломки — в панели F2.`, 5000);
      }
      return;
    }
    game.phase = 'day';
    app.goto('home', { x: -0.3, z: 1.6 }, 0);
  }

  function setDay(n) {
    game.clearTimers();
    game.ui.dialogue(null, null, []);
    game.ui.fade(false);
    app.transitioning = false;
    game.day = Math.min(7, Math.max(1, n));
    game.finalDay = false;
    game.startDay();
    app.goto('home', { x: -0.3, z: 1.6 }, 0);
  }

  function setNight(n) {
    game.clearTimers();
    game.ui.dialogue(null, null, []);
    game.ui.fade(false);
    app.transitioning = false;
    game.day = Math.min(7, Math.max(1, n));
    game.finalDay = false;
    game.startNight();
    app.goto('home', { x: -0.3, z: 1.6 }, 0);
  }

  function nextDay() {
    if (game.day >= 7) {
      game.day = 7;
      game.finalDay = true;
      game.startDay();
    } else {
      game.day += 1;
      game.startDay();
    }
    app.goto('home', { x: -0.3, z: 1.6 }, 0);
    game.msg(`DEBUG: день ${game.day}.`, 3500);
  }

  function act(name, el) {
    switch (name) {
      case 'jump': teleport(el.dataset.id); break;
      case 'day': setDay(Number(el.dataset.n)); break;
      case 'night': setNight(Number(el.dataset.n)); break;
      case 'skip-night':
        if (game.phase === 'night' || game.phase === 'nightfall') game.skipNight();
        else nextDay();
        break;
      case 'next-day': nextDay(); break;
      case 'kit':
        game.inventory.lamp = 1;
        game.inventory.key = 1;
        game.inventory.fuse = 1;
        game.inventory.filter = 1;
        game.inventory.crowbar = 1;
        game.inventory.echo = 1;
        game.syncMineAccess();
        game.syncMineItems();
        game.hud();
        game.msg('DEBUG: лампа, ключ, предохранитель, фильтр, лом и эхо — в рюкзаке.', 4000);
        break;
      case 'unlock-mine':
        game.mineUnlocked = true;
        game.phase = 'night';
        game.day = Math.max(3, game.day);
        game.syncMineAccess();
        game.msg('DEBUG: шахта открыта. Люк — в подвале.', 4000);
        break;
      case 'solve':
        game.mineLevers = [true, false, true];
        game.mineLeversTouched = new Set([0, 1, 2]);
        game.mineGasFixed = true;
        game.minePumpOrder = [0, 2, 1];
        game.minePumpsOn = true;
        game.minePressure = { valveA: 2, valveB: 3 };
        game.minePressureOk = true;
        game.mineEchoSeq = [2, 0, 3, 1];
        game.mineEchoSolved = true;
        game.syncMineAccess();
        game.msg('DEBUG: все головоломки горизонтов решены.', 4000);
        break;
      case 'supplies':
        game.supplies += 5;
        game.hearts = 3;
        game.hud();
        game.msg('DEBUG: +5 запасов, сердца восстановлены.', 3500);
        break;
      case 'calm':
        game.storeSuspicion = 0;
        game.storeCaught = 0;
        game.storeWarned = 0;
        game.msg('DEBUG: внимание Людмилы сброшено.', 3000);
        break;
      case 'caught':
        if (game.cart.length === 0) game.cart.push('butter');
        game.caughtStealing();
        break;
      case 'chase':
        game.day = Math.max(3, game.day);
        game.mineUnlocked = true;
        game.phase = 'night';
        game.minePressureOk = true;
        game.minePressure = { valveA: 2, valveB: 3 };
        game.mineLevel = 3;
        game.syncMineAccess();
        game.enterMine(3, false);
        game.after(1.0, () => game.startMineChase());
        break;
      case 'end':
        game.day = 8;
        game.finalDay = true;
        game.finalEnding();
        break;
      default: break;
    }
    refresh();
  }

  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) {
      if (e.target.id === 'debug-close') show(false);
      return;
    }
    if (btn.id === 'debug-close') { show(false); return; }
    try { act(btn.dataset.act, btn); } catch (err) { console.warn('[debug]', err); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'F2') {
      e.preventDefault();
      show(!open);
    } else if (e.code === 'Escape' && open) {
      show(false);
    }
  });

  if (location.hash === '#debug') setTimeout(() => show(true), 1200);

  const api = { show, refresh, act, get open() { return open; } };
  window.__debug = api;
  return api;
}