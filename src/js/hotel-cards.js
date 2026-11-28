// ================= HOTEL CARDS & 🔖 BOOKED (4.18.0) =================
// 🏨 פרטי הלינה shows a full card per hotel: tonight's first and open, the next ones folded, the ones you left at the end
// (✓ היינו). Hotel facts come from the trip file (Claude) and the lodging editor; what is near is worked out from the
// destination's places; a photo of the hotel is in the PHOTOS block (hotelPhotoHTML).
function hotelNearby(p) {
  const c = routeCoordOf(p); if (!c) return '';
  const near = (pred, max) => POINTS.filter(q => q.id !== p.id && pred(q) && routeCoordOf(q)).map(q => ({ q, d: distanceKm(c, routeCoordOf(q)) })).filter(x => x.d <= max).sort((a, b) => a.d - b.d);
  const one = (ic, pred) => { const n = near(pred, 1.5)[0]; return n ? `${msi(ic, { cls: 'msi-in' })} ${fmtKm(n.d)}` : ''; }; // 10.15.0 (design-review, under Q11): field marks as line icons (HTML)
  const food = near(q => (layerDef(q.layer) || {}).type === 'food', 0.6).length;
  const D = DESTS[p.dest], cc = D && D.meta.center ? { lat: D.meta.center[0], lng: D.meta.center[1] } : null, cd = cc ? distanceKm(c, cc) : null;
  return [one('local_atm', q => q.icon === 'atm'), one('shopping_cart', q => q.icon === 'grocery_or_supermarket' || q.icon === 'market'), one('local_pharmacy', q => q.icon === 'pharmacy'), food ? `${msi('restaurant', { cls: 'msi-in' })} ${food} מקומות אוכל` : '', cd != null && cd < 30 ? `מהמרכז ${fmtKm(cd)}` : ''].filter(Boolean).join(SEP);
}
function lodgingCardsHTML(lo) { // 5.3.0: the hotels of the trip as mini cards (tonight first, then the next ones, past ones last); all the details are in each one's window
  const iso = todayStr(), st = l => l.checkIn <= iso && iso < l.checkOut ? 0 : (l.checkOut <= iso ? 2 : 1);
  return lo.slice().sort((a, b) => st(a) - st(b) || String(a.checkIn).localeCompare(String(b.checkIn))).map(l => { const it = itemOf('l:' + l.id); return it ? miniCardHTML(it, { screen: 'hotels' }) : ''; }).join('');
}

function goLodgingCard(id) { if (FS) exitFS(); openItemWin('l:' + id); } // 5.2.0: from the night's line, a pin or a route stop - the hotel's window

// 🔖 booked: a mark with an optional date, time and booking number. With a date the place goes into that day of the plan
// (with a time, at that time). Booked places leave the open-reservations filter. Personal, per trip, like ⭐ and ✓.
function bookingOf(id) { return (STATE.bookings || {})[id] || null; }
function bookingLabel(id, plain) { const b = bookingOf(id); if (!b) return ''; return (plain ? '' : SYM_BOOKED + ' ') + 'הוזמן' + (b.date ? SEP + tmFmt('dayN', b.date) : '') + (b.time ? ' ' + b.time : ''); }
function openBookingSheet(p) { layerNote(openBookingSheet, arguments); // מ9: stays a bottom sheet - a short task about the place behind it
  const sheet = document.getElementById('sheet'), cur = bookingOf(p.id) || {}, F = fmNew({ p });
  const c = reservationClass(p.reservation), unk = bpResv(p.reservation).need === 'unknown'; // 11.42.0: "not needed" only when it was checked (Q2)
  sheet.innerHTML = `${fmHead(`${SYM_BOOKED} הזמנה${SEP}${escH(placeLabel(p))}`)}
    <div class="sh-hint bk-short">${c === 'resv-must' ? msi('event', { cls: 'msi-in' }) + ' <b>חובה להזמין</b>' : c === 'resv-rec' ? msi('event_available', { cls: 'msi-in' }) + ' <b>מומלץ להזמין</b>' : unk ? 'לא ידוע אם צריך להזמין' : 'לא צריך להזמין מראש'}${SEP}כשהזמנתם - "הוזמן"</div>
    <div class="sh-why" hidden>${c === 'resv-must' ? msi('event', { cls: 'msi-in' }) + ' <b>חובה להזמין</b>: למקום הזה צריך להזמין מראש (כרטיסים, תור או שולחן).' : c === 'resv-rec' ? msi('event_available', { cls: 'msi-in' }) + ' <b>מומלץ להזמין</b>: אפשר בלי, אבל כדאי להזמין מראש.' : unk ? 'עוד לא ידוע אם צריך להזמין למקום הזה.' : 'למקום הזה לא צריך להזמין מראש.'}${bpResv(p.reservation).note ? ' ' + escH(bpResv(p.reservation).note) : ''}<br>כשהזמנתם - מסמנים כאן "הוזמן". עם יום המקום נכנס לתוכנית ביום הזה, ועם שעה - בשעה הזו; הוא יוצא מסינון ${msi('event_available', { cls: 'msi-in' })} ההזמנות הפתוחות.</div>
    ${fmChips(F, 'date', { label: 'יום', value: cur.date || '', options: [['', '— בלי יום'], ...TRIP_DAYS.map(d => [d.date, tmFmt('day', d.date)])] })}
    <div class="sh-times">${fmTime(F, 'time', { label: 'שעה', value: cur.time || '', clear: true })}${fmText(F, 'ref', { label: 'מספר הזמנה (רשות)', value: cur.ref || '', dir: 'ltr' })}</div>
    ${bookingOf(p.id) ? fmEndActs([{ act: 'booking.del', label: 'ביטול הסימון', ic: 'event_busy' }]) : ''}
    ${fmSaveBar({ act: 'booking.save', label: SYM_BOOKED + ' הוזמן' })}`;
  showSheetBackdrop('openBookingSheet'); winRef('place:' + p.id); fmAttach(F);
}
act('booking.del', c => { const p = c.ref.obj; const b = { ...(STATE.bookings || {}) }; delete b[p.id]; STATE.bookings = b; closeSheet(); persist(); showUndoToast('סימון ההזמנה בוטל: ' + p.name); });
act('booking.save', c => { const p = c.ref.obj;
    const F = fmOf(c.el), date = fmGet(F, 'date'), time = fmGet(F, 'time'), ref = fmGet(F, 'ref');
    STATE.bookings = { ...(STATE.bookings || {}), [p.id]: { date, time: date ? time : '', ref, at: Date.now() } };
    const day = date ? TRIP_DAYS.find(d => d.date === date) : null;
    if (day) { const d = ensureDay(day.key); if (!findSlot(day.key, p.id)) d.unassigned.push(p.id);
      if (time) { const old = getTime(day.key, p.id); STATE.times[timeKey(day.key, p.id)] = { start: time, end: old && old.end > time ? old.end : tmAddMin(time, 60) }; placeTimed(day.key, p.id); } }
    closeSheet(); persist(); showUndoToast(bookingLabel(p.id, true) + ': ' + p.name + (day ? (SEP + 'נכנס לתוכנית') : ''));
  });

