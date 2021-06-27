/* global lunr */

async function dataToJSON(data) {
  let entries = [];
  
  let lines = data.split(/\r\n|\n/);
  let i = 0;

  do
   {
    let entry = {};
    while (i < lines.length) {
      i++;
      let line = lines[i-1].trim();

      // End of Block
      if (line.startsWith("---")) {
        break;
      }
      // Skip comments.
      if (line.startsWith("#")) {
        continue;
      }
      let parts = line.split(":");
      let key = parts.shift().trim();
      if (key) {
        let value = parts.join(":").trim();
        entry[key] = value;
      }
    }

    // Add found entry.
    if (Object.keys(entry).length > 0) {
      entries.push(entry);
    }
  } while (i < lines.length);
  
  return entries;
}

//const slugMatch = /\/addon\/([^\/]+)\//;

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
  // const sheetId = '1ZzheVRDnEpAwdQ3eHDVI6Hu5om5zhp2YtSCeB0mmLUQ';
  // let url = `https://spreadsheets.google.com/feeds/list/${sheetId}/1/public/full?alt=json`;
  let url = "https://raw.githubusercontent.com/thundernest/extension-finder/master/data.yaml"
  return fetch(url).then(r => r.text()).then(dataToJSON);
}

function buildIndex(data) {
  let b = new lunr.Builder();
  
  b.field('name'); //search field
  b.ref('idx'); // unique index reference

  let addons = {};
  
  // data.feed.entry.forEach(e => {
  data.forEach(e => {
    let record = process(e);
    b.add(record);
    addons[record.idx] = record;
  });
  
  let idx = b.build();
  console.log({idx, addons})
  return { idx, addons };  
}

function process(entry) {
  let obj = {
    idx: entry["r_name"],//.gsx$legacycontent.$t,
    name: entry["u_name"],//.gsx$legacycontent.$t,
    suggested: {
      name: entry["r_name"],//.gsx$webextensionreplacement.$t,
      url: entry["r_link"],//.gsx$url.$t
      slug: entry["r_id"],
    }
  };
  
  /*let match = obj.suggested.url.match(slugMatch);
  
  if (match) {
    obj.suggested.slug = match[1];
  }*/
  
  return obj;
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
  
  input.setAttribute('placeholder', 'name of unmaintained extension');
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
      let p = fetch(`https://addons.thunderbird.net/api/v4/addons/addon/${slug}/`).then(r => r.json())
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
    $('.button').href = `https://addons.thunderbird.net/search/?q=${query}&appver=78.0`;
  });
}



window.addEventListener('load', function (e) {
  loadData().then(buildIndex).then(init);
});
