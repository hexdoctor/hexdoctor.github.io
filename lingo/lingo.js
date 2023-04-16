function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)]
}

// Compares the guessed word G with the mystery word M and
// returns and array with either 'right', 'another' or false
// Example: compareWords("tax", "cat") => ['another', 'right', false]
function compareWords(G, M) {
    const res = [...G].map((ai, i) => ai === M[i] ? 'right' : false)
    const tmp = res.map(Boolean)
    const N = res.length
    for (let i = 0; i < N; ++i) {
        for (let j = 0; j < N; ++j) {
            if (!res[i] && !tmp[j] && G[i] == M[j]) {
                res[i] = 'another'
                tmp[j] = true
            }
        }
    }
    return res
}

function Lingo(LANG, WORDSIZE, boardEl, statsEl, keyboardEl) {
    const LETTERS = LINGO[LANG].letters.join('').toUpperCase()
    const DICTIONARY = LINGO[LANG].dictionaries[WORDSIZE]
    const RETRIES = LINGO[LANG].retries[WORDSIZE]

    const board = LingoBoard(boardEl, WORDSIZE, RETRIES, LETTERS, onSubmit)
    const stats = LingoStats(statsEl, WORDSIZE)
    LingoKeyboard(keyboardEl, LINGO[LANG].letters)

    let mysteryWord, hintLetters;
    function nextWord() {
        mysteryWord = randomItem(DICTIONARY).toUpperCase()
        hintLetters = Array(WORDSIZE).fill()
        hintLetters[0] = mysteryWord[0]
        console.log(mysteryWord)

        board.clear()
        board.setHint(hintLetters)
        board.enableInput()
    }

    nextWord()

    async function onSubmit(word, isLastWord) {
        if (DICTIONARY.includes(word.toLowerCase())) {
            const result = compareWords(word, mysteryWord)
            board.showResult(result)
            if (word == mysteryWord) { // Correct word
                if (!isLastWord) stats.addLife()
                stats.addScore(100)
                await board.pause()
                nextWord()
            } else if (isLastWord) { // No more tries
                await board.pause()
                board.setWord(mysteryWord)
                board.showResult(Array(WORDSIZE).fill('right'))
                stats.takeLife()
                if (stats.hasLife()) {
                    await board.pause(2000)
                    nextWord()
                } else {
                    board.disableInput()
                }
            } else { // Try again
                board.nextWord()
                hintLetters = hintLetters.map((letter, i) => (
                    result[i] == 'right' ? mysteryWord[i] : letter
                ))
                board.setHint(hintLetters)
            }
        } else { // Illegal word
            board.showResult(Array(WORDSIZE).fill('wrong'))
            board.disableInput()
            await board.pause()
            if(stats.hasLife(2)) stats.takeLife()
            board.enableInput()
            board.clearWord()
        }
    }
}

function LingoStats(statsEl, LIVESMAX, life = 0, score = 0) {
    const lifeEl = statsEl.querySelector('.life')
    const scoreEl = statsEl.querySelector('.score')
    addLife(2)
    addScore(0)

    function addLife(n = 1) {
        life = Math.max(0, Math.min(life + n, LIVESMAX))
        lifeEl.textContent = life ? '♥'.repeat(life) : 'Game Over'
    }

    function takeLife(n = 1) {
        addLife(-n)
    }

    function hasLife(n = 1) {
        return life >= n
    }

    function addScore(n) {
        score += n
        scoreEl.textContent = score
    }

    return { addLife, takeLife, hasLife, addScore }
}

function LingoKeyboard(keyboardEl, LETTERS) {
    // for (const row of LETTERS) {
    //     for (const letter of row) {
    //         const button = document.createElement("button")
    //         button.textContent = letter
    //         keyboardEl.appendChild(button)
    //     }
    // }
}

function LingoBoard(boardEl, WORDSIZE, RETRIES, LETTERS, handleSubmit) {
    let cursorMin, cursorMax, cursorAt
    let word = ""
    let hintLetters = []

    boardEl.style.gridTemplateColumns = `repeat(${WORDSIZE}, 1fr)`
    while (boardEl.lastElementChild) {
        boardEl.removeChild(boardEl.lastElementChild);
    }

    const tileElems = [], letterElems = []
    let N = WORDSIZE * RETRIES
    while (N--) {
        const tile = document.createElement("div")
        const letter = document.createElement("div")
        tile.classList.add('tile')
        letter.classList.add('letter')
        tile.appendChild(letter)
        boardEl.appendChild(tile)
        tileElems.push(tile)
        letterElems.push(letter)
    }

    const clearLetter = (el) => {
        el.textContent = ''
        el.classList.remove('right', 'wrong', 'another')
    }

    function clear() {
        word = ""
        cursorMin = 0
        cursorMax = WORDSIZE
        cursorAt = cursorMin
        hintLetters = []
        letterElems.forEach(clearLetter)
    }

    function clearWord() {
        word = ""
        cursorAt = cursorMin
        for (let i = 0; i < WORDSIZE; ++i) {
            clearLetter(letterElems[cursorMin + i])
            tileElems[cursorMin + i].classList.remove('entered')
        }
        updateHint()
    }

    function setWord(word) {
        for (let i = 0; i < WORDSIZE; ++i) {
            letterElems[cursorMin + i].textContent = word[i]
            tileElems[cursorMin + i].classList.remove('entered')
        }
    }

    function nextWord() {
        cursorMin += WORDSIZE
        cursorMax += WORDSIZE
        clearWord()
    }

    function showResult(result) {
        for (let i = 0; i < WORDSIZE; ++i) {
            const res = result[i]
            if (res) letterElems[cursorMin + i].classList.add(res)
        }
    }

    function updateHint() {
        for (let i = 0; i < WORDSIZE; ++i) {
            letterElems[cursorMin + i].textContent ||= hintLetters[i]
        }
    }

    function insert(letter) {
        if (cursorAt < cursorMax) {
            letterElems[cursorAt].textContent = letter
            tileElems[cursorAt].classList.add('entered')
            word += letter
            cursorAt++
            updateHint()
        }
    }

    function deleteLetter() {
        if (cursorAt > cursorMin) {
            cursorAt--
            word = word.slice(0, -1)
            letterElems[cursorAt].textContent = ''
            tileElems[cursorAt]?.classList.remove('entered')
            updateHint()
        }
    }

    function onKeyInput(e) {
        e.preventDefault()
        switch (e.key) {
            case 'Enter':
                if (cursorAt == cursorMax) {
                    handleSubmit(word, cursorMax == letterElems.length)
                }
                break
            case 'Backspace':
                deleteLetter()
                break
            default:
                if (e.key.length == 1) {
                    const letter = e.key.toUpperCase()
                    if (cursorAt < cursorMax && LETTERS.includes(letter)) {
                        insert(letter)
                    }
                }
        }
    }

    function setHint(letters) {
        hintLetters = letters
        updateHint()
    }

    function enableInput() {
        window.onkeydown = onKeyInput
    }

    function disableInput() {
        window.onkeydown = undefined
    }

    function pause(timeout = 1000) {
        return new Promise(resolve => {
            window.setTimeout(resolve, timeout)
        })
    }

    return { clear, clearWord, setWord, nextWord, setHint, enableInput, disableInput, pause, showResult }
}
