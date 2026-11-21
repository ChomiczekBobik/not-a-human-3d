# -*- coding: utf-8 -*-
"""Патч game.js: кража из «Бедронки» вместо бесплатной выдачи.
- состояние подозрения, видимость через сектор Людмилы;
- взятие предмета на виду = мгновенный рост внимания;
- поимка: предметы возвращаются, игрок у входа, можно попробовать снова;
- выход из магазина только с 1–3 предметами;
- у людей (Людмила, Зося) больше нет контурной подсветки;
- обновлены тексты дел, комендантского часа, кровати и сна.
"""
import io, sys

PATH = r'C:\Users\user\not-a-human-3d\src\game.js'
s = io.open(PATH, encoding='utf-8').read()
orig = s

def sub(old, new, label):
    global s
    if old not in s:
        print('MISS:', label)
        print(repr(old[:160]))
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('ok:', label)

# ---------- состояние ----------
sub(
    "    this.storeCurfewWarned = false;\n    this._surfaceLockNoticeAt = -Infinity;",
    "    this.storeCurfewWarned = false;\n    this.storeSuspicion = 0;      // 0..100, растёт, когда Людмила видит краденое\n    this.storeCaught = 0;         // сколько раз попался за день\n    this.storeSeen = false;\n    this.storeWarned = 0;\n    this._surfaceLockNoticeAt = -Infinity;",
    'reset stealth state'
)

sub(
    "    this.storeCurfewWarned = false;\n    this.collapseUsed = false;\n    this.warmth = 100;",
    "    this.storeCurfewWarned = false;\n    this.storeSuspicion = 0;\n    this.storeCaught = 0;\n    this.storeSeen = false;\n    this.storeWarned = 0;\n    this.collapseUsed = false;\n    this.warmth = 100;",
    'startDay stealth reset'
)

# ---------- тексты замков ----------
old_lock = """  surfaceLockText(id) {
    if (id === 'store-exit' && this.cart.length > 0) {
      return `Корзина не оформлена: ${this.cart.length} из ${STORE_DAILY_LIMIT} предметов. Рассчитайся у Людмилы бесплатно или верни товары [Q] / кнопкой «ВЕРНУТЬ».`;
    }
    if (id === 'street-home' && !this.finalDay) {
      if (this.cart.length > 0) return 'С неоформленной корзиной домой нельзя. Вернись к Людмиле и рассчитайся — бесплатно.';
      if (!this.storeTripDone) return 'Домой — только после покупки. В «Бедронке» выбери от 1 до 3 предметов и рассчитайся у Людмилы. Деньги не нужны.';
    }
    return '';
  }"""
new_lock = """  surfaceLockText(id) {
    if (id === 'store-exit' && this.cart.length === 0 && !this.storeTripDone) {
      return 'С пустыми руками не уйти: дома ждут. Возьми 1–3 предмета, пока Людмила не смотрит.';
    }
    if (id === 'street-home' && !this.finalDay) {
      if (!this.storeTripDone) return 'Домой — только после «Бедронки». Возьми 1–3 предмета и уйди незамеченным.';
    }
    return '';
  }"""
sub(old_lock, new_lock, 'surfaceLockText')

sub(
    "    if (id === 'store-exit') return this.cart.length === 0;",
    "    if (id === 'store-exit') return this.cart.length > 0 || this.storeTripDone;",
    'store-exit gate'
)

# ---------- leaveStore ----------
old_leave = """  leaveStore(options = {}) {
    if (!this.surfaceReady()) return false;
    if (this.cart.length > 0) {
      this.notifySurfaceLock('store-exit');
      return false;
    }
    this.ui.dialogue(null, null, []);
    this.sfx.doorClose(0.7);
    this.phase = 'street';
    return this.goStreet(true, options);
  }"""
