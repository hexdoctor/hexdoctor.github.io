// Run at build time to generate words, e.g.
// $ node generate.js svenska 4

require('./index.js')
const fs = require('fs');
const readline = require('readline');

const [, , LANG, SIZE] = process.argv

const LETTERS = LINGO[LANG].letters.join('')
const INPUT = `${LANG}/all.txt`
const OUTPUT = `${LANG}/size${SIZE}.js`
const VARIABLE = `LINGO.${LANG}.dictionaries[${SIZE}]`

const letterIsValid = letter => LETTERS.includes(letter)
const wordIsValid = word => word.length == SIZE && [...word].every(letterIsValid)

async function generate() {
  console.log('Reading', INPUT)
  const readInput = readline.createInterface({
    input: fs.createReadStream(INPUT),
    crlfDelay: Infinity
  });

  const words = []
  for await (const word of readInput) {
    if (wordIsValid(word)) words.push(word)
  }

  fs.writeFileSync(OUTPUT, `${VARIABLE}=${JSON.stringify(words)}`);
  console.log('Written', words.length, 'words to', OUTPUT)
}

generate()