// sim.mjs — автосимуляция недели для проверки логики без ручного ввода.
// Запуск из консоли страницы: import('/tools/sim.mjs').then(m => m.run())
// Опции: {refuseAll:true} — никого не впускать; {noShop:true} — не ходить в магазин;
//        {bad:true} — стрелять всех (проверка концовки «палач»).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VERDICT = {
  velichanin: 'keep',
  krakovianin: 'shoot',
  radioactive: 'basement'
};

export async function run(opts = {}) {
  const g = window.__game;
  const log = [];
  const ff = (n = 200, dt = 0.06) => { for (let i = 0; i < n; i++) g.update(dt); };

  if (g.phase === 'title') {
    document.getElementById('start-btn').click();
    await sleep(1200);
  }
  ff(60);

  log.push(`start: day=${g.day} phase=${g.phase} hearts=${g.hearts} sup=${g.supplies} money=${g.money}`);

  let guard = 0;
  while (g.day <= 7 && guard++ < 10) {
    const dayStart = g.day;

    // --- утро: разобрать гостей ---
    let vg = 0;
    while (g.pending.length && vg++ < 6) {
      const entry = g.pending[0];
      g.current = entry;
      let kind = VERDICT[entry.guest.type];
      if (opts.bad) kind = 'shoot';
      if (opts.all) kind = opts.all;
      g.verdict(kind);
      g.current = null;
      ff(150);
      log.push(`verdict ${entry.guest.name} (${entry.guest.type}) -> ${kind}`);
    }

    // --- магазин ---
    if (!opts.noShop) {
      g.goStore();
      ff(40);
      g.cart = ['butter', 'butter', 'bread'];
      g.checkout();
      ff(20);
      g.goHome();
      ff(20);
      log.push(`shop: money=${g.money.toFixed(2)} sup=${g.supplies} meds=${g.meds}`);
    }

    // --- ночь ---
    g.startNight();
    ff(150);
    let ng = 0;
    while (g.doorGuest && ng++ < 6) {
      const guest = g.doorGuest;
      if (opts.refuseAll) {
        g.refuse();
        log.push(`night ${g.day}: refused ${guest.name} (${guest.type})`);
      } else {
        g.enterHouse();
        log.push(`night ${g.day}: let in ${guest.name} (${guest.type})`);
      }
      ff(220);
    }
    // ждём автоматического перехода к следующему дню
    for (let i = 0; i < 900 && g.day === dayStart && g.phase !== 'done'; i++) g.update(0.06);
    log.push(`morning: day=${g.day} hearts=${g.hearts} sup=${g.supplies} residents=${g.residents.length} patients=${g.patients.length} phase=${g.phase}`);
    if (g.phase === 'done') break;
  }

  // финальный день: вердикты и концовка
  let fg = 0;
  while (g.pending.length && fg++ < 6) {
    const entry = g.pending[0];
    g.current = entry;
    g.verdict(opts.bad ? 'shoot' : (opts.all || VERDICT[entry.guest.type]));
    g.current = null;
    ff(150);
  }
  ff(600);

  const state = {
    day: g.day,
    phase: g.phase,
    hearts: g.hearts,
    supplies: g.supplies,
    money: Math.round(g.money * 100) / 100,
    residents: g.residents.map((r) => `${r.guest.name}:${r.guest.type}`),
    patients: g.patients.map((p) => `${p.guest.name}:${p.daysLeft}`),
    flags: g.flags,
    ending: document.getElementById('go-title').textContent,
    endingShown: !document.getElementById('gameover').classList.contains('hidden')
  };
  return { log, state };
}