new_leave = """  leaveStore(options = {}) {
    if (!this.surfaceReady()) return false;
    if (this.cart.length === 0 && !this.storeTripDone) {
      this.notifySurfaceLock('store-exit');
      return false;
    }
    let loot = [];
    if (this.cart.length > 0) {
      loot = this.stashLoot(true);
      this.msg(`Дверь. Никто не крикнул вслед. Добыча: ${loot.join(', ')}.`, 5200);
    }
    this.storeSuspicion = 0;
    this.storeWarned = 0;
    this.ui.setStealth(false, 0, false);
    this.ui.dialogue(null, null, []);
    this.sfx.doorClose(0.7);
    this.phase = 'street';
    return this.goStreet(true, options);
  }"""
sub(old_leave, new_leave, 'leaveStore')

# ---------- подсказки в goStore / goHome ----------
sub(
    "    this.msg('«Бедронка». Светло, тепло, пахнет хлебом и сигаретами Людмилы.', 5000);",
    "    this.msg('«Бедронка». Людмила за кассой, смотрит в зал — но не всегда. Возьми 1–3 предмета, пока она отвернулась. C — присесть, чтобы быть тише.', 7000);",
    'goStore hint'
)

sub(
    "      this.msg('Дом. Тепло. Спать — в спальне, кровать у стены.', 5000);",
    "      this.msg('Дом. Тепло. Дверь в подвал — слева от кухни, под жёлтой лампой и табличкой «ПОДВАЛ». Спать — в спальне, кровать у стены.', 6500);",
    'goHome hint'
)

# ---------- задача сна ----------
old_sleep = """    if (!this.storeTripDone || this.cart.length > 0) {
      const text = this.cart.length > 0
        ? 'Сначала оформи корзину у Людмилы или верни товары на полки. Сон — только после расчёта.'
        : 'Сначала сходи в «Бедронку»: выбери от 1 до 3 предметов и рассчитайся у Людмилы. Это бесплатно, но обязательно.';
      this.msg(text, 6000);
      this.ui.prompt(this.cart.length > 0
        ? 'Вернись в «Бедронку»: рассчитайся у Людмилы или верни товары.'
        : 'Дорога в «Бедронку». Выбери 1–3 предмета и рассчитайся у Людмилы — бесплатно.');
      return false;
    }"""
new_sleep = """    if (!this.storeTripDone || this.cart.length > 0) {
      this.msg(this.cart.length > 0
        ? 'Сначала выйди из «Бедронки» с добычей: домой с полными карманами не пройти.'
        : 'Сначала сходи в «Бедронку»: возьми 1–3 предмета, пока Людмила не смотрит, и уйди.', 6000);
      this.ui.prompt(this.cart.length > 0
        ? 'Вернись в «Бедронку» и выйди через дверь — с добычей, но незамеченным.'
        : 'Дорога в «Бедронку». Возьми 1–3 предмета и уйди незамеченным.');
      return false;
    }"""
sub(old_sleep, new_sleep, 'requestSleep text')

# ---------- магазин: корзина ----------
old_cart = """  updateCart() {
    this.ui.setCart(
      this.storePurchased.size + this.cart.length,
      this.cart.length,
      this.app.mode === 'store' && this.phase !== 'done',
      STORE_DAILY_LIMIT
    );
  }"""
