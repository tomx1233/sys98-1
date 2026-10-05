// "N online" in the status bar. Every open page pings once in a while; the server counts
// the pings from the last ~70 seconds. The id is random and only lives in this tab (sessionStorage).
(function () {
  var el = document.getElementById('onlineNow');
  if (!el) return;

  function makeId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  var id;
  try {
    id = sessionStorage.getItem('s98-pid');
    if (!id) { id = makeId(); sessionStorage.setItem('s98-pid', id); }
  } catch (e) { id = makeId(); }

  function show(n) {
    el.textContent = '';
    var dot = document.createElement('span');
    dot.className = 'status-dot';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(n + ' online'));
    el.hidden = false;
  }

  function beat() {
    if (document.hidden) return;
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id }),
      keepalive: true
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && typeof d.online === 'number') show(d.online); else el.hidden = true; })
      .catch(function () { el.hidden = true; });
  }

  beat();
  setInterval(beat, 45000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
})();
