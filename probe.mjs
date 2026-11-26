import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
db.prepare('INSERT INTO t (name) VALUES (?)').run('tomato');
console.log('sqlite-ok', JSON.stringify(db.prepare('SELECT * FROM t').all()));
console.log('express', !!import.meta.resolve('express'));
console.log('vite', !!import.meta.resolve('vite'));
console.log('react', !!import.meta.resolve('react'));
console.log('lucide', !!import.meta.resolve('lucide-react'));