new_cart = """  updateCart() {
    this.ui.setCart(
      this.cart.length,
      0,
      this.app.mode === 'store' && this.phase !== 'done',
      STORE_DAILY_LIMIT
    );
  }

  // Видит ли Людмила Хомку прямо сейчас (сектор + укрытия в store.js).
  storeSightNow() {
    if (this.app.mode !== 'store') return false;
    const so = this.app.scenes && this.app.scenes.store;
    const st = so && so.stealth;
    if (!st) return false;
    const cam = this.app.camera.position;
    return st.sees(cam.x, cam.z);
  }

  // Выложить добычу в дом: предметы превращаются в запасы, лекарства, носки.
  stashLoot(silent = false) {
    const got = [];
    let flavor = '';
    for (const k of this.cart) {
      const it = ITEMS[k];
      if (!it) continue;
      this.supplies += it.supplies || 0;
      if (it.meds) this.meds += it.meds;
      if (it.heals) this.tea += it.heals;
      if (it.gear === 'socks') { this.hasSocks = true; flavor += ' Носки шерстяные — дорога станет теплей.'; }
      if (it.gear === 'geiger') { this.hasGeiger = true; flavor += ' Дозиметр — это глаза, у которых нет мнения.'; }
      if (k === 'matches') flavor += ' Спички оставь себе, Хомка. Своим — они дороже.';
      got.push(it.name.toLowerCase());
      this.storePurchased.add(k);
    }
    this.cart = [];
    this.storeTripDone = true;
    this.storeSuspicion = 0;
    this.storeWarned = 0;
    this.syncStoreItems();
    this.hud();
    if (!silent) this.msg(`В карманах: ${got.join(', ')}.${flavor}`, 5200);
    return got;
  }

  // Попалась: Людмила отбирает всё и выставляет к двери. День продолжается.
  caughtStealing() {
    const got = this.cart.map((k) => ITEMS[k] && ITEMS[k].name.toLowerCase()).filter(Boolean);
    this.cart = [];
    this.storeCaught += 1;
    this.storeSuspicion = 0;
    this.storeWarned = 0;
    this.storeSeen = false;
    this.syncStoreItems();
    this.updateCart();
    this.hud();
    this.sfx.alert(1);
    this.phase = 'caught';
    const cam = this.app.camera;
    cam.position.set(0, 1.62, 4.45);
    cam.rotation.set(0, Math.PI, 0);
    this.ui.bigtext('ПОЙМАНА', 2100);
    this.ui.say('Людмила', `Так. ${got.length ? `«${got.join(', ')}» — обратно на полку. ` : ''}Я бы тебе и так всё отдала, Хомка. Зачем ты как вор? Иди, я не видела. И больше не при ней.`, [
      { label: '(виновато отойти)', cb: () => { this.ui.dialogue(null, null, []); this.phase = 'store'; } }
    ]);
  }

  storeSuspicionStep(dt) {
    if (this.app.mode !== 'store' || this.phase !== 'store') return;
    const so = this.app.scenes.store;
    const st = so && so.stealth;
    if (!st) return;
    const cam = this.app.camera.position;
    const seen = st.sees(cam.x, cam.z);
    this.storeSeen = seen;
    const carrying = this.cart.length > 0;
    if (seen && carrying) {
      const dist = Math.hypot(cam.x - st.eye.x, cam.z - st.eye.z);
      const near = dist < 3.2 ? 1.35 : 1;
      const crouch = this.app.crouched ? 0.5 : 1;
      const rate = 21 * crouch * (1 + this.storeCaught * 0.3) * near;
      this.storeSuspicion = Math.min(100, this.storeSuspicion + rate * dt);
    } else if (seen) {
      this.storeSuspicion = Math.max(0, this.storeSuspicion - 8 * dt);
    } else {
      this.storeSuspicion = Math.max(0, this.storeSuspicion - 15 * dt);
    }
    st.setAlert(this.storeSuspicion / 100);
    this.ui.setStealth(seen, this.storeSuspicion, carrying);
    if (this.storeSuspicion >= 100) { this.caughtStealing(); return; }
    if (this.storeSuspicion > 78 && this.storeWarned < 2) {
      this.storeWarned = 2;
      this.sfx.alert(0.8);
      this.msg('Людмила: «Хомка, ты что это делаешь?»', 2600);
    } else if (this.storeSuspicion > 52 && this.storeWarned < 1) {
      this.storeWarned = 1;
      this.sfx.alert(0.45);
      this.msg('Людмила хмурится: «Хомка?..»', 2600);
    }
  }"""
sub(old_cart, new_cart, 'updateCart + stealth core')

