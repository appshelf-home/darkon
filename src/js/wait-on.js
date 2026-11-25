// ================= WAITING ON AN OUTSIDE SERVICE - the one "in progress" indicator (split from js/services.js in map-3d at its natural seam: the client above, a screen's indicator here) =================
// 11.46.0 (phone-round-4c-fixes P3; decisions 2026-11-21 · Review of the `phone-round-4b-fixes` summary, Q2; standard ui-look-layout
// "Waiting on an outside service"): "in progress" - the one indicator of a screen or window waiting on an outside service. waitOn(host, o)
// puts a moving bar under the host's head (o.head: the element it goes after; else the host's first child), writes the stage line with
// moving dots into o.line (o.stage: its words, no "…"), and dims o.map with a pulsing ring on its middle - the estimated area. It returns
// { stage(words), progress(done, total, words), done() }: done takes the bar, the line and the dimming off (the screen then writes its result or its failure line);
// both are safe after the host left the page. waitLineHTML(words) is the stage line alone - every "searching…" line of the app.
// wait-look (Q1, the measured state): when the screen knows how much is done (a count of a total), progress(done, total, words) stops
// the bar's run and fills it to done / total (aria-valuenow / aria-valuemax, so a screen reader hears it) and the stage line shows the
// words with the count ("מורידים את אזור 2 מתוך 5 · 120 מתוך 400") and no dots; a total unknown again (0 / null) returns to the running
// bar and the dots. With no count the component is as before. A screen drawn as one string (the Timeline's review) writes the same
// two pieces with waitBarHTML(words, n) and waitLineHTML(words, n); n = { done, total } or nothing.
const waitNum = x => Number(x || 0).toLocaleString('he-IL');
const waitPct = n => Math.max(0, Math.min(100, Math.round(100 * n.done / n.total)));
function waitCountHTML(n) { return `<bdi>${waitNum(n.done)}</bdi> מתוך <bdi>${waitNum(n.total)}</bdi>`; }
function waitMeasured(n) { return n && n.total > 0 ? { done: Math.min(+n.done || 0, n.total), total: +n.total } : null; }
function waitLineHTML(t, n) { n = waitMeasured(n);
  return `<small class="ps-line ps-busy wait-line${n ? ' wait-count' : ''}" role="status">${escH(t)}${n ? SEP + waitCountHTML(n) : '<span class="wait-dots">…</span>'}</small>`; }
function waitBarHTML(t, n) { n = waitMeasured(n);
  return `<div class="wait-bar${n ? ' wait-fill' : ''}" role="progressbar" aria-label="${escH(t)}"${n ? ` aria-valuemin="0" aria-valuemax="${escH(n.total)}" aria-valuenow="${escH(n.done)}" style="--wait-p:${waitPct(n)}%"` : ''}></div>`; }
function waitBarSet(bar, t, n) { n = waitMeasured(n); bar.setAttribute('aria-label', t); bar.classList.toggle('wait-fill', !!n);
  if (n) { bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(n.total)); bar.setAttribute('aria-valuenow', String(n.done)); bar.style.setProperty('--wait-p', waitPct(n) + '%'); }
  else { ['aria-valuemin', 'aria-valuemax', 'aria-valuenow'].forEach(a => bar.removeAttribute(a)); bar.style.removeProperty('--wait-p'); } }
function waitOn(host, o) { o = o || {}; if (!host) return { stage() {}, progress() {}, done() {} };
  const bar = document.createElement('div'); bar.className = 'wait-bar'; bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', o.stage || 'בטעינה');
  const after = o.head && o.head.parentElement === host ? o.head : null; if (after) after.after(bar); else host.prepend(bar);
  let words = o.stage || ''; const line = o.line || null, map = o.map || null, show = (t, n) => { words = t; if (line && line.isConnected) line.innerHTML = waitLineHTML(t, n); waitBarSet(bar, t, n); };
  if (o.stage) show(o.stage); let ring = null; if (map) { map.classList.add('wait-map'); ring = document.createElement('div'); ring.className = 'wait-ring'; ring.setAttribute('aria-hidden', 'true'); map.appendChild(ring); }
  let on = true; return { stage: t => { if (on) show(t); }, progress: (done, total, t) => { if (on) show(t || words, { done, total }); },
    done: () => { if (!on) return; on = false; bar.remove(); if (ring) ring.remove(); if (map) map.classList.remove('wait-map'); if (line && line.querySelector('.wait-line')) line.innerHTML = ''; } }; }
