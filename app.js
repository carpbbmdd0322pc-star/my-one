'use strict';
const STORAGE_KEY = 'kotoba-articles-v1';
const statuses = ['構成作成', '執筆中', '確認待ち', '納品済み'];
const $ = (selector) => document.querySelector(selector);
let articles = [];
let activeFilter = 'all';
let editingId = null;
let storageHealthy = true;
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date) && date.toISOString().slice(0, 10) === value;
}
function validArticle(a) {
  return a && typeof a.id === 'string' && typeof a.client === 'string' && a.client.trim() && typeof a.title === 'string' && a.title.trim() && validDate(a.deadline) && statuses.includes(a.status);
}
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(validArticle) || new Set(saved.map(a => a.id)).size !== saved.length) throw new Error('Invalid data');
    articles = saved;
  }
} catch {
  storageHealthy = false;
  $('#notice').textContent = '保存データを読み込めませんでした。元のデータを保護するため保存を停止しています。ブラウザの設定をご確認ください。';
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const overdue = (a) => a.status !== '納品済み' && a.deadline < today();
function save(next) {
  if (!storageHealthy) return false;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); articles = next; return true; }
  catch { $('#notice').textContent = '保存できませんでした。ブラウザの保存設定や空き容量を確認してください。'; return false; }
}
function element(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function render() {
  $('#total-count').replaceChildren(document.createTextNode(articles.length), element('small', '', '件'));
  $('#active-count').replaceChildren(document.createTextNode(articles.filter(a => a.status !== '納品済み').length), element('small', '', '件'));
  $('#overdue-count').replaceChildren(document.createTextNode(articles.filter(overdue).length), element('small', '', '件'));
  $('#done-count').replaceChildren(document.createTextNode(articles.filter(a => a.status === '納品済み').length), element('small', '', '件'));
  const query = $('#search').value.trim().toLocaleLowerCase();
  const visible = articles.filter(a => (activeFilter === 'all' || a.status === activeFilter) && `${a.title} ${a.client}`.toLocaleLowerCase().includes(query)).sort((a,b) => a.deadline.localeCompare(b.deadline));
  $('#result-count').textContent = `${visible.length}件`;
  $('#article-list').replaceChildren();
  $('#empty-state').hidden = visible.length > 0;
  $('#empty-state h3').textContent = articles.length ? '該当する記事がありません' : '最初の記事を登録しましょう';
  $('#empty-state p').textContent = articles.length ? '検索キーワードやステータスを変更してください。' : 'クライアントと納期を登録して、制作を少しずつ前へ。';
  $('#empty-add').hidden = articles.length > 0;
  for (const a of visible) {
    const row = element('article', 'article');
    const details = element('div', 'article-details');
    details.append(element('h3', 'article-title', a.title), element('div', 'client-name', a.client));
    const date = element('div', 'deadline' + (overdue(a) ? ' late' : ''));
    const time = element('time', '', a.deadline.replaceAll('-', '/')); time.dateTime = a.deadline; date.append(time);
    if (overdue(a)) date.append(element('small', '', '納期を過ぎています'));
    else if (a.deadline === today() && a.status !== '納品済み') date.append(element('small', '', '今日が納期です'));
    const state = element('div', 'article-status'); const badge = element('span', 'badge', a.status); badge.dataset.status = a.status; state.append(badge);
    const actions = element('div', 'row-actions');
    const edit = element('button', '', '編集'); edit.type = 'button'; edit.setAttribute('aria-label', `${a.title}を編集`); edit.addEventListener('click', () => openForm(a));
    const remove = element('button', 'delete', '削除'); remove.type = 'button'; remove.setAttribute('aria-label', `${a.title}を削除`);
    remove.addEventListener('click', () => {
      if (confirm(`「${a.title}」を削除しますか？この操作は元に戻せません。`) && save(articles.filter(item => item.id !== a.id))) { render(); $('#notice').textContent = '記事を削除しました。'; $('#add-button').focus(); }
    });
    actions.append(edit, remove); row.append(details, date, state, actions); $('#article-list').append(row);
  }
}
function openForm(article) {
  editingId = article?.id ?? null;
  $('#article-form').reset();
  $('#dialog-title').textContent = article ? '記事を編集' : '新しい記事';
  $('#form-error').textContent = '';
  if (article) for (const key of ['client', 'title', 'deadline', 'status']) $(`#${key}`).value = article[key];
  $('#article-dialog').showModal();
  $('#client').focus();
}
$('#add-button').addEventListener('click', () => openForm());
$('#empty-add').addEventListener('click', () => openForm());
for (const id of ['close-dialog', 'cancel-dialog']) $(`#${id}`).addEventListener('click', () => $('#article-dialog').close());
$('#article-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const article = {id: editingId ?? crypto.randomUUID(), client: $('#client').value.trim(), title: $('#title').value.trim(), deadline: $('#deadline').value, status: $('#status').value};
  if (!validArticle(article)) { $('#form-error').textContent = 'クライアント名・記事タイトル・正しい納期を入力してください。'; return; }
  const next = editingId ? articles.map(a => a.id === editingId ? article : a) : [...articles, article];
  if (!save(next)) { $('#form-error').textContent = '保存できません。ブラウザの保存設定をご確認ください。入力内容はそのまま残っています。'; return; }
  render(); $('#article-dialog').close(); $('#notice').textContent = '記事を保存しました。';
});
$('#search').addEventListener('input', render);
for (const button of document.querySelectorAll('.filter')) button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  for (const b of document.querySelectorAll('.filter')) { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }
  render();
});
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) location.reload();
});
render();