# ---------- pickup ----------
old_pick = """  pickup(itemKey) {
    const item = ITEMS[itemKey];
    if (!item || this.cart.includes(itemKey) || this.storePurchased.has(itemKey)) return false;
    if (item.gear === 'socks' && this.hasSocks) { this.msg('Носки уже на ногах. Вторая пара — роскошь.', 3000); return false; }
    if (item.gear === 'geiger' && this.hasGeiger) { this.msg('Дозиметр уже в кармане. Он уже щёлкает.', 3000); return false; }
    const dailyCount = this.storePurchased.size + this.cart.length;
    if (dailyCount >= STORE_DAILY_LIMIT) {
      this.msg(`Дневной лимит — ${STORE_DAILY_LIMIT} предмета. Завтра выдачу обновят.`, 3500);
      return false;
    }
    this.cart.push(itemKey);
    this.syncStoreItems();
    this.updateCart();
    this.sfx.beep();
    this.msg(`${item.name} — в корзину. Сегодня: ${dailyCount + 1}/${STORE_DAILY_LIMIT} · [Q] вернуть · расчёт у Людмилы бесплатный`, 3500);
    return true;
  }"""
new_pick = """  pickup(itemKey) {
    const item = ITEMS[itemKey];
    if (!item || this.cart.includes(itemKey) || this.storePurchased.has(itemKey)) return false;
    if (this.storeTripDone) { this.msg('На сегодня хватит: карманы уже набиты, иди домой.', 3000); return false; }
    if (item.gear === 'socks' && this.hasSocks) { this.msg('Носки уже на ногах. Вторая пара — роскошь.', 3000); return false; }
    if (item.gear === 'geiger' && this.hasGeiger) { this.msg('Дозиметр уже в кармане. Он уже щёлкает.', 3000); return false; }
    if (this.cart.length >= STORE_DAILY_LIMIT) {
      this.msg(`Больше ${STORE_DAILY_LIMIT} за раз не унести. Выходи с добычей.`, 3200);
      return false;
    }
    const seen = this.storeSightNow();
    this.cart.push(itemKey);
    this.syncStoreItems();
    this.updateCart();
    if (seen) {
      this.storeSuspicion = Math.min(100, this.storeSuspicion + 44);
      this.sfx.alert(0.7);
      this.msg(`${item.name} — в кармане. Но она смотрит прямо на тебя!`, 2600);
      if (this.storeSuspicion >= 100) { this.caughtStealing(); return false; }
    } else {
      this.sfx.beep();
      this.msg(`${item.name} — за пазуху. ${this.cart.length}/${STORE_DAILY_LIMIT} · [Q] вернуть · уходи, пока не заметила`, 3200);
    }
    return true;
  }"""
sub(old_pick, new_pick, 'pickup')

sub(
    "    this.msg(`${ITEMS[key].name} — обратно на полку. Сегодня выбрано: ${this.storePurchased.size + this.cart.length}/${STORE_DAILY_LIMIT}`, 3000);",
    "    this.msg(`${ITEMS[key].name} — обратно на полку. В карманах: ${this.cart.length}/${STORE_DAILY_LIMIT}`, 3000);",
    'returnItem text'
)

# ---------- диалог Людмилы: убрать «рассчитаться» ----------
sub(
    """      if (this.cart.length > 0) {
        choices.push({ label: `РАССЧИТАТЬСЯ · БЕСПЛАТНО (${this.cart.length})`, cls: 'decide-open', cb: () => this.checkout() });
      }
""",
    "",
    'remove checkout choice'
)

# ---------- checkout -> удалить, оставить совместимую заглушку ----------
old_checkout = """  checkout() {
    if (this.cart.length === 0) return false;
    const l = LYUDMILA[this.day - 1];
    const got = [];
    let flavor = '';
    for (const k of this.cart) {
      const it = ITEMS[k];
      this.supplies += it.supplies || 0;
      if (it.meds) this.meds += it.meds;
      if (it.heals) this.tea += it.heals;
      if (it.gear === 'socks') { this.hasSocks = true; flavor += ' Носки шерстяные — дорога станет теплей.'; }
      if (it.gear === 'geiger') { this.hasGeiger = true; flavor += ' Дозиметр — это глаза, у которых нет мнения.'; }
      if (k === 'matches') flavor += ' Спички оставь себе, Хомка. Своим — они дороже.';
      got.push(it.name.toLowerCase());
      this.storePurchased.add(k);
    }
    this.cart = [];
    this.storeTripDone = true;
    this.syncStoreItems();
    this.sfx.kassa();
    this.hud();
    this.ui.say('Людмила', `Оформила: ${got.join(', ')}. Денег не надо — отметила в журнале выдачи. ${l.receipt}${flavor}`, this.shopBack());
    return true;
  }"""
