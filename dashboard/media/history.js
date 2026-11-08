(function () {
  'use strict';

  function esc(s, h) {
    return h.safe(String(s == null ? '' : s));
  }

  function formatted(text, h) {
    let out = esc(text, h);
    out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    return out.replace(/\n/g, '<br>');
  }

  function time(ts) {
    const date = new Date(ts);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function render(container, messages, info, h) {
    messages = Array.isArray(messages) ? messages : [];
    const last = messages.length ? messages[messages.length - 1] : null;
    const marker = JSON.stringify([info && info.sessionId, last && last.ts, last && String(last.text || '').length]);
    if (container.dataset.councilMarker === marker) return;
    const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 24;
    const oldTop = container.scrollTop;
    container.dataset.councilMarker = marker;
    if (!info) {
      container.innerHTML = '<div class="history-empty">Bitte oben eine Sitzung wählen.</div>';
      return;
    }
    let html = '<header class="history-header">' +
      '<div class="history-title">' + esc(info.title, h) + '</div>';
    if (info.cwd) html += '<div class="history-cwd">📁 ' + esc(info.cwd, h) + '</div>';
    html += '<button type="button" class="history-goto" data-goto>→ zum Tab</button></header>';
    html += '<div class="history-messages">';
    messages.forEach(function (message, index) {
      const user = message.role === 'user';
      const full = String(message.text || '');
      const long = full.split('\n').length > 12;
      const shown = long ? full.split('\n').slice(0, 12).join('\n') : full;
      html += '<div class="history-message ' + (user ? 'user' : 'assistant') + '">' +
        '<div class="history-bubble ' + (user ? 'user' : 'assistant') + '" data-bubble="' + index + '">' + formatted(shown, h) +
        (long ? '<br><button type="button" data-expand="' + index + '" class="history-expand">mehr anzeigen</button>' : '') + '</div>' +
        '<div class="history-time ' + (user ? 'user' : 'assistant') + '">' + esc(time(message.ts), h) + '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelector('[data-goto]').addEventListener('click', function () {
      h.post({ type: 'gotoTab', title: info.title });
    });
    container.querySelectorAll('[data-expand]').forEach(function (button) {
      button.addEventListener('click', function () {
        const index = Number(button.getAttribute('data-expand'));
        const bubble = container.querySelector('[data-bubble="' + index + '"]');
        bubble.innerHTML = formatted(messages[index].text || '', h);
      });
    });
    container.scrollTop = wasAtBottom ? container.scrollHeight : oldTop;
  }

  window.CouncilHistory = { render: render };
}());
