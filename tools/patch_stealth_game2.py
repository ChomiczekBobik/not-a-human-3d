# -*- coding: utf-8 -*-
"""Вторая часть патча game.js (после сдвига отступов в getTasks)."""
import io, sys

PATH = r'C:\Users\user\not-a-human-3d\src\game.js'
s = io.open(PATH, encoding='utf-8').read()
orig = s

def sub(old, new, label):
    global s
    if old not in s:
        print('MISS:', label)
        print(repr(old[:200]))
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('ok:', label)

# ---------- задачи ----------
old_tasks = """    const storeCount = this.storePurchased.size + this.cart.length;
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
new_tasks = """    const storeCount = this.cart.length;
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
old_int = """      const dailyCount = this.storePurchased.size + this.cart.length;
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
new_int = """      const count = this.cart.length;
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
sub(old_int, new_int, 'store interactables')

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
    "    // Погоня: расстояние, рык и захват. Проверка только на чёрном горизонте.",
    "    // Стелс в «Бедронке»: взгляд Людмилы, шкала внимания, поимка.\n    this.storeSuspicionStep(dt);\n\n    // Погоня: расстояние, рык и захват. Проверка только на чёрном горизонте.",
    'update stealth call'
)

io.open(PATH, 'w', encoding='utf-8', newline='\n').write(s)
print('game.js patch2 done, bytes:', len(s))