// 7.1.0 (ש8): the rate is kept (24 hours, service "שער מטבע"), loaded in the background once a day when a destination has a
// currency, so the converter also works offline - with the date it is from
function rateOf(code) { const e = regCacheGet('rate', code); return e && e.v ? e : null; }
async function rateLoad(code, prio) {
  if (!code || code === 'ILS') return rateOf(code); const have = rateOf(code); if (have && svcFresh('rate', have)) return have;
  const r = await svcAsk('rate', { key: code, prio, build: () => ({ url: 'https://open.er-api.com/v6/latest/' + code }),
    parse: d => { if (!d || d.result === 'error' || !d.rates) throw new Error('answer'); return d.rates.ILS ? d.rates.ILS : SVC_EMPTY; } });
  if (r.kind === 'ok') { regCacheSet('rate', code, { v: r.value, at: Date.now() }); return rateOf(code); }
  return have;
}
function rateDaily() { const cs = [...new Set(tripDests(activeTripObj()).map(id => DESTS[id] && DESTS[id].meta.currency && DESTS[id].meta.currency.code).filter(c => c && c !== 'ILS'))]; cs.forEach(c => rateLoad(c, 'bg')); }
function wireCurrencyConverter() {
  const btn = document.getElementById('convertBtn');
  const input = document.getElementById('hufInput');
  const result = document.getElementById('convertResult');
  if (!btn || !input || !result) return;
  const code = infoDest().meta.currency.code; rateLoad(code, 'bg');
  async function doConvert() {
    const huf = parseFloat(input.value);
    if (!huf || huf <= 0) { result.textContent = ''; return; }
    result.innerHTML = waitLineHTML('טוען שער'); // wait-look: the one stage line of a wait (was the small spinner, 10.1.0)
    const e = await rateLoad(code, 'screen');
    if (!e) { result.textContent = svcNetDown() ? SVC_MSG.offline + ' לשער (עוד לא נשמר שער בטלפון)' : 'לא הצלחנו לטעון שער - נסו את הלינק לגוגל למעלה'; return; }
    const old = !svcFresh('rate', e) ? `${SEP}שער מ-${tmFmt('dayN', tmPhoneDate(e.at))}` : '';
    result.innerHTML = `<bdi dir="ltr" class="cv-sum">${escH(huf.toLocaleString('he-IL'))} ${escH(code)} ≈ ${escH((huf * e.v).toLocaleString('he-IL', { maximumFractionDigits: 2 }))} ₪</bdi>${old}<br><small>${svcCredit('erapi')}</small>`; // phone-round-2b-fixes P10 (G60): the sum in one left-to-right isolate - "10 ARS ≈ 0.02 ₪", never reordered by the Hebrew line
  }
  CONVERT = doConvert; btn.dataset.act = 'currency.convert'; input.dataset.actEnter = 'currency.convert'; // the converter comes in the destination's content
}
var CONVERT = null;
act('currency.convert', () => { if (CONVERT) CONVERT(); return 'quiet'; });

