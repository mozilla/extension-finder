/* global lunr */

const sheetId = '1ZzheVRDnEpAwdQ3eHDVI6Hu5om5zhp2YtSCeB0mmLUQ';

const slugMatch = /\/addon\/([^\/]+)\//;

const templates = {
  results: {
    addon: $('#search-result-addon'),
    general: $('#search-result-general'),
    empty: $('#search-result-empty')
  }
}

function stamp(template, cb) {
  let el = document.importNode(template.content, true);
  cb(sel => el.querySelector(sel));
  return el;
}

function $(selector, parent=document) {
  return parent.querySelector(selector);
}

function loadData() {
  let url = `https://spreadsheets.google.com/feeds/list/${sheetId}/1/public/full?alt=json`;

  return fetch(url).then(r => r.json());
}

function buildIndex(data) {
  let b = new lunr.Builder();
  
  b.field('name');
  b.ref('name');

  let addons = {};
  
  data.feed.entry.forEach(e => {
    let record = process(e);
    b.add(record);
    addons[record.name] = record;
  });
  
  let idx = b.build();
  return { idx, addons };  
}

function init({ idx, addons }) {
  let input = $('input');
  let outEl = $('.out');
  let allAddons = Object.values(addons).sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1);
  
  function search(query) {
    let results, out;
    if (query) {
      results = idx.search('*' + query + '*');
      out = results.map(r => addons[r.ref]);
    } else {
      out = allAddons;
    }
    
    outEl.innerHTML = '';
    
    if (out.length) {
      out.forEach(r => outEl.appendChild(resultRow(r)));
    } else {
      outEl.appendChild(emptyResult(query));
    }
  }
    
  input.addEventListener('input', function (e) {
    let query = input.value.trim();
    search(query);
  }, { passive: true });
  
  input.setAttribute('placeholder', 'name of legacy extension');
  input.disabled = false;
  
  let loc = new URL(window.location);
  
  let query = loc.searchParams.get('q') || input.value;
  
  if (query) {
    input.value = query;
    search(query);
  } else {
    search();
  }
  
  input.focus();
}

function resultRow(result) {
  if (result.suggested.slug) {
    return addonResult(result);
  }
  return generalResult(result);
}

let cachedAddons = {};

function getAddonData(slug) {
  return new Promise((resolve, reject) => {
    if (slug in cachedAddons) {
      resolve(cachedAddons[slug]);
    } else {
      let p = fetch(`https://addons.mozilla.org/api/v3/addons/addon/${slug}/`).then(r => r.json())
      p.then(data => cachedAddons[slug] = p);
      resolve(p);
    }
  });
}

function addonResult(result) {
  return stamp(templates.results.addon, $ => {
    $('.legacy-name').textContent = result.name;
    $('.alt-name').textContent = result.suggested.name;
    $('.cta .button').setAttribute('href', result.suggested.url);
    
    let authorEl = $('.alt-author');
    let iconEl = $('.icon');
    
    getAddonData(result.suggested.slug)
    .then(data => {
      authorEl.textContent = data.authors.map(a => a.name).join(', ');
      iconEl.src = data.icon_url;
    }).catch(console.error);
  });
}

function generalResult(result) {
  return stamp(templates.results.general, $ => {
    $('.legacy-name').textContent = result.name;
    $('.alt-name').textContent = result.suggested.name;
    $('.cta .button').setAttribute('href', result.suggested.url);    
  });
}

function emptyResult(query) {
  return stamp(templates.results.empty, $=> {
    $('.query').textContent = query;
    $('.button').href = `https://addons.mozilla.org/firefox/search/?q=${query}&appver=57.0`;
  });
}

function process(entry) {
  let obj = {
    name: entry.gsx$legacycontent.$t,
    suggested: {
      name: entry.gsx$webextensionreplacement.$t,
      url: entry.gsx$url.$t
    }
  };
  
  let match = obj.suggested.url.match(slugMatch);
  
  if (match) {
    obj.suggested.slug = match[1];
  }
  
  return obj;
}

window.addEventListener('load', function (e) {
  loadData().then(buildIndex).then(init);
});
