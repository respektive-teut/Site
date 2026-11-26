const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'music.db'));
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS music(id TEXT PRIMARY KEY, name TEXT, kind TEXT, description TEXT, category TEXT);
CREATE TABLE IF NOT EXISTS favorites(owner TEXT, music_id TEXT REFERENCES music(id), PRIMARY KEY(owner,music_id));
CREATE TABLE IF NOT EXISTS playlists(id INTEGER PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE, UNIQUE(owner,name));
CREATE TABLE IF NOT EXISTS tracks(playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE, music_id TEXT REFERENCES music(id), PRIMARY KEY(playlist_id,music_id));`);
const music = require('./music.json');
for (const [id,m] of Object.entries(music)) db.prepare('INSERT OR IGNORE INTO music VALUES(?,?,?,?,?)').run(id,m.name,m.kind,m.desc,m.category);
function fail(status,message){throw Object.assign(new Error(message),{status});}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)fail(413,'Завеликий запит.');}try{return JSON.parse(text);}catch{fail(400,'Некоректний JSON.');}}
function nameOf(value){if(typeof value!=='string'||!value.trim()||value.trim().length>60)fail(400,'Введіть назву від 1 до 60 символів.');return value.trim();}
function ownerOf(req,res){let owner=(req.headers.cookie||'').match(/(?:^|;\s*)plativka=([a-f0-9]{64})(?:;|$)/)?.[1];if(!owner){owner=crypto.randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`plativka=${owner}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${process.env.SECURE_COOKIE==='1'?'; Secure':''}`);}return owner;}
function listOf(owner){return db.prepare('SELECT id,name FROM playlists WHERE owner=? ORDER BY id').all(owner).map(p=>({...p,tracks:db.prepare('SELECT music_id FROM tracks WHERE playlist_id=?').all(p.id).map(t=>t.music_id)}));}
function playlist(owner,id){const p=db.prepare('SELECT id FROM playlists WHERE owner=? AND id=?').get(owner,id);if(!p)fail(404,'Плейлист не знайдено.');return p;}
function item(id,track=false){const m=db.prepare('SELECT * FROM music WHERE id=?').get(id);if(!m||(track&&m.category!=='tracks'))fail(400,'Запис не знайдено.');}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{const url=new URL(req.url,'http://localhost');const parts=url.pathname.split('/').filter(Boolean);const method=req.method;
 if(parts[0]!=='api'){if(method!=='GET')return send(405,{error:'Метод не підтримується.'});const file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!/^[\w-]+\.(html|css|js)$/.test(file))return send(404,{error:'Не знайдено.'});const full=path.join(__dirname,'public',file);if(!fs.existsSync(full))return send(404,{error:'Не знайдено.'});res.setHeader('Content-Type',({html:'text/html',css:'text/css',js:'text/javascript'})[file.split('.').pop()]+'; charset=utf-8');return res.end(fs.readFileSync(full));}
 const owner=ownerOf(req,res);const [,resource,id,sub,track]=parts;
 if(resource==='music'&&method==='GET'&&!id)return send(200,music);
 if(resource==='favorites'&&!id&&method==='GET')return send(200,db.prepare('SELECT music_id FROM favorites WHERE owner=?').all(owner).map(x=>x.music_id));
 if(resource==='favorites'&&id&&!sub){item(id);if(method==='PUT')db.prepare('INSERT OR IGNORE INTO favorites VALUES(?,?)').run(owner,id);else if(method==='DELETE')db.prepare('DELETE FROM favorites WHERE owner=? AND music_id=?').run(owner,id);else fail(405,'Метод не підтримується.');return send(200,{ok:true});}
 if(resource==='playlists'){
 if(!id&&method==='GET')return send(200,listOf(owner));
 if(!id&&method==='POST'){const name=nameOf((await body(req)).name);const result=db.prepare('INSERT INTO playlists(owner,name) VALUES(?,?)').run(owner,name);return send(201,{id:Number(result.lastInsertRowid),name,tracks:[]});}
 if(id&&/^\d+$/.test(id)){playlist(owner,Number(id));if(!sub&&method==='PATCH'){const name=nameOf((await body(req)).name);db.prepare('UPDATE playlists SET name=? WHERE id=?').run(name,id);return send(200,{ok:true});}if(!sub&&method==='DELETE'){db.prepare('DELETE FROM playlists WHERE id=?').run(id);return send(200,{ok:true});}if(sub==='tracks'&&track){item(track,true);if(method==='PUT')db.prepare('INSERT OR IGNORE INTO tracks VALUES(?,?)').run(id,track);else if(method==='DELETE')db.prepare('DELETE FROM tracks WHERE playlist_id=? AND music_id=?').run(id,track);else fail(405,'Метод не підтримується.');return send(200,{ok:true});}}}
 fail(404,'Маршрут не знайдено.');
 }catch(e){if(String(e.message).includes('UNIQUE constraint'))return send(409,{error:'Плейлист із такою назвою вже існує.'});if(!e.status)console.error(e);send(e.status||500,{error:e.status?e.message:'Помилка сервера.'});}
});
server.listen(Number(process.env.PORT||8000),()=>console.log('Платівка: http://localhost:'+server.address().port));
