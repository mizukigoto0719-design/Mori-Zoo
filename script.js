(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
   * 0. 画像フォールバック
   *    images/ に実画像を置けばそのまま表示。無い場合は仮画像を表示。
   * ---------------------------------------------------------- */
  const hues = [140, 30, 200, 10, 90, 260];
  let hueIdx = 0;
  const placeholder = (img) => {
    const w = 800, h = 600;
    const hue = hues[hueIdx++ % hues.length];
    const label = (img.alt || 'IMAGE').replace(/[<>&]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},55%,78%)"/><stop offset="1" stop-color="hsl(${hue + 30},50%,58%)"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="44" font-weight="700" fill="rgba(255,255,255,.92)">${label}</text></svg>`;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  const guard = (img) => {
    if (img.dataset.fb) return;
    const apply = () => { img.dataset.fb = '1'; placeholder(img); };
    img.addEventListener('error', apply, { once: true });
    if (img.complete && img.naturalWidth === 0) apply();
  };
  $$('img').forEach(guard);

  /* ------------------------------------------------------------
   * 1. モーションタイポグラフィ（1文字ずつ登場）
   * ---------------------------------------------------------- */
  const splitText = (el) => {
    const label = el.textContent.replace(/\s+/g, '');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);
    let i = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!node.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      [...node.textContent.trim()].forEach((c) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.setAttribute('aria-hidden', 'true');
        s.style.setProperty('--i', i++);
        s.textContent = c;
        frag.appendChild(s);
      });
      node.replaceWith(frag);
    });
  };
  const splits = $$('[data-split]');
  splits.forEach(splitText);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  splits.forEach((el) => {
    if (el.hasAttribute('data-split-now')) requestAnimationFrame(() => setTimeout(() => el.classList.add('is-in'), 200));
    else io.observe(el);
  });

  /* ------------------------------------------------------------
   * 2. ハンバーガーメニュー
   * ---------------------------------------------------------- */
  const burger = $('#burger');
  const gnav = $('#gnav');
  const navBackdrop = $('#navBackdrop');
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    gnav.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
    if (open) {
      navBackdrop.hidden = false;
      requestAnimationFrame(() => navBackdrop.classList.add('is-show'));
    } else {
      navBackdrop.classList.remove('is-show');
      setTimeout(() => { if (!gnav.classList.contains('is-open')) navBackdrop.hidden = true; }, 300);
    }
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  navBackdrop.addEventListener('click', () => setMenu(false));
  $$('a', gnav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && gnav.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
  matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ------------------------------------------------------------
   * 3. パララックス
   * ---------------------------------------------------------- */
  const pxEls = $$('[data-parallax]');
  let ticking = false;
  const updateParallax = () => {
    const vh = innerHeight;
    pxEls.forEach((box) => {
      const r = box.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const speed = parseFloat(box.dataset.parallax) || 0.2;
      const offset = (r.top + r.height / 2 - vh / 2) * -speed;
      const img = $('img', box);
      if (img) img.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
    ticking = false;
  };
  if (!reduce) {
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateParallax); } }, { passive: true });
    addEventListener('resize', updateParallax);
    updateParallax();
  }

  /* ------------------------------------------------------------
   * 4. スライドショー
   * ---------------------------------------------------------- */
  (() => {
    const track = $('#track');
    if (!track) return; // スライダーが無いページでは何もしない
    const slides = $$('.slide', track);
    const dotsWrap = $('#dots');
    const prev = $('#prev'), next = $('#next'), toggle = $('#toggle');
    const root = $('#slider');
    let index = 0, per = 4, timer = null, playing = !reduce;

    const getPer = () => (matchMedia('(max-width:480px)').matches ? 1.18
      : matchMedia('(max-width:1000px)').matches ? 2 : 4);
    const maxIndex = () => Math.max(0, Math.ceil(slides.length - per));

    const buildDots = () => {
      dotsWrap.innerHTML = '';
      for (let i = 0; i <= maxIndex(); i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', `${i + 1}番目へ`);
        b.addEventListener('click', () => { go(i); restart(); });
        dotsWrap.appendChild(b);
      }
    };
    const render = () => {
      const w = slides[0].getBoundingClientRect().width;
      track.style.transform = `translateX(${-index * w}px)`;
      $$('button', dotsWrap).forEach((b, i) => b.setAttribute('aria-selected', String(i === index)));
      slides.forEach((s, i) => {
        const visible = i >= index && i < index + Math.ceil(per);
        s.setAttribute('aria-hidden', String(!visible));
        $$('button', s).forEach((b) => (b.tabIndex = visible ? 0 : -1));
      });
    };
    const go = (i) => {
      const m = maxIndex();
      index = i > m ? 0 : i < 0 ? m : i;
      render();
    };
    const start = () => { stop(); if (playing) timer = setInterval(() => go(index + 1), 4500); };
    const stop = () => { clearInterval(timer); timer = null; };
    const restart = () => start();

    prev.addEventListener('click', () => { go(index - 1); restart(); });
    next.addEventListener('click', () => { go(index + 1); restart(); });
    toggle.addEventListener('click', () => {
      playing = !playing;
      toggle.textContent = playing ? '⏸' : '▶';
      toggle.setAttribute('aria-pressed', String(!playing));
      toggle.setAttribute('aria-label', playing ? '自動再生を停止' : '自動再生を開始');
      start();
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { go(index - 1); restart(); }
      if (e.key === 'ArrowRight') { go(index + 1); restart(); }
    });

    // スワイプ
    let sx = 0, dx = 0, dragging = false;
    track.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX; dx = 0; });
    track.addEventListener('pointermove', (e) => { if (dragging) dx = e.clientX - sx; });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dx) > 50) { go(index + (dx < 0 ? 1 : -1)); restart(); }
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', (e) => { if (Math.abs(dx) > 8) { e.preventDefault(); e.stopPropagation(); } }, true);

    const layout = () => {
      per = getPer();
      buildDots();
      if (index > maxIndex()) index = maxIndex();
      render();
    };
    addEventListener('resize', layout);
    toggle.textContent = playing ? '⏸' : '▶';
    layout();
    start();
  })();

  /* ------------------------------------------------------------
   * 5. モーダルウィンドウ（<dialog>）
   * ---------------------------------------------------------- */
  (() => {
    const dlg = $('#modal');
    const content = $('#modalContent');
    if (!dlg) return; // モーダルが無いページでは何もしない
    const open = (tplId) => {
      const tpl = document.getElementById(tplId);
      if (!tpl) return;
      content.replaceChildren(tpl.content.cloneNode(true));
      $$('img', content).forEach(guard);
      dlg.setAttribute('aria-labelledby', 'modalTitle');
      document.body.classList.add('is-locked');
      dlg.showModal();
    };
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-modal]');
      if (t) { e.preventDefault(); open(t.dataset.modal); return; }
      if (e.target.closest('[data-close]')) dlg.close();
      else if (e.target === dlg) dlg.close(); // 背景クリック
    });
    // dialog内の余白(backdrop)判定
    dlg.addEventListener('click', (e) => {
      const r = $('.modal__box', dlg).getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close();
    });
    dlg.addEventListener('close', () => document.body.classList.remove('is-locked'));
  })();

  /* ------------------------------------------------------------
   * 6. アコーディオン
   *    [data-accordion] 内の .acc__btn / .acc__panel。data-single で1つだけ開く
   * ---------------------------------------------------------- */
  $$('[data-accordion]').forEach((acc) => {
    const single = acc.hasAttribute('data-single');
    const btns = $$('.acc__btn', acc);
    btns.forEach((btn, i) => {
      const panel = btn.closest('.acc__item').querySelector('.acc__panel');
      const id = `acc-${Math.random().toString(36).slice(2, 8)}-${i}`;
      panel.id = id;
      btn.setAttribute('aria-controls', id);
      panel.setAttribute('role', 'region');
      btn.addEventListener('click', () => {
        const willOpen = btn.getAttribute('aria-expanded') !== 'true';
        if (single && willOpen) {
          btns.forEach((b) => {
            if (b === btn) return;
            b.setAttribute('aria-expanded', 'false');
            b.closest('.acc__item').querySelector('.acc__panel').classList.remove('is-open');
          });
        }
        btn.setAttribute('aria-expanded', String(willOpen));
        panel.classList.toggle('is-open', willOpen);
      });
      btn.addEventListener('keydown', (e) => {
        const k = e.key;
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(k)) return;
        e.preventDefault();
        const n = btns.length;
        const to = k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowUp' ? (i - 1 + n) % n : k === 'Home' ? 0 : n - 1;
        btns[to].focus();
      });
    });
  });
})();


   function showClock() {
      let nowTime = new Date();
      let nowHour = nowTime.getHours();
      let nowMin  = nowTime.getMinutes();
      let nowSec  = nowTime.getSeconds();
      let msg = "現在時刻：" + nowHour + ":" + nowMin + ":" + nowSec;
      const clock = document.getElementById("realtime");
      if (clock) clock.innerHTML = msg;
    }
    setInterval(showClock, 1000);