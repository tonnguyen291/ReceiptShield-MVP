import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const matched = [...content.matchAll(/<button([^>]*?)>/g)];
console.log(matched.length, matched[0]);
