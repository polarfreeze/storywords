import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = fs.existsSync(path.join(root, 'docs/index.html')) ? path.join(root, 'docs') : root;
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(site, 'stories.js'), 'utf8'), context);
const data = context.window.STORYWORDS;
assert.equal(data.stories.length, 100);
assert.equal(data.uniqueWords, 3850);
let occurrences = 0;
let entries = 0;
const unique = new Set();
for (const [i,story] of data.stories.entries()) {
  assert.equal(story.id, i + 1);
  assert.ok(story.title && story.paragraphs.length >= 2);
  assert.ok(story.paragraphs.every(p=>p.length>20 && !/^Step\d|^Story\d/.test(p)));
  const alternatives = [...story.words].sort((a,b)=>b[0].length-a[0].length).map(w=>w[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const matches = [...story.paragraphs.join('\n').matchAll(new RegExp('(?<![A-Za-z])('+alternatives+')（([^（）]+)）','gi'))];
  const found = new Set(matches.map(m=>m[1].toLowerCase()));
  for(const [word,meaning] of story.words) {
    assert.ok(word && meaning && found.has(word.toLowerCase()),`Missing ${word} in story ${story.id}`);
    unique.add(word.toLowerCase()); entries++;
  }
  occurrences += matches.length;
}
assert.equal(unique.size, data.uniqueWords);
assert.equal(entries, data.totalEntries);
assert.equal(entries, 8675);
assert.equal(occurrences, 10367);
const html = fs.readFileSync(path.join(site,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))assert.ok(fs.existsSync(path.join(site,match[1])),`Missing asset ${match[1]}`);
for(const name of ['app.js','sw.js'])new vm.Script(fs.readFileSync(path.join(site,name),'utf8'),{filename:name});
console.log(JSON.stringify({status:'passed',stories:100,paragraphs:data.stories.reduce((n,s)=>n+s.paragraphs.length,0),vocabularyEntries:entries,uniqueWords:unique.size,wordOccurrences:occurrences}));
