import type { Trip } from '../types'
import { budget, dayBlocks, dayLegs, mapsDirectionsUrl, mapsPlaceUrl, placeOf } from './schedule'
import { fmtTime, shortDate, tripDays, weekdayName } from './time'

/**
 * The trip guide is one self-contained HTML file: no network, no build, no
 * account. It opens from Files, AirDrop or a private link, and works offline
 * apart from the outbound "open in Maps" links.
 */

interface GuideStop {
  id: string
  start: number
  end: number
  time: string
  title: string
  category: string
  note?: string
  fixed: boolean
  tentative: boolean
  cost?: number
  mapUrl?: string
  /** Travel from this stop to the next. */
  leg?: { text: string; estimated: boolean; url: string; tight: boolean }
}

interface GuideData {
  name: string
  destination: string
  party: number
  currency: string
  homeCurrency: string
  rate: number
  perPerson: number
  days: { date: string; label: string; weekday: string; stops: GuideStop[] }[]
  checklist: { id: string; text: string; note?: string; done: boolean }[]
}

const MODE_LABEL = { walk: 'Walk', transit: 'Transit', drive: 'Drive' } as const

export function guideData(trip: Trip): GuideData {
  return {
    name: trip.name,
    destination: trip.destination,
    party: trip.partySize,
    currency: trip.currency,
    homeCurrency: trip.homeCurrency,
    rate: trip.rate,
    perPerson: budget(trip).perPerson,
    days: tripDays(trip).map((date) => {
      const legs = dayLegs(trip, date)
      return {
        date,
        label: shortDate(date),
        weekday: weekdayName(date),
        stops: dayBlocks(trip, date).map((b) => {
          const place = placeOf(trip, b)
          const leg = legs.find((l) => l.from.id === b.id)
          const to = leg ? placeOf(trip, leg.to) : undefined
          return {
            id: b.id,
            start: b.start,
            end: b.end,
            time: `${fmtTime(b.start)} to ${fmtTime(b.end)}`,
            title: b.title,
            category: b.category,
            note: b.note,
            fixed: !!b.locked,
            tentative: !!b.tentative,
            cost: b.cost,
            mapUrl: place ? mapsPlaceUrl(place) : undefined,
            leg:
              leg && place && to
                ? {
                    text: `${MODE_LABEL[leg.mode]} ${leg.minutes} min${leg.cost ? `, ${trip.currency} ${leg.cost.toLocaleString('en')}` : ''}${leg.note ? `. ${leg.note.replace(/\.+$/, '')}` : ''}`,
                    estimated: !leg.verified,
                    url: mapsDirectionsUrl(place, to, leg.mode),
                    tight: leg.tight,
                  }
                : undefined,
          }
        }),
      }
    }),
    checklist: trip.checklist.map((c) => ({ id: c.id, text: c.text, note: c.note, done: c.done })),
  }
}

