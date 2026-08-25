import { DOM, SOUND } from './state';
import { PARAMS } from './plaits';
import { getCenter, distance, type Point } from './utils';
import type { SoundSource, OrbitableElement, LineMovableElement } from '../types';

interface RampableParam {
  rampTo(target: number, rampTime: number): unknown;
}

const lastRampTarget = new WeakMap<RampableParam, number>();

/**
 * Re-issuing an identical (or barely-changed) rampTo() target every animation
 * frame forever — as happens whenever a param sits at its "idle" resting
 * value — has been observed to eventually corrupt the Web Audio graph in
 * Chromium (surfacing as permanent silence) once combined with a connected
 * synth's own envelope automation. Skipping redundant re-scheduling avoids
 * the pattern entirely without changing any audible behavior.
 */
function rampToIfChanged(param: RampableParam, target: number, rampTime: number, epsilon = 0.001): void {
  const last = lastRampTarget.get(param);
  if (last !== undefined && Math.abs(last - target) < epsilon) return;
  param.rampTo(target, rampTime);
  lastRampTarget.set(param, target);
}

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

function drawLineConnection(
  center: Point,
  axis: Point,
  halfLength: number,
  to: Point,
  dist: number,
  radius: number,
): void {
  const alpha = 1 - dist / radius;
  DOM.ctx.save();

  // The rail itself.
  DOM.ctx.strokeStyle = `hsla(4, 95%, 62%, ${0.2 + alpha * 0.4})`;
  DOM.ctx.lineWidth = 1 + alpha * 1.2;
  DOM.ctx.setLineDash([6, 6]);
  DOM.ctx.beginPath();
  DOM.ctx.moveTo(center.x - axis.x * halfLength, center.y - axis.y * halfLength);
  DOM.ctx.lineTo(center.x + axis.x * halfLength, center.y + axis.y * halfLength);
  DOM.ctx.stroke();

  // Tether from the rail's centre out to whatever it's carrying.
  DOM.ctx.setLineDash([1, 4]);
  DOM.ctx.beginPath();
  DOM.ctx.moveTo(center.x, center.y);
  DOM.ctx.lineTo(to.x, to.y);
  DOM.ctx.stroke();

  DOM.ctx.setLineDash([]);
  DOM.ctx.fillStyle = `hsla(10, 100%, 72%, ${0.4 + alpha * 0.5})`;
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
  for (const ps of SOUND.powersynths) {
    ps.warped = false;
    ps.woahAffected = false;
    ps.modAffected = false;
  }

  const orbitableElements: OrbitableElement[] = [
    ...SOUND.orbs,
    ...SOUND.deeppads,
    ...SOUND.timewarps,
    ...SOUND.woahs,
    ...SOUND.etheralwinds,
    ...SOUND.modulators,
    ...SOUND.powersynths,
    ...SOUND.lines,
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

  const lineMovableElements: LineMovableElement[] = [
    ...SOUND.orbs,
    ...SOUND.deeppads,
    ...SOUND.timewarps,
    ...SOUND.woahs,
    ...SOUND.etheralwinds,
    ...SOUND.modulators,
    ...SOUND.powersynths,
    ...SOUND.orbits,
  ];

  for (const line of SOUND.lines) {
    const lineCenter = getCenter(line.el);
    const radians = (line.angle * Math.PI) / 180;
    const axis = { x: Math.cos(radians), y: Math.sin(radians) };
    // Left-hand normal, so +p is consistently one side of the rail.
    const perp = { x: -axis.y, y: axis.x };
    const halfLength = line.length / 2;

    for (const item of lineMovableElements) {
      if (item.el.classList.contains('is-dragging')) continue;

      const itemCenter = getCenter(item.el);
      const dist = distance(lineCenter, itemCenter);
      if (dist > line.radius) continue;

      const dx = itemCenter.x - lineCenter.x;
      const dy = itemCenter.y - lineCenter.y;

      // Decompose the offset into "along the rail" and "off to one side".
      let along = dx * axis.x + dy * axis.y;
      let offset = dx * perp.x + dy * perp.y;

      // Ease the side offset away — this is the pull onto the rail.
      offset *= 0.88;
      if (Math.abs(offset) < 0.5) offset = 0;

      let dir = line.directions.get(item.el) ?? 1;
      along += dir * line.speed;

      // Bounce: park it exactly on the end and turn it around.
      if (along > halfLength) {
        along = halfLength;
        dir = -1;
      } else if (along < -halfLength) {
        along = -halfLength;
        dir = 1;
      }
      line.directions.set(item.el, dir);

      let newX = lineCenter.x + axis.x * along + perp.x * offset;
      let newY = lineCenter.y + axis.y * along + perp.y * offset;

      newX = Math.max(30, Math.min(rect.width - 30, newX));
      newY = Math.max(30, Math.min(rect.height - 30, newY));

      item.el.style.left = `${newX}px`;
      item.el.style.top = `${newY}px`;

      drawLineConnection(lineCenter, axis, halfLength, itemCenter, dist, line.radius);
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

    for (const ps of SOUND.powersynths) {
      const psCenter = getCenter(ps.el);
      const dist = distance(twCenter, psCenter);
      if (dist <= tw.radius) {
        ps.warped = true;
        drawTwConnection(twCenter, psCenter, dist, tw.radius);
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
      rampToIfChanged(woah.fx.delay.delayTime, 0.11, 0.12);
    } else {
      rampToIfChanged(woah.fx.delay.delayTime, 0.375, 0.2);
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
      rampToIfChanged(orb.distortion.wet, maxMod * 0.85, 0.06);
    } else {
      rampToIfChanged(orb.distortion.wet, 0, 0.1);
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
      rampToIfChanged(dp.distortion.wet, maxMod * 0.8, 0.06);
      rampToIfChanged(dp.filter.frequency, dp.baseFreq + maxMod * 1200, 0.06, 1);
    } else {
      rampToIfChanged(dp.distortion.wet, 0, 0.1);
      rampToIfChanged(dp.filter.frequency, dp.baseFreq, 0.15, 1);
    }
  }

  for (const ps of SOUND.powersynths) {
    const psCenter = getCenter(ps.el);
    let maxMod = 0;

    for (const mod of SOUND.modulators) {
      const modCenter = getCenter(mod.el);
      const dist = distance(modCenter, psCenter);
      if (dist <= mod.radius) {
        const modAmount = 1 - (dist / mod.radius);
        if (modAmount > maxMod) maxMod = modAmount;
        drawModConnection(modCenter, psCenter, dist, mod.radius);
      }
    }

    ps.modAffected = maxMod > 0;

    // Plaits has no distortion stage, so the Modulator sweeps the engine's
    // own timbre and morph instead. This loop is the ONLY writer of those two
    // params — the dialog writes baseTimbre/baseMorph, and the effective value
    // is derived here, so the two never fight over the same number.
    if (ps.voice) {
      ps.voice.setParamIfChanged(PARAMS.TIMBRE, Math.min(1, ps.baseTimbre + maxMod * 0.5));
      ps.voice.setParamIfChanged(PARAMS.MORPH, Math.min(1, ps.baseMorph + maxMod * 0.5));
    }
  }

  const allSoundSources: SoundSource[] = [
    ...SOUND.orbs,
    ...SOUND.deeppads,
    ...SOUND.etheralwinds,
    ...SOUND.powersynths,
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
          rampToIfChanged(sendGainNode.gain, targetGain, 0.05);
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
        rampToIfChanged(sendGainNode.gain, 0, 0.08);
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
  for (const ps of SOUND.powersynths) {
    ps.el.classList.toggle('warped', ps.warped);
    ps.el.classList.toggle('woah-affected', ps.woahAffected);
    ps.el.classList.toggle('mod-affected', ps.modAffected);
  }

  requestAnimationFrame(proximityLoop);
}
