async function api(url, method = 'GET', data) {
    const response = await fetch('/api/' + url, {method, headers: {'Content-Type':'application/json'}, body: data === undefined ? undefined : JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
}
async function start() {
const params = new URLSearchParams(location.search);
const get = id => document.getElementById(id);
const music = await api('music');
const favorites = await api('favorites');
const playlists = await api('playlists');
function message(text, error = false) {
    const box = get('message');
    box.textContent = text;
    box.classList.toggle('error', error);
}

const currentPage = location.pathname.split('/').pop() || 'index.html';
const category = document.querySelector('.categories');
const searchInput = document.querySelector('input[name="q"]');
if (category) {
    category.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const url = new URL(link.href);
        if (searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim());
        location.href = url.href;
    });
}
const activePage = ['artists.html', 'groups.html', 'albums.html', 'tracks.html'].includes(currentPage)
    ? 'tracks.html' : currentPage;
document.querySelectorAll('.header nav a').forEach(link => {
    if (link.getAttribute('href') === activePage) link.setAttribute('aria-current', 'page');
});


if (get('results')) {
    const search = document.querySelector('input[name="q"]');
    const filters = get('filter-form');
    search.value = params.get('q') || '';
    function filterRecords() {
        let count = 0;
        const query = search.value.trim().toLowerCase();
        document.querySelectorAll('#results .record').forEach(record => {
            const match = record.querySelector('h3').textContent.toLowerCase().includes(query)
                && ['genre', 'country', 'year'].every(key => !filters.elements[key].value || record.dataset[key] === filters.elements[key].value);
            record.hidden = !match;
            if (match) count++;
        });
        get('count').textContent = 'Знайдено: ' + count;
        get('empty').hidden = count !== 0;
    }
    search.addEventListener('input', filterRecords);
    search.form.addEventListener('submit', async event => { event.preventDefault(); filterRecords(); });
    filters.addEventListener('change', filterRecords);
    filters.addEventListener('submit', event => { event.preventDefault(); filterRecords(); });
    filters.addEventListener('reset', () => setTimeout(filterRecords, 0));
    filterRecords();
}

function record(name, description, url, remove) {
    const article = document.createElement('article');
    article.className = 'record';
    const info = document.createElement('div');
    info.className = 'record-info';
    const title = document.createElement('h3');
    const link = document.createElement('a');
    link.href = url;
    link.textContent = name;
    title.append(link);
    const text = document.createElement('p');
    text.textContent = description;
    info.append(title, text);
    article.append(info);
    if (remove) {
        const button = document.createElement('button');
        button.className = 'button secondary';
        button.textContent = 'Видалити';
        button.addEventListener('click', async () => { try { await remove(); } catch(e) { alert(e.message); } });
        article.append(button);
    }
    return article;
}
const saveButton = document.querySelector('[data-save]');
if (saveButton) {
    saveButton.addEventListener('click', async () => {
        const id = saveButton.dataset.save;
        if (favorites.includes(id)) return message('Цей запис уже в обраному.');
        try { await api('favorites/' + id, 'PUT'); } catch(e) { return message(e.message,true); }
        favorites.push(id);
        message('Запис додано до обраного.');
        saveButton.textContent = 'В обраному';
    });
    if (favorites.includes(saveButton.dataset.save)) saveButton.textContent = 'В обраному';
}
if (get('favorites')) {
    function showFavorites() {
        get('favorites').replaceChildren();
        favorites.forEach((id, index) => {
            const item = music[id];
            if (!item) return;
            get('favorites').append(record(item.name, item.kind, id + '.html', async () => {
                await api('favorites/' + id, 'DELETE');
                favorites.splice(index, 1);
                showFavorites();
            }));
        });
        get('empty-favorites').hidden = favorites.length !== 0;
    }
    showFavorites();
}
if (get('playlists')) {
    playlists.forEach((list, index) => get('playlists').append(record(list.name, 'Треків: ' + list.tracks.length, 'playlist.html?id=' + list.id)));
}
if (get('new-playlist')) {
    get('new-playlist').addEventListener('submit', async event => {
        event.preventDefault();
        const name = event.target.elements.name.value.trim();
        if (!name) return message('Введіть назву плейлиста.', true);
        if (name.length > 60) return message('Назва має містити не більше 60 символів.', true);
        if (playlists.some(list => list.name.toLowerCase() === name.toLowerCase())) return message('Плейлист із такою назвою вже існує.', true);
        try { const list = await api('playlists','POST',{name}); location.href = 'playlist.html?id=' + list.id; } catch(e) { message(e.message,true); }
    });
}
if (get('choose')) {
    const id = params.get('track');
    const form = get('choose');
    get('track-name').textContent = music[id]?.name || 'Трек не вибрано';
    playlists.forEach((list, index) => form.elements.playlist.add(new Option(list.name, list.id)));
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const list = playlists.find(p => p.id === Number(form.elements.playlist.value));
        if (!list || music[id]?.category !== 'tracks') return message('Оберіть трек і плейлист.', true);
        if (list.tracks.includes(id)) return message('Трек уже є у плейлисті.', true);
        try { await api('playlists/' + list.id + '/tracks/' + id,'PUT'); } catch(e) { return message(e.message,true); }
        location.href = 'playlist.html?id=' + form.elements.playlist.value;
    });
}
if (get('playlist-tracks')) {
    const list = params.has('id') ? playlists.find(p => p.id === Number(params.get('id'))) : undefined;
    if (list) {
        get('playlist-title').textContent = list.name;
        const form = document.createElement('form');
        const input = document.createElement('input'); input.value = list.name; input.maxLength = 60; input.setAttribute('aria-label','Нова назва плейлиста');
        const rename = document.createElement('button'); rename.className='button secondary'; rename.textContent='Перейменувати';
        const del = document.createElement('button'); del.type='button'; del.className='button secondary'; del.textContent='Видалити плейлист';
        const status = document.createElement('p'); status.setAttribute('role','status');
        form.append(input,rename,del,status); get('playlist-title').after(form);
        form.addEventListener('submit', async e => { e.preventDefault(); try { await api('playlists/'+list.id,'PATCH',{name:input.value}); get('playlist-title').textContent=input.value.trim(); status.textContent='Назву змінено.'; } catch(e){status.textContent=e.message;} });
        del.addEventListener('click', async () => { if(confirm('Видалити плейлист?')) { try { await api('playlists/'+list.id,'DELETE'); location.href='playlists.html'; } catch(e){status.textContent=e.message;} } });
        function showTracks() {
            get('playlist-tracks').replaceChildren();
            list.tracks.forEach((id, index) => {
                const item = music[id];
                if (!item) return;
                get('playlist-tracks').append(record(item.name, item.desc, id + '.html', async () => {
                    await api('playlists/' + list.id + '/tracks/' + id,'DELETE');
                    list.tracks.splice(index, 1);
                    showTracks();
                }));
            });
            get('empty-playlist').hidden = list.tracks.length !== 0;
        }
        showTracks();
    } else { get('playlist-title').textContent = 'Плейлист не знайдено'; }
}
if (get('login')) {
    const form = get('login');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const email = form.elements.email;
        const password = form.elements.password;
        if (!email.value.trim() || !email.validity.valid) {
            email.focus();
            return message('Введіть коректну електронну пошту.', true);
        }
        if (password.value.trim().length < 6) {
            password.focus();
            return message('Пароль має містити щонайменше 6 символів.', true);
        }
        message('Дані перевірено. Авторизація демонстраційна.');
        password.value = '';
    });
}

}
start().catch(error => { const p=document.createElement("p"); p.setAttribute("role","alert"); p.textContent="Не вдалося завантажити дані: "+error.message; document.querySelector("main").prepend(p); });