const CSS = `
:root{--ink:#18212f;--ink2:#5a6577;--paper:#eef0f3;--surface:#fff;--rule:#d9dde3;--now:#ffc83d;--warn:#d7372b;
--sight:#0b8a7a;--food:#c97a00;--lodging:#4650c8;--shopping:#b5407a;--transport:#5f6b7c;--other:#7a6f5a}
@media(prefers-color-scheme:dark){:root{--ink:#eef0f3;--ink2:#a3adbd;--paper:#141a24;--surface:#1d2532;--rule:#2f3a4b}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{padding:20px 16px 8px;max-width:560px;margin:0 auto}
h1{font-size:26px;line-height:1.15;margin:0;letter-spacing:-.01em}
header p{margin:4px 0 0;color:var(--ink2);font-size:14px}
nav{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--rule)}
.tabs{display:flex;gap:6px;overflow-x:auto;padding:10px 16px;max-width:560px;margin:0 auto;scrollbar-width:none}
.tabs button{flex:none;border:1px solid var(--rule);background:var(--surface);color:var(--ink);border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;min-height:44px;cursor:pointer}
.tabs button small{display:block;font-size:11px;color:var(--ink2)}
.tabs button[aria-selected=true]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.tabs button[aria-selected=true] small{color:inherit;opacity:.75}
.tabs button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid var(--now);outline-offset:2px}
main{max-width:560px;margin:0 auto;padding:16px 16px 64px}
.next{background:var(--now);color:#18212f;border-radius:14px;padding:14px 16px;margin-bottom:20px}
.next b{display:block;font-size:20px;line-height:1.2}
.next span{font-size:14px}
ol.line{list-style:none;margin:0;padding:0}
.stop{position:relative;padding:0 0 4px 34px}
.stop::before{content:"";position:absolute;left:11px;top:0;bottom:0;width:4px;background:var(--c)}
.stop:first-child::before{top:12px}
.stop:last-child::before{bottom:auto;height:12px}
.stop::after{content:"";position:absolute;left:5px;top:6px;width:16px;height:16px;border-radius:50%;background:var(--surface);border:4px solid var(--c)}
.stop.done{opacity:.55}
.stop.now::after{background:var(--now);box-shadow:0 0 0 5px color-mix(in srgb,var(--now) 45%,transparent)}
.time{font-variant-numeric:tabular-nums;font-size:13px;color:var(--ink2)}
.stop h2{font-size:18px;line-height:1.25;margin:0}
.stop.tentative h2::after{content:" (not decided)";font-weight:400;font-size:13px;color:var(--ink2)}
.note{margin:2px 0 0;font-size:14px;color:var(--ink2)}
.tag{display:inline-block;font-size:12px;font-weight:600;border:1px solid currentColor;border-radius:4px;padding:0 6px;margin-left:6px;color:var(--warn);vertical-align:2px}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
.acts a{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:10px;background:var(--surface);border:1px solid var(--rule);color:var(--ink);text-decoration:none;font-size:14px;font-weight:600}
.leg{margin:10px 0 14px;font-size:14px;color:var(--ink2)}
.leg a{color:var(--ink);font-weight:600}
.leg.tight{color:var(--warn)}
.stop:last-child .body{padding-bottom:0}
.body{padding-bottom:14px}
.empty{color:var(--ink2);padding:24px 0}
.check{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--rule)}
.check input{width:22px;height:22px;margin:1px 0 0;accent-color:var(--sight);flex:none}
.check small{display:block;color:var(--ink2)}
.check input:checked+span{text-decoration:line-through;color:var(--ink2)}
.sum{background:var(--surface);border:1px solid var(--rule);border-radius:14px;padding:14px 16px;margin-top:24px;font-size:14px}
.sum b{font-size:18px;font-variant-numeric:tabular-nums}
`

