// scenes.js — реестр локаций: дом, улица, бедронка, подвал.
import { createHome } from './home.js';
import { createStreet } from './street.js';
import { createStore } from './store.js';
import { createBasement } from './basement.js';
import { buildLyceumInterior } from './lyceum.js';
import { buildMineScenes } from './mine.js';

export function buildScenes() {
  const home = createHome();
  const street = createStreet();
  const store = createStore();
  const basement = createBasement();
  const lyceum = buildLyceumInterior();
  const mine = buildMineScenes();

  return {
    home: {
      id: 'home',
      scene: home.scene,
      colliders: home.colliders,
      bounds: { minX: home.flat.minX, maxX: home.flat.maxX, minZ: home.flat.minZ, maxZ: home.flat.maxZ },
      anchors: home.anchors,
      world: home.world,
      rifle: home.rifle,
      // Не копируем door через spread: setOpen должен менять именно створку,
      // которую анимирует world.update(), а не отдельный объект адаптера.
      surfaceDoors: [{
        id: 'home-exit', x: 0, z: -2.5, radius: 1.65,
        setOpen: (open) => home.world.door.setOpen(open),
        get openAngle() { return home.world.door.openAngle; },
        get targetAngle() { return home.world.door.targetAngle; },
        get openAmount() { return Math.min(1, Math.abs(home.world.door.openAngle) / 1.85); }
      }],
      update: home.update
    },
    street: {
      id: 'street',
      scene: street.scene,
      colliders: street.colliders,
      bounds: street.bounds,
      anchors: street.anchors,
      cross: street.cross,
      targets: street.targets,
      surfaceDoors: street.surfaceDoors,
      update: street.update
    },
    store: {
      id: 'store',
      scene: store.scene,
      colliders: store.colliders,
      bounds: store.bounds,
      anchors: store.anchors,
      lyudmila: store.lyudmila,
      lyudmilaRef: store.lyudmilaRef,
      zosia: store.zosia,
      targets: store.targets,
      stealth: store.stealth,   // сектор взгляда Людмилы: кража и внимание
      surfaceDoors: store.surfaceDoors,
      update: store.update
    },
    basement: {
      id: 'basement',
      scene: basement.scene,
      colliders: basement.colliders,
      bounds: basement.bounds,
      anchors: basement.anchors,
      cotSpots: basement.cotSpots,
      targets: basement.targets,
      setMineHatch: basement.setMineHatch,
      update: basement.update
    },
    lyceum: {
      id: 'lyceum',
      scene: lyceum.scene,
      colliders: lyceum.colliders,
      bounds: lyceum.bounds,
      anchors: lyceum.anchors,
      targets: lyceum.targets,
      surfaceDoors: lyceum.surfaceDoors,
      update: lyceum.update
    },
    ...mine
  };
}
