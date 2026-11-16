// scenes.js — реестр локаций: дом, улица, бедронка, подвал.
import { createHome } from './home.js';
import { createStreet } from './street.js';
import { createStore } from './store.js';
import { createBasement } from './basement.js';
import { buildLyceumInterior } from './lyceum.js';

export function buildScenes() {
  const home = createHome();
  const street = createStreet();
  const store = createStore();
  const basement = createBasement();
  const lyceum = buildLyceumInterior();

  return {
    home: {
      id: 'home',
      scene: home.scene,
      colliders: home.colliders,
      bounds: { minX: home.flat.minX, maxX: home.flat.maxX, minZ: home.flat.minZ, maxZ: home.flat.maxZ },
      anchors: home.anchors,
      world: home.world,
      rifle: home.rifle,
      update: home.update
    },
    street: {
      id: 'street',
      scene: street.scene,
      colliders: street.colliders,
      bounds: street.bounds,
      anchors: street.anchors,
      cross: street.cross,
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
      update: store.update
    },
    basement: {
      id: 'basement',
      scene: basement.scene,
      colliders: basement.colliders,
      bounds: basement.bounds,
      anchors: basement.anchors,
      cotSpots: basement.cotSpots,
      update: basement.update
    },
    lyceum: {
      id: 'lyceum',
      scene: lyceum.scene,
      colliders: lyceum.colliders,
      bounds: lyceum.bounds,
      anchors: lyceum.anchors,
      update: lyceum.update
    }
  };
}