new_checkout = """  // Старое имя оставлено для внешних проверок: теперь это просто «выложить добычу».
  checkout() {
    if (this.cart.length === 0) return false;
    this.stashLoot(false);
    return true;
  }"""
sub(old_checkout, new_checkout, 'checkout -> stashLoot')

# ---------- shopBack ----------
old_back = """  shopBack() {
    return [{ label: '(уйти)', cb: () => {
      this.ui.dialogue(null, null, []);
      this.phase = 'store';
      this.ui.prompt(this.storeTripDone && this.cart.length === 0
        ? `Покупка оформлена бесплатно. Сегодня: ${this.storePurchased.size}/${STORE_DAILY_LIMIT}. Можно возвращаться домой.`
        : this.cart.length > 0
          ? 'Рассчитайся у Людмилы — бесплатно, или верни лишнее [Q] / «ВЕРНУТЬ».'
          : `Выбери от 1 до ${STORE_DAILY_LIMIT} предметов и рассчитайся у Людмилы.`);
    } }];
  }"""
new_back = """  shopBack() {
    return [{ label: '(уйти)', cb: () => {
      this.ui.dialogue(null, null, []);
      this.phase = 'store';
      this.ui.prompt(this.storeTripDone
        ? `Добыча в карманах: ${this.storePurchased.size}/${STORE_DAILY_LIMIT}. Иди к двери, пока Людмила не передумала.`
        : this.cart.length > 0
          ? 'Выйди через дверь с добычей — или верни лишнее [Q] / «ВЕРНУТЬ».'
          : `Возьми 1–${STORE_DAILY_LIMIT} предмета, пока Людмила не смотрит.`);
    } }];
  }"""
sub(old_back, new_back, 'shopBack')

# ---------- задачи ----------
old_tasks = """      const storeCount = this.storePurchased.size + this.cart.length;
      if (!this.storeTripDone) {
        out.push({ text: this.cart.length > 0
          ? `Рассчитаться у Людмилы бесплатно: в корзине ${this.cart.length} · всего ${storeCount}/${STORE_DAILY_LIMIT}`
          : `«Бедронка»: выбрать от 1 до ${STORE_DAILY_LIMIT} предметов и рассчитаться у Людмилы` });
        if (this.cart.length > 0) out.push({ text: 'Изменить выбор — вернуть товар [Q] / «ВЕРНУТЬ»' });
      } else if (this.cart.length > 0) {
        out.push({ text: `Оформить новую корзину у Людмилы или вернуть [Q] · всего ${storeCount}/${STORE_DAILY_LIMIT}` });
      } else {
        out.push({ text: `Покупка оформлена · ${storeCount}/${STORE_DAILY_LIMIT}. Вернуться домой и лечь спать [E]` });
      }"""
new_tasks = """      const storeCount = this.cart.length;
      if (!this.storeTripDone) {
        out.push({ text: storeCount > 0
          ? `Уйти из «Бедронки» с добычей: ${storeCount}/${STORE_DAILY_LIMIT} · не попасться Людмиле`
          : `«Бедронка»: взять 1–${STORE_DAILY_LIMIT} предмета, пока Людмила не смотрит` });
        out.push({ text: 'Шкала ВНИМАНИЕ заполнится — она отберёт всё и выставит к двери. C — присесть и идти тише.' });
        if (storeCount > 0) out.push({ text: 'Вернуть лишнее — [Q] / «ВЕРНУТЬ». Выйти можно только с 1–3 предметами.' });
      } else {
        out.push({ text: `Добыча в карманах · ${this.storePurchased.size}/${STORE_DAILY_LIMIT}. Вернуться домой и лечь спать [E]` });
      }"""
