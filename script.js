(function () {
  var config = window.LANDING_CONFIG || {};
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RATE_LIMIT_MS = 45000;
  var RATE_LIMIT_KEY = 'young_socios_last_submit_at';

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  function setLink(id, value, placeholderSuffix) {
    var el = document.getElementById(id);
    if (!el) return;

    var invalid = !value || value.indexOf('(Configurar') === 0;
    if (invalid) {
      el.href = '#';
      el.classList.add('pointer-events-none', 'opacity-60');
      if (placeholderSuffix && el.textContent.indexOf(placeholderSuffix) === -1) {
        el.textContent = el.textContent + ' ' + placeholderSuffix;
      }
      return;
    }

    el.href = value;
  }

  function toWhatsappUrl(phone, message) {
    if (!phone) return '';
    var cleanPhone = String(phone).replace(/[^\d]/g, '');
    if (!cleanPhone) return '';
    var text = encodeURIComponent(message || 'Hola! Quiero hacerme socio de Young Universitario.');
    return 'https://wa.me/' + cleanPhone + '?text=' + text;
  }

  function getUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || '',
    };
  }

  function normalizeCi(value) {
    return String(value || '')
      .replace(/[.\-\s]/g, '')
      .trim();
  }

  function setStatus(message, type) {
    var statusEl = document.getElementById('formStatus');
    if (!statusEl) return;

    statusEl.textContent = message || '';
    statusEl.classList.remove('text-zinc-700', 'text-clubRed', 'text-emerald-700');

    if (type === 'error') {
      statusEl.classList.add('text-clubRed');
    } else if (type === 'success') {
      statusEl.classList.add('text-emerald-700');
    } else {
      statusEl.classList.add('text-zinc-700');
    }
  }

  function setSubmitting(isSubmitting) {
    var button = document.getElementById('submitButton');
    if (!button) return;

    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? 'Enviando...' : 'Enviar datos';
  }

  function secondsRemaining() {
    var lastSubmitAt = Number(localStorage.getItem(RATE_LIMIT_KEY) || '0');
    if (!lastSubmitAt) return 0;

    var diff = Date.now() - lastSubmitAt;
    if (diff >= RATE_LIMIT_MS) return 0;

    return Math.ceil((RATE_LIMIT_MS - diff) / 1000);
  }

  function setMemberType(type) {
    var hidden = document.getElementById('memberTypeHidden');
    var newFields = document.getElementById('newMemberFields');
    var renewFields = document.getElementById('renewMemberFields');
    var carnetSection = document.getElementById('carnetSection');
    var newRequired = document.querySelectorAll('[data-required-new]');
    var renewRequired = document.querySelectorAll('[data-required-renew]');

    if (hidden) hidden.value = type;

    if (type === 'renovacion') {
      if (newFields) newFields.classList.add('hidden');
      if (renewFields) renewFields.classList.remove('hidden');
      if (carnetSection) carnetSection.classList.add('hidden');
      newRequired.forEach(function (el) {
        el.required = false;
      });
      renewRequired.forEach(function (el) {
        el.required = true;
      });
      setCarnetChoice(false);
    } else {
      if (newFields) newFields.classList.remove('hidden');
      if (renewFields) renewFields.classList.add('hidden');
      if (carnetSection) carnetSection.classList.remove('hidden');
      newRequired.forEach(function (el) {
        el.required = true;
      });
      renewRequired.forEach(function (el) {
        el.required = false;
      });
    }
  }

  function handleMemberTypeSwitch() {
    var radios = document.querySelectorAll('input[name="memberType"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function (event) {
        setMemberType(event.target.value);
      });
    });

    var checked = document.querySelector('input[name="memberType"]:checked');
    setMemberType(checked ? checked.value : 'nuevo');
  }

  function setCarnetChoice(enabled) {
    var carnetFields = document.getElementById('carnetFields');
    var carnetRequired = document.querySelectorAll('[data-required-carnet]');

    if (enabled) {
      if (carnetFields) carnetFields.classList.remove('hidden');
      carnetRequired.forEach(function (el) {
        el.required = true;
      });
    } else {
      if (carnetFields) carnetFields.classList.add('hidden');
      carnetRequired.forEach(function (el) {
        el.required = false;
      });
    }
  }

  function handleCarnetChoiceSwitch() {
    var radios = document.querySelectorAll('input[name="wants_carnet"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function (event) {
        setCarnetChoice(event.target.value === 'si');
      });
    });

    var checked = document.querySelector('input[name="wants_carnet"]:checked');
    setCarnetChoice(checked && checked.value === 'si');
  }

  function handleFaq() {
    var faqTriggers = document.querySelectorAll('.faq-trigger');
    faqTriggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq-item');
        if (!item) return;

        var isOpen = item.classList.contains('open');
        item.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  function handleReveal() {
    var revealItems = document.querySelectorAll('.reveal');
    if (reducedMotion) {
      revealItems.forEach(function (el) {
        el.classList.add('in');
      });
      return;
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );

      revealItems.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      revealItems.forEach(function (el) {
        el.classList.add('in');
      });
    }
  }

  function handleBenefitsCarousel() {
    var carousel = document.getElementById('benefitsCarousel');
    if (!carousel) return;

    var panels = Array.prototype.slice.call(carousel.querySelectorAll('.benefit-panel'));
    var dots = Array.prototype.slice.call(carousel.querySelectorAll('.benefit-dot'));
    var prev = document.getElementById('benefitPrev');
    var next = document.getElementById('benefitNext');
    if (!panels.length || !dots.length || panels.length !== dots.length) return;

    var current = 0;
    var timerId = null;
    var touchStartX = 0;
    var touchEndX = 0;

    function paint(index) {
      current = index;
      panels.forEach(function (panel, i) {
        panel.classList.toggle('active', i === current);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('active', i === current);
      });
    }

    function goNext() {
      paint((current + 1) % panels.length);
    }

    function goPrev() {
      paint((current - 1 + panels.length) % panels.length);
    }

    function restartTimer() {
      if (timerId) window.clearInterval(timerId);
      timerId = null;
      if (!reducedMotion) {
        timerId = window.setInterval(goNext, 3000);
      }
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        paint(i);
        restartTimer();
      });
    });

    if (prev) {
      prev.addEventListener('click', function () {
        goPrev();
        restartTimer();
      });
    }

    if (next) {
      next.addEventListener('click', function () {
        goNext();
        restartTimer();
      });
    }

    carousel.addEventListener(
      'touchstart',
      function (event) {
        touchStartX = event.changedTouches[0].clientX;
      },
      { passive: true }
    );

    carousel.addEventListener(
      'touchend',
      function (event) {
        touchEndX = event.changedTouches[0].clientX;
        var delta = touchEndX - touchStartX;
        if (Math.abs(delta) < 35) return;
        if (delta < 0) goNext();
        if (delta > 0) goPrev();
        restartTimer();
      },
      { passive: true }
    );

    paint(0);

    if (reducedMotion) return;

    timerId = window.setInterval(goNext, 3000);
    carousel.addEventListener('mouseenter', function () {
      if (timerId) window.clearInterval(timerId);
      timerId = null;
    });
    carousel.addEventListener('mouseleave', function () {
      if (!timerId) timerId = window.setInterval(goNext, 3000);
    });
  }

  async function submitForm(event) {
    event.preventDefault();

    var form = event.currentTarget;
    var formData = new FormData(form);
    var memberType = formData.get('member_type') || 'nuevo';

    if (formData.get('company')) {
      setStatus('No se pudo enviar. Probá nuevamente.', 'error');
      return;
    }

    if (!form.reportValidity()) {
      setStatus('Revisá los campos obligatorios.', 'error');
      return;
    }

    var remaining = secondsRemaining();
    if (remaining > 0) {
      setStatus('Esperá ' + remaining + ' segundos antes de volver a enviar.', 'error');
      return;
    }

    var submitEndpoint = config.BACKEND_API_URL || config.N8N_WEBHOOK_URL;
    if (!submitEndpoint || submitEndpoint.indexOf('(Configurar') === 0) {
      setStatus('Falta configurar BACKEND_API_URL en config.js.', 'error');
      return;
    }

    if (!config.FORM_KEY || config.FORM_KEY.indexOf('(Configurar') === 0) {
      setStatus('Falta configurar FORM_KEY en config.js.', 'error');
      return;
    }

    var rawCi = memberType === 'renovacion' ? formData.get('ci_renew') : formData.get('ci_new');
    var ci = normalizeCi(rawCi);

    if (!ci) {
      setStatus('Ingresá una cédula válida.', 'error');
      return;
    }

    if (/[^0-9]/.test(ci)) {
      setStatus('La cédula debe contener solo números (sin puntos ni guiones).', 'error');
      return;
    }

    var wantsCarnet = memberType === 'nuevo' ? String(formData.get('wants_carnet') || 'no') : 'no';
    var plan = String(formData.get('plan') || '').trim();
    if (plan !== 'semestral' && plan !== 'anual') {
      setStatus('Seleccioná un plan válido.', 'error');
      return;
    }

    var payload = {
      member_type: memberType,
      ci: ci,
      plan: plan,
      payment_ref: String(formData.get('payment_ref') || '').trim(),
      pageUrl: window.location.href,
    };

    if (memberType !== 'renovacion') {
      payload.nombre = String(formData.get('nombre') || '').trim();
      payload.telefono = String(formData.get('telefono_whatsapp') || '').trim();
      payload.email = String(formData.get('email') || '').trim();
      payload.wants_carnet = wantsCarnet;
      payload.birth_date = wantsCarnet === 'si' ? String(formData.get('birth_date') || '').trim() : '';
      payload.category = wantsCarnet === 'si' ? String(formData.get('category') || '').trim() : '';
    }

    var utm = getUtmParams();
    payload.utm_source = utm.utm_source;
    payload.utm_medium = utm.utm_medium;
    payload.utm_campaign = utm.utm_campaign;
    payload.utm_content = utm.utm_content;
    payload.utm_term = utm.utm_term;

    setSubmitting(true);
    setStatus('Enviando...', 'info');

    try {
      var response = await fetch(submitEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FORM-KEY': config.FORM_KEY,
        },
        body: JSON.stringify(payload),
      });

      var responseData = null;
      try {
        responseData = await response.json();
      } catch (parseError) {
        responseData = null;
      }

      if (responseData && responseData.ok === false) {
        throw new Error(responseData.message || 'No se pudo enviar. Intentá nuevamente.');
      }

      if (!response.ok) {
        var errorMessage =
          (responseData && responseData.message) || 'No se pudo enviar. Verificá tu conexión e intentá de nuevo.';
        throw new Error(errorMessage);
      }

      var successMessage =
        (responseData && responseData.ok === true && responseData.message) ||
        '¡Listo! Tus datos fueron enviados correctamente.';

      localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
      form.reset();
      setCarnetChoice(false);
      setMemberType('nuevo');
      setStatus(successMessage, 'success');
    } catch (error) {
      setStatus(error.message || 'Error inesperado al enviar el formulario.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function init() {
    setText('heroTitle', 'Hacete socio de ' + (config.CLUB_NAME || 'Young Universitario'));
    setText('heroBadge', 'Campaña de socios • ' + (config.CITY || 'Young, Uruguay'));
    setText('priceMonthly', config.PRICE_MONTHLY || '(Configurar precio)');
    setText('priceYearly', config.PRICE_YEARLY || '(Configurar precio)');

    setLink('instagramHero', config.INSTAGRAM_URL);
    setLink('payMonthly', config.MP_LINK_MONTHLY, '(Configurar link)');
    setLink('payYearly', config.MP_LINK_YEARLY, '(Configurar link)');

    var whatsappUrl = toWhatsappUrl(config.CONTACT_WHATSAPP, config.WHATSAPP_MESSAGE);
    setLink('whatsappFloat', whatsappUrl);

    var contactText = 'Instagram del club';
    if (config.CONTACT_WHATSAPP) {
      contactText = 'WhatsApp: ' + config.CONTACT_WHATSAPP;
    } else if (config.CONTACT_EMAIL) {
      contactText = 'Email: ' + config.CONTACT_EMAIL;
    }

    setText('contactText', contactText);

    var form = document.getElementById('socioForm');
    if (form) {
      form.addEventListener('submit', submitForm);
    }

    handleMemberTypeSwitch();
    handleCarnetChoiceSwitch();
    handleBenefitsCarousel();
    handleFaq();
    handleReveal();
  }

  init();
})();
