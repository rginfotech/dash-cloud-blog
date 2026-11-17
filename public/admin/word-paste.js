/*
 * Keeps formatting when pasting from Word / Google Docs / web pages into the
 * Decap rich-text editor. Decap only keeps plain text from the clipboard, so
 * we turn the clipboard HTML into Slate nodes (headings, lists, bold, italic,
 * links, quotes) and hand them to the editor as a Slate fragment.
 */
(function () {
  var BLOCK_TAGS = /^(H[1-6]|P|UL|OL|LI|BLOCKQUOTE|TABLE|PRE)$/;
  var HEADINGS = { H1: 'heading-one', H2: 'heading-two', H3: 'heading-three', H4: 'heading-four', H5: 'heading-five', H6: 'heading-six' };

  function hasStructure(html) {
    return /<(h[1-6]|ul|ol|li|blockquote|b|strong|i|em|a|table)[\s>]/i.test(html) || /Mso(Heading|Title|ListParagraph)/i.test(html);
  }

  function cleanText(t) {
    return t.replace(/\u00a0/g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ');
  }

  // Inline content -> array of Slate text/link nodes with marks.
  function inline(node, marks, out) {
    node.childNodes.forEach(function (c) {
      if (c.nodeType === 3) {
        var t = cleanText(c.nodeValue);
        if (t) out.push(Object.assign({ text: t }, marks));
        return;
      }
      if (c.nodeType !== 1) return;
      var tag = c.tagName;
      var style = (c.getAttribute('style') || '').toLowerCase();
      if (/mso-list:\s*ignore/.test(style) || /^(STYLE|SCRIPT|META|LINK|XML)$/.test(tag) || /^O:/.test(tag) && tag !== 'O:P') return;
      if (tag === 'BR') { out.push(Object.assign({ text: ' ' }, marks)); return; }
      var m = Object.assign({}, marks);
      if (tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/.test(style)) m.bold = true;
      if (tag === 'I' || tag === 'EM' || /font-style:\s*italic/.test(style)) m.italic = true;
      if (tag === 'CODE') m.code = true;
      if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') m.delete = true;
      if (tag === 'A' && c.getAttribute('href') && !/^#/.test(c.getAttribute('href'))) {
        var kids = [];
        inline(c, m, kids);
        if (kids.length) out.push({ type: 'link', url: c.getAttribute('href'), data: { url: c.getAttribute('href') }, children: kids });
        return;
      }
      inline(c, m, out);
    });
    return out;
  }

  function tidy(children) {
    // trim leading/trailing spaces, merge neighbours, never return empty
    var out = [];
    children.forEach(function (n) {
      var last = out[out.length - 1];
      if (n.text !== undefined && last && last.text !== undefined &&
          !!last.bold === !!n.bold && !!last.italic === !!n.italic && !!last.code === !!n.code && !!last.delete === !!n.delete) {
        last.text += n.text;
      } else out.push(n);
    });
    if (out[0] && out[0].text !== undefined) out[0].text = out[0].text.replace(/^ +/, '');
    var l = out[out.length - 1];
    if (l && l.text !== undefined) l.text = l.text.replace(/ +$/, '');
    out = out.filter(function (n) { return n.text === undefined || n.text !== ''; });
    return out.length ? out : [{ text: '' }];
  }

  function plain(children) {
    return children.map(function (n) { return n.text !== undefined ? n.text : plain(n.children); }).join('');
  }

  function paragraph(el, type) {
    var kids = tidy(inline(el, {}, []));
    if (!plain(kids).trim()) return null;
    return { type: type || 'paragraph', children: kids };
  }

  function listItemNode(li) {
    var p = paragraph(li, 'paragraph');
    return { type: 'list-item', children: [p || { type: 'paragraph', children: [{ text: '' }] }] };
  }

  function listFromElement(el, nodes) {
    var items = [];
    Array.prototype.forEach.call(el.children, function (c) {
      if (c.tagName === 'LI') {
        // nested lists are flattened into the parent list
        var clone = c.cloneNode(true);
        Array.prototype.forEach.call(clone.querySelectorAll('ul,ol'), function (n) { n.parentNode.removeChild(n); });
        var item = listItemNode(clone);
        if (plain(item.children[0].children).trim()) items.push(item);
        Array.prototype.forEach.call(c.querySelectorAll(':scope > ul > li, :scope > ol > li'), function (n) {
          var sub = listItemNode(n);
          if (plain(sub.children[0].children).trim()) items.push(sub);
        });
      }
    });
    if (items.length) nodes.push({ type: el.tagName === 'OL' ? 'numbered-list' : 'bulleted-list', children: items });
  }

  var BULLET_RE = /^\s*([\u00b7\u2022\u25cf\u25aa\u25e6o\-*\u00a7\uf0b7\uf0a7])\s+/;
  var NUMBER_RE = /^\s*(\d+|[a-zA-Z]|[ivxIVX]+)[.)]\s+/;

  function convert(root) {
    var nodes = [];
    var pending = null; // word-style list being collected

    function flush() { if (pending) { nodes.push(pending); pending = null; } }

    function wordList(el) {
      var style = (el.getAttribute('style') || '').toLowerCase();
      var cls = el.getAttribute('class') || '';
      if (!/MsoListParagraph/i.test(cls) && !/mso-list:\s*l\d/.test(style)) return false;
      var clone = el.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll('[style*="mso-list:Ignore"],[style*="mso-list: Ignore"]'), function (n) { n.parentNode.removeChild(n); });
      Array.prototype.forEach.call(clone.querySelectorAll('o\\:p'), function (n) { n.parentNode.removeChild(n); });
      var text = el.textContent.replace(/\u00a0/g, ' ');
      var ordered = NUMBER_RE.test(text) && !BULLET_RE.test(text);
      var p = paragraph(clone, 'paragraph');
      if (!p) return true;
      // strip a leftover marker if Word did not wrap it in an "Ignore" span
      var first = p.children[0];
      if (first && first.text !== undefined) first.text = first.text.replace(BULLET_RE, '').replace(NUMBER_RE, '');
      var type = ordered ? 'numbered-list' : 'bulleted-list';
      if (!pending || pending.type !== type) { flush(); pending = { type: type, children: [] }; }
      pending.children.push({ type: 'list-item', children: [p] });
      return true;
    }

    function walk(parent) {
      Array.prototype.forEach.call(parent.childNodes, function (el) {
        if (el.nodeType === 3) {
          var t = cleanText(el.nodeValue).trim();
          if (t) { flush(); nodes.push({ type: 'paragraph', children: [{ text: t }] }); }
          return;
        }
        if (el.nodeType !== 1) return;
        var tag = el.tagName;
        if (/^(STYLE|SCRIPT|META|LINK|XML|HEAD)$/.test(tag)) return;
        if (tag === 'P' && wordList(el)) return;
        flush();
        if (HEADINGS[tag]) { var h = paragraph(el, HEADINGS[tag]); if (h) nodes.push(h); }
        else if (tag === 'P') {
          var cls = el.getAttribute('class') || '';
          var kind = /MsoTitle|MsoHeading1/i.test(cls) ? 'heading-two' : /MsoHeading[2-9]|MsoSubtitle/i.test(cls) ? 'heading-three' : 'paragraph';
          var p = paragraph(el, kind);
          if (p) nodes.push(p);
        }
        else if (tag === 'UL' || tag === 'OL') listFromElement(el, nodes);
        else if (tag === 'BLOCKQUOTE') { var q = paragraph(el, 'paragraph'); if (q) nodes.push({ type: 'quote', children: [q] }); }
        else if (tag === 'PRE') { var pr = el.textContent; if (pr.trim()) nodes.push({ type: 'paragraph', children: [{ text: pr, code: true }] }); }
        else if (tag === 'TABLE') {
          Array.prototype.forEach.call(el.querySelectorAll('tr'), function (tr) {
            var cells = Array.prototype.map.call(tr.children, function (c) { return cleanText(c.textContent).trim(); }).filter(Boolean);
            if (cells.length) nodes.push({ type: 'paragraph', children: [{ text: cells.join(' | ') }] });
          });
        }
        else if (BLOCK_TAGS.test(tag) || el.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote')) walk(el);
        else { var s = paragraph(el, 'paragraph'); if (s) nodes.push(s); }
      });
    }

    walk(root);
    flush();
    return nodes;
  }

  function htmlToSlate(html) {
    var m = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/);
    if (m) html = m[1];
    html = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '').replace(/<!\[if !supportLists\]>([\s\S]*?)<!\[endif\]>/g, '<span style="mso-list:Ignore">$1</span>');
    var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    return convert(doc.body);
  }

  document.addEventListener('beforeinput', function (e) {
    if (e.inputType !== 'insertFromPaste' || !e.dataTransfer) return;
    var target = e.target && e.target.closest && e.target.closest('[data-slate-editor="true"]');
    if (!target) return;
    var dt = e.dataTransfer;
    if (dt.getData('application/x-slate-fragment')) return; // copied inside the editor
    var html = dt.getData('text/html');
    if (!html || !hasStructure(html)) return;
    var nodes;
    try { nodes = htmlToSlate(html); } catch (err) { return; }
    if (!nodes.length) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var out = new DataTransfer();
    out.setData('application/x-slate-fragment', btoa(encodeURIComponent(JSON.stringify(nodes))));
    out.setData('text/plain', plain(nodes));
    target.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: out, bubbles: true, cancelable: true }));
  }, true);

  window.__htmlToSlate = htmlToSlate; // handy for debugging
})();
