const searchParams = new URLSearchParams(window.location.search);

// Initialize Firebase
const FieldValue = firebase.firestore.FieldValue;
const app = firebase.initializeApp({
    apiKey: "AIzaSyALmCffmEd_nC3-JDbBLfjwNjxafSucohQ",
    authDomain: "chessaziz.firebaseapp.com",
    projectId: "chessaziz",
    storageBucket: "chessaziz.appspot.com",
    messagingSenderId: "561251204947",
    appId: "1:561251204947:web:6ffdd5f83315093f19aba6"
});
const onlineDialog = document.querySelector('#online-dialog');
const onlineItem = document.querySelector('#online-item');

class OnlineChessGame extends ChessGame {
    constructor(position) {
        super(position);
        let gameId = searchParams.get('game');
        let color = searchParams.get('color');
        this.db = firebase.firestore(app);
        if (!gameId || !color) {
            this.showGamePicker();
        } else {
            // startGame(selectedGame, selectedColor);
            // const snap = this.db.collection("games").doc().get();
        }
    }

    get isActiveColor() { return this.color == this.lastMove.activeColor; }

    showGamePicker() {
        const today = new Date();
        const yesterday = today.setDate(today.getDate() - 1);
        const unsubscribe = this.db.collection("games").where('createdAt', '>', yesterday).onSnapshot((snap) => {
            const menuList = onlineDialog.querySelector('menu ul');
            const children = [];
            const games = [];
            snap.forEach((doc) => games.push({ ...doc.data(), doc, id: doc.id }));
            games.sort((a, b) => a.createdAt - b.createdAt);
            games.forEach(({ doc, id, name }) => {
                const item = onlineItem.content.cloneNode(true);
                item.querySelector('span').textContent = name || id.slice(0, 6).toUpperCase();;
                item.firstElementChild.onclick = ({ target }) => {
                    if (target.dataset.color) {
                        this.startGame(doc, target.dataset.color);
                        onlineDialog.close();
                    }
                }
                children.push(item);
            });
            menuList.replaceChildren(...children);
        })

        onlineDialog.oncancel = e => e.preventDefault();
        onlineDialog.onclose = unsubscribe;
        onlineDialog.showModal();
    }

    createGame() {
        this.db.collection("games").doc().set({
            createdAt: Date.now(),
            name: randomName()
        });
    }

    async startGame(doc, color) {
        this.doc = doc;
        this.color = color;

        flipTable(color);
        this.reset(doc.data().position);

        if (doc.data().moves && doc.data().moves) {
            const res = await showPromptDialog('', "Restart", "Continue");
            if (res == "Restart") {
                await doc.ref.update({ createdAt: Date.now(), moves: null });
            }
        }

        this.doneMoves = [];
        this.unsubscribe = doc.ref.onSnapshot(this.onSnapshot.bind(this));
    }

     async onSnapshot(snap) {
        if (snap.exists) {
            const moves = snap.data()?.moves || [];
            const createdAt = snap.data()?.createdAt;
            if (this.createdAt != createdAt) {
                this.reset(snap.data()?.position);
                this.doneMoves = [];
            }
            for (const i in moves) {
                if (!this.doneMoves[i]) {
                    this.doneMoves[i] = moves[i];
                    await this.receiveMove(this.hydrate(moves[i]));
                }
            }
        } else {
            this.quit();
        }
    }

    quit() {
        super.quit();
        this.unsubscribe();
        this.showGamePicker();
    }

    onDialog(dialog) {
        dialog.hide('#redo-button');
        dialog.disable('#undo-button', !this.isActiveColor || !this.hasHistory);
    }

    dehydrate({ from, to, promoted, enpassant, time, delay }) {
        const res = {
            type: 'move',
            from: from.id,
            to: to.id,
            time, delay,
            checksum: this.toString(),
        };
        if (enpassant) res.enpassant = enpassant.id;
        if (promoted) res.promoted = promoted.id;
        return res;
    }

    dehydrateUndo() {
        return ({
            type: 'undo',
            time: Date.now(),
            checksum: this.toString(),
        })
    }

    hydrate(move) {
        if (move.type == 'undo') {
            return {
                type: 'undo',
                checksum: move.checksum,
            }
        }

        const from = this.board.getSquare(move.from);
        const to = this.board.getSquare(move.to);
        const result = {
            type: 'move',
            from, to,
            piece: from.piece,
            time: Number(move.time),
            delay: Number(move.delay),
            checksum: move.checksum,
        };
        if (move.promoted) result.promoted = new ChessPiece(move.promoted);
        if (move.enpassant) result.enpassant = this.board.getSquare(move.enpassant);
        return result;
    }

    onClick(square) {
        this.board.forEach(square => square.deselect());
        if (!this.isActiveColor) return;
        super.onClick(square);
    }

    sendMove(move) {
        this.doneMoves.push(move);
        this.doc.ref.update({
            moves: FieldValue.arrayUnion(move)
        })
    }

    async receiveMove(move) {
        if (move.type == 'undo') {
            super.undoMove();
        } else {
            await super.doMove(move);
        }
        if (move.checksum != this.toString()) {
            console.error('EXPECTED:', move.checksum, '\n', 'ACTUAL:', this.toString());
        }
        this.board.forEach(square => square.deselect());
        this.lastMove.from?.select();
        this.lastMove.to?.select();
    }

    async doMove(next, keepFuture = false) {
        await super.doMove(next, keepFuture);
        this.sendMove(this.dehydrate(this.lastMove));
    }

    undoMove() {
        if (!this.isActiveColor) return;
        super.undoMove();
        this.sendMove(this.dehydrateUndo());
    }

    redoMove() { }
}

window.GAME = searchParams.get('local') == null ?
    new OnlineChessGame() :
    new ChessGame();
