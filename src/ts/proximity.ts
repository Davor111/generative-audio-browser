import { DOM, SOUND } from './state';
import { getCenter, distance, type Point } from './utils';
import type { SoundSource, OrbitableElement } from './types';

export function resizeConnectionsCanvas(): void {
  const rect = DOM.canvas.getBoundingClientRect();
  DOM.connectionsCanvas.width = rect.width * devicePixelRatio;
  DOM.connectionsCanvas.height = rect.height * devicePixelRatio;
  DOM.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function drawTwConnection(from: Point, to: Point, dist: number, radius: number): void {
  const alpha = 1 - (dist / radius);
  DOM.ctx.save();
  DOM.ctx.strokeStyle = `hsla(190, 80%, 60%, ${0.15 + alpha * 0.4})`;
  DOM.ctx.lineWidth = 1 + alpha * 1.5;
  DOM.ctx.setLineDash([4, 6]);
  DOM.ctx.beginPath();
  DOM.ctx.moveTo(from.x, from.y);
  DOM.ctx.lineTo(to.x, to.y);
  DOM.ctx.stroke();

  DOM.ctx.setLineDash([]);
  DOM.ctx.fillStyle = `hsla(190, 85%, 65%, ${0.3 + alpha * 0.4})`;
  DOM.ctx.beginPath();
  DOM.ctx.arc(to.x, to.y, 3 + alpha * 3, 0, Math.PI * 2);
  DOM.ctx.fill();
  DOM.ctx.restore();
}

function drawModConnection(from: Point, to: Point, dist: number, radius: number): void {
  const alpha = 1 - (dist / radius);
  DOM.ctx.save();
  DOM.ctx.strokeStyle = `hsla(340, 95%, 60%, ${0.2 + alpha * 0.55})`;
  DOM.ctx.lineWidth = 1.5 + alpha * 2.2;
  DOM.ctx.beginPath();
  DOM.ctx.moveTo(from.x, from.y);
  DOM.ctx.lineTo(to.x, to.y);
  DOM.ctx.stroke();

  DOM.ctx.fillStyle = `hsla(340, 100%, 68%, ${0.4 + alpha * 0.5})`;
  DOM.ctx.beginPath();
  DOM.ctx.arc(to.x, to.y, 4 + alpha * 3, 0, Math.PI * 2);
  DOM.ctx.fill();
  DOM.ctx.restore();
}

function drawOrbitConnection(from: Point, to: Point, dist: number, radius: number): void {
  const alpha = 1 - (dist / radius);
  DOM.ctx.save();
  DOM.ctx.strokeStyle = `hsla(45, 100%, 60%, ${0.15 + alpha * 0.35})`;
  DOM.ctx.lineWidth = 1 + alpha * 1.2;
  DOM.ctx.setLineDash([2, 5]);
  DOM.ctx.beginPath();
  DOM.ctx.arc(from.x, from.y, dist, 0, Math.PI * 2);
  DOM.ctx.stroke();

  DOM.ctx.setLineDash([1, 4]);
  DOM.ctx.beginPath();
  DOM.ctx.moveTo(from.x, from.y);
  DOM.ctx.lineTo(to.x, to.y);
  DOM.ctx.stroke();

  DOM.ctx.setLineDash([]);
  DOM.ctx.fillStyle = `hsla(45, 100%, 75%, ${0.4 + alpha * 0.5})`;
  DOM.ctx.beginPath();
  DOM.ctx.arc(to.x, to.y, 3 + alpha * 3, 0, Math.PI * 2);
  DOM.ctx.fill();
  DOM.ctx.restore();
}

export function proximityLoop(): void {
  const rect = DOM.canvas.getBoundingClientRect();
  DOM.ctx.clearRect(0, 0, rect.width, rect.height);

  for (const orb of SOUND.orbs) {
    orb.warped = false;
    orb.woahAffected = false;
    orb.modAffected = false;
  }
  for (const dp of SOUND.deeppads) {
    dp.warped = false;
    dp.woahAffected = false;
    dp.modAffected = false;
  }
  for (const woah of SOUND.woahs) {
    woah.warped = false;
  }
  for (const wind of SOUND.etheralwinds) {
    wind.woahAffected = false;
  }

  const orbitableElements: OrbitableElement[] = [
    ...SOUND.orbs,
    ...SOUND.deeppads,
    ...SOUND.timewarps,
    ...SOUND.woahs,
    ...SOUND.etheralwinds,
    ...SOUND.modulators,
  ];

  for (const orbit of SOUND.orbits) {
    const orbitCenter = getCenter(orbit.el);

    for (const item of orbitableElements) {
      if (item.el.classList.contains('is-dragging')) continue;

      const itemCenter = getCenter(item.el);
      const dist = distance(orbitCenter, itemCenter);

      if (dist <= orbit.radius && dist > 14) {
        const currentAngle = Math.atan2(itemCenter.y - orbitCenter.y, itemCenter.x - orbitCenter.x);
        const angularSpeed = 0.012 + (1 - dist / orbit.radius) * 0.016;
        const newAngle = currentAngle + angularSpeed;

        let newX = orbitCenter.x + Math.cos(newAngle) * dist;
        let newY = orbitCenter.y + Math.sin(newAngle) * dist;

        newX = Math.max(30, Math.min(rect.width - 30, newX));
        newY = Math.max(30, Math.min(rect.height - 30, newY));

        item.el.style.left = `${newX}px`;
        item.el.style.top = `${newY}px`;

        drawOrbitConnection(orbitCenter, itemCenter, dist, orbit.radius);
      }
    }
  }

  for (const tw of SOUND.timewarps) {
    const twCenter = getCenter(tw.el);

    for (const orb of SOUND.orbs) {
      const orbCenter = getCenter(orb.el);
      const dist = distance(twCenter, orbCenter);
      if (dist <= tw.radius) {
        orb.warped = true;
        drawTwConnection(twCenter, orbCenter, dist, tw.radius);
      }
    }

    for (const dp of SOUND.deeppads) {
      const dpCenter = getCenter(dp.el);
      const dist = distance(twCenter, dpCenter);
      if (dist <= tw.radius) {
        dp.warped = true;
        drawTwConnection(twCenter, dpCenter, dist, tw.radius);
      }
    }

    for (const woah of SOUND.woahs) {
      const woahCenter = getCenter(woah.el);
      const dist = distance(twCenter, woahCenter);
      if (dist <= tw.radius) {
        woah.warped = true;
        drawTwConnection(twCenter, woahCenter, dist, tw.radius);
      }
    }
  }

  for (const woah of SOUND.woahs) {
    if (woah.warped) {
      woah.fx.delay.delayTime.rampTo(0.11, 0.12);
    } else {
      woah.fx.delay.delayTime.rampTo(0.375, 0.2);
    }
    woah.el.classList.toggle('warped', woah.warped);
  }

  for (const orb of SOUND.orbs) {
    const orbCenter = getCenter(orb.el);
    let maxMod = 0;

    for (const mod of SOUND.modulators) {
      const modCenter = getCenter(mod.el);
      const dist = distance(modCenter, orbCenter);
      if (dist <= mod.radius) {
        const modAmount = 1 - (dist / mod.radius);
        if (modAmount > maxMod) maxMod = modAmount;
        drawModConnection(modCenter, orbCenter, dist, mod.radius);
      }
    }

    if (maxMod > 0) {
      orb.modAffected = true;
      orb.distortion.wet.rampTo(maxMod * 0.85, 0.06);
    } else {
      orb.distortion.wet.rampTo(0, 0.1);
    }
  }

  for (const dp of SOUND.deeppads) {
    const dpCenter = getCenter(dp.el);
    let maxMod = 0;

    for (const mod of SOUND.modulators) {
      const modCenter = getCenter(mod.el);
      const dist = distance(modCenter, dpCenter);
      if (dist <= mod.radius) {
        const modAmount = 1 - (dist / mod.radius);
        if (modAmount > maxMod) maxMod = modAmount;
        drawModConnection(modCenter, dpCenter, dist, mod.radius);
      }
    }

    if (maxMod > 0) {
      dp.modAffected = true;
      dp.distortion.wet.rampTo(maxMod * 0.8, 0.06);
      dp.filter.frequency.rampTo(dp.baseFreq + maxMod * 1200, 0.06);
    } else {
      dp.distortion.wet.rampTo(0, 0.1);
      dp.filter.frequency.rampTo(dp.baseFreq, 0.15);
    }
  }

  const allSoundSources: SoundSource[] = [
    ...SOUND.orbs,
    ...SOUND.deeppads,
    ...SOUND.etheralwinds,
  ];

  for (const woah of SOUND.woahs) {
    const woahCenter = getCenter(woah.el);

    for (const source of allSoundSources) {
      const sourceCenter = getCenter(source.el);
      const dist = distance(woahCenter, sourceCenter);
      const sendGainNode = source.woahSends.get(woah);

      if (dist <= woah.radius) {
        source.woahAffected = true;

        const closeness = 1 - (dist / woah.radius);
        const targetGain = Math.min(1.0, closeness * 1.2);

        if (sendGainNode) {
          sendGainNode.gain.rampTo(targetGain, 0.05);
        }

        DOM.ctx.save();
        DOM.ctx.strokeStyle = `hsla(155, 95%, 52%, ${0.2 + closeness * 0.55})`;
        DOM.ctx.lineWidth = 1.5 + closeness * 2.5;
        DOM.ctx.beginPath();
        DOM.ctx.moveTo(woahCenter.x, woahCenter.y);
        DOM.ctx.lineTo(sourceCenter.x, sourceCenter.y);
        DOM.ctx.stroke();

        DOM.ctx.fillStyle = `hsla(155, 95%, 60%, ${0.4 + closeness * 0.5})`;
        DOM.ctx.beginPath();
        DOM.ctx.arc(sourceCenter.x, sourceCenter.y, 4 + closeness * 4, 0, Math.PI * 2);
        DOM.ctx.fill();
        DOM.ctx.restore();
      } else if (sendGainNode) {
        sendGainNode.gain.rampTo(0, 0.08);
      }
    }
  }

  for (const orb of SOUND.orbs) {
    orb.el.classList.toggle('warped', orb.warped);
    orb.el.classList.toggle('woah-affected', orb.woahAffected);
    orb.el.classList.toggle('mod-affected', orb.modAffected);
  }
  for (const dp of SOUND.deeppads) {
    dp.el.classList.toggle('warped', dp.warped);
    dp.el.classList.toggle('woah-affected', dp.woahAffected);
    dp.el.classList.toggle('mod-affected', dp.modAffected);
  }
  for (const wind of SOUND.etheralwinds) {
    wind.el.classList.toggle('woah-affected', wind.woahAffected);
  }

  requestAnimationFrame(proximityLoop);
}