sub(old_tasks, new_tasks, 'tasks store')

# ---------- интерактивы магазина ----------
old_store_int = """      const dailyCount = this.storePurchased.size + this.cart.length;
      for (const key of Object.keys(ITEMS)) {
        const a = so.anchors[ITEMS[key].anchor];
        const it = ITEMS[key];
        const target = so.targets[ITEMS[key].anchor];
        const inCart = this.cart.includes(key);
        if (!inCart && (!target || !target.visible)) continue;
        out.push({
          x: a.x, z: a.z, r: a.r,
          hl: inCart ? null : (a.hl || [a.x, 1.15, a.z, 0.55, 0.55, 0.5]),
          target: () => inCart ? null : target,
          itemKey: key,
          label: inCart
            ? `[Q] Вернуть: ${it.name} · сегодня ${dailyCount}/${STORE_DAILY_LIMIT}`
            : dailyCount >= STORE_DAILY_LIMIT
              ? `[E] Дневной лимит: ${STORE_DAILY_LIMIT} предмета`
              : `[E] Взять: ${it.name} · расчёт бесплатный`,
          action: () => {
            if (this.cart.includes(key)) this.msg(`${it.name} уже в корзине. [Q] — вернуть на полку.`, 2500);
            else this.pickup(key);
          }
        });
      }
      const co = so.anchors.checkout;
      out.push({ x: co.x, z: co.z, r: co.r, hl: co.hl, target: () => so.lyudmilaRef.model || so.lyudmila.root, label: '[E] К кассе — Людмила', action: () => this.lyudmilaTalk() });
      const zosiaA = so.anchors.zosia;
      out.push({
        x: zosiaA.x, z: zosiaA.z, r: zosiaA.r,
        hl: zosiaA.hl,
        target: so.zosia.root,
        label: `[E] ${TEXTS.zosiaTitle}`,"""
new_store_int = """      const count = this.cart.length;
      const seen = this.storeSeen;
      for (const key of Object.keys(ITEMS)) {
        const a = so.anchors[ITEMS[key].anchor];
        const it = ITEMS[key];
        const target = so.targets[ITEMS[key].anchor];
        const inCart = this.cart.includes(key);
        if (!inCart && (!target || !target.visible)) continue;
        out.push({
          x: a.x, z: a.z, r: a.r,
          hl: inCart ? null : (a.hl || [a.x, 1.15, a.z, 0.55, 0.55, 0.5]),
          target: () => inCart ? null : target,
          itemKey: key,
          label: inCart
            ? `[Q] Вернуть: ${it.name} · в карманах ${count}/${STORE_DAILY_LIMIT}`
            : count >= STORE_DAILY_LIMIT
              ? `[E] Больше не унести: ${STORE_DAILY_LIMIT} предмета`
              : this.storeTripDone
                ? `[E] ${it.name} — на сегодня хватит`
                : `[E] Взять: ${it.name}${seen ? ' — она смотрит!' : ' · пока не видит'}`,
          action: () => {
            if (this.cart.includes(key)) this.msg(`${it.name} уже за пазухой. [Q] — вернуть на полку.`, 2500);
            else this.pickup(key);
          }
        });
      }
      // У людей контур не рисуем: это живые, а не предметы.
      const co = so.anchors.checkout;
      out.push({ x: co.x, z: co.z, r: co.r, label: '[E] Людмила — поговорить', action: () => this.lyudmilaTalk() });
      const zosiaA = so.anchors.zosia;
      out.push({
        x: zosiaA.x, z: zosiaA.z, r: zosiaA.r,
        label: `[E] ${TEXTS.zosiaTitle}`,"""
sub(old_store_int, new_store_int, 'store interactables')

