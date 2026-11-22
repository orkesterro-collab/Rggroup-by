(() => {
  'use strict';

  const recipient = 'info@rggroup.by';
  const subject = 'Проект на расчёт — РГ Групп';
  const maxFileSize = 8 * 1024 * 1024;
  let dialog;
  let trigger;

  function encodeBytes(bytes) {
    const parts = [];
    // Keep chunks divisible by three so their base64 streams can be joined.
    const chunkSize = 3 * 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      parts.push(btoa(String.fromCharCode(...bytes.subarray(i, i + chunkSize))));
    }
    return parts.join('');
  }

  function encodeText(text) {
    return encodeBytes(new TextEncoder().encode(text));
  }

  function mimeLines(base64) {
    return base64.match(/.{1,76}/g)?.join('\r\n') || '';
  }

  function disposition(name) {
    const safeName = (name.split(/[\\/]/).pop() || 'project')
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim() || 'project';
    const ascii = safeName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^[_ .-]+|[_ .-]+$/g, '');
    const fallback = /^[a-z0-9]+$/i.test(ascii) && safeName !== ascii && /\.[a-z0-9]{1,10}$/i.test(safeName)
      ? 'project.' + safeName.split('.').pop().toLowerCase() : (ascii || 'project');
    const pieces = [];
    let current = '';
    // Keep each Unicode scalar and each UTF-8 percent sequence on one header line.
    for (const char of safeName) {
      const encoded = encodeURIComponent(char).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      if ((current + encoded).length > 45) {
        pieces.push(current);
        current = '';
      }
      current += encoded;
    }
    pieces.push(current);
    const filenameParams = pieces.length === 1
      ? [" filename*=UTF-8''" + pieces[0]]
      : pieces.map((value, index) => ' filename*' + index + '*=' + (index === 0 ? "UTF-8''" : '') + value);
    return ['Content-Disposition: attachment', ...filenameParams, ' filename="' + fallback.slice(0, 64) + '"'].join(';\r\n');
  }

  function draftFile(file, bytes, message) {
    const nonce = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('');
    const boundary = 'rg_project_' + nonce;
    const type = /^[a-z0-9+.-]+\/[a-z0-9+.-]+$/i.test(file.type) ? file.type : 'application/octet-stream';
    const body = message.replace(/\r\n|\r|\n/g, '\r\n');
    const fields = [
      'X-Unsent: 1', 'To: ' + recipient, 'Subject: =?UTF-8?B?' + encodeText(subject) + '?=',
      'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + boundary + '"',
      '', '--' + boundary, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64',
      '', mimeLines(encodeText(body)), '--' + boundary, 'Content-Type: ' + type,
      'Content-Transfer-Encoding: base64', disposition(file.name), '', mimeLines(encodeBytes(bytes)), '--' + boundary + '--', ''
    ];
    return new Blob([fields.join('\r\n')], { type: 'message/rfc822' });
  }

  function createDialog() {
    const el = document.createElement('dialog');
    if (typeof el.showModal !== 'function') return null;
    el.id = 'rg-request';
    el.className = 'rg-request';
    el.setAttribute('aria-labelledby', 'rg-request-title');
    el.innerHTML = `
      <div class="rg-request__inner">
        <button class="rg-request__close" type="button" aria-label="Закрыть окно"><span aria-hidden="true">×</span></button>
        <h2 id="rg-request-title" tabindex="-1" autofocus>Отправить проект инженеру</h2>
        <p class="rg-request__intro">Опишите объект и задачу. Письмо будет адресовано <a href="mailto:info@rggroup.by">info@rggroup.by</a>.</p>
        <form class="rg-request__form">
          <label class="rg-request__label" for="rg-task">Что нужно рассчитать?</label>
          <textarea id="rg-task" rows="3" maxlength="1800" required placeholder="Например, вентиляцию склада в Минске. Площадь — 1 200 м²."></textarea>
          <label class="rg-request__label" for="rg-reply">Ваш контакт <span>по желанию</span></label>
          <input id="rg-reply" type="text" maxlength="180" placeholder="Имя, телефон или электронная почта">
          <label class="rg-request__label" for="rg-file">Файл проекта <span>по желанию, до 8 МБ</span></label>
          <div class="rg-request__file-row">
            <input id="rg-file" type="file" aria-describedby="rg-file-error">
            <button class="rg-request__text" type="button" data-clear-file hidden>Убрать</button>
          </div>
          <p class="rg-request__error" id="rg-file-error" role="alert" hidden></p>
          <p class="rg-request__hint" data-hint></p>
          <div class="rg-request__actions">
            <button class="rg-request__primary" type="submit">Открыть в почте</button>
            <button class="rg-request__text" type="button" data-copy>Скопировать заявку</button>
          </div>
          <p class="rg-request__status" role="status" aria-live="polite"></p>
          <textarea class="rg-request__manual" aria-label="Текст для ручного копирования" rows="4" readonly hidden></textarea>
        </form>
      </div>`;
    document.body.append(el);
    const form = el.querySelector('form');
    const task = el.querySelector('#rg-task');
    const contact = el.querySelector('#rg-reply');
    const fileInput = el.querySelector('#rg-file');
    const clear = el.querySelector('[data-clear-file]');
    const error = el.querySelector('#rg-file-error');
    const primary = el.querySelector('[type=submit]');
    const hint = el.querySelector('[data-hint]');
    const status = el.querySelector('[role=status]');
    const manual = el.querySelector('.rg-request__manual');

    function updateFile() {
      const file = fileInput.files[0];
      const tooLarge = !!file && file.size > maxFileSize;
      error.hidden = !tooLarge;
      error.textContent = tooLarge ? 'Файл больше 8 МБ. Выберите меньший файл или добавьте ссылку на него в описание.' : '';
      fileInput.setCustomValidity(error.textContent);
      fileInput.setAttribute('aria-invalid', String(tooLarge));
      primary.textContent = file ? 'Скачать письмо с файлом' : 'Открыть в почте';
      hint.textContent = file
        ? 'Скачайте черновик (.eml), откройте его в почтовой программе и нажмите «Отправить». Если почта откроет файл для просмотра, скопируйте заявку в новое письмо и прикрепите исходный файл.'
        : 'Почтовая программа откроет черновик. Вы сможете проверить текст и отправить его.';
      clear.hidden = !file;
      status.textContent = '';
      manual.hidden = true;
    }

    function message() {
      const paragraphs = ['Здравствуйте!', task.value.trim()];
      if (contact.value.trim()) paragraphs.push('Для связи: ' + contact.value.trim());
      return paragraphs.join('\n\n');
    }

    function validTask() {
      task.setCustomValidity(task.value.trim() ? '' : 'Опишите задачу.');
      return task.reportValidity();
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!validTask() || !form.reportValidity()) return;
      const file = fileInput.files[0];
      const text = message();
      if (!file) {
        window.location.href = 'mailto:' + recipient + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
        return;
      }
      primary.disabled = true;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const url = URL.createObjectURL(draftFile(file, bytes, text));
        const save = document.createElement('a');
        save.href = url;
        save.download = 'RG-Group-project.eml';
        el.append(save);
        save.click();
        save.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        status.textContent = 'Откройте файл RG-Group-project.eml в почтовой программе для отправки.';
      } catch {
        status.textContent = 'Не удалось подготовить вложение. Скопируйте заявку в письмо и прикрепите файл в своей почте.';
      } finally {
        primary.disabled = false;
      }
    });
    fileInput.addEventListener('change', updateFile);
    clear.addEventListener('click', () => {
      fileInput.value = '';
      updateFile();
      fileInput.focus();
    });
    task.addEventListener('input', () => task.setCustomValidity(''));
    el.querySelector('[data-copy]').addEventListener('click', async () => {
      if (!validTask()) return;
      const file = fileInput.files[0];
      const text = 'Кому: ' + recipient + '\nТема: ' + subject + '\n\n' + message() +
        (file ? '\n\nВложение: ' + file.name : '');
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = 'Адрес и текст заявки скопированы.';
      } catch {
        manual.hidden = false;
        manual.value = text;
        manual.focus();
        manual.select();
        status.textContent = 'Текст выделен. Скопируйте его в почту.';
      }
    });

    el.querySelector('.rg-request__close').addEventListener('click', () => el.close());
    el.addEventListener('click', event => {
      if (event.target === el) {
        const bounds = el.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) el.close();
      }
    });
    el.addEventListener('close', () => {
      document.documentElement.classList.remove('rg-request-open');
      trigger?.focus({ preventScroll: true });
    });
    updateFile();
    return el;
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('[data-request]');
    if (!link) return;
    dialog ||= createDialog();
    if (!dialog) return;
    event.preventDefault();
    trigger = link;
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('rg-request-open');
      dialog.querySelector('#rg-request-title').focus({ preventScroll: true });
    }
  });
})();