/** Runs inside the exported file. Kept dependency-free and written for old phone browsers too. */
const SCRIPT = `
(function(){
var D=JSON.parse(document.getElementById('trip').textContent);
var KEY='trip-guide:'+D.name+':checks';
var checks={};try{checks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
var main=document.querySelector('main'),tabs=document.querySelector('.tabs');
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function link(text,url){var a=el('a',null,text);a.href=url;a.target='_blank';a.rel='noopener';return a}
function pad(n){return(n<10?'0':'')+n}
var now=new Date(),today=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate()),mins=now.getHours()*60+now.getMinutes();
var current='list';
D.days.forEach(function(d,i){if(d.date===today)current=i});
if(current==='list'&&D.days.length)current=0;
function money(n){return D.currency+' '+Math.round(n).toLocaleString('en')}
function renderDay(d){
  var isToday=d.date===today;
  if(!d.stops.length){main.appendChild(el('p','empty','Nothing planned for this day.'));return}
  if(isToday){
    var up=null;d.stops.forEach(function(s){if(!up&&s.end>mins)up=s});
    if(up){var box=el('div','next');box.appendChild(el('span',null,up.start<=mins?'Now, until '+up.time.split(' to ')[1]:'Next at '+up.time.split(' to ')[0]));box.appendChild(el('b',null,up.title));main.appendChild(box)}
  }
  var ol=el('ol','line');
  d.stops.forEach(function(s){
    var li=el('li','stop'+(s.tentative?' tentative':''));
    li.style.setProperty('--c','var(--'+s.category+')');
    if(isToday&&s.end<=mins)li.className+=' done';
    if(isToday&&s.start<=mins&&s.end>mins)li.className+=' now';
    var body=el('div','body');
    body.appendChild(el('div','time',s.time));
    var h=el('h2',null,s.title);if(s.fixed)h.appendChild(el('span','tag','Fixed time'));body.appendChild(h);
    if(s.note)body.appendChild(el('p','note',s.note));
    if(s.cost)body.appendChild(el('p','note',money(s.cost)+' per person'));
    if(s.mapUrl){var a=el('div','acts');a.appendChild(link('Open in Maps',s.mapUrl));body.appendChild(a)}
    if(s.leg){var l=el('p','leg'+(s.leg.tight?' tight':''));l.appendChild(document.createTextNode(s.leg.text+(s.leg.estimated?' (estimate)':'')+(s.leg.tight?'. Tight connection':'')+'. '));l.appendChild(link('Directions',s.leg.url));body.appendChild(l)}
    li.appendChild(body);ol.appendChild(li);
  });
  main.appendChild(ol);
}
function renderList(){
  if(!D.checklist.length)main.appendChild(el('p','empty','No checklist items.'));
  D.checklist.forEach(function(c){
    var row=el('label','check'),box=el('input');box.type='checkbox';
    box.checked=checks[c.id]!=null?checks[c.id]:c.done;
    box.onchange=function(){checks[c.id]=box.checked;try{localStorage.setItem(KEY,JSON.stringify(checks))}catch(e){}};
    var t=el('span',null,c.text);if(c.note)t.appendChild(el('small',null,c.note));
    row.appendChild(box);row.appendChild(t);main.appendChild(row);
  });
  if(D.perPerson){var s=el('div','sum');s.appendChild(document.createTextNode('Planned spend per person '));s.appendChild(el('b',null,money(D.perPerson)));
    s.appendChild(el('div',null,'About '+D.homeCurrency+' '+Math.round(D.perPerson*D.rate).toLocaleString('en')+' each, '+D.homeCurrency+' '+Math.round(D.perPerson*D.rate*D.party).toLocaleString('en')+' for '+D.party+'.'));main.appendChild(s)}
}
function render(){
  main.textContent='';
  Array.prototype.forEach.call(tabs.children,function(b){b.setAttribute('aria-selected',String(b._k===current))});
  if(current==='list')renderList();else renderDay(D.days[current]);
}
function tab(k,label,sub){var b=el('button',null,label);b.type='button';b._k=k;b.setAttribute('role','tab');if(sub)b.appendChild(el('small',null,sub));b.onclick=function(){current=k;render();window.scrollTo(0,0)};tabs.appendChild(b)}
D.days.forEach(function(d,i){tab(i,d.label,d.date===today?'Today':d.weekday)});
tab('list','Checklist','and budget');
render();
var sel=tabs.querySelector('[aria-selected=true]');if(sel&&sel.scrollIntoView)sel.scrollIntoView({inline:'center',block:'nearest'});
})();
`

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildGuideHtml(trip: Trip): string {
  const data = guideData(trip)
  // "<" is escaped so trip text can never close the script tag early.
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const dates = data.days.length ? `${data.days[0].label} to ${data.days.at(-1)!.label}` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${esc(trip.name)}</title>
<style>${CSS}</style>
</head>
<body>
<header><h1>${esc(trip.name)}</h1><p>${esc([trip.destination, dates, `${data.party} travelling`].filter(Boolean).join(', '))}</p></header>
<nav><div class="tabs" role="tablist"></div></nav>
<main></main>
<script type="application/json" id="trip">${json}</script>
<script>${SCRIPT}</script>
</body>
</html>`
}

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