sub(
    "      out.push({ x: so.anchors.exit.x, z: so.anchors.exit.z, r: 1.4, hl: [0, 1.1, 5.55, 1.5, 2.2, 0.3], target: so.targets.exit, label: this.cart.length > 0 ? '[E] Выйти — сначала оформить или вернуть корзину' : '[E] Выйти на улицу', action: () => this.leaveStore() });",
    "      out.push({ x: so.anchors.exit.x, z: so.anchors.exit.z, r: 1.5, hl: [0, 1.1, 5.55, 1.5, 2.2, 0.3], target: so.targets.exit, label: this.cart.length > 0 ? '[E] Уйти с добычей' : this.storeTripDone ? '[E] Выйти на улицу' : '[E] Выйти — сначала возьми 1–3 предмета', action: () => this.leaveStore() });",
    'store exit label'
)

# ---------- комендантский час ----------
old_curfew = """        if (!this.storeTripDone || this.cart.length > 0) {
          // Ночь не обходит магазин: часы ждут на 21:59, пока корзина не оплачена
          // и не куплен хотя бы один товар. Игрок остаётся там, где может это сделать.
          this.timeMinutes = 22 * 60 - 0.05;
          if (!this.storeCurfewWarned) {
            this.storeCurfewWarned = true;
            this.ui.bigtext('СНАЧАЛА — «БЕДРОНКА»', 2600);
            this.msg(this.cart.length > 0
              ? '22:00. Сначала рассчитайся у Людмилы бесплатно или верни товары [Q] / «ВЕРНУТЬ». День не закончится с неоформленной корзиной.'
              : `22:00. Выбери от 1 до ${STORE_DAILY_LIMIT} предметов в «Бедронке» и рассчитайся у Людмилы. Это бесплатно, но без покупки ночь не начнётся.`, 7500);
            this.ui.prompt(this.cart.length > 0
              ? 'Оформи корзину у Людмилы бесплатно или верни лишнее [Q] / «ВЕРНУТЬ».'
              : `«Бедронка»: выбрать 1–${STORE_DAILY_LIMIT} предмета → рассчитаться у Людмилы → вернуться домой.`);
            this.hud();
          }
        } else {"""
new_curfew = """        if (!this.storeTripDone || this.cart.length > 0) {
          // Ночь не обходит магазин: часы ждут на 21:59, пока Хомка не вынесет
          // хотя бы один предмет из «Бедронки».
          this.timeMinutes = 22 * 60 - 0.05;
          if (!this.storeCurfewWarned) {
            this.storeCurfewWarned = true;
            this.ui.bigtext('СНАЧАЛА — «БЕДРОНКА»', 2600);
            this.msg(this.cart.length > 0
              ? '22:00. Выйди из «Бедронки» через дверь с добычей — домой с полными карманами не пройти.'
              : `22:00. Возьми в «Бедронке» 1–${STORE_DAILY_LIMIT} предмета, пока Людмила не смотрит, и уйди. Без этого ночь не начнётся.`, 7500);
            this.ui.prompt(this.cart.length > 0
              ? 'Иди к двери «Бедронки» и выйди с добычей.'
              : `«Бедронка»: взять 1–${STORE_DAILY_LIMIT} предмета → выйти через дверь → домой.`);
            this.hud();
          }
        } else {"""
sub(old_curfew, new_curfew, 'curfew texts')

# ---------- update(): вызов стелса ----------
sub(
    """    // Погоня: расстояние, рык и захват. Проверка только на чёрном горизонте.""",
    """    // Стелс в «Бедронке»: взгляд Людмилы, шкала внимания, поимка.
    this.storeSuspicionStep(dt);

    // Погоня: расстояние, рык и захват. Проверка только на чёрном горизонте.""",
    'update stealth call'
)

if s == orig:
    print('nothing changed')
    sys.exit(1)
io.open(PATH, 'w', encoding='utf-8', newline='\n').write(s)
print('game.js patched, bytes:', len(s))